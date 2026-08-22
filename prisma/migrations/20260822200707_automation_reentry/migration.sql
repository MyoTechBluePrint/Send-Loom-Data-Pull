-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Automation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "triggerEvent" TEXT,
    "allowReentry" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "entered" INTEGER NOT NULL DEFAULT 0,
    "completed" INTEGER NOT NULL DEFAULT 0,
    "revenue" REAL NOT NULL DEFAULT 0,
    "conversion" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Automation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Automation" ("completed", "conversion", "createdAt", "entered", "id", "isDemo", "name", "revenue", "status", "trigger", "triggerEvent", "workspaceId") SELECT "completed", "conversion", "createdAt", "entered", "id", "isDemo", "name", "revenue", "status", "trigger", "triggerEvent", "workspaceId" FROM "Automation";
DROP TABLE "Automation";
ALTER TABLE "new_Automation" RENAME TO "Automation";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
