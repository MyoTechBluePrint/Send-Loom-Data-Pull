-- AlterTable
ALTER TABLE "AutomationRun" ADD COLUMN "stoppedReason" TEXT;

-- CreateTable
CREATE TABLE "AutomationRunEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" TEXT NOT NULL,
    "detail" TEXT,
    CONSTRAINT "AutomationRunEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AutomationRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AutomationRunEvent_runId_at_idx" ON "AutomationRunEvent"("runId", "at");
