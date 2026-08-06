import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';

// =========================================================================
// DATABASE SETUP — WAL mode for high-frequency writes
// =========================================================================
const libsql = createClient({ url: 'file:dev.db' });
const adapter = new PrismaLibSql({ url: 'file:dev.db' });
const prisma = new PrismaClient({ adapter });

async function enableWalMode() {
    await libsql.execute('PRAGMA journal_mode=WAL;');
    await libsql.execute('PRAGMA synchronous=NORMAL;');
    await libsql.execute('PRAGMA cache_size=10000;');
    console.log('✅ SQLite WAL mode + performance PRAGMAs enabled.');
}

// =========================================================================
// FLEET CONFIGURATION  — 38 nodes: 32 Nominal / 4 Warning / 2 Critical
// =========================================================================
const LOCALITIES = [
    'Zone A: Nagpur (Thermal Corridor)',
    'Zone B: Nagpur (Heavy Industry)',
    'Zone C: Chandrapur (Mining Sector)',
    'Zone D: Umred (Commercial Ops)',
];
const ZONES = ['Nagpur', 'Nagpur', 'Chandrapur', 'Umred'];
const FIRMWARES = ['v2.4.1', 'v2.4.2', 'v2.4.0-rc1'];
type NodeCategory = 'NOMINAL' | 'WARNING' | 'CRITICAL';

const TOTAL_NODES   = 38;
const CRITICAL_START = 36; // index 36-37 → 2 nodes (5%)
const WARNING_START  = 32; // index 32-35 → 4 nodes (10%)
// index  0-31 → 32 nodes (85% Nominal)

function getNodeCategory(i: number): NodeCategory {
    if (i >= CRITICAL_START) return 'CRITICAL';
    if (i >= WARNING_START)  return 'WARNING';
    return 'NOMINAL';
}

interface NodeCfg {
    id: string;
    category: NodeCategory;
    locality: string;
    zone: string;
    firmwareVersion: string;
    signalStrength: number;
    gridVoltageBaseline: number;
}

function buildFleet(): NodeCfg[] {
    const fleet: NodeCfg[] = [];
    for (let i = 0; i < TOTAL_NODES; i++) {
        const cat = getNodeCategory(i);
        let zoneIdx = 0;
        if (cat === 'WARNING') zoneIdx = 1; // Heavy thermal in Zone B
        else if (cat === 'CRITICAL') zoneIdx = 2; // Hard failures in Zone C
        else zoneIdx = [0, 2, 3][i % 3]; // Nominals spread across A, C, D
        
        fleet.push({
            id: `INV_ESP32_${String(i + 1).padStart(3, '0')}`,
            category: cat,
            locality: LOCALITIES[zoneIdx],
            zone: ZONES[zoneIdx],
            firmwareVersion: FIRMWARES[i % FIRMWARES.length],
            signalStrength: -50 - Math.floor(Math.random() * 30),
            gridVoltageBaseline: 230 + (Math.random() * 10 - 5),
        });
    }
    return fleet;
}

// =========================================================================
// GAUSSIAN NOISE — Box-Muller transform
// =========================================================================
function gauss(mean = 0, sd = 1): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

// =========================================================================
// DIURNAL SUN CURVE  (Time-compressed: 5 minutes = 24 hours)
// =========================================================================
let currentCloudCover = 0;
let cloudTarget = 0;

function solarMultiplier(): number {
    const cycleMs = 5 * 60 * 1000;
    const now = Date.now();
    const cycleFrac = (now % cycleMs) / cycleMs; // 0 to 1
    
    // Macro cloud cover logic (changes target 5% of the time)
    if (Math.random() < 0.05) {
        cloudTarget = Math.random() > 0.4 ? Math.random() * 0.7 : 0; // 60% chance of clouds, up to 70% cover
    }
    // Smooth transition
    currentCloudCover += (cloudTarget - currentCloudCover) * 0.1;

    // Fluctuate smoothly between 0.2 and 1.0 (no "night" phase for demo purposes)
    const baseCurve = 0.2 + 0.8 * ((Math.sin(cycleFrac * 2 * Math.PI) + 1) / 2);
    
    return Math.max(0.1, baseCurve * (1 - currentCloudCover));
}

// =========================================================================
// LOCALITY WEATHER STATE  (shared per zone per tick)
// =========================================================================
interface ZoneWeather {
    tempBias: number;
    humidityBias: number;
    brownout: boolean;
    brownoutVoltage: number;
}

function generateZoneWeather(): Record<string, ZoneWeather> {
    const weather: Record<string, ZoneWeather> = {};
    for (const zone of Array.from(new Set(ZONES))) {
        const brownout = Math.random() < 0.004;
        weather[zone] = {
            tempBias: gauss(zone === 'Nagpur' ? 5 : 0, 0.8), // Nagpur is significantly hotter
            humidityBias: gauss(0, 1.0),
            brownout,
            brownoutVoltage: brownout ? 155 + Math.random() * 35 : 230 + gauss(0, 1.5),
        };
    }
    return weather;
}

// =========================================================================
// BASELINE ANCHORS — permanent health profile per node, never modified
// =========================================================================
interface NodeBaseline {
    category:      NodeCategory;
    baseRul:       number;   // % anchor
    ambientTemp:   number;   // °C anchor
    dcRipple:      number;   // V anchor
    insulation:    number;   // MΩ anchor
    efficiency:    number;   // % anchor
    actualFanRpm:  number;   // RPM anchor
    humidity:      number;   // % anchor
    dustIndex:     number;   // dimensionless anchor
    thermalStress: number;   // cumulative anchor
}

function buildBaseline(cat: NodeCategory, i: number): NodeBaseline {
    if (cat === 'NOMINAL') {
        const seed = (i * 1.37) % 1;
        return {
            category:     'NOMINAL',
            baseRul:      85 + seed * 14,          // 85–99%
            ambientTemp:  26 + seed * 10,
            dcRipple:     2.8 + seed * 1.5,
            insulation:   13 + seed * 5,
            efficiency:   97.0 + seed * 1.5,
            actualFanRpm: 2940 + seed * 80,
            humidity:     30 + seed * 20,
            dustIndex:    5 + seed * 15,
            thermalStress: seed * 5,
        };
    }
    if (cat === 'WARNING') {
        const seed = (i * 2.13) % 1;
        return {
            category:     'WARNING',
            baseRul:      45 + seed * 20,          // 45–65%
            ambientTemp:  48 + seed * 4,           // ALWAYS > 45°C
            dcRipple:     4.2 + seed * 1.0,
            insulation:   6.0 + seed * 1.5,
            efficiency:   92.0 + seed * 1.5,
            actualFanRpm: 2720 + seed * 80,
            humidity:     65 + seed * 10,
            dustIndex:    45 + seed * 20,
            thermalStress: 18 + seed * 10,
        };
    }
    // CRITICAL
    const seed = (i * 3.71) % 1;
    return {
        category:     'CRITICAL',
        baseRul:      12 + seed * 13,              // 12–25%
        ambientTemp:  52 + seed * 6,
        dcRipple:     7.5 + seed * 4.0,            // ALWAYS > 6.5V
        insulation:   1.5 + seed * 1.5,            // ALWAYS < 4.0 MΩ
        efficiency:   85 + seed * 3,
        actualFanRpm: 1800 + seed * 400,
        humidity:     80 + seed * 10,
        dustIndex:    72 + seed * 18,
        thermalStress: 45 + seed * 20,
    };
}

// =========================================================================
// PER-NODE RUNTIME STATE — micro-fluctuates around its baseline
// =========================================================================
interface NodeState {
    baseline:      NodeBaseline;
    rul:           number;
    ambientTemp:   number;
    dcRipple:      number;
    insulation:    number;
    efficiency:    number;
    actualFanRpm:  number;
    humidity:      number;
    dustIndex:     number;
    thermalStress: number;
    repairCountdown: number | null;
    isUnderRepair:   boolean;
}

function initNodeState(baseline: NodeBaseline): NodeState {
    return {
        baseline,
        rul:           baseline.baseRul,
        ambientTemp:   baseline.ambientTemp,
        dcRipple:      baseline.dcRipple,
        insulation:    baseline.insulation,
        efficiency:    baseline.efficiency,
        actualFanRpm:  baseline.actualFanRpm,
        humidity:      baseline.humidity,
        dustIndex:     baseline.dustIndex,
        thermalStress: baseline.thermalStress,
        repairCountdown: null,
        isUnderRepair:   false,
    };
}

// =========================================================================
// STATE TRANSITION — micro-fluctuations anchored to baseline
// =========================================================================
function stepState(s: NodeState, weather: ZoneWeather): NodeState {
    const st = { ...s };
    const b = s.baseline;

    if (st.isUnderRepair) {
        st.ambientTemp   = clamp(st.ambientTemp   - gauss(0.3, 0.05), 30, b.ambientTemp);
        st.dcRipple      = clamp(st.dcRipple      - gauss(0.2, 0.03), 2.5, b.dcRipple);
        st.insulation    = clamp(st.insulation     + gauss(0.4, 0.05), b.insulation, 18.0);
        st.efficiency    = clamp(st.efficiency     + gauss(0.3, 0.04), b.efficiency, 99.0);
        st.actualFanRpm  = clamp(st.actualFanRpm   + gauss(15, 2),     b.actualFanRpm, 3050);
        st.dustIndex     = clamp(st.dustIndex      - gauss(1.0, 0.2),  0, b.dustIndex);
        st.thermalStress = clamp(st.thermalStress  - gauss(0.5, 0.1),  0, b.thermalStress);
        st.rul           = clamp(st.rul            + gauss(1.0, 0.2),  st.rul, 100);
        return st;
    }

    const tempBias = b.category === 'NOMINAL' ? clamp(weather.tempBias, -1.5, 1.5) : weather.tempBias;
    st.ambientTemp = clamp(b.ambientTemp + gauss(0, 0.15) + tempBias * 0.3, b.ambientTemp - 1.5, b.ambientTemp + 1.5);
    st.dcRipple = clamp(b.dcRipple + gauss(0, 0.015), b.dcRipple - 0.25, b.dcRipple + 0.25);
    st.insulation = clamp(b.insulation + gauss(0, 0.01), b.insulation - 0.2, b.insulation + 0.2);
    st.efficiency = clamp(b.efficiency + gauss(0, 0.02), b.efficiency - 0.5, b.efficiency + 0.5);
    st.actualFanRpm = clamp(b.actualFanRpm + gauss(0, 5), b.actualFanRpm - 40, b.actualFanRpm + 40);
    st.humidity = clamp(b.humidity + gauss(0, 0.3) + weather.humidityBias * 0.2, b.humidity - 3, b.humidity + 3);
    st.dustIndex = clamp(b.dustIndex + gauss(0, 0.2), b.dustIndex - 2, b.dustIndex + 2);

    if (b.category === 'CRITICAL') {
        st.thermalStress = clamp(st.thermalStress + gauss(0.02, 0.01), 0, 500);
    } else {
        st.thermalStress = clamp(b.thermalStress + gauss(0, 0.5), 0, 500);
    }
    
    st.rul = clamp(b.baseRul - st.thermalStress * 0.05 + gauss(0, 0.1), 0, 100);

    return st;
}

// =========================================================================
// TELEMETRY RECORD BUILDER
// =========================================================================
function buildPayload(inverterId: string, s: NodeState, weather: ZoneWeather, sol: number) {
    const heatsinkTemp  = s.ambientTemp + 10 + (3000 - s.actualFanRpm) / 100;
    const heatsinkDelta = heatsinkTemp - s.ambientTemp;

    const isNight   = sol === 0;
    const solarIrr  = isNight ? 0 : clamp(sol * 1050 + gauss(0, 8), 0, 1200);
    const thermalDerating = s.baseline.category === 'WARNING'
        ? Math.max(0, (s.ambientTemp - 45) * 180)
        : 0;

    const basePower = isNight ? 0 : clamp(50000 * (s.efficiency / 100) * sol - thermalDerating, 0, 55000);
    const activePower = weather.brownout
        ? basePower * 0.15
        : basePower + gauss(0, basePower * 0.03 + 200); // 3% noise + 200W baseline noise

    const acFreqBase = 0.005 * Math.max(0, 100 - s.rul);
    return {
        inverterId,
        ambientTemp:         s.ambientTemp    + gauss(0, 0.02),
        relativeHumidity:    s.humidity       + gauss(0, 0.05),
        dustIndex:           s.dustIndex      + gauss(0, 0.05),
        solarIrradiance:     solarIrr,
        dcBusRippleVoltage:  s.dcRipple       + gauss(0, 0.005),
        dcBusRippleCurrent:  s.dcRipple * 1.5 + gauss(0, 0.008),
        activePower:         clamp(activePower, 0, 60000),
        reactivePower:       clamp(500 + Math.max(0, 100 - s.rul) * 10 + gauss(0, 2), 0, 5000),
        acFrequencyDrift:    clamp(acFreqBase + gauss(0, 0.0002), 0, 1),
        insulationResistance: s.insulation    + gauss(0, 0.005),
        thd:                 clamp(2 + (s.dcRipple - 3) * 0.3 + gauss(0, 0.01), 0, 15),
        mainsSurges:         weather.brownout ? 3 : (Math.random() > 0.99 ? 1 : 0),
        junctionTemp:        heatsinkTemp + 15 + gauss(0, 0.1),
        heatsinkTemp:        heatsinkTemp      + gauss(0, 0.08),
        heatsinkDelta:       heatsinkDelta     + gauss(0, 0.05),
        mosfetOnResistance:  clamp(5 + s.thermalStress * 0.01 + gauss(0, 0.005), 4, 12),
        igbtVgeth:           clamp(5.5 - s.thermalStress * 0.005 + gauss(0, 0.003), 2.5, 6),
        commandedFanRpm:     3000,
        actualFanRpm:        clamp(s.actualFanRpm + gauss(0, 1.5), 0, 3200),
        smpsOutputVoltage:   clamp(24 - s.rul * 0.08 + gauss(0, 0.01), 18, 28),
        capacitorEsr:        clamp(10 + (s.dcRipple - 3) * 2 + gauss(0, 0.03), 0, 50),
        conversionEfficiency: clamp(s.efficiency + gauss(0, 0.01), 0, 100),
        cumulativeThermalStress: clamp(s.thermalStress, 0, 500),
        rulVelocity:         clamp(100 - s.rul, 0, 100),
    };
}

function getHealthState(s: NodeState, weather: ZoneWeather): number {
    if (weather.brownout) return 2; // Critical Grid Fault
    if (s.rul < 30) return 2; // Critical
    if (s.rul <= 70) return 1; // Warning
    return 0; // Nominal
}

// =========================================================================
// SEEDING
// =========================================================================
async function seedFleet(fleet: NodeCfg[], baselines: Map<string, NodeBaseline>) {
    console.log(`\n🌱 Seeding ${fleet.length} nodes (${fleet.length - 6} Nominal / 4 Warning / 2 Critical)…`);
    for (const node of fleet) {
        const initHealth = node.category === 'CRITICAL' ? 2 : node.category === 'WARNING' ? 1 : 0;
        await prisma.inverter.upsert({
            where: { id: node.id },
            update: {
                locality: node.locality, firmwareVersion: node.firmwareVersion,
                signalStrength: node.signalStrength, gridVoltageBaseline: node.gridVoltageBaseline,
                healthState: initHealth,
            },
            create: {
                id: node.id, location: `Site ${node.id.split('_')[2]}`,
                locality: node.locality, firmwareVersion: node.firmwareVersion,
                signalStrength: node.signalStrength, gridVoltageBaseline: node.gridVoltageBaseline,
                healthState: initHealth,
            },
        });
    }

    // Log fleet summary
    for (const node of fleet) {
        const b = baselines.get(node.id)!;
        if (node.category !== 'NOMINAL') {
            console.log(`   ${node.category === 'CRITICAL' ? '🔴' : '⚠️ '} ${node.id}: ambientTemp=${b.ambientTemp.toFixed(1)}°C, dcRipple=${b.dcRipple.toFixed(2)}V, insulation=${b.insulation.toFixed(2)}MΩ`);
        }
    }

    // Auto-tickets for CRITICAL nodes
    for (const node of fleet.filter(n => n.category === 'CRITICAL')) {
        const exists = await prisma.dispatchTicket.findFirst({
            where: { inverterId: node.id, status: 'OPEN', priority: 'CRITICAL' }
        });
        if (!exists) {
            const b = baselines.get(node.id)!;
            await prisma.dispatchTicket.create({
                data: {
                    inverterId: node.id,
                    description: `[AUTO-SEEDED] CRITICAL hardware failure on ${node.id}: DC Bus Ripple ${b.dcRipple.toFixed(2)}V (threshold: 6.5V), Insulation ${b.insulation.toFixed(2)} MΩ (threshold: 4.0 MΩ). Immediate field inspection required.`,
                    priority: 'CRITICAL',
                }
            });
            console.log(`   🎫 CRITICAL dispatch ticket created for ${node.id}`);
        }
    }
    console.log('✅ Seeding complete.\n');
}

// =========================================================================
// REPAIR LIFECYCLE
// =========================================================================
const REPAIR_TICKS_MIN     = 40;   // ~20s at 500ms
const REPAIR_TICKS_MAX     = 120;  // ~60s
const REPAIR_DURATION_TICKS = 16;  // ~8s for repair to complete

// =========================================================================
// MAIN TELEMETRY LOOP — 500ms interval
// =========================================================================
async function simulateTelemetry(fleet: NodeCfg[], baselines: Map<string, NodeBaseline>) {
    const states: Record<string, NodeState> = {};
    const repairDoneAt: Record<string, number> = {};
    let tick = 0;

    // Initialise state from baselines
    for (const node of fleet) {
        const baseline = baselines.get(node.id)!;
        states[node.id] = initNodeState(baseline);
        // Schedule initial repair countdown for CRITICAL nodes
        if (node.category === 'CRITICAL') {
            const countdown = REPAIR_TICKS_MIN + Math.floor(Math.random() * (REPAIR_TICKS_MAX - REPAIR_TICKS_MIN));
            states[node.id].repairCountdown = countdown;
            console.log(`   🔧 ${node.id}: repair scheduled in ${countdown} ticks (~${(countdown * 0.5).toFixed(0)}s)`);
        }
    }

    console.log('\n🔄 SCADA telemetry loop started at 500ms interval (WAL, batched transactions)…\n');

    setInterval(async () => {
        tick++;
        const now = new Date();
        const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const sol = solarMultiplier();
        const zoneWeather = generateZoneWeather();

        for (const [zone, w] of Object.entries(zoneWeather)) {
            if (w.brownout) console.log(`\n⚡ BROWNOUT in ${zone}! Grid voltage: ${w.brownoutVoltage.toFixed(0)}V`);
        }

        try {
            await prisma.$transaction(async (tx) => {
                for (const node of fleet) {
                    const weather = zoneWeather[node.zone];
                    let s = states[node.id];

                    // ---- Repair countdown ----
                    if (s.repairCountdown !== null && s.repairCountdown > 0) {
                        s = { ...s, repairCountdown: s.repairCountdown - 1 };
                        if (s.repairCountdown !== null && s.repairCountdown <= 0) {
                            s = { ...s, isUnderRepair: true, repairCountdown: null };
                            repairDoneAt[node.id] = tick + REPAIR_DURATION_TICKS;
                            console.log(`\n   🛠️  Technician on-site: ${node.id} — repair in progress…`);
                        }
                    }

                    // ---- Finish repair ----
                    if (s.isUnderRepair && tick >= (repairDoneAt[node.id] ?? Infinity)) {
                        const newBaseline = buildBaseline('NOMINAL', parseInt(node.id.split('_')[2]) - 1);
                        const nextCountdown = REPAIR_TICKS_MIN + Math.floor(Math.random() * (REPAIR_TICKS_MAX - REPAIR_TICKS_MIN));
                        s = { ...initNodeState(newBaseline), repairCountdown: nextCountdown, isUnderRepair: false };
                        console.log(`\n   ✅ Repair COMPLETE: ${node.id} → Nominal. Re-check in ${nextCountdown} ticks.`);
                        const openTicket = await tx.dispatchTicket.findFirst({ where: { inverterId: node.id, status: 'OPEN' } });
                        if (openTicket) {
                            await tx.dispatchTicket.update({ where: { id: openTicket.id }, data: { status: 'CLOSED' } });
                            console.log(`   🎫 Ticket ${openTicket.id} → CLOSED`);
                        }
                    }

                    // ---- Physics micro-step ----
                    s = stepState(s, weather);
                    states[node.id] = s;

                    const healthState = getHealthState(s, weather);
                    const telemetry   = buildPayload(node.id, s, weather, sol);
                    const signalStrength = -50 - Math.floor(Math.random() * 30);

                    await tx.telemetryLog.create({ data: { ...telemetry, timestamp: now } });
                    await tx.inverter.update({
                        where: { id: node.id },
                        data: { healthState, signalStrength, lastSeen: now }
                    });

                    if (healthState > 0) {
                        const existing = await tx.dispatchTicket.findFirst({ where: { inverterId: node.id, status: 'OPEN' } });
                        if (!existing) {
                            let desc = `[AUTO] ${healthState >= 2 ? 'CRITICAL' : 'WARNING'} on ${node.id}.`;
                            if (s.dcRipple > 6.5)     desc += ` DC Ripple: ${s.dcRipple.toFixed(2)}V.`;
                            if (s.insulation < 4)      desc += ` Insulation: ${s.insulation.toFixed(2)} MΩ.`;
                            if (weather.brownout)      desc += ` Grid brownout: ${weather.brownoutVoltage.toFixed(0)}V.`;
                            if (s.ambientTemp > 45)    desc += ` Thermal: ${s.ambientTemp.toFixed(1)}°C.`;
                            await tx.dispatchTicket.create({
                                data: { inverterId: node.id, description: desc, priority: healthState >= 2 ? 'CRITICAL' : 'WARNING' }
                            });
                        }
                    }
                }

                // Prune old telemetry (every 120 ticks = ~60s to reduce overhead)
                if (tick % 120 === 0) {
                    await tx.telemetryLog.deleteMany({ where: { timestamp: { lt: cutoff } } });
                }
            });

            // Heartbeat every 20 ticks = 10 seconds
            if (tick % 20 === 0) {
                const noW = { tempBias: 0, humidityBias: 0, brownout: false, brownoutVoltage: 230 };
                const n = fleet.filter(f => getHealthState(states[f.id], noW) === 0).length;
                const w = fleet.filter(f => getHealthState(states[f.id], noW) === 1).length;
                const c = fleet.filter(f => getHealthState(states[f.id], noW) >= 2).length;
                const nightStr = sol === 0 ? '🌙 Night' : `☀️  Solar ${(sol * 100).toFixed(0)}%`;
                console.log(`[Tick ${String(tick).padStart(5)}] ${nightStr} | ✅ ${n} Nominal | ⚠️  ${w} Warning | 🔴 ${c} Critical`);
            } else {
                process.stdout.write('.');
            }
        } catch (err) {
            console.error('\n❌ Transaction error:', err);
        }
    }, 500); // ← 500ms SCADA interval
}

// =========================================================================
// ENTRY
// =========================================================================
async function main() {
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║  MICROTEK Enterprise Fleet Ops — SCADA Simulator (500ms) ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
    await enableWalMode();
    const fleet = buildFleet();

    // Build baselines ONCE — they are permanent anchors
    const baselines = new Map<string, NodeBaseline>();
    for (let i = 0; i < fleet.length; i++) {
        baselines.set(fleet[i].id, buildBaseline(fleet[i].category, i));
    }

    await seedFleet(fleet, baselines);
    await simulateTelemetry(fleet, baselines);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
