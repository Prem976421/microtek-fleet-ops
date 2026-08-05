'use client';
import { useEffect, useState } from 'react';

type Inverter = {
    id: string;
    location: string;
    healthState: number;
    telemetry: any[];
    tickets: any[];
};

export default function Dashboard() {
    const [inverters, setInverters] = useState<Inverter[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isSimulating, setIsSimulating] = useState(false);

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

    // Simulating Data Push to API
    useEffect(() => {
        let simInterval: NodeJS.Timeout;
        let tick = 0;
        if (isSimulating) {
            simInterval = setInterval(async () => {
                tick++;
                
                // Determine simulated state
                let state = 'Healthy';
                if (tick > 10 && tick <= 20) state = 'Warning';
                if (tick > 20) state = 'Critical';
                if (tick > 30) state = 'Imminent Failure';

                const payload = {
                    node_id: 'INV_ESP32_001',
                    location: 'Sector 5 - Alpha Unit',
                    health_state: state,
                    dc_bus_ripple_voltage: state === 'Healthy' ? 5.5 + Math.random() : state === 'Warning' ? 8.5 : 15.0 + Math.random(),
                    heatsink_temp: state === 'Healthy' ? 45.0 + Math.random() : state === 'Warning' ? 55.0 : 75.0,
                    actual_fan_rpm: state === 'Healthy' ? 2500 - Math.random()*50 : 2000,
                    thd: state === 'Healthy' ? 2.5 : 5.5,
                };
                
                await fetch('/api/telemetry', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (tick > 35) {
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

    return (
        <div className="flex h-screen overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 glass-panel m-4 flex flex-col">
                <div className="p-4 border-b border-glass-border">
                    <h1 className="text-xl font-bold text-accent-blue tracking-wider">MICROTEK</h1>
                    <p className="text-xs text-gray-400">Fleet Operations</p>
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
                        {isSimulating ? 'Stop Simulation' : 'Start Simulation'}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 m-4 ml-0 flex flex-col space-y-4 overflow-y-auto">
                {activeNode ? (
                    <>
                        {/* Header & RUL */}
                        <section className="glass-panel p-6">
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

                        {/* Sparklines Grid */}
                        <section className="grid grid-cols-2 gap-4">
                            {/* Card 1 */}
                            <div className="glass-panel p-5">
                                <h3 className="text-gray-400 text-sm font-semibold uppercase">DC Bus Ripple (V)</h3>
                                <div className="text-4xl font-bold my-2">
                                    {activeNode.telemetry[0]?.dcBusRippleVoltage.toFixed(2) || '0.00'}
                                </div>
                            </div>
                            {/* Card 2 */}
                            <div className="glass-panel p-5">
                                <h3 className="text-gray-400 text-sm font-semibold uppercase">Heatsink Temp (°C)</h3>
                                <div className="text-4xl font-bold my-2">
                                    {activeNode.telemetry[0]?.heatsinkTemp.toFixed(1) || '0.0'}
                                </div>
                            </div>
                            {/* Card 3 */}
                            <div className="glass-panel p-5">
                                <h3 className="text-gray-400 text-sm font-semibold uppercase">Fan RPM</h3>
                                <div className="text-4xl font-bold my-2">
                                    {activeNode.telemetry[0]?.actualFanRpm || '0'}
                                </div>
                            </div>
                            {/* Card 4 */}
                            <div className="glass-panel p-5">
                                <h3 className="text-gray-400 text-sm font-semibold uppercase">THD (%)</h3>
                                <div className="text-4xl font-bold my-2">
                                    {activeNode.telemetry[0]?.thd.toFixed(2) || '0.00'}
                                </div>
                            </div>
                        </section>

                        {/* Dispatch Terminal */}
                        <section className="glass-panel flex-1 flex flex-col overflow-hidden min-h-[250px]">
                            <div className="bg-black/40 px-4 py-2 border-b border-glass-border">
                                <span className="font-mono text-sm text-gray-300">Live Automated Dispatch Terminal</span>
                            </div>
                            <div className="p-4 font-mono text-sm space-y-2 overflow-y-auto flex-1">
                                {activeNode.tickets.length === 0 ? (
                                    <div className="text-gray-500 italic">No dispatch tickets open.</div>
                                ) : (
                                    activeNode.tickets.map(ticket => (
                                        <div key={ticket.id} className="border-l-2 border-accent-red pl-3 bg-red-900/20 p-2 rounded">
                                            <span className="text-accent-red font-bold">[{ticket.priority}]</span> {ticket.id} 
                                            <span className="text-gray-400 text-xs ml-2">{new Date(ticket.createdAt).toLocaleTimeString()}</span>
                                            <div className="text-gray-200 mt-1">{ticket.description}</div>
                                            <div className="text-accent-yellow mt-1 text-xs">→ Webhook Fired: Customer SMS Sent. Technician Auto-Routed.</div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>
                    </>
                ) : (
                    <div className="glass-panel flex-1 flex items-center justify-center text-gray-500 flex-col">
                        <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                        <p>No Inverter Node Selected</p>
                        <p className="text-sm mt-2">Click "Start Simulation" to generate test nodes.</p>
                    </div>
                )}
            </main>
        </div>
    );
}
