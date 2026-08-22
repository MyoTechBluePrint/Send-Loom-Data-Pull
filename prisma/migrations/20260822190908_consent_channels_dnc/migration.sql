-- AlterTable
ALTER TABLE "Form" ADD COLUMN "smsConsentLabel" TEXT;
ALTER TABLE "Form" ADD COLUMN "whatsappConsentLabel" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT,
    "previewText" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "channel" TEXT NOT NULL DEFAULT 'email',
    "audienceType" TEXT,
    "audienceRef" TEXT,
    "audienceSnapshot" INTEGER NOT NULL DEFAULT 0,
    "content" TEXT,
    "renderedHtml" TEXT,
    "renderedText" TEXT,
    "templateId" TEXT,
    "brandId" TEXT,
    "contentDirty" BOOLEAN NOT NULL DEFAULT false,
    "scheduledAt" DATETIME,
    "sentAt" DATETIME,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "openRate" REAL NOT NULL DEFAULT 0,
    "clickRate" REAL NOT NULL DEFAULT 0,
    "revenue" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sendMode" TEXT NOT NULL DEFAULT 'immediate',
    "sendDurationMins" INTEGER,
    "sendBatchSize" INTEGER NOT NULL DEFAULT 100,
    "sendWindowStart" INTEGER,
    "sendWindowEnd" INTEGER,
    "sendState" TEXT,
    "sendPausedAt" DATETIME,
    "sendPauseReason" TEXT,
    "nextBatchAt" DATETIME,
    CONSTRAINT "Campaign_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Campaign_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EmailTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Campaign" ("audienceRef", "audienceSnapshot", "audienceType", "brandId", "clickRate", "content", "contentDirty", "createdAt", "id", "isDemo", "name", "nextBatchAt", "openRate", "previewText", "renderedHtml", "renderedText", "revenue", "scheduledAt", "sendBatchSize", "sendDurationMins", "sendMode", "sendPauseReason", "sendPausedAt", "sendState", "sendWindowEnd", "sendWindowStart", "sentAt", "status", "subject", "templateId", "workspaceId") SELECT "audienceRef", "audienceSnapshot", "audienceType", "brandId", "clickRate", "content", "contentDirty", "createdAt", "id", "isDemo", "name", "nextBatchAt", "openRate", "previewText", "renderedHtml", "renderedText", "revenue", "scheduledAt", "sendBatchSize", "sendDurationMins", "sendMode", "sendPauseReason", "sendPausedAt", "sendState", "sendWindowEnd", "sendWindowStart", "sentAt", "status", "subject", "templateId", "workspaceId" FROM "Campaign";
DROP TABLE "Campaign";
ALTER TABLE "new_Campaign" RENAME TO "Campaign";
CREATE TABLE "new_Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT,
    "country" TEXT,
    "city" TEXT,
    "postcode" TEXT,
    "externalCustomerId" TEXT,
    "notes" TEXT,
    "customFields" TEXT,
    "confidence" INTEGER NOT NULL DEFAULT 70,
    "engagement" TEXT NOT NULL DEFAULT 'none',
    "emailConsent" TEXT NOT NULL DEFAULT 'unknown',
    "smsConsent" TEXT NOT NULL DEFAULT 'unknown',
    "whatsappConsent" TEXT NOT NULL DEFAULT 'unknown',
    "doNotContact" BOOLEAN NOT NULL DEFAULT false,
    "consentSource" TEXT,
    "consentAt" DATETIME,
    "consentUpdatedBy" TEXT,
    "ordersCount" INTEGER NOT NULL DEFAULT 0,
    "revenue" REAL NOT NULL DEFAULT 0,
    "lastOrderAt" DATETIME,
    "lastActivityAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Contact_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Contact" ("city", "confidence", "country", "createdAt", "customFields", "email", "engagement", "externalCustomerId", "firstName", "id", "lastActivityAt", "lastName", "lastOrderAt", "notes", "ordersCount", "phone", "postcode", "revenue", "updatedAt", "workspaceId") SELECT "city", "confidence", "country", "createdAt", "customFields", "email", "engagement", "externalCustomerId", "firstName", "id", "lastActivityAt", "lastName", "lastOrderAt", "notes", "ordersCount", "phone", "postcode", "revenue", "updatedAt", "workspaceId" FROM "Contact";
DROP TABLE "Contact";
ALTER TABLE "new_Contact" RENAME TO "Contact";
CREATE INDEX "Contact_workspaceId_lastActivityAt_idx" ON "Contact"("workspaceId", "lastActivityAt");
CREATE UNIQUE INDEX "Contact_workspaceId_email_key" ON "Contact"("workspaceId", "email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Backfill: fold the existing ledger into the new current-state columns, so
-- production wakes up already knowing where every contact stands. The latest
-- ConsentRecord per channel wins, exactly as every reader has always assumed.
-- Contacts with no ledger rows stay "unknown": history without evidence is
-- never treated as consent.
UPDATE "Contact" SET "emailConsent" = COALESCE((
  SELECT cr."status" FROM "ConsentRecord" cr
  WHERE cr."contactId" = "Contact"."id" AND cr."channel" = 'email'
  ORDER BY cr."createdAt" DESC, cr."id" DESC LIMIT 1
), 'unknown');
UPDATE "Contact" SET "smsConsent" = COALESCE((
  SELECT cr."status" FROM "ConsentRecord" cr
  WHERE cr."contactId" = "Contact"."id" AND cr."channel" = 'sms'
  ORDER BY cr."createdAt" DESC, cr."id" DESC LIMIT 1
), 'unknown');
UPDATE "Contact" SET "whatsappConsent" = COALESCE((
  SELECT cr."status" FROM "ConsentRecord" cr
  WHERE cr."contactId" = "Contact"."id" AND cr."channel" = 'whatsapp'
  ORDER BY cr."createdAt" DESC, cr."id" DESC LIMIT 1
), 'unknown');

-- The old integration API wrote "revoked", a word no reader ever checked
-- for. It meant withdrawn; make it say so, in the ledger and the mirror.
UPDATE "ConsentRecord" SET "status" = 'withdrawn' WHERE "status" = 'revoked';
UPDATE "Contact" SET "emailConsent" = 'withdrawn' WHERE "emailConsent" = 'revoked';
UPDATE "Contact" SET "smsConsent" = 'withdrawn' WHERE "smsConsent" = 'revoked';
UPDATE "Contact" SET "whatsappConsent" = 'withdrawn' WHERE "whatsappConsent" = 'revoked';

-- Consent stamp for the profile header: when and whence the newest row came.
UPDATE "Contact" SET
  "consentAt" = (SELECT cr."createdAt" FROM "ConsentRecord" cr WHERE cr."contactId" = "Contact"."id" ORDER BY cr."createdAt" DESC, cr."id" DESC LIMIT 1),
  "consentUpdatedBy" = (SELECT cr."actor" FROM "ConsentRecord" cr WHERE cr."contactId" = "Contact"."id" ORDER BY cr."createdAt" DESC, cr."id" DESC LIMIT 1),
  "consentSource" = (SELECT cr."lawfulBasis" FROM "ConsentRecord" cr WHERE cr."contactId" = "Contact"."id" ORDER BY cr."createdAt" DESC, cr."id" DESC LIMIT 1);
