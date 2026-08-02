
-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "storeId" TEXT,
    "logoUrl" TEXT,
    "darkLogoUrl" TEXT,
    "iconUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#6d28d9',
    "secondaryColor" TEXT NOT NULL DEFAULT '#14121f',
    "accentColor" TEXT NOT NULL DEFAULT '#8b5cf6',
    "backgroundColor" TEXT NOT NULL DEFAULT '#faf9f7',
    "textColor" TEXT NOT NULL DEFAULT '#2c2b28',
    "headingFont" TEXT NOT NULL DEFAULT 'Helvetica, Arial, sans-serif',
    "bodyFont" TEXT NOT NULL DEFAULT 'Helvetica, Arial, sans-serif',
    "buttonRadius" INTEGER NOT NULL DEFAULT 8,
    "socialLinks" TEXT,
    "menuLinks" TEXT,
    "contactDetails" TEXT,
    "mailingAddress" TEXT,
    "legalLinks" TEXT,
    "senderName" TEXT,
    "senderEmail" TEXT,
    "replyToEmail" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "locale" TEXT NOT NULL DEFAULT 'en-GB',
    "footerText" TEXT,
    "unsubscribeText" TEXT NOT NULL DEFAULT 'You are receiving this because you subscribed. Unsubscribe at any time.',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "GlobalElement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "brandId" TEXT,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "updatedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GlobalElement_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GlobalElementVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "elementId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "savedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GlobalElementVersion_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "GlobalElement" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FormStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "formId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT,
    "fields" TEXT NOT NULL DEFAULT '[]',
    "rules" TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT "FormStep_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FormSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "formId" TEXT NOT NULL,
    "contactId" TEXT,
    "email" TEXT,
    "answers" TEXT NOT NULL DEFAULT '[]',
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "lastStep" INTEGER NOT NULL DEFAULT 0,
    "couponCodeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FormSubmission_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "storeId" TEXT,
    "name" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'shared',
    "sharedCode" TEXT,
    "prefix" TEXT NOT NULL DEFAULT 'LOOM',
    "kind" TEXT NOT NULL DEFAULT 'percent',
    "amount" REAL NOT NULL DEFAULT 10,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "expiryDays" INTEGER,
    "minSpend" REAL,
    "maxSpend" REAL,
    "usageLimit" INTEGER DEFAULT 1,
    "perCustomer" INTEGER DEFAULT 1,
    "individualUse" BOOLEAN NOT NULL DEFAULT true,
    "emailRestricted" BOOLEAN NOT NULL DEFAULT true,
    "includeProductIds" TEXT,
    "excludeProductIds" TEXT,
    "includeCategories" TEXT,
    "excludeCategories" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CouponCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "promotionId" TEXT NOT NULL,
    "contactId" TEXT,
    "email" TEXT,
    "code" TEXT NOT NULL,
    "source" TEXT,
    "expiresAt" DATETIME,
    "pushState" TEXT NOT NULL DEFAULT 'pending',
    "externalId" TEXT,
    "pushedAt" DATETIME,
    "redeemedAt" DATETIME,
    "orderRef" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CouponCode_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Poll" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PollAnswer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pollId" TEXT NOT NULL,
    "contactId" TEXT,
    "sendId" TEXT,
    "optionKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PollAnswer_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

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
INSERT INTO "new_Campaign" ("audienceRef", "audienceSnapshot", "audienceType", "clickRate", "content", "createdAt", "id", "isDemo", "name", "openRate", "previewText", "revenue", "scheduledAt", "sentAt", "status", "subject", "workspaceId") SELECT "audienceRef", "audienceSnapshot", "audienceType", "clickRate", "content", "createdAt", "id", "isDemo", "name", "openRate", "previewText", "revenue", "scheduledAt", "sentAt", "status", "subject", "workspaceId" FROM "Campaign";
DROP TABLE "Campaign";
ALTER TABLE "new_Campaign" RENAME TO "Campaign";
CREATE TABLE "new_EmailTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'newsletter',
    "brandId" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "updatedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EmailTemplate_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_EmailTemplate" ("content", "createdAt", "id", "name", "workspaceId") SELECT "content", "createdAt", "id", "name", "workspaceId" FROM "EmailTemplate";
DROP TABLE "EmailTemplate";
ALTER TABLE "new_EmailTemplate" RENAME TO "EmailTemplate";
CREATE TABLE "new_Form" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "trigger" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "views" INTEGER NOT NULL DEFAULT 0,
    "signups" INTEGER NOT NULL DEFAULT 0,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "headline" TEXT,
    "body" TEXT,
    "buttonLabel" TEXT,
    "consentLabel" TEXT,
    "successMessage" TEXT,
    "offerCode" TEXT,
    "accent" TEXT,
    "collectName" BOOLEAN NOT NULL DEFAULT false,
    "triggerKind" TEXT NOT NULL DEFAULT 'time_on_page',
    "triggerSeconds" INTEGER NOT NULL DEFAULT 8,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "imageLayout" TEXT NOT NULL DEFAULT 'none',
    "imageUrl" TEXT,
    "imageAlt" TEXT,
    "imageLinkUrl" TEXT,
    "imageOverlay" BOOLEAN NOT NULL DEFAULT true,
    "brandId" TEXT,
    "promotionId" TEXT,
    CONSTRAINT "Form_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Form" ("accent", "body", "buttonLabel", "collectName", "consentLabel", "createdAt", "headline", "id", "isDemo", "name", "offerCode", "signups", "status", "successMessage", "trigger", "triggerKind", "triggerSeconds", "type", "updatedAt", "views", "workspaceId") SELECT "accent", "body", "buttonLabel", "collectName", "consentLabel", "createdAt", "headline", "id", "isDemo", "name", "offerCode", "signups", "status", "successMessage", "trigger", "triggerKind", "triggerSeconds", "type", "updatedAt", "views", "workspaceId" FROM "Form";
DROP TABLE "Form";
ALTER TABLE "new_Form" RENAME TO "Form";
CREATE TABLE "new_Tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Tag_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Tag" ("createdAt", "id", "name", "workspaceId") SELECT "createdAt", "id", "name", "workspaceId" FROM "Tag";
DROP TABLE "Tag";
ALTER TABLE "new_Tag" RENAME TO "Tag";
CREATE UNIQUE INDEX "Tag_workspaceId_name_key" ON "Tag"("workspaceId", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Brand_workspaceId_name_key" ON "Brand"("workspaceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "GlobalElement_workspaceId_name_key" ON "GlobalElement"("workspaceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "GlobalElementVersion_elementId_version_key" ON "GlobalElementVersion"("elementId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "FormStep_formId_order_key" ON "FormStep"("formId", "order");

-- CreateIndex
CREATE INDEX "FormSubmission_formId_createdAt_idx" ON "FormSubmission"("formId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CouponCode_code_key" ON "CouponCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CouponCode_promotionId_contactId_key" ON "CouponCode"("promotionId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "PollAnswer_pollId_contactId_key" ON "PollAnswer"("pollId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignSend_campaignId_contactId_key" ON "CampaignSend"("campaignId", "contactId");

