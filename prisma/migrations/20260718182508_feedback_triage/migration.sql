-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Feedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "internalNote" TEXT,
    "area" TEXT NOT NULL,
    "workedWell" TEXT,
    "confusing" TEXT,
    "missing" TEXT,
    "improve" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "notes" TEXT,
    "author" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Feedback" ("area", "author", "confusing", "createdAt", "id", "improve", "missing", "notes", "priority", "workedWell", "workspaceId") SELECT "area", "author", "confusing", "createdAt", "id", "improve", "missing", "notes", "priority", "workedWell", "workspaceId" FROM "Feedback";
DROP TABLE "Feedback";
ALTER TABLE "new_Feedback" RENAME TO "Feedback";
CREATE INDEX "Feedback_workspaceId_createdAt_idx" ON "Feedback"("workspaceId", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
