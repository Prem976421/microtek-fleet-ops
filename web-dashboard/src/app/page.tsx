'use client';
import { useEffect, useState } from 'react';

type TelemetryLog = {
    ambientTemp: number;
    relativeHumidity: number;
    dustIndex: number;
    solarIrradiance: number;
    dcBusRippleVoltage: number;
    dcBusRippleCurrent: number;
    activePower: number;
    reactivePower: number;
    acFrequencyDrift: number;
    insulationResistance: number;
    thd: number;
    mainsSurges: number;
    junctionTemp: number;
    heatsinkTemp: number;
    heatsinkDelta: number;
    mosfetOnResistance: number;
    igbtVgeth: number;
    commandedFanRpm: number;
    actualFanRpm: number;
    smpsOutputVoltage: number;
    capacitorEsr: number;
    conversionEfficiency: number;
    cumulativeThermalStress: number;
    rulVelocity: number;
    timestamp: string;
};

type Inverter = {
    id: string;
    location: string;
    healthState: number;
    telemetry: TelemetryLog[];
    tickets: any[];
};

export default function Dashboard() {
    const [inverters, setInverters] = useState<Inverter[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isSimulating, setIsSimulating] = useState(false);
    const [activeTab, setActiveTab] = useState<'primary' | 'environmental' | 'power' | 'subsystem'>('primary');

    // Polling API
    useEffect(() => {
        const fetchData = async () => {
            const res = await fetch('/api/telemetry');
            if (res.ok) {
                const data = await res.json();
                setInverters(data.inverters);
                if (!selectedId && data.inverters.length > 0) {
                    setSelectedId(data.inverters[0].id);
                }
            }
        };
        fetchData();
        const interval = setInterval(fetchData, 2000);
        return () => clearInterval(interval);
    }, [selectedId]);

    // Causal Physics Simulation Engine
    useEffect(() => {
        let simInterval: NodeJS.Timeout;
        
        // Initial State (Healthy)
        let tick = 0;
        let dustIndex = 10.0;
        let ambientTemp = 35.0;
        let cumulativeThermalStress = 0.0;
        let actualFanRpm = 3000;
        let dcBusRippleVoltage = 5.0;
        let insulationResistance = 10.0;
        let relativeHumidity = 40.0;
        let conversionEfficiency = 98.5;

        if (isSimulating) {
            simInterval = setInterval(async () => {
                tick++;
                
                // CAUSAL PHYSICS:
                // 1. Dust accumulates over time
                dustIndex += Math.random() * 2;
                
                // 2. High dust blocks airflow, reducing fan efficiency
                if (dustIndex > 40) actualFanRpm -= Math.random() * 100;
                
                // 3. Poor airflow causes Ambient and Heatsink Temps to rise
                let heatsinkTemp = ambientTemp + 10 + (3000 - actualFanRpm) / 100;
                if (dustIndex > 60) ambientTemp += Math.random();
                
                let heatsinkDelta = heatsinkTemp - ambientTemp;

                // 4. Heat causes Cumulative Thermal Stress to rise rapidly
                if (heatsinkTemp > 60) {
                    cumulativeThermalStress += (heatsinkTemp - 60) * 0.1;
                }

                // 5. Thermal stress destroys DC Capacitors (Ripple Voltage rises) and drops Efficiency
                dcBusRippleVoltage += cumulativeThermalStress * 0.05;
                conversionEfficiency -= cumulativeThermalStress * 0.02;
                if (conversionEfficiency < 0) conversionEfficiency = 0;

                // 6. Environmental Moisture (Humidity spikes) affect Insulation Resistance
                if (tick > 15) {
                    relativeHumidity += 2.0; // Storm rolls in
                    if (relativeHumidity > 80) {
                        insulationResistance -= Math.random() * 0.5;
                        if (insulationResistance < 0.1) insulationResistance = 0.1;
                    }
                }

                // 7. Calculate RUL Velocity (rate of degradation)
                let rulVelocity = (dcBusRippleVoltage - 5.0) + (10.0 - insulationResistance);

                // Determine State based on parameters
                let state = 'Healthy';
                if (rulVelocity > 5 || relativeHumidity > 75) state = 'Warning';
                if (dcBusRippleVoltage > 12 || insulationResistance < 1.0) state = 'Critical';
                if (dcBusRippleVoltage > 18) state = 'Imminent Failure';

                const payload = {
                    node_id: 'INV_ESP32_001',
                    location: 'Sector 5 - Alpha Unit',
                    health_state: state,
                    
                    ambient_temp: ambientTemp,
                    relative_humidity: relativeHumidity,
                    dust_index: dustIndex,
                    solar_irradiance: 800 + Math.random() * 100,
                    
                    dc_bus_ripple_voltage: dcBusRippleVoltage,
                    dc_bus_ripple_current: dcBusRippleVoltage * 1.5,
                    activePower: 50000 - (100 - conversionEfficiency) * 100,
                    reactivePower: 500 + rulVelocity * 10,
                    ac_frequency_drift: 0.01 * rulVelocity,
                    insulation_resistance: insulationResistance,
                    thd: 2.5 + (dcBusRippleVoltage - 5.0) * 0.2,
                    mains_surges: Math.floor(Math.random() * 2),
                    
                    junction_temp: heatsinkTemp + 15,
                    heatsink_temp: heatsinkTemp,
                    heatsink_delta: heatsinkDelta,
                    mosfet_on_resistance: 5.0 + cumulativeThermalStress * 0.01,
                    igbt_vgeth: 5.5 - cumulativeThermalStress * 0.005,
                    commanded_fan_rpm: 3000,
                    actual_fan_rpm: Math.max(0, actualFanRpm),
                    smps_output_voltage: 24.0 - (rulVelocity * 0.1),
                    capacitor_esr: 10.0 + (dcBusRippleVoltage - 5.0) * 2,
                    
                    conversion_efficiency: conversionEfficiency,
                    cumulative_thermal_stress: cumulativeThermalStress,
                    rul_velocity: rulVelocity
                };
                
                await fetch('/api/telemetry', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (state === 'Imminent Failure' || tick > 45) {
                    setIsSimulating(false);
                }
            }, 1000);
        }
        return () => clearInterval(simInterval);
    }, [isSimulating]);

    const activeNode = inverters.find(i => i.id === selectedId);
    
    // Derived values
    const rulPercentage = activeNode ? Math.max(0, 100 - (activeNode.healthState * 33)) : 100;
    const rulColor = activeNode?.healthState === 0 ? 'bg-accent-green' : 
                     activeNode?.healthState === 1 ? 'bg-accent-yellow' : 'bg-accent-red';

    const latest = activeNode?.telemetry[0];

    return (
        <div className="flex h-screen overflow-hidden text-sm">
            {/* Sidebar */}
            <aside className="w-64 glass-panel m-4 flex flex-col shrink-0">
                <div className="p-4 border-b border-glass-border">
                    <h1 className="text-xl font-bold text-accent-blue tracking-wider">MICROTEK</h1>
                    <p className="text-xs text-gray-400">Enterprise Fleet Ops</p>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {inverters.length === 0 && <p className="text-sm text-gray-400 italic">No nodes detected.</p>}
                    {inverters.map(inv => (
                        <div 
                            key={inv.id} 
                            onClick={() => setSelectedId(inv.id)}
                            className={`p-3 rounded-lg cursor-pointer transition-colors ${selectedId === inv.id ? 'bg-accent-blue/20 border border-accent-blue' : 'hover:bg-white/5 border border-transparent'}`}
                        >
                            <div className="font-semibold">{inv.id}</div>
                            <div className="text-xs text-gray-400 flex items-center justify-between mt-1">
                                <span>{inv.location}</span>
                                <div className={`w-2 h-2 rounded-full ${inv.healthState === 0 ? 'bg-accent-green' : inv.healthState === 1 ? 'bg-accent-yellow' : 'bg-accent-red'}`}></div>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-4 border-t border-glass-border">
                    <button 
                        onClick={() => setIsSimulating(!isSimulating)}
                        className={`w-full py-2 rounded font-bold transition-colors ${isSimulating ? 'bg-accent-red hover:bg-red-600 text-white' : 'bg-accent-blue hover:bg-blue-600 text-white'}`}
                    >
                        {isSimulating ? 'Stop Causal Sim' : 'Start Causal Sim'}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 m-4 ml-0 flex flex-col space-y-4 overflow-hidden">
                {activeNode ? (
                    <>
                        {/* Header & RUL */}
                        <section className="glass-panel p-6 shrink-0">
                            <div className="flex justify-between items-end mb-4">
                                <div>
                                    <h2 className="text-3xl font-bold">{activeNode.id}</h2>
                                    <p className="text-gray-400">{activeNode.location}</p>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm text-gray-400 uppercase tracking-widest mb-1">Remaining Useful Life (RUL)</div>
                                    <div className="text-2xl font-bold">{rulPercentage}%</div>
                                </div>
                            </div>
                            <div className="w-full h-4 bg-gray-800 rounded-full overflow-hidden">
                                <div className={`h-full transition-all duration-1000 ${rulColor}`} style={{ width: `${rulPercentage}%` }}></div>
                            </div>
                        </section>

                        {/* Navigation Tabs */}
                        <div className="flex space-x-2 px-2 shrink-0">
                            {['primary', 'environmental', 'power', 'subsystem'].map(tab => (
                                <button 
                                    key={tab}
                                    onClick={() => setActiveTab(tab as any)}
                                    className={`px-4 py-2 rounded-t-lg font-semibold capitalize transition-colors ${activeTab === tab ? 'bg-glass-panel border-t border-l border-r border-glass-border text-white' : 'bg-black/20 text-gray-400 hover:text-white'}`}
                                >
                                    {tab === 'primary' ? 'Primary Health' : tab}
                                </button>
                            ))}
                        </div>

                        {/* Tab Content */}
                        <div className="flex-1 overflow-y-auto pr-2 pb-2">
                            {activeTab === 'primary' && (
                                <div className="flex flex-col h-full space-y-4">
                                    <section className="grid grid-cols-4 gap-4 shrink-0">
                                        <div className="glass-panel p-4">
                                            <h3 className="text-gray-400 text-xs uppercase">Conversion Eff.</h3>
                                            <div className="text-2xl font-bold my-1">{latest?.conversionEfficiency.toFixed(1) || '0'}%</div>
                                        </div>
                                        <div className="glass-panel p-4">
                                            <h3 className="text-gray-400 text-xs uppercase">DC Ripple (V)</h3>
                                            <div className="text-2xl font-bold my-1">{latest?.dcBusRippleVoltage.toFixed(2) || '0'}</div>
                                        </div>
                                        <div className="glass-panel p-4">
                                            <h3 className="text-gray-400 text-xs uppercase">RUL Velocity</h3>
                                            <div className="text-2xl font-bold my-1">{latest?.rulVelocity.toFixed(2) || '0'}</div>
                                        </div>
                                        <div className="glass-panel p-4">
                                            <h3 className="text-gray-400 text-xs uppercase">Insulation (MΩ)</h3>
                                            <div className="text-2xl font-bold my-1 text-accent-yellow">{latest?.insulationResistance.toFixed(1) || '0'}</div>
                                        </div>
                                    </section>
                                    
                                    {/* Dispatch Terminal */}
                                    <section className="glass-panel flex-1 flex flex-col min-h-[200px]">
                                        <div className="bg-black/40 px-4 py-2 border-b border-glass-border font-mono text-xs text-gray-300">Live Automated Dispatch Terminal</div>
                                        <div className="p-4 font-mono text-sm space-y-2 overflow-y-auto">
                                            {activeNode.tickets.length === 0 ? (
                                                <div className="text-gray-500 italic">No dispatch tickets open.</div>
                                            ) : (
                                                activeNode.tickets.map(ticket => (
                                                    <div key={ticket.id} className="border-l-2 border-accent-red pl-3 bg-red-900/20 p-2 rounded">
                                                        <span className="text-accent-red font-bold">[{ticket.priority}]</span> {ticket.id} 
                                                        <span className="text-gray-400 text-xs ml-2">{new Date(ticket.createdAt).toLocaleTimeString()}</span>
                                                        <div className="text-gray-200 mt-1">{ticket.description}</div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </section>
                                </div>
                            )}

                            {activeTab === 'environmental' && (
                                <section className="grid grid-cols-2 gap-4">
                                    <div className="glass-panel p-5"><h3 className="text-gray-400 uppercase text-xs">Dust Index</h3><div className="text-3xl font-bold mt-2">{latest?.dustIndex.toFixed(1)}</div></div>
                                    <div className="glass-panel p-5"><h3 className="text-gray-400 uppercase text-xs">Relative Humidity</h3><div className="text-3xl font-bold mt-2">{latest?.relativeHumidity.toFixed(1)}%</div></div>
                                    <div className="glass-panel p-5"><h3 className="text-gray-400 uppercase text-xs">Ambient Temp</h3><div className="text-3xl font-bold mt-2">{latest?.ambientTemp.toFixed(1)}°C</div></div>
                                    <div className="glass-panel p-5"><h3 className="text-gray-400 uppercase text-xs">Solar Irradiance</h3><div className="text-3xl font-bold mt-2">{latest?.solarIrradiance.toFixed(0)} W/m²</div></div>
                                </section>
                            )}

                            {activeTab === 'power' && (
                                <section className="grid grid-cols-2 gap-4">
                                    <div className="glass-panel p-5"><h3 className="text-gray-400 uppercase text-xs">THD (Total Harmonic Dist.)</h3><div className="text-3xl font-bold mt-2">{latest?.thd.toFixed(2)}%</div></div>
                                    <div className="glass-panel p-5"><h3 className="text-gray-400 uppercase text-xs">AC Freq Drift</h3><div className="text-3xl font-bold mt-2">{latest?.acFrequencyDrift.toFixed(3)} Hz</div></div>
                                    <div className="glass-panel p-5"><h3 className="text-gray-400 uppercase text-xs">Active Power (P)</h3><div className="text-3xl font-bold mt-2">{latest?.activePower?.toFixed(0)} W</div></div>
                                    <div className="glass-panel p-5"><h3 className="text-gray-400 uppercase text-xs">Reactive Power (Q)</h3><div className="text-3xl font-bold mt-2">{latest?.reactivePower?.toFixed(0)} VAR</div></div>
                                </section>
                            )}

                            {activeTab === 'subsystem' && (
                                <section className="grid grid-cols-2 gap-4">
                                    <div className="glass-panel p-5"><h3 className="text-gray-400 uppercase text-xs">Heatsink Delta (ΔT)</h3><div className="text-3xl font-bold mt-2">{latest?.heatsinkDelta.toFixed(1)}°C</div></div>
                                    <div className="glass-panel p-5"><h3 className="text-gray-400 uppercase text-xs">Fan RPM (Cmd vs Act)</h3><div className="text-3xl font-bold mt-2">{latest?.commandedFanRpm} / <span className="text-accent-red">{latest?.actualFanRpm}</span></div></div>
                                    <div className="glass-panel p-5"><h3 className="text-gray-400 uppercase text-xs">SMPS Aux Voltage</h3><div className="text-3xl font-bold mt-2">{latest?.smpsOutputVoltage.toFixed(2)} V</div></div>
                                    <div className="glass-panel p-5"><h3 className="text-gray-400 uppercase text-xs">MOSFET Rds(on)</h3><div className="text-3xl font-bold mt-2">{latest?.mosfetOnResistance.toFixed(2)} mΩ</div></div>
                                </section>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="glass-panel flex-1 flex items-center justify-center text-gray-500 flex-col">
                        <p>No Inverter Node Selected</p>
                        <p className="text-sm mt-2">Click "Start Causal Sim" to generate test nodes.</p>
                    </div>
                )}
            </main>
        </div>
    );
}
