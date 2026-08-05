-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'TECHNICIAN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Inverter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "location" TEXT NOT NULL,
    "healthState" INTEGER NOT NULL DEFAULT 0,
    "lastSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TelemetryLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "inverterId" TEXT NOT NULL,
    "dcBusRippleVoltage" REAL NOT NULL,
    "capacitorEsr" REAL NOT NULL,
    "junctionTemp" REAL NOT NULL,
    "mosfetOnResistance" REAL NOT NULL,
    "conversionEfficiency" REAL NOT NULL,
    "heatsinkTemp" REAL NOT NULL,
    "commandedFanRpm" INTEGER NOT NULL,
    "actualFanRpm" INTEGER NOT NULL,
    "thd" REAL NOT NULL,
    "mainsSurges" INTEGER NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TelemetryLog_inverterId_fkey" FOREIGN KEY ("inverterId") REFERENCES "Inverter" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DispatchTicket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inverterId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "description" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'HIGH',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    CONSTRAINT "DispatchTicket_inverterId_fkey" FOREIGN KEY ("inverterId") REFERENCES "Inverter" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
