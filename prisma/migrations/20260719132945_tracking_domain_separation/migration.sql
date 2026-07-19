-- AlterTable
ALTER TABLE "Store" ADD COLUMN "backendDomains" TEXT;

-- CreateTable
CREATE TABLE "TrackingReject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "url" TEXT,
    "eventType" TEXT,
    "reason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrackingReject_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TrackingReject_storeId_createdAt_idx" ON "TrackingReject"("storeId", "createdAt");
