import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // 1. Time-Series Aggregation: Group by timestamp
        const timeseriesRaw = await prisma.$queryRaw`
            SELECT 
                timestamp,
                SUM(activePower) as totalPower,
                SUM(55000) as theoreticalCapacity
            FROM TelemetryLog
            WHERE timestamp >= datetime('now', '-2 minutes')
            GROUP BY timestamp
            ORDER BY timestamp ASC
            LIMIT 120
        `;

        const timeseries = (timeseriesRaw as any[]).map(row => ({
            timestamp: new Date(row.timestamp).getTime(),
            power: Number(row.totalPower) / 1000,
            capacity: Number(row.theoreticalCapacity) / 1000
        }));

        // 2. Global KPIs via Aggregation
        const healthCounts = await prisma.inverter.groupBy({
            by: ['healthState'],
            _count: { id: true }
        });

        let totalDeployed = 0;
        let nominalCount = 0;
        let warningCount = 0;
        let criticalCount = 0;
        let offlineCount = 0;
        let totalRulSum = 0;

        healthCounts.forEach(c => {
            totalDeployed += c._count.id;
            if (c.healthState === 0) nominalCount += c._count.id;
            else if (c.healthState === 1) warningCount += c._count.id;
            else if (c.healthState >= 2) criticalCount += c._count.id;
            else if (c.healthState === -1) offlineCount += c._count.id;
            
            const rul = Math.max(0, 100 - c.healthState * 33);
            totalRulSum += (rul * c._count.id);
        });

        const healthRate = totalDeployed > 0 ? ((nominalCount / totalDeployed) * 100).toFixed(1) : '0.0';
        const avgRul = totalDeployed > 0 ? totalRulSum / totalDeployed : 0;
        const mtbfEst = totalDeployed > 0 ? Math.max(24, Math.floor(avgRul * 180)) : 0;

        // 3. Geographic Heatmap Aggregation (Zone Matrix Replacement)
        const zoneHealthCounts = await prisma.inverter.groupBy({
            by: ['locality', 'healthState'],
            _count: { id: true }
        });

        // 4. Top 5 Degrading Nodes (using raw SQL window function for speed)
        const degradingRaw = await prisma.$queryRaw`
            SELECT 
                i.id, 
                i.locality as zone, 
                i.healthState, 
                t.rulVelocity
            FROM Inverter i
            JOIN (
                SELECT inverterId, rulVelocity, ROW_NUMBER() OVER(PARTITION BY inverterId ORDER BY timestamp DESC) as rn
                FROM TelemetryLog
            ) t ON i.id = t.inverterId AND t.rn = 1
            ORDER BY t.rulVelocity DESC
            LIMIT 5
        `;

        // 5. Global Dispatch Tickets
        const globalTickets = await prisma.dispatchTicket.findMany({
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: {
                id: true,
                inverterId: true,
                description: true,
                priority: true,
                status: true,
                createdAt: true,
                resolvedAt: true,
                inverter: { select: { locality: true } }
            }
        });

        const payload = {
            success: true,
            ts: Date.now(),
            timeseries,
            kpis: {
                totalDeployed,
                nominalCount,
                healthRate,
                avgRul,
                mtbfEst
            },
            healthDistribution: [
                { name: 'Nominal', value: nominalCount },
                { name: 'Warning', value: warningCount },
                { name: 'Critical', value: criticalCount },
                { name: 'Standby/Offline', value: offlineCount }
            ].filter(d => d.value > 0),
            geographicHeatmap: zoneHealthCounts,
            degradingNodes: degradingRaw,
            globalTickets
        };

        return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
    } catch (error) {
        console.error('[/api/analytics] Error:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
