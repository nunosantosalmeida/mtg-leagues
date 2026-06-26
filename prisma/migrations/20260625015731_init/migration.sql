-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'PLAYER',
    "provider" TEXT NOT NULL DEFAULT 'credentials',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "League" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "format" TEXT NOT NULL DEFAULT 'COMMANDER',
    "bestOf" INTEGER NOT NULL DEFAULT 1,
    "totalDays" INTEGER NOT NULL DEFAULT 5,
    "status" TEXT NOT NULL DEFAULT 'REGISTRATION',
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "League_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeaguePlayer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "points" REAL NOT NULL DEFAULT 1500,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "LeaguePlayer_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LeaguePlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeagueDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    CONSTRAINT "LeagueDay_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Round" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueDayId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    CONSTRAINT "Round_leagueDayId_fkey" FOREIGN KEY ("leagueDayId") REFERENCES "LeagueDay" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Table" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roundId" TEXT NOT NULL,
    "tableNumber" INTEGER NOT NULL,
    CONSTRAINT "Table_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TablePlayer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tableId" TEXT NOT NULL,
    "leaguePlayerId" TEXT NOT NULL,
    "seatPosition" INTEGER NOT NULL,
    "result" TEXT NOT NULL DEFAULT 'PENDING',
    "pointsWagered" REAL NOT NULL,
    "pointsChange" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "TablePlayer_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TablePlayer_leaguePlayerId_fkey" FOREIGN KEY ("leaguePlayerId") REFERENCES "LeaguePlayer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlayerPointChange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leaguePlayerId" TEXT NOT NULL,
    "roundId" TEXT,
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlayerPointChange_leaguePlayerId_fkey" FOREIGN KEY ("leaguePlayerId") REFERENCES "LeaguePlayer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "LeaguePlayer_leagueId_userId_key" ON "LeaguePlayer"("leagueId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueDay_leagueId_dayNumber_key" ON "LeagueDay"("leagueId", "dayNumber");

-- CreateIndex
CREATE UNIQUE INDEX "TablePlayer_tableId_leaguePlayerId_key" ON "TablePlayer"("tableId", "leaguePlayerId");
