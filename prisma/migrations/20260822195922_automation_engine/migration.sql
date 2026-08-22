-- AlterTable
ALTER TABLE "Automation" ADD COLUMN "triggerEvent" TEXT;

-- AlterTable
ALTER TABLE "AutomationRun" ADD COLUMN "nextDueAt" DATETIME;
