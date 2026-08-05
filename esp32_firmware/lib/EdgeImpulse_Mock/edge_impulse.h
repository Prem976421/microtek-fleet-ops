#ifndef EDGE_IMPULSE_MOCK_H
#define EDGE_IMPULSE_MOCK_H

#include <Arduino.h>

// Mock definitions for Edge Impulse TinyML Library
#define EI_CLASSIFIER_DSP_INPUT_FRAME_SIZE 10 // Our 10 telemetry features
#define EI_CLASSIFIER_LABEL_COUNT 4

extern const char* ei_classifier_inferencing_categories[EI_CLASSIFIER_LABEL_COUNT];

typedef struct {
    float classification[EI_CLASSIFIER_LABEL_COUNT];
    float value;
    uint32_t time_ms;
} ei_impulse_result_t;

typedef struct {
    int (*get_data)(size_t offset, size_t length, float *out_ptr);
} signal_t;

// Mock function to simulate ML inference
inline int run_classifier(signal_t *signal, ei_impulse_result_t *result, bool debug = false) {
    // In a real scenario, this runs the neural network.
    // For our mock, we just generate dummy probabilities.
    float input_buffer[EI_CLASSIFIER_DSP_INPUT_FRAME_SIZE];
    signal->get_data(0, EI_CLASSIFIER_DSP_INPUT_FRAME_SIZE, input_buffer);
    
    // Simple mock logic: if DC ripple (index 0) > 10, predict state 2.
    // if DC ripple > 18, predict state 3.
    // Otherwise state 0 or 1.
    float dc_ripple = input_buffer[0];
    
    for (int i=0; i<EI_CLASSIFIER_LABEL_COUNT; i++) {
        result->classification[i] = 0.0f;
    }

    if (dc_ripple > 18.0f) {
        result->classification[3] = 0.95f; // Imminent Failure
    } else if (dc_ripple > 10.0f) {
        result->classification[2] = 0.88f; // Critical
    } else if (dc_ripple > 6.0f) {
        result->classification[1] = 0.75f; // Warning
    } else {
        result->classification[0] = 0.99f; // Healthy
    }
    
    result->time_ms = 15; // Mock inference time
    return 0; // 0 means success in EI
}

const char* ei_classifier_inferencing_categories[] = { "Healthy", "Warning", "Critical", "Imminent Failure" };

#endif // EDGE_IMPULSE_MOCK_H
