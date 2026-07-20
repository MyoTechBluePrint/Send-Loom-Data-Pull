-- CreateTable
CREATE TABLE "DataFolder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ImportBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT,
    "folderId" TEXT,
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
    CONSTRAINT "ImportBatch_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ImportProject" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ImportBatch_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "DataFolder" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ImportBatch" ("blockedRows", "classification", "completedAt", "createdAt", "duplicateRows", "format", "id", "invalidRows", "mapping", "mergedRows", "missingConsentRows", "name", "options", "projectId", "readyRows", "revenue", "source", "sourceType", "status", "totalRows", "uploadedBy", "workspaceId") SELECT "blockedRows", "classification", "completedAt", "createdAt", "duplicateRows", "format", "id", "invalidRows", "mapping", "mergedRows", "missingConsentRows", "name", "options", "projectId", "readyRows", "revenue", "source", "sourceType", "status", "totalRows", "uploadedBy", "workspaceId" FROM "ImportBatch";
DROP TABLE "ImportBatch";
ALTER TABLE "new_ImportBatch" RENAME TO "ImportBatch";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "DataFolder_workspaceId_name_key" ON "DataFolder"("workspaceId", "name");
