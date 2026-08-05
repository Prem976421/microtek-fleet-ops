#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <SPIFFS.h>
#include <ArduinoJson.h>

// Mock Edge Impulse Library
#include "edge_impulse.h"

// Networking configurations
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* mqtt_server = "192.168.1.100"; // Local Mosquitto IP
const int mqtt_port = 1883;

WiFiClient espClient;
PubSubClient mqtt_client(espClient);

// FreeRTOS Task Handles
TaskHandle_t TaskNetwork;
TaskHandle_t TaskInference;

// Telemetry structure
struct TelemetryData {
    float dc_bus_ripple_voltage;
    float capacitor_esr;
    float junction_temp;
    float mosfet_on_resistance;
    float conversion_efficiency;
    float heatsink_temp;
    int commanded_fan_rpm;
    int actual_fan_rpm;
    float thd;
    int mains_surges;
};

// Global queue to pass data from Core 1 to Core 0
QueueHandle_t telemetryQueue;

// Mock Modbus Reading function
TelemetryData read_inverter_sensors() {
    TelemetryData data;
    // Simulating Modbus RTU RS485 reads...
    data.dc_bus_ripple_voltage = random(500, 2200) / 100.0;
    data.capacitor_esr = random(1000, 3500) / 100.0;
    data.junction_temp = random(4500, 9500) / 100.0;
    data.mosfet_on_resistance = random(500, 1000) / 100.0;
    data.conversion_efficiency = random(8500, 9850) / 100.0;
    data.heatsink_temp = random(4000, 9000) / 100.0;
    data.commanded_fan_rpm = 3000;
    data.actual_fan_rpm = random(1000, 3000);
    data.thd = random(150, 900) / 100.0;
    data.mains_surges = random(0, 5);
    return data;
}

// Write to SPIFFS if offline
void buffer_data_to_spiffs(String payload) {
    File file = SPIFFS.open("/offline_buffer.txt", FILE_APPEND);
    if (!file) {
        Serial.println("Failed to open file for appending");
        return;
    }
    file.println(payload);
    file.close();
    Serial.println("Buffered data to SPIFFS.");
}

// Sync SPIFFS data to MQTT when online
void sync_offline_buffer() {
    if (!SPIFFS.exists("/offline_buffer.txt")) return;
    
    File file = SPIFFS.open("/offline_buffer.txt", FILE_READ);
    if (!file) return;

    Serial.println("Syncing offline buffer to cloud...");
    while (file.available()) {
        String payload = file.readStringUntil('\n');
        if (payload.length() > 0) {
            mqtt_client.publish("microtek/inverter/telemetry", payload.c_str());
            delay(10); // Prevent flooding
        }
    }
    file.close();
    SPIFFS.remove("/offline_buffer.txt");
    Serial.println("Offline buffer synced and cleared.");
}

// ---------------------------------------------------------
// CORE 0: Network & Cloud Task
// ---------------------------------------------------------
void network_task(void * parameter) {
    // Connect Wi-Fi
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
        vTaskDelay(1000 / portTICK_PERIOD_MS);
    }
    Serial.println("Connected to Wi-Fi");

    mqtt_client.setServer(mqtt_server, mqtt_port);

    while(true) {
        if (!mqtt_client.connected()) {
            if (mqtt_client.connect("ESP32_Inverter_Node")) {
                Serial.println("Connected to MQTT Broker");
                sync_offline_buffer();
            }
        }
        if (mqtt_client.connected()) {
            mqtt_client.loop();
        }

        // Check if inference task sent any data to the queue
        String payload;
        if (xQueueReceive(telemetryQueue, &payload, 0) == pdPASS) {
            if (mqtt_client.connected()) {
                mqtt_client.publish("microtek/inverter/telemetry", payload.c_str());
                Serial.println("Published to MQTT");
            } else {
                buffer_data_to_spiffs(payload);
            }
        }
        vTaskDelay(10 / portTICK_PERIOD_MS);
    }
}

// Helper wrapper for Edge Impulse signature
float features[EI_CLASSIFIER_DSP_INPUT_FRAME_SIZE];
int get_feature_data(size_t offset, size_t length, float *out_ptr) {
    memcpy(out_ptr, features + offset, length * sizeof(float));
    return 0;
}

// ---------------------------------------------------------
// CORE 1: Inference & Sensor Sampling Task
// ---------------------------------------------------------
void inference_task(void * parameter) {
    while(true) {
        // 1. Read Sensors
        TelemetryData currentData = read_inverter_sensors();

        // 2. Prepare Array for TinyML model
        features[0] = currentData.dc_bus_ripple_voltage;
        features[1] = currentData.capacitor_esr;
        features[2] = currentData.junction_temp;
        features[3] = currentData.mosfet_on_resistance;
        features[4] = currentData.conversion_efficiency;
        features[5] = currentData.heatsink_temp;
        features[6] = currentData.commanded_fan_rpm;
        features[7] = currentData.actual_fan_rpm;
        features[8] = currentData.thd;
        features[9] = currentData.mains_surges;

        // 3. Run Inference
        signal_t signal;
        signal.get_data = &get_feature_data;
        ei_impulse_result_t result;
        
        run_classifier(&signal, &result, false);

        // Find highest probability state
        float max_prob = 0.0;
        int max_index = 0;
        for (int ix = 0; ix < EI_CLASSIFIER_LABEL_COUNT; ix++) {
            if (result.classification[ix] > max_prob) {
                max_prob = result.classification[ix];
                max_index = ix;
            }
        }

        const char* health_status = ei_classifier_inferencing_categories[max_index];
        Serial.printf("Predicted Health State: %s (Prob: %.2f)\n", health_status, max_prob);

        // 4. Emergency Trip if Imminent Failure
        if (strcmp(health_status, "Imminent Failure") == 0) {
            Serial.println("EMERGENCY TRIP TRIGGERED! Disconnecting Inverter Load.");
            // e.g. digitalWrite(RELAY_PIN, HIGH);
        }

        // 5. Build JSON Payload
        StaticJsonDocument<256> doc;
        doc["node_id"] = "INV_ESP32_001";
        doc["health_state"] = health_status;
        doc["dc_ripple"] = currentData.dc_bus_ripple_voltage;
        doc["j_temp"] = currentData.junction_temp;
        
        String jsonPayload;
        serializeJson(doc, jsonPayload);

        // 6. Send to Core 0 for publishing
        xQueueSend(telemetryQueue, &jsonPayload, portMAX_DELAY);

        // Run this task every 5 seconds
        vTaskDelay(5000 / portTICK_PERIOD_MS);
    }
}

void setup() {
    Serial.begin(115200);
    
    // Initialize SPIFFS
    if (!SPIFFS.begin(true)) {
        Serial.println("An Error has occurred while mounting SPIFFS");
        return;
    }

    // Create Queue for Inter-Task Communication (size 10)
    telemetryQueue = xQueueCreate(10, sizeof(String));

    // Pin task to Core 0 (Networking)
    xTaskCreatePinnedToCore(
        network_task,      // Task function
        "NetworkTask",     // Name of task
        10000,             // Stack size
        NULL,              // Parameter
        1,                 // Priority
        &TaskNetwork,      // Task handle
        0                  // Core ID
    );                  

    // Pin task to Core 1 (Sensors & ML)
    xTaskCreatePinnedToCore(
        inference_task,    // Task function
        "InferenceTask",   // Name of task
        10000,             // Stack size
        NULL,              // Parameter
        1,                 // Priority
        &TaskInference,    // Task handle
        1                  // Core ID
    );
}

void loop() {
    // FreeRTOS is running tasks, nothing to do here.
    vTaskDelete(NULL);
}
