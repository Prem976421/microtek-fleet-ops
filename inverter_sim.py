import csv
import random
import time
import os

# Configuration
NUM_SAMPLES_PER_STATE = 1000
OUTPUT_FILE = "inverter_telemetry_dataset.csv"

# Telemetry features:
# 1. dc_bus_ripple_voltage (V)
# 2. capacitor_esr (mOhm)
# 3. junction_temp (C)
# 4. mosfet_on_resistance (mOhm)
# 5. conversion_efficiency (%)
# 6. heatsink_temp (C)
# 7. commanded_fan_rpm (RPM)
# 8. actual_fan_rpm (RPM)
# 9. thd (%)
# 10. mains_surges (Count)
# 11. state (0: Healthy, 1: Warning, 2: Critical, 3: Imminent Failure)

def generate_noise(base, variance):
    return base + random.uniform(-variance, variance)

def generate_state_data(state, num_samples):
    data = []
    for _ in range(num_samples):
        # Base values depend on state
        if state == 0: # Healthy (100% - 85%)
            dc_bus_ripple = generate_noise(5.0, 0.5)
            esr = generate_noise(10.0, 1.0)
            junction_temp = generate_noise(45.0, 2.0)
            on_res = generate_noise(5.0, 0.2)
            efficiency = generate_noise(98.5, 0.3)
            heatsink_temp = generate_noise(40.0, 2.0)
            cmd_rpm = random.choice([1500, 2000, 2500])
            act_rpm = generate_noise(cmd_rpm, 50)
            thd = generate_noise(1.5, 0.2)
            surges = random.randint(0, 1)
            
        elif state == 1: # Warning (84% - 50%)
            dc_bus_ripple = generate_noise(7.5, 1.0)
            esr = generate_noise(14.0, 2.0)
            junction_temp = generate_noise(55.0, 3.0)
            on_res = generate_noise(5.8, 0.3)
            efficiency = generate_noise(96.0, 0.8)
            heatsink_temp = generate_noise(52.0, 3.0)
            cmd_rpm = random.choice([2000, 2500, 3000])
            act_rpm = generate_noise(cmd_rpm - 200, 100) # Fan lagging
            thd = generate_noise(3.0, 0.5)
            surges = random.randint(0, 3)

        elif state == 2: # Critical (49% - 15%)
            dc_bus_ripple = generate_noise(12.0, 2.0)
            esr = generate_noise(22.0, 3.0)
            junction_temp = generate_noise(75.0, 5.0)
            on_res = generate_noise(7.5, 0.5)
            efficiency = generate_noise(92.0, 1.5)
            heatsink_temp = generate_noise(70.0, 4.0)
            cmd_rpm = 3500
            act_rpm = generate_noise(cmd_rpm - 800, 200) # Severe fan lag
            thd = generate_noise(5.5, 1.0)
            surges = random.randint(2, 6)

        elif state == 3: # Imminent Failure (< 15%)
            dc_bus_ripple = generate_noise(20.0, 4.0)
            esr = generate_noise(35.0, 5.0)
            junction_temp = generate_noise(95.0, 8.0)
            on_res = generate_noise(10.0, 1.0)
            efficiency = generate_noise(85.0, 3.0)
            heatsink_temp = generate_noise(90.0, 5.0)
            cmd_rpm = 4000
            act_rpm = generate_noise(cmd_rpm - 2000, 500) # Fan failing
            thd = generate_noise(9.0, 2.0)
            surges = random.randint(5, 10)

        # Clip values to realistic bounds
        efficiency = min(100.0, efficiency)
        act_rpm = max(0, act_rpm)
        
        row = [
            round(dc_bus_ripple, 2),
            round(esr, 2),
            round(junction_temp, 2),
            round(on_res, 2),
            round(efficiency, 2),
            round(heatsink_temp, 2),
            int(cmd_rpm),
            int(act_rpm),
            round(thd, 2),
            int(surges),
            state
        ]
        data.append(row)
    return data

def main():
    print("Starting Synthetic Data Generation for Inverter Predictive Maintenance...")
    
    headers = [
        "dc_bus_ripple_voltage_V", 
        "capacitor_esr_mOhm", 
        "junction_temp_C", 
        "mosfet_on_resistance_mOhm", 
        "conversion_efficiency_pct", 
        "heatsink_temp_C", 
        "command_fan_rpm", 
        "actual_fan_rpm", 
        "thd_pct", 
        "mains_surges_count", 
        "health_state"
    ]
    
    dataset = []
    for state in [0, 1, 2, 3]:
        print(f"Generating data for State {state}...")
        dataset.extend(generate_state_data(state, NUM_SAMPLES_PER_STATE))
        
    # Shuffle dataset
    random.shuffle(dataset)
    
    print(f"Writing {len(dataset)} samples to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, mode='w', newline='') as file:
        writer = csv.writer(file)
        writer.writerow(headers)
        writer.writerows(dataset)
        
    print(f"Dataset generated successfully at: {os.path.abspath(OUTPUT_FILE)}")

if __name__ == "__main__":
    main()
