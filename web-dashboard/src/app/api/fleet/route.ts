import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const nodeId = req.nextUrl.searchParams.get('nodeId');

        // 1. Lightweight fleet status (for sidebar and search)
        const fleetStatus = await prisma.inverter.findMany({
            select: {
                id: true,
                locality: true,
                healthState: true,
                signalStrength: true
            },
            orderBy: { id: 'asc' }
        });

        // 2. Heavy telemetry ONLY for the active node
        let activeNode = null;
        if (nodeId) {
            activeNode = await prisma.inverter.findUnique({
                where: { id: nodeId },
                select: {
                    id: true,
                    location: true,
                    locality: true,
                    firmwareVersion: true,
                    signalStrength: true,
                    gridVoltageBaseline: true,
                    healthState: true,
                    lastSeen: true,
                    telemetry: {
                        orderBy: { timestamp: 'desc' },
                        take: 1, // Only the single latest reading
                        select: {
                            ambientTemp: true,
                            relativeHumidity: true,
                            dustIndex: true,
                            solarIrradiance: true,
                            dcBusRippleVoltage: true,
                            dcBusRippleCurrent: true,
                            activePower: true,
                            reactivePower: true,
                            acFrequencyDrift: true,
                            insulationResistance: true,
                            thd: true,
                            mainsSurges: true,
                            junctionTemp: true,
                            heatsinkTemp: true,
                            heatsinkDelta: true,
                            mosfetOnResistance: true,
                            igbtVgeth: true,
                            commandedFanRpm: true,
                            actualFanRpm: true,
                            smpsOutputVoltage: true,
                            capacitorEsr: true,
                            conversionEfficiency: true,
                            cumulativeThermalStress: true,
                            rulVelocity: true,
                            timestamp: true,
                        }
                    },
                    tickets: {
                        where: { status: 'OPEN' },
                        orderBy: { createdAt: 'desc' },
                        take: 5,
                        select: {
                            id: true,
                            description: true,
                            priority: true,
                            status: true,
                            createdAt: true,
                        }
                    }
                }
            });
        }

        // 3. Global Dispatch Tickets (lightweight feed)
        const globalTickets = await prisma.dispatchTicket.findMany({
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: {
                id: true,
                inverterId: true,
                description: true,
                priority: true,
                status: true,
                createdAt: true,
                resolvedAt: true,
            }
        });

        return NextResponse.json(
            { success: true, fleetStatus, activeNode, globalTickets, ts: Date.now() },
            { headers: { 'Cache-Control': 'no-store, max-age=0' } }
        );
    } catch (error) {
        console.error('[/api/fleet] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
