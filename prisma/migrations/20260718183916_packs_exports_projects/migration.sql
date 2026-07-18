-- CreateTable
CREATE TABLE "ContactPack" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "contactIds" TEXT NOT NULL,
    "total" INTEGER NOT NULL DEFAULT 0,
    "eligible" INTEGER NOT NULL DEFAULT 0,
    "withEmail" INTEGER NOT NULL DEFAULT 0,
    "withPhone" INTEGER NOT NULL DEFAULT 0,
    "excludedSuppressed" INTEGER NOT NULL DEFAULT 0,
    "excludedUnsubscribed" INTEGER NOT NULL DEFAULT 0,
    "excludedNoRoute" INTEGER NOT NULL DEFAULT 0,
    "duplicatesRemoved" INTEGER NOT NULL DEFAULT 0,
    "suggestedUse" TEXT,
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ExportLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "packId" TEXT,
    "user" TEXT NOT NULL,
    "dataType" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "contacts" INTEGER NOT NULL DEFAULT 0,
    "excludedSuppressed" INTEGER NOT NULL DEFAULT 0,
    "excludedUnsubscribed" INTEGER NOT NULL DEFAULT 0,
    "duplicatesRemoved" INTEGER NOT NULL DEFAULT 0,
    "batch" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExportLog_packId_fkey" FOREIGN KEY ("packId") REFERENCES "ContactPack" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ImportBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT,
    "classification" TEXT,
    "name" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'import',
    "format" TEXT NOT NULL DEFAULT 'csv',
    "uploadedBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'mapping',
    "mapping" TEXT,
    "options" TEXT,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "readyRows" INTEGER NOT NULL DEFAULT 0,
    "duplicateRows" INTEGER NOT NULL DEFAULT 0,
    "mergedRows" INTEGER NOT NULL DEFAULT 0,
    "blockedRows" INTEGER NOT NULL DEFAULT 0,
    "missingConsentRows" INTEGER NOT NULL DEFAULT 0,
    "invalidRows" INTEGER NOT NULL DEFAULT 0,
    "revenue" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "ImportBatch_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ImportBatch_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ImportProject" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ImportBatch" ("blockedRows", "completedAt", "createdAt", "duplicateRows", "format", "id", "invalidRows", "mapping", "mergedRows", "missingConsentRows", "name", "options", "readyRows", "revenue", "source", "sourceType", "status", "totalRows", "uploadedBy", "workspaceId") SELECT "blockedRows", "completedAt", "createdAt", "duplicateRows", "format", "id", "invalidRows", "mapping", "mergedRows", "missingConsentRows", "name", "options", "readyRows", "revenue", "source", "sourceType", "status", "totalRows", "uploadedBy", "workspaceId" FROM "ImportBatch";
DROP TABLE "ImportBatch";
ALTER TABLE "new_ImportBatch" RENAME TO "ImportBatch";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ExportLog_workspaceId_createdAt_idx" ON "ExportLog"("workspaceId", "createdAt");
