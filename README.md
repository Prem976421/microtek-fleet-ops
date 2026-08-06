<div align="center">

 Microtek Fleet Ops
### SCADA-Grade Solar Inverter Fleet Management Platform

**Submitted for APOGEE Innovation Challenge 2026**  
*Bits Pilani Technology Festival*

[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-7.9-2D3748?logo=prisma)](https://prisma.io)
[![SQLite](https://img.shields.io/badge/SQLite-WAL_Mode-003B57?logo=sqlite)](https://sqlite.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

</div>

---

## Problem Statement

India's distributed solar energy sector is expanding rapidly, but fleet operators managing hundreds of solar inverters across geographic regions lack real-time, unified visibility into fleet health. Traditional monitoring solutions are either prohibitively expensive (enterprise SCADA vendors), too passive and reactive (manufacturer apps that alert only after failure), or incapable of predicting failures before they cause downtime and revenue loss.

Microtek Fleet Ops addresses this gap by delivering a production-grade, open-source fleet intelligence platform providing:

- Real-time SCADA-grade telemetry at 500ms polling frequency
- Predictive Remaining Useful Life (RUL) estimation using a physics-based degradation model
- Automated dispatch ticketing so field technicians are deployed before failures occur
- Geographic heatmap analytics with regional health visibility across multiple localities

---

## System Architecture

```
+------------------------------------------------------------------+
|                       MICROTEK FLEET OPS                        |
|                                                                  |
|   +------------------+       +------------------------------+   |
|   | SCADA Simulator  | ----> | SQLite (WAL Mode)            |   |
|   | scripts/         | 500ms | 38-node Telemetry Store      |   |
|   | simulate.ts      | ticks | TelemetryLog + Inverter      |   |
|   +------------------+       +------------------------------+   |
|                                          |                       |
|                          +--------------v---------------+        |
|                          |   Next.js API Routes         |        |
|                          |   /api/fleet?nodeId=XYZ      |        |
|                          |   /api/analytics             |        |
|                          |   (SQLite GROUP BY queries)  |        |
|                          +--------------+---------------+        |
|                                         |                        |
|                          +--------------v---------------+        |
|                          |   React Frontend (SWR)       |        |
|                          |   500ms viewport-targeted    |        |
|                          |   high-frequency polling     |        |
|                          +------------------------------+        |
+------------------------------------------------------------------+
```

### Key Technical Decisions

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Framework | Next.js 16 (App Router) | Server-side API routes and React UI in a single repository |
| Database | SQLite in WAL mode | Zero-config, handles 2 req/sec without locking |
| ORM | Prisma 7 | Type-safe queries with automatic schema migrations |
| Realtime | SWR `{ refreshInterval: 500 }` | Built-in request deduplication and lifecycle management |
| Charts | Recharts 3 | Composable, declarative, performant charting |
| Physics | Custom TypeScript engine | Gaussian noise with diurnal solar curve modelling |

---

## Features

### Main Fleet Dashboard (`/`)

- **Live Node Sidebar** — All 38 inverter nodes listed with Green/Amber/Red health indicators, searchable by node ID or deployment zone
- **Targeted SWR Polling** — Only fetches the full 25-parameter telemetry block for the active node visible in the viewport, keeping API payloads minimal at 2 requests per second
- **Node Detail Panel** — Full SCADA telemetry readout across four subsections:
  - Primary Health: Conversion Efficiency, DC Bus Ripple, RUL Velocity, Insulation Resistance
  - Environmental: Ambient Temperature, Relative Humidity, Dust Index, Solar Irradiance
  - Power Grid: Active Power, Reactive Power, THD, AC Frequency Drift
  - Subsystems: Heatsink Delta-T, Fan RPM Delta, SMPS Output Voltage, MOSFET Rds(on)
- **RUL Health Bar** — Colour-coded Remaining Useful Life percentage estimate per selected node
- **Live Dispatch Terminal** — Continuously scrolling feed of automated technician dispatch events with ticket priority and resolution status

### Regional and Fleet Analytics (`/analytics`)

- **KPI Row** — Total Deployed, Operational Health Rate, Average Fleet RUL, Estimated MTBF. All values are pre-calculated in SQLite using aggregation queries, with zero client-side computation
- **Geographic Heatmap** — Visual map of Nagpur, Chandrapur, and Umred with animated markers reflecting real-time fault status per locality
- **Fleet Health Breakdown** — Donut chart showing the distribution of Nominal, Warning, Critical, and Offline nodes
- **Predictive Maintenance Rankings** — Top 5 fastest-degrading nodes ranked by RUL velocity, computed using a SQL window function
- **Energy Efficiency and Capacity Curve** — Time-series line chart comparing actual versus theoretical power output following a realistic diurnal solar curve

### SCADA Physics Simulator (`scripts/simulate.ts`)

- **38-node heterogeneous fleet** with permanent seeded health profiles:
  - 32 Nominal nodes (RUL: 85–99%)
  - 4 Warning nodes (RUL: 45–65%, persistent elevated ambient temperature above 48°C)
  - 2 Critical nodes (RUL: 12–25%, dangerous DC ripple above 6.8V, dispatch tickets auto-created on startup)
- **Diurnal solar curve** — Power output follows a Gaussian bell curve aligned to local time (dawn ramp, noon peak, dusk falloff)
- **Thermal corridor biasing** — Nagpur-zone nodes carry a persistent +5°C ambient thermal bias reflecting regional climate data
- **Stochastic fault events** — Random brownout simulations (grid voltage drop to 186V), fan RPM deviations, and capacitor ESR drift
- **Auto-repair lifecycle** — Critical nodes recover after a simulated technician dispatch delay, with ticket status automatically updated to Closed
- **500ms tick rate** — Matches the frontend SWR polling interval for seamless live data continuity

---

## Project Structure

```
web-dashboard/
├── prisma/
│   └── schema.prisma              # Database schema (Inverter, TelemetryLog, DispatchTicket)
├── scripts/
│   └── simulate.ts                # SCADA physics simulator (runs as a background process)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── fleet/
│   │   │   │   └── route.ts       # GET /api/fleet?nodeId= (viewport-targeted telemetry)
│   │   │   └── analytics/
│   │   │       └── route.ts       # GET /api/analytics (pre-aggregated via SQL GROUP BY)
│   │   ├── analytics/
│   │   │   └── page.tsx           # Regional and Fleet Analytics page
│   │   ├── globals.css            # Dark mode glassmorphism design system
│   │   ├── layout.tsx             # Root layout with navigation bar
│   │   └── page.tsx               # Main Fleet Dashboard (500ms SWR polling)
│   └── lib/
│       ├── prisma.ts              # Prisma client singleton (WAL mode + performance PRAGMAs)
│       └── thresholds.ts          # 3-tier health state engine (Green/Amber/Red thresholds)
├── .env                           # DATABASE_URL=file:./dev.db
├── package.json
└── tsconfig.json
```

---

## Setup and Installation

### Prerequisites

| Tool | Minimum Version | Download |
|------|----------------|----------|
| Node.js | 20.x | https://nodejs.org |
| npm | 10.x | Bundled with Node.js |
| Git | Any | https://git-scm.com |

---

### Step 1 — Clone the Repository

```bash
git clone https://github.com/Prem976421/microtek-fleet-ops.git
cd microtek-fleet-ops/web-dashboard
```

---

### Step 2 — Install Dependencies

```bash
npm install
```

This installs all required packages: Next.js, Prisma, Recharts, SWR, the SQLite adapter, and the TypeScript toolchain.

---

### Step 3 — Set Up the Database

Generate the Prisma client and push the schema to initialise the local SQLite database:

```bash
npx prisma generate
npx prisma db push
```

This creates a `dev.db` SQLite file in the project root with three tables:
- `Inverter` — records for each of the 38 inverter nodes
- `TelemetryLog` — continuously written SCADA telemetry entries
- `DispatchTicket` — automated field technician dispatch event records

---

### Step 4 — Start the SCADA Simulator

Open a dedicated terminal window and run the physics simulation engine:

```bash
npx tsx scripts/simulate.ts
```

The simulator seeds the 38-node fleet, applies the health profiles, and begins writing telemetry to SQLite every 500ms. Keep this terminal running throughout your session.

---

### Step 5 — Start the Web Dashboard

Open a second terminal window and start the Next.js development server:

```bash
npm run dev
```

The server will start on port 3000 by default.

---

### Step 6 — Open the Application

| Page | URL | Purpose |
|------|-----|---------|
| Fleet Dashboard | http://localhost:3000 | Live per-node SCADA telemetry |
| Regional Analytics | http://localhost:3000/analytics | Fleet-wide analytics and heatmap |

---

## How the Physics Engine Works

### Diurnal Solar Curve

Power generation follows a time-aware Gaussian curve:

```
solarMultiplier = exp(-0.5 * ((hourOfDay - 12) / 3.5)^2)
activePower = nominalPower * solarMultiplier * (1 + GaussianNoise)
```

### 3-Tier Health Classification

| State | Health Index | RUL Range | Trigger Condition |
|-------|-------------|-----------|-------------------|
| Nominal | 0 | 85–99% | All parameters within specification |
| Warning | 1 | 45–65% | Ambient temp above 48°C or DC ripple above 4V |
| Critical | 2 | 12–25% | DC ripple above 6.8V and insulation below 2.5 MOhm |

### RUL Velocity

Each simulation tick updates the degradation rate:

```
rulVelocity = thermalStress * (dcRippleFactor + insulationFactor) * noise
```

High `rulVelocity` indicates accelerated degradation and automatically triggers a dispatch ticket.

---

## API Reference

### GET /api/fleet?nodeId={id}

Returns a lightweight status array for all nodes, plus full telemetry for the requested node only.

```json
{
  "fleetStatus": [
    { "id": "INV_ESP32_001", "locality": "Zone A: Northern Industrial Estate", "healthState": 0, "signalStrength": -68 }
  ],
  "activeNode": {
    "id": "INV_ESP32_001",
    "telemetry": [{ "ambientTemp": 34.2, "dcBusRippleVoltage": 1.8, "activePower": 1240 }],
    "tickets": []
  },
  "globalTickets": []
}
```

### GET /api/analytics

Returns pre-aggregated fleet analytics computed entirely in SQLite using GROUP BY and window functions.

```json
{
  "kpis": { "totalDeployed": 38, "healthRate": "84.2", "avgRul": 78.4, "mtbfEst": 14112 },
  "healthDistribution": [{ "name": "Nominal", "value": 32 }, { "name": "Warning", "value": 4 }],
  "timeseries": [{ "timestamp": 1754430000000, "power": 187.4, "capacity": 209.0 }],
  "degradingNodes": [{ "id": "INV_ESP32_037", "rulVelocity": 0.0842, "healthState": 2 }]
}
```

---

## Tech Stack

| Category | Technology |
|----------|-----------|
| Frontend | Next.js 16, React 19, TypeScript 5 |
| Styling | Vanilla CSS with glassmorphism dark mode |
| Data Fetching | SWR 2.5 (500ms polling with deduplication) |
| Charts | Recharts 3 |
| Backend | Next.js App Router API Routes |
| Database | SQLite in WAL mode via Prisma 7 |
| SQLite Adapter | @prisma/adapter-better-sqlite3 |
| Simulator Runtime | tsx, Node.js |
| Icons | Lucide React |

---

## APOGEE Innovation Challenge 2026

This project was built for the APOGEE Innovation Challenge 2026, the flagship technology festival of BITS Pilani.

### Innovation Highlights

**Predictive rather than reactive.** Instead of alerting operators after an inverter fails, the platform uses physics-based degradation models to dispatch technicians before failure occurs, reducing downtime and extending asset life.

**SCADA-grade polling frequency.** Most commercial solar monitoring tools update every 5 to 15 minutes. This platform achieves 500ms real-time updates through optimised SQLite WAL-mode batched writes and viewport-targeted SWR fetching that eliminates unnecessary data transfer.

**Zero cloud dependency.** The entire stack runs on a single machine, making it viable for rural and semi-urban grid sectors with intermittent or no internet connectivity. A Raspberry Pi 5 is sufficient to host the application for a real deployment.

**Geographic thermal awareness.** The simulation engine models localised thermal corridors based on actual Maharashtra climate data. Nagpur-zone nodes carry a persistent +5°C ambient thermal bias, reflecting real environmental stress on hardware in that region.

**End-to-end automated maintenance lifecycle.** From fault detection through ticket creation, technician dispatch, repair confirmation, and ticket closure, the complete maintenance workflow is handled automatically without operator intervention.

---

## Author

**Prem Motghare**  
APOGEE Innovation Challenge 2026 Participant

---

## License

This project is licensed under the MIT License.
