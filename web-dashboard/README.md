<div align="center">

# ⚡ Microtek Fleet Ops
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

## 📌 Problem Statement

India's distributed solar energy sector is growing at an unprecedented rate, but fleet operators managing hundreds of solar inverters across vast geographic regions — from Nagpur's industrial estates to Chandrapur's rural grid sectors — face a critical challenge: **there is no real-time, unified visibility into the health of their inverter fleet**.

Traditional monitoring solutions are either:
- Too expensive and proprietary (SCADA vendors like Siemens, ABB)
- Too simple and reactive (inverter manufacturer apps — only alert after failure)
- Unable to predict failures before they cause downtime and revenue loss

**Microtek Fleet Ops** solves this by delivering a production-grade, open-source fleet intelligence platform that provides:
- **Real-time SCADA-grade telemetry** at 500ms polling frequency
- **Predictive Remaining Useful Life (RUL)** estimation using physics-based degradation modelling
- **Automated dispatch ticketing** so field technicians are dispatched *before* failure occurs
- **Geographic heatmap analytics** with regional health visibility across multiple localities

---

## 🏗️ System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     MICROTEK FLEET OPS                           │
│                                                                  │
│   ┌─────────────────┐       ┌──────────────────────────────┐    │
│   │  SCADA Simulator │──────▶│   SQLite (WAL Mode)          │    │
│   │  scripts/        │ 500ms │   38-node Telemetry Store    │    │
│   │  simulate.ts     │ ticks │   TelemetryLog + Inverter    │    │
│   └─────────────────┘       └──────────────────────────────┘    │
│                                          │                       │
│                              ┌───────────▼──────────────┐        │
│                              │   Next.js API Routes      │        │
│                              │  /api/fleet?nodeId=XYZ    │        │
│                              │  /api/analytics           │        │
│                              │  (SQLite GROUP BY queries) │       │
│                              └───────────┬──────────────┘        │
│                                          │                       │
│                              ┌───────────▼──────────────┐        │
│                              │  React Frontend (SWR)     │        │
│                              │  500ms viewport-targeted  │        │
│                              │  high-frequency polling   │        │
│                              └──────────────────────────┘        │
└──────────────────────────────────────────────────────────────────┘
```

### Key Technical Decisions

| Component | Technology | Why |
|-----------|-----------|-----|
| Framework | Next.js 16 (App Router) | Server-side API routes + React UI in one repo |
| Database | SQLite in WAL mode | Zero-config, supports 2 req/sec without locking |
| ORM | Prisma 7 | Type-safe queries, schema migrations |
| Realtime | SWR `{ refreshInterval: 500 }` | Built-in deduplication, lifecycle management |
| Charts | Recharts 3 | Composable, declarative, performant |
| Physics | Custom TS degradation engine | Gaussian noise + diurnal solar curves |

---

## ✨ Features

### 🖥️ Main Fleet Dashboard (`/`)
- **Live Node Sidebar** — 38 inverter nodes with Green/Amber/Red health dots, searchable by ID or zone
- **Targeted SWR Polling** — only fetches full 25-parameter telemetry for the **active node** in the viewport (not all 38), keeping API payloads tiny
- **Node Detail Panel** — full SCADA telemetry readout with animated metric cards:
  - Primary Health: Conversion Efficiency, DC Bus Ripple, RUL Velocity, Insulation Resistance
  - Environmental: Ambient Temp, Relative Humidity, Dust Index, Solar Irradiance
  - Power Grid: Active Power, Reactive Power, THD, AC Frequency Drift
  - Subsystems: Heatsink ΔT, Fan RPM Delta, SMPS Output, MOSFET Rds(on)
- **RUL Health Bar** — colour-coded Remaining Useful Life percentage estimate per node
- **Live Dispatch Terminal** — real-time scrolling feed of automated technician dispatch events

### 📊 Regional & Fleet Analytics (`/analytics`)
- **KPI Row** — Total Deployed, Operational Health Rate, Avg Fleet RUL, Estimated MTBF (all pre-calculated in SQLite, zero client-side computation)
- **Geographic Heatmap** — interactive map of Nagpur, Chandrapur, and Umred with live pulse markers (Red = Critical, Amber = Warning, Green = Nominal)
- **Fleet Health Breakdown** — donut pie chart of Nominal / Warning / Critical / Offline distribution
- **Predictive Maintenance Rankings** — top 5 fastest-degrading nodes ranked by RUL velocity (computed via SQL window function)
- **Energy Efficiency & Capacity Curve** — time-series line chart of actual vs. theoretical power output following a real diurnal solar curve

### ⚙️ SCADA Physics Simulator (`scripts/simulate.ts`)
- **38-node heterogeneous fleet** seeded with permanent health profiles:
  - 32 Nominal nodes (RUL: 85–99%)
  - 4 Warning nodes (RUL: 45–65%, persistent high ambient temp ≥48°C)
  - 2 Critical nodes (RUL: 12–25%, dangerous DC ripple ≥6.8V → auto-tickets created)
- **Diurnal solar curve** — power output follows a Gaussian bell curve pegged to time of day (dawn ramp → noon peak → dusk falloff)
- **Thermal corridor biasing** — Nagpur-zone nodes carry a persistent +5°C ambient thermal bias reflecting real geographic conditions
- **Stochastic events** — random brownout events (grid voltage drop to 186V), fan RPM deviations, capacitor ESR drift
- **Auto-repair lifecycle** — critical nodes self-resolve after technician dispatch delay, ticket status updated to CLOSED
- **500ms tick rate** — matches the SWR polling frequency for seamless live updates

---

## 🗂️ Project Structure

```
web-dashboard/
├── prisma/
│   └── schema.prisma          # Database schema (Inverter, TelemetryLog, DispatchTicket)
├── scripts/
│   └── simulate.ts            # SCADA physics simulator (runs as background process)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── fleet/
│   │   │   │   └── route.ts   # GET /api/fleet?nodeId= (targeted telemetry fetch)
│   │   │   └── analytics/
│   │   │       └── route.ts   # GET /api/analytics (pre-aggregated via SQL GROUP BY)
│   │   ├── analytics/
│   │   │   └── page.tsx       # Regional & Fleet Analytics dashboard
│   │   ├── globals.css        # Dark mode glassmorphism design system
│   │   ├── layout.tsx         # Root layout with nav bar
│   │   └── page.tsx           # Main Fleet Dashboard (500ms SWR polling)
│   └── lib/
│       ├── prisma.ts          # Prisma client singleton (WAL mode + performance PRAGMAs)
│       └── thresholds.ts      # 3-tier health state engine (Green/Amber/Red thresholds)
├── .env                       # DATABASE_URL=file:./dev.db
├── package.json
└── tsconfig.json
```

---

## 🚀 Setup & Installation

### Prerequisites

Make sure you have the following installed on your system:

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 20.x | https://nodejs.org |
| npm | ≥ 10.x | Bundled with Node.js |
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

This installs all required packages including Next.js, Prisma, Recharts, SWR, and the SQLite adapter.

---

### Step 3 — Set Up the Database

Generate the Prisma client and push the schema to create the local SQLite database:

```bash
npx prisma generate
npx prisma db push
```

This creates a `dev.db` SQLite file in the project root with the full schema:
- `Inverter` — 38 inverter node records
- `TelemetryLog` — continuously written SCADA telemetry
- `DispatchTicket` — automated field technician dispatch events

---

### Step 4 — Start the SCADA Simulator

Open a **dedicated terminal** and run the physics simulation engine:

```bash
npx tsx scripts/simulate.ts
```

You will see output like:
```
╔═══════════════════════════════════════════════════════════╗
║  MICROTEK Enterprise Fleet Ops — SCADA Simulator (500ms) ║
╚═══════════════════════════════════════════════════════════╝

✅ SQLite WAL mode + performance PRAGMAs enabled.
🌱 Seeding 38 nodes (32 Nominal / 4 Warning / 2 Critical)…
   ⚠️  INV_ESP32_033: ambientTemp=48.6°C, dcRipple=4.36V
   🔴 INV_ESP32_037: ambientTemp=55.4°C, dcRipple=9.74V
   🎫 CRITICAL dispatch ticket created for INV_ESP32_037
✅ Seeding complete.
🔄 SCADA telemetry loop started at 500ms interval…
[Tick 20] ☀️  Solar 95% | ✅ 32 Nominal | ⚠️  4 Warning | 🔴 2 Critical
```

**Leave this terminal running** throughout your session. It writes new telemetry into SQLite every 500ms.

---

### Step 5 — Start the Web Dashboard

Open a **second terminal** and start the Next.js development server:

```bash
npm run dev
```

Expected output:
```
▲ Next.js 16.3.0 (Turbopack)
- Local:   http://localhost:3000
✓ Ready in 758ms
```

---

### Step 6 — Open the Dashboard

Navigate to the following URLs in your browser:

| Page | URL | Description |
|------|-----|-------------|
| Fleet Dashboard | http://localhost:3000 | Live per-node SCADA telemetry |
| Regional Analytics | http://localhost:3000/analytics | Fleet-wide analytics & heatmap |

---

## 🔬 How the Physics Engine Works

The simulator (`scripts/simulate.ts`) models real-world inverter degradation:

### Diurnal Solar Curve
Power generation follows a time-aware Gaussian curve:
```
solarMultiplier = exp(-0.5 × ((hourOfDay - 12) / 3.5)²)
activePower = nominalPower × solarMultiplier × (1 + Gaussian noise)
```

### 3-Tier Health Classification

| State | Health Index | RUL Range | Visual | Trigger Condition |
|-------|-------------|-----------|--------|-------------------|
| Nominal | 0 | 85–99% | 🟢 Green | All parameters within spec |
| Warning | 1 | 45–65% | 🟡 Amber | Ambient temp ≥ 48°C OR DC ripple ≥ 4V |
| Critical | 2 | 12–25% | 🔴 Red | DC ripple ≥ 6.8V AND insulation ≤ 2.5 MΩ |

### RUL Velocity
Each tick updates the degradation rate:
```
rulVelocity = thermalStress × (dcRippleFactor + insulationFactor) × noise
```
High `rulVelocity` = faster degradation = auto-dispatch ticket triggered.

---

## 📡 API Reference

### `GET /api/fleet?nodeId=INV_ESP32_001`

Returns lightweight fleet status for all nodes + full telemetry for the requested node.

```json
{
  "fleetStatus": [
    { "id": "INV_ESP32_001", "locality": "Zone A: Northern Industrial Estate", "healthState": 0, "signalStrength": -68 }
  ],
  "activeNode": {
    "id": "INV_ESP32_001",
    "telemetry": [{ "ambientTemp": 34.2, "dcBusRippleVoltage": 1.8, "activePower": 1240, ... }],
    "tickets": []
  },
  "globalTickets": [...]
}
```

### `GET /api/analytics`

Returns pre-aggregated analytics computed entirely in SQLite (`GROUP BY`, window functions).

```json
{
  "kpis": { "totalDeployed": 38, "healthRate": "84.2", "avgRul": 78.4, "mtbfEst": 14112 },
  "healthDistribution": [{ "name": "Nominal", "value": 32 }, { "name": "Warning", "value": 4 }],
  "timeseries": [{ "timestamp": 1754430000000, "power": 187.4, "capacity": 209.0 }],
  "degradingNodes": [{ "id": "INV_ESP32_037", "rulVelocity": 0.0842, "healthState": 2 }],
  "geographicHeatmap": [...]
}
```

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|-----------|
| **Frontend** | Next.js 16, React 19, TypeScript 5 |
| **Styling** | Vanilla CSS with glassmorphism dark mode |
| **Data Fetching** | SWR 2.5 (500ms, deduplication) |
| **Charts** | Recharts 3 |
| **Backend** | Next.js App Router API Routes |
| **Database** | SQLite (WAL mode) via Prisma 7 |
| **SQLite Adapter** | `@prisma/adapter-better-sqlite3` |
| **Simulator** | `tsx` + Node.js 25 |
| **Icons** | Lucide React |

---

## 🏆 APOGEE Innovation Challenge 2026

This project was built for the **APOGEE Innovation Challenge 2026** — the flagship technology festival of BITS Pilani.

### Innovation Highlights

1. **Real-time predictive maintenance** at the edge — instead of reactive monitoring, the platform uses physics-based degradation models to dispatch technicians *before* inverters fail

2. **SCADA-grade 500ms polling** — most commercial solar monitoring tools update every 5–15 minutes; we achieve real-time situational awareness through optimized SQLite WAL-mode batched writes and targeted viewport-based SWR fetching

3. **Zero-cloud, fully local** — the entire stack runs on a single machine (a Raspberry Pi 5 could host this for a real deployment), making it viable for rural and semi-urban grid sectors with intermittent internet

4. **Geographic thermal awareness** — the physics engine models localized thermal corridors (Nagpur nodes carry a +5°C persistent bias reflecting actual Maharashtra climate data)

5. **Automated dispatch lifecycle** — from fault detection → ticket creation → technician dispatch → repair confirmation → ticket closure, the full maintenance workflow is automated end-to-end

---

## 👨‍💻 Author

**Prem Motghare**
APOGEE Innovation Challenge 2026 Participant

---

## 📄 License

This project is licensed under the MIT License.
