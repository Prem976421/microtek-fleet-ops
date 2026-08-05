'use client';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { evaluateMetric } from '@/lib/thresholds';

const fetcher = async (url: string) => {
    const t0 = performance.now();
    const res = await fetch(url);
    if (!res.ok) throw new Error('Fetch failed');
    const data = await res.json();
    data._pollMs = Math.round(performance.now() - t0);
    return data;
};

// =========================================================================
// TYPES
// =========================================================================
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
    locality: string;
    firmwareVersion: string;
    signalStrength: number;
    gridVoltageBaseline: number;
    healthState: number;
    lastSeen: string;
    telemetry: TelemetryLog[];
    tickets: { id: string; description: string; priority: string; status: string; createdAt: string }[];
};

// =========================================================================
// CONSTANTS
// =========================================================================
const LOCALITIES = [
    'All Localities',
    'Zone A: Northern Industrial Estate',
    'Zone B: Western Solar Corridor',
    'Zone C: Rural Grid Sector 4',
    'Zone D: Urban Commercial Ops',
];

const HEALTH_LABELS: Record<number, { label: string; color: string }> = {
    0: { label: 'NOMINAL', color: 'text-green-400' },
    1: { label: 'WARNING', color: 'text-amber-400' },
    2: { label: 'CRITICAL', color: 'text-red-400' },
    3: { label: 'IMMINENT FAILURE', color: 'text-red-600' },
};

// =========================================================================
// METRIC CARD COMPONENT
// =========================================================================
function MetricCard({
    title, metricKey, value, unit,
}: {
    title: string; metricKey: string; value: number; unit: string;
}) {
    const { state, percentage, color } = evaluateMetric(metricKey, value);

    const precision =
        metricKey === 'acFreqDrift' ? 3 :
        metricKey.includes('Power') || metricKey.includes('Rpm') || metricKey === 'solarIrradiance' ? 0 : 1;

    return (
        <div className="metric-card relative pb-6 flex flex-col justify-between overflow-hidden">
            <div className="flex justify-between items-start mb-2">
                <div className="metric-label">{title}</div>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold tracking-widest text-black ${color}`}>
                    {state}
                </span>
            </div>
            <div className="metric-value">
                {value.toFixed(precision)}
                <span className="text-xs text-gray-500 ml-1">{unit}</span>
            </div>
            {/* Range bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/5 overflow-hidden rounded-b">
                <div
                    className={`h-full transition-all duration-300 ${color}`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
}

// =========================================================================
// STATUS DOT HELPER
// =========================================================================
function StatusDot({ state }: { state?: number }) {
    const cls =
        state === 0 ? 'bg-green-400' :
        state === 1 ? 'bg-amber-400 animate-pulse' :
        'bg-red-500 animate-pulse';
    return <span className={`inline-block w-2 h-2 rounded-full ${cls}`} />;
}

// =========================================================================
// MAIN DASHBOARD
// =========================================================================
export default function Dashboard() {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedLocality, setSelectedLocality] = useState('All Localities');

    const { data } = useSWR(`/api/fleet${selectedId ? `?nodeId=${selectedId}` : ''}`, fetcher, {
        refreshInterval: 500,
        dedupeInterval: 400,
        revalidateOnFocus: false
    });

    const fleetStatus: any[] = data?.fleetStatus || [];
    const activeNode: Inverter | null = data?.activeNode || null;
    const globalTickets: any[] = data?.globalTickets || [];
    const pollMs = data?._pollMs || 0;
    const lastUpdated = data ? new Date() : null;

    useEffect(() => {
        if (!selectedId && fleetStatus.length > 0) {
            setSelectedId(fleetStatus[0].id);
        }
    }, [fleetStatus, selectedId]);

    // =========================================================================
    // DERIVED STATE
    // =========================================================================
    const latest = activeNode?.telemetry?.[0];
    const rulPct = activeNode ? Math.max(0, 100 - activeNode.healthState * 33) : 100;
    const rulColor = activeNode?.healthState === 0 ? 'bg-green-500' : activeNode?.healthState === 1 ? 'bg-amber-500' : 'bg-red-500';
    const healthInfo = HEALTH_LABELS[activeNode?.healthState ?? 0] ?? HEALTH_LABELS[0];

    const filtered = fleetStatus.filter(inv => {
        const matchSearch = inv.id.toLowerCase().includes(searchTerm.toLowerCase());
        const matchLocale = selectedLocality === 'All Localities' || inv.locality === selectedLocality;
        return matchSearch && matchLocale;
    });

    return (
        <div className="flex h-full overflow-hidden text-sm">
            {/* ======================== SIDEBAR ======================== */}
            <aside className="w-72 glass-panel m-4 flex flex-col shrink-0">
                {/* Sidebar header with live pulse */}
                <div className="p-4 border-b border-glass-border space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs uppercase tracking-widest text-gray-400">
                            Fleet Nodes <span className="text-gray-600">({filtered.length})</span>
                        </span>
                        <div className="flex items-center gap-1.5">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                            </span>
                            <span className="text-[10px] font-mono text-green-400">
                                {lastUpdated ? lastUpdated.toLocaleTimeString() : '—'}
                            </span>
                            {pollMs > 0 && (
                                <span className="text-[9px] font-mono text-gray-600 ml-1">{pollMs}ms</span>
                            )}
                        </div>
                    </div>

                    <input
                        type="text"
                        placeholder="Search Node ID…"
                        className="w-full bg-black/30 border border-glass-border rounded px-3 py-2 text-xs text-gray-200 outline-none focus:border-blue-500 transition-colors"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                    <select
                        className="w-full bg-black/30 border border-glass-border rounded px-3 py-2 text-xs text-gray-200 outline-none focus:border-blue-500 transition-colors"
                        value={selectedLocality}
                        onChange={e => setSelectedLocality(e.target.value)}
                    >
                        {LOCALITIES.map(loc => (
                            <option key={loc} value={loc} className="bg-[#06080F]">{loc}</option>
                        ))}
                    </select>
                </div>

                {/* Node list */}
                <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                    {filtered.length === 0 && (
                        <p className="text-xs text-gray-500 italic p-2">No nodes match filter.</p>
                    )}
                    {filtered.map(inv => (
                        <div
                            key={inv.id}
                            onClick={() => setSelectedId(inv.id)}
                            className={`node-item flex items-center justify-between ${selectedId === inv.id ? 'active' : ''}`}
                        >
                            <div>
                                <div className="font-semibold text-xs">{inv.id}</div>
                                <div className="text-[10px] text-gray-500 mt-0.5">{inv.locality.split(':')[0]}</div>
                            </div>
                            <StatusDot state={inv.healthState} />
                        </div>
                    ))}
                </div>
            </aside>

            {/* ======================== MAIN PANEL ======================== */}
            <main className="flex-1 m-4 ml-0 flex flex-col overflow-y-auto pr-1 pb-4 space-y-4">
                {activeNode && latest ? (
                    <>
                        {/* ---- Node header ---- */}
                        <section className="glass-panel p-4 flex items-start justify-between">
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <h2 className="text-2xl font-bold tracking-wide">{activeNode.id}</h2>
                                    <StatusDot state={activeNode.healthState} />
                                    <span className={`text-xs font-bold ${healthInfo.color}`}>{healthInfo.label}</span>
                                </div>
                                <p className="text-gray-400 text-xs">{activeNode.locality}</p>
                            </div>
                            <div className="flex gap-6 text-xs text-right">
                                {[
                                    { label: 'Firmware', val: activeNode.firmwareVersion },
                                    { label: 'Signal', val: `${activeNode.signalStrength} dBm` },
                                    { label: 'Grid Baseline', val: `${activeNode.gridVoltageBaseline.toFixed(1)} V` },
                                    { label: 'Last Seen', val: new Date(activeNode.lastSeen).toLocaleTimeString() },
                                ].map(m => (
                                    <div key={m.label}>
                                        <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">{m.label}</div>
                                        <div className="text-gray-200 font-mono">{m.val}</div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* ---- RUL health bar ---- */}
                        <div className="glass-panel px-4 py-3 flex items-center gap-4">
                            <span className="text-xs text-gray-400 uppercase tracking-widest shrink-0">RUL Estimate</span>
                            <div className="flex-1 h-2 bg-white/5 rounded overflow-hidden">
                                <div className={`h-full rounded transition-all duration-500 ${rulColor}`} style={{ width: `${rulPct}%` }} />
                            </div>
                            <span className={`text-xs font-bold ${healthInfo.color}`}>{rulPct}%</span>
                        </div>

                        {/* ---- Primary Health ---- */}
                        <section className="glass-panel p-4">
                            <div className="section-header"><span className="status-dot green" /><h2>Primary Health Metrics</h2></div>
                            <div className="grid grid-cols-4 gap-3">
                                <MetricCard title="Conversion Efficiency" metricKey="conversionEfficiency" value={latest.conversionEfficiency} unit="%" />
                                <MetricCard title="DC Bus Ripple" metricKey="dcRipple" value={latest.dcBusRippleVoltage} unit="V" />
                                <MetricCard title="RUL Velocity" metricKey="rulVelocity" value={latest.rulVelocity} unit="" />
                                <MetricCard title="Insulation" metricKey="insulation" value={latest.insulationResistance} unit="MΩ" />
                            </div>
                        </section>

                        {/* ---- Environmental ---- */}
                        <section className="glass-panel p-4">
                            <div className="section-header"><span className="status-dot green" /><h2>Environmental Parameters</h2></div>
                            <div className="grid grid-cols-4 gap-3">
                                <MetricCard title="Ambient Temp" metricKey="ambientTemp" value={latest.ambientTemp} unit="°C" />
                                <MetricCard title="Relative Humidity" metricKey="relativeHumidity" value={latest.relativeHumidity} unit="%" />
                                <MetricCard title="Dust Index" metricKey="dustIndex" value={latest.dustIndex} unit="" />
                                <MetricCard title="Solar Irradiance" metricKey="solarIrradiance" value={latest.solarIrradiance} unit="W/m²" />
                            </div>
                        </section>

                        {/* ---- Power Grid ---- */}
                        <section className="glass-panel p-4">
                            <div className="section-header"><span className="status-dot blue" /><h2>Power Grid Telemetry</h2></div>
                            <div className="grid grid-cols-4 gap-3">
                                <MetricCard title="Active Power" metricKey="activePower" value={latest.activePower} unit="W" />
                                <MetricCard title="Reactive Power" metricKey="reactivePower" value={latest.reactivePower} unit="VAR" />
                                <MetricCard title="THD" metricKey="thd" value={latest.thd} unit="%" />
                                <MetricCard title="AC Freq Drift" metricKey="acFreqDrift" value={latest.acFrequencyDrift} unit="Hz" />
                            </div>
                        </section>

                        {/* ---- Subsystems ---- */}
                        <section className="glass-panel p-4">
                            <div className="section-header"><span className="status-dot purple" /><h2>Subsystem Diagnostics</h2></div>
                            <div className="grid grid-cols-4 gap-3">
                                <MetricCard title="Heatsink ΔT" metricKey="heatsinkDeltaT" value={latest.heatsinkDelta} unit="°C" />
                                <MetricCard title="Fan RPM Delta" metricKey="fanRpmDelta" value={Math.abs(latest.commandedFanRpm - latest.actualFanRpm)} unit="RPM" />
                                <MetricCard title="SMPS Output" metricKey="smpsOutputVoltage" value={latest.smpsOutputVoltage} unit="V" />
                                <MetricCard title="MOSFET Rds(on)" metricKey="mosfetOnResistance" value={latest.mosfetOnResistance} unit="mΩ" />
                            </div>
                        </section>

                        {/* ---- Dispatch Terminal ---- */}
                        <section className="glass-panel flex flex-col min-h-[180px]">
                            <div className="bg-black/40 px-4 py-2 border-b border-glass-border font-mono text-xs text-gray-400 flex items-center justify-between">
                                <span>Live Automated Dispatch Terminal (Global Feed)</span>
                                <span className="text-[10px] text-gray-600">{globalTickets.length} recent events</span>
                            </div>
                            <div className="p-4 font-mono text-xs space-y-2 overflow-y-auto flex-1">
                                {globalTickets.length === 0 ? (
                                    <div className="text-gray-600 italic">No recent dispatch events.</div>
                                ) : (
                                    globalTickets.map(ticket => (
                                        <div key={ticket.id} className="ticket-entry mb-3 border-l-2 border-white/10 pl-2">
                                            <span className={`font-bold ${ticket.status === 'CLOSED' ? 'text-green-500' : ticket.priority === 'CRITICAL' ? 'text-red-400' : 'text-amber-400'}`}>
                                                [{ticket.status === 'CLOSED' ? 'RESOLVED' : ticket.priority}]
                                            </span>{' '}
                                            <span className="text-gray-400">Node: {ticket.inverterId}</span>
                                            <span className="text-gray-600 ml-2 text-[10px]">{new Date(ticket.createdAt).toLocaleTimeString()}</span>
                                            <div className="text-gray-300 mt-1 leading-relaxed whitespace-pre-wrap">{ticket.description}</div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-600 gap-3">
                        <div className="text-4xl">📡</div>
                        <p className="text-sm">{fleetStatus.length === 0 ? 'Connecting to SCADA backend…' : 'Select a node from the sidebar.'}</p>
                    </div>
                )}
            </main>
        </div>
    );
}
