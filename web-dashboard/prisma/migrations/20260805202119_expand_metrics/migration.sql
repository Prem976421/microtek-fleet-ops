-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TelemetryLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "inverterId" TEXT NOT NULL,
    "ambientTemp" REAL NOT NULL DEFAULT 0.0,
    "relativeHumidity" REAL NOT NULL DEFAULT 0.0,
    "dustIndex" REAL NOT NULL DEFAULT 0.0,
    "solarIrradiance" REAL NOT NULL DEFAULT 0.0,
    "dcBusRippleVoltage" REAL NOT NULL DEFAULT 0.0,
    "dcBusRippleCurrent" REAL NOT NULL DEFAULT 0.0,
    "activePower" REAL NOT NULL DEFAULT 0.0,
    "reactivePower" REAL NOT NULL DEFAULT 0.0,
    "acFrequencyDrift" REAL NOT NULL DEFAULT 0.0,
    "insulationResistance" REAL NOT NULL DEFAULT 0.0,
    "thd" REAL NOT NULL DEFAULT 0.0,
    "mainsSurges" INTEGER NOT NULL DEFAULT 0,
    "junctionTemp" REAL NOT NULL DEFAULT 0.0,
    "heatsinkTemp" REAL NOT NULL DEFAULT 0.0,
    "heatsinkDelta" REAL NOT NULL DEFAULT 0.0,
    "mosfetOnResistance" REAL NOT NULL DEFAULT 0.0,
    "igbtVgeth" REAL NOT NULL DEFAULT 0.0,
    "commandedFanRpm" INTEGER NOT NULL DEFAULT 0,
    "actualFanRpm" INTEGER NOT NULL DEFAULT 0,
    "smpsOutputVoltage" REAL NOT NULL DEFAULT 0.0,
    "capacitorEsr" REAL NOT NULL DEFAULT 0.0,
    "conversionEfficiency" REAL NOT NULL DEFAULT 0.0,
    "cumulativeThermalStress" REAL NOT NULL DEFAULT 0.0,
    "rulVelocity" REAL NOT NULL DEFAULT 0.0,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TelemetryLog_inverterId_fkey" FOREIGN KEY ("inverterId") REFERENCES "Inverter" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_TelemetryLog" ("actualFanRpm", "capacitorEsr", "commandedFanRpm", "conversionEfficiency", "dcBusRippleVoltage", "heatsinkTemp", "id", "inverterId", "junctionTemp", "mainsSurges", "mosfetOnResistance", "thd", "timestamp") SELECT "actualFanRpm", "capacitorEsr", "commandedFanRpm", "conversionEfficiency", "dcBusRippleVoltage", "heatsinkTemp", "id", "inverterId", "junctionTemp", "mainsSurges", "mosfetOnResistance", "thd", "timestamp" FROM "TelemetryLog";
DROP TABLE "TelemetryLog";
ALTER TABLE "new_TelemetryLog" RENAME TO "TelemetryLog";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
