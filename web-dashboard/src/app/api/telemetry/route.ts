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

    // Create Telemetry Log with expanded parameters
    const telemetry = await prisma.telemetryLog.create({
      data: {
        inverterId: inverter.id,
        
        // Environmental
        ambientTemp: data.ambient_temp || 0.0,
        relativeHumidity: data.relative_humidity || 0.0,
        dustIndex: data.dust_index || 0.0,
        solarIrradiance: data.solar_irradiance || 0.0,

        // Power Quality
        dcBusRippleVoltage: data.dc_bus_ripple_voltage || 0.0,
        dcBusRippleCurrent: data.dc_bus_ripple_current || 0.0,
        activePower: data.active_power || 0.0,
        reactivePower: data.reactive_power || 0.0,
        acFrequencyDrift: data.ac_frequency_drift || 0.0,
        insulationResistance: data.insulation_resistance || 0.0,
        thd: data.thd || 0.0,
        mainsSurges: data.mains_surges || 0,

        // Subsystems
        junctionTemp: data.junction_temp || 0.0,
        heatsinkTemp: data.heatsink_temp || 0.0,
        heatsinkDelta: data.heatsink_delta || 0.0,
        mosfetOnResistance: data.mosfet_on_resistance || 0.0,
        igbtVgeth: data.igbt_vgeth || 0.0,
        commandedFanRpm: data.commanded_fan_rpm || 0,
        actualFanRpm: data.actual_fan_rpm || 0,
        smpsOutputVoltage: data.smps_output_voltage || 0.0,
        capacitorEsr: data.capacitor_esr || 0.0,

        // Predictive
        conversionEfficiency: data.conversion_efficiency || 0.0,
        cumulativeThermalStress: data.cumulative_thermal_stress || 0.0,
        rulVelocity: data.rul_velocity || 0.0,
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
            let description = `Automated Dispatch: ${data.health_state} state detected.`;
            
            // Smarter ticket descriptions based on expanded parameters
            if (data.insulation_resistance < 1.0 && data.relative_humidity > 80.0) {
                description += ` High Risk: Insulation Resistance dropped to ${data.insulation_resistance.toFixed(2)}MΩ coupled with ${data.relative_humidity.toFixed(1)}% humidity. Inspect conformal coating and seals immediately.`;
            } else if (data.dust_index > 75.0 && data.heatsink_temp > 80.0) {
                description += ` Cooling Failure: High Dust Index (${data.dust_index.toFixed(1)}) is severely restricting airflow. Heatsink Delta is elevated. Replace fans and clear heatsink.`;
            } else if (data.dc_bus_ripple_voltage > 12.0) {
                description += ` Capacitor Degradation: DC Bus Ripple has exceeded 12V. RUL Velocity is dropping rapidly. Replace DC Link Capacitors.`;
            }

            await prisma.dispatchTicket.create({
                data: {
                    inverterId: inverter.id,
                    description: description,
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
      },
      orderBy: { id: 'asc' }
    });
    return NextResponse.json({ success: true, inverters });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
