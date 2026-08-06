'use client';
import { useState } from 'react';
import useSWR from 'swr';
import {
    PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend,
    ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Label,
    AreaChart, Area, LineChart, Line
} from 'recharts';

// =========================================================================
// TYPES
// =========================================================================
type Timeseries = { timestamp: number; power: number; capacity: number };
type Ticket = {
    id: string; inverterId: string; description: string;
    priority: string; status: string; createdAt: string;
    inverter: { locality: string; zone: string };
};
type Inverter = {
    id: string; locality: string; zone: string; healthState: number;
    telemetry: {
        rulVelocity: number;
        cumulativeThermalStress: number;
        conversionEfficiency: number;
        ambientTemp: number;
    }[];
};

const HEALTH_COLORS: Record<string, string> = {
    Nominal: '#10b981', Warning: '#f59e0b', Critical: '#ef4444', 'Standby/Offline': '#64748b',
};

const TOOLTIP_STYLE = {
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    border: '1px solid #1e293b',
    borderRadius: '8px',
    backdropFilter: 'blur(6px)',
    color: '#e2e8f0',
};

const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.04) return null;
    const r = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + r * Math.cos(-midAngle * (Math.PI / 180));
    const y = cy + r * Math.sin(-midAngle * (Math.PI / 180));
    return (
        <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
            {`${(percent * 100).toFixed(0)}%`}
        </text>
    );
};

const fetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Fetch failed');
    return res.json();
};

export default function AnalyticsDashboard() {
    const [searchCity, setSearchCity] = useState('');

    const { data } = useSWR('/api/analytics', fetcher, {
        refreshInterval: 500,
        dedupeInterval: 400,
        revalidateOnFocus: false
    });

    const timeseries = data?.timeseries || [];
    const tickets = data?.globalTickets || [];
    const kpis = data?.kpis || { totalDeployed: 0, nominalCount: 0, healthRate: '0.0', avgRul: 0, mtbfEst: 0 };
    const healthData = data?.healthDistribution || [];
    const heatmapCounts = data?.geographicHeatmap || [];
    const degrading = data?.degradingNodes || [];

    // Module 1: Geographic Heatmap
    const filteredCities = [
        { name: 'Nagpur', coords: 'top-[30%] left-[20%]' },
        { name: 'Chandrapur', coords: 'top-[60%] left-[40%]' },
        { name: 'Umred', coords: 'top-[50%] left-[50%]' }
    ].filter(c => c.name.toLowerCase().includes(searchCity.toLowerCase()));

    return (
        <div className="flex flex-col flex-1 p-6 overflow-y-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-100">Regional & Fleet Analytics</h1>
                <p className="text-gray-400 text-sm mt-1">Aggregated insights across all deployed localities · Auto-refreshing</p>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-4 gap-4">
                {[
                    { label: 'Total Deployed', value: `${kpis.totalDeployed}`, unit: 'Units', color: 'text-blue-400' },
                    { label: 'Operational Health Rate', value: `${kpis.healthRate}%`, unit: 'Nominal', color: 'text-green-400' },
                    { label: 'Avg Fleet RUL', value: `${kpis.avgRul.toFixed(1)}%`, unit: '', color: 'text-purple-400' },
                    { label: 'Estimated MTBF', value: `${kpis.mtbfEst}`, unit: 'Hours', color: 'text-teal-400' },
                ].map(kpi => (
                    <div key={kpi.label} className="glass-panel p-4 flex flex-col justify-center">
                        <div className="text-xs text-gray-400 uppercase tracking-widest mb-2">{kpi.label}</div>
                        <div className={`text-3xl font-bold ${kpi.color}`}>
                            {kpi.value} <span className="text-sm font-normal text-gray-500">{kpi.unit}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Row 1: Geographic Heatmap (Mod 1) & Pie Chart */}
            <div className="grid grid-cols-3 gap-6">
                <div className="glass-panel p-5 col-span-1 flex flex-col" style={{ minHeight: '340px' }}>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xs text-gray-400 uppercase tracking-widest">Geographic Heatmap</h3>
                        <input 
                            type="text" 
                            placeholder="Search City..." 
                            className="bg-black/40 border border-white/10 rounded px-2 py-1 text-xs outline-none focus:border-blue-500 w-28 text-gray-200"
                            value={searchCity}
                            onChange={(e) => setSearchCity(e.target.value)}
                        />
                    </div>
                    <div className="flex-1 relative bg-black/20 rounded border border-white/5 overflow-hidden">
                        {/* Background generic abstract grid/map */}
                        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '20px 20px' }}></div>
                        
                        {filteredCities.map(city => {
                            const cityCounts = heatmapCounts.filter((c: any) => c.locality.includes(city.name));
                            const critical = cityCounts.filter((c: any) => c.healthState >= 2).reduce((acc: number, cur: any) => acc + cur._count.id, 0);
                            const warning = cityCounts.filter((c: any) => c.healthState === 1).reduce((acc: number, cur: any) => acc + cur._count.id, 0);
                            const nominal = cityCounts.filter((c: any) => c.healthState === 0).reduce((acc: number, cur: any) => acc + cur._count.id, 0);
                            const total = critical + warning + nominal;
                            
                            let markerColor = 'bg-gray-600';
                            let pulse = '';
                            if (critical > 0) { markerColor = 'bg-red-500'; pulse = 'animate-ping'; }
                            else if (warning > 0) { markerColor = 'bg-amber-400'; pulse = 'animate-pulse'; }
                            else if (total > 0) { markerColor = 'bg-green-500'; }
                            
                            return (
                                <div key={city.name} className={`absolute ${city.coords} flex flex-col items-center -translate-x-1/2 -translate-y-1/2`}>
                                    <div className="relative flex h-4 w-4 mb-1">
                                        <span className={`${pulse} absolute inline-flex h-full w-full rounded-full ${markerColor} opacity-75`}></span>
                                        <span className={`relative inline-flex rounded-full h-4 w-4 ${markerColor}`}></span>
                                    </div>
                                    <span className="text-[10px] font-bold text-gray-300 bg-black/60 px-1.5 rounded backdrop-blur-sm border border-white/10">
                                        {city.name}
                                    </span>
                                    {total > 0 && (
                                        <div className="text-[9px] text-gray-500 mt-0.5">
                                            {critical > 0 ? `${critical} Crit` : warning > 0 ? `${warning} Warn` : `${total} OK`}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="glass-panel p-5 col-span-1 flex flex-col" style={{ minHeight: '340px' }}>
                    <h3 className="text-xs text-gray-400 uppercase tracking-widest mb-4">Fleet Health Breakdown</h3>
                    <div className="flex-1 min-h-[260px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={healthData} cx="50%" cy="50%" innerRadius={65} outerRadius={90} paddingAngle={4} dataKey="value" stroke="none" labelLine={false} label={renderCustomLabel}>
                                    {healthData.map((entry: any) => <Cell key={entry.name} fill={HEALTH_COLORS[entry.name] ?? '#64748b'} />)}
                                </Pie>
                                <RechartsTooltip contentStyle={TOOLTIP_STYLE} />
                                <Legend iconType="circle" iconSize={8} formatter={(val) => <span style={{ color: '#94a3b8', fontSize: '11px' }}>{val}</span>} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="glass-panel p-5 col-span-1 flex flex-col" style={{ minHeight: '340px' }}>
                    <h3 className="text-xs text-gray-400 uppercase tracking-widest mb-4">Module 2: Predictive Maintenance (MTBF)</h3>
                    <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                        {degrading.length === 0 ? <p className="text-xs text-gray-500 italic">No nodes tracked.</p> : null}
                        {degrading.map((inv: any, idx: number) => {
                            const st = inv.healthState === 0 ? 'bg-green-500/20 text-green-400' : inv.healthState === 1 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400';
                            return (
                                <div key={inv.id} className="flex justify-between items-center bg-black/30 p-2 rounded border border-white/5">
                                    <div className="flex items-center gap-3">
                                        <span className="text-gray-600 font-bold w-4">{idx + 1}.</span>
                                        <div>
                                            <div className="font-bold text-gray-200">{inv.id}</div>
                                            <div className="text-[10px] text-gray-500">{inv.zone.split(':')[0]}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 text-right">
                                        <div>
                                            <div className="text-[10px] text-gray-500 uppercase">Velocity</div>
                                            <div className="font-mono text-red-400">{inv.rulVelocity.toFixed(4)} %/s</div>
                                        </div>
                                        <div className={`px-2 py-1 rounded text-[10px] font-bold ${st}`}>
                                            {inv.healthState === 0 ? 'NOMINAL' : inv.healthState === 1 ? 'WARNING' : 'CRITICAL'}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Row 2: Efficiency & Capacity Curve (Mod 3) */}
            <div className="glass-panel p-5 flex flex-col" style={{ minHeight: '340px' }}>
                <h3 className="text-xs text-gray-400 uppercase tracking-widest mb-4">Module 3: Regional Power Output (Live)</h3>
                <div className="flex-1 min-h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={timeseries} margin={{ left: 10, right: 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                            <XAxis
                                dataKey="timestamp" type="number" domain={['dataMin', 'dataMax']} scale="time"
                                stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false}
                                tickFormatter={(tick) => new Date(tick).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            />
                            <YAxis stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => Math.round(v).toString()} width={50}>
                                <Label value="Power (kW)" angle={-90} position="insideLeft" fill="#94a3b8" style={{ fontSize: '11px' }} offset={-10} />
                            </YAxis>
                            
                            <RechartsTooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(label: any) => new Date(Number(label)).toLocaleTimeString()} />
                            <Legend iconType="circle" iconSize={8} formatter={(val) => <span style={{ color: '#94a3b8', fontSize: '11px' }}>{val}</span>} />
                            
                            <Line type="monotone" dataKey="Zone A" name="Zone A (Nagpur)" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
                            <Line type="monotone" dataKey="Zone B" name="Zone B (Nagpur)" stroke="#8b5cf6" strokeWidth={2} dot={false} isAnimationActive={false} />
                            <Line type="monotone" dataKey="Zone C" name="Zone C (Chandrapur)" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} />
                            <Line type="monotone" dataKey="Zone D" name="Zone D (Umred)" stroke="#f59e0b" strokeWidth={2} dot={false} isAnimationActive={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Row 3: Live Incident & Automated Dispatch Feed (Mod 4) */}
            <div className="glass-panel p-5 flex flex-col" style={{ minHeight: '280px' }}>
                <h3 className="text-xs text-gray-400 uppercase tracking-widest mb-4">Module 4: Live Incident & Automated Dispatch Feed</h3>
                <div className="flex-1 overflow-y-auto space-y-2">
                    {tickets.length === 0 ? (
                        <div className="text-gray-600 italic font-mono text-xs p-2">No recent dispatch events.</div>
                    ) : (
                        tickets.map((ticket: any) => (
                            <div key={ticket.id} className="font-mono text-xs bg-black/40 p-3 rounded border-l-2 border-white/10 flex flex-col gap-1.5">
                                <div className="flex items-center gap-3">
                                    <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${ticket.status === 'CLOSED' ? 'bg-green-500/20 text-green-400' : ticket.priority === 'CRITICAL' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                        {ticket.status === 'CLOSED' ? 'RESOLVED' : ticket.priority}
                                    </span>
                                    <span className="text-gray-300 font-bold">{ticket.inverterId}</span>
                                    <span className="text-gray-500 text-[10px]">{ticket.inverter?.zone} • {ticket.inverter?.locality}</span>
                                    <span className="text-gray-600 ml-auto">{new Date(ticket.createdAt).toLocaleTimeString()}</span>
                                </div>
                                <div className="text-gray-400 leading-relaxed pl-1 whitespace-pre-wrap">{ticket.description}</div>
                            </div>
                        ))
                    )}
                </div>
            </div>

        </div>
    );
}
