-- AlterTable
ALTER TABLE "Automation" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "Automation" ADD COLUMN "deletedBy" TEXT;

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "Campaign" ADD COLUMN "deletedBy" TEXT;

-- CreateTable
CREATE TABLE "DeletionRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entityCreatedAt" DATETIME NOT NULL,
    "deletedBy" TEXT NOT NULL,
    "deletedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metricsSnapshot" TEXT NOT NULL,
    "restoredAt" DATETIME,
    "restoredBy" TEXT
);

-- CreateIndex
CREATE INDEX "DeletionRecord_workspaceId_deletedAt_idx" ON "DeletionRecord"("workspaceId", "deletedAt");
