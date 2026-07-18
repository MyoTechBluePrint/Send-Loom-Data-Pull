-- CreateTable
CREATE TABLE "IntakeItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "raw" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'review',
    "confidence" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'Universal Inbox',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME,
    CONSTRAINT "IntakeItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExtractedRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "intakeId" TEXT NOT NULL,
    "fields" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "contactId" TEXT,
    "duplicateOf" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExtractedRecord_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "IntakeItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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

-- CreateIndex
CREATE INDEX "IntakeItem_workspaceId_status_idx" ON "IntakeItem"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "ExtractedRecord_intakeId_status_idx" ON "ExtractedRecord"("intakeId", "status");
