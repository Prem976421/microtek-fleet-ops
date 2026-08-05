import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    // Upsert Inverter
    const inverter = await prisma.inverter.upsert({
      where: { id: data.node_id },
      update: { 
        healthState: data.health_state === 'Healthy' ? 0 : 
                     data.health_state === 'Warning' ? 1 :
                     data.health_state === 'Critical' ? 2 : 3,
        lastSeen: new Date()
      },
      create: {
        id: data.node_id,
        location: data.location || 'Unknown Location',
        healthState: data.health_state === 'Healthy' ? 0 : 
                     data.health_state === 'Warning' ? 1 :
                     data.health_state === 'Critical' ? 2 : 3,
      }
    });

    // Create Telemetry Log
    const telemetry = await prisma.telemetryLog.create({
      data: {
        inverterId: inverter.id,
        dcBusRippleVoltage: data.dc_bus_ripple_voltage || 0.0,
        capacitorEsr: data.capacitor_esr || 0.0,
        junctionTemp: data.junction_temp || 0.0,
        mosfetOnResistance: data.mosfet_on_resistance || 0.0,
        conversionEfficiency: data.conversion_efficiency || 0.0,
        heatsinkTemp: data.heatsink_temp || 0.0,
        commandedFanRpm: data.commanded_fan_rpm || 0,
        actualFanRpm: data.actual_fan_rpm || 0,
        thd: data.thd || 0.0,
        mainsSurges: data.mains_surges || 0,
      }
    });

    // Check for Tickets
    if (inverter.healthState > 0) {
        // If critical or warning, generate a ticket if one doesn't exist for this state today
        const existingTicket = await prisma.dispatchTicket.findFirst({
            where: {
                inverterId: inverter.id,
                status: 'OPEN',
                priority: inverter.healthState >= 2 ? 'CRITICAL' : 'WARNING'
            }
        });

        if (!existingTicket) {
            await prisma.dispatchTicket.create({
                data: {
                    inverterId: inverter.id,
                    description: `Automated Dispatch: ${data.health_state} state detected.`,
                    priority: inverter.healthState >= 2 ? 'CRITICAL' : 'WARNING',
                }
            });
        }
    }

    return NextResponse.json({ success: true, telemetry }, { status: 201 });
  } catch (error) {
    console.error('Error ingesting telemetry:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const inverters = await prisma.inverter.findMany({
      include: {
        telemetry: {
          orderBy: { timestamp: 'desc' },
          take: 20, // last 20 readings for sparklines
        },
        tickets: {
            where: { status: 'OPEN' },
            orderBy: { createdAt: 'desc' }
        }
      }
    });
    return NextResponse.json({ success: true, inverters });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
