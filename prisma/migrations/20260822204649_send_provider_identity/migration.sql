-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CampaignSend" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "providerMessageId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "openedAt" DATETIME,
    "clickedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CampaignSend_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CampaignSend_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_CampaignSend" ("campaignId", "clickedAt", "contactId", "createdAt", "id", "openedAt", "status") SELECT "campaignId", "clickedAt", "contactId", "createdAt", "id", "openedAt", "status" FROM "CampaignSend";
DROP TABLE "CampaignSend";
ALTER TABLE "new_CampaignSend" RENAME TO "CampaignSend";
CREATE INDEX "CampaignSend_campaignId_status_idx" ON "CampaignSend"("campaignId", "status");
CREATE UNIQUE INDEX "CampaignSend_campaignId_contactId_key" ON "CampaignSend"("campaignId", "contactId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
