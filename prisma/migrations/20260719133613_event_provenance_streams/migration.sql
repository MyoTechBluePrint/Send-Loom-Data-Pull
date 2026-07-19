-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "storeId" TEXT,
    "contactId" TEXT,
    "type" TEXT NOT NULL,
    "payload" TEXT,
    "anonymousId" TEXT,
    "stream" TEXT NOT NULL DEFAULT 'storefront',
    "sourceContext" TEXT,
    "acceptReason" TEXT,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Event_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Event_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Event" ("anonymousId", "contactId", "createdAt", "id", "occurredAt", "payload", "storeId", "type", "workspaceId") SELECT "anonymousId", "contactId", "createdAt", "id", "occurredAt", "payload", "storeId", "type", "workspaceId" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
CREATE INDEX "Event_workspaceId_type_occurredAt_idx" ON "Event"("workspaceId", "type", "occurredAt");
CREATE INDEX "Event_contactId_occurredAt_idx" ON "Event"("contactId", "occurredAt");
CREATE TABLE "new_Store" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'woocommerce',
    "apiKey" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "domains" TEXT,
    "environment" TEXT NOT NULL DEFAULT 'staging',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "lastSyncAt" DATETIME,
    "backendDomains" TEXT,
    "trackingMode" TEXT NOT NULL DEFAULT 'live',
    "lastEventAt" DATETIME,
    "pluginVersion" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Store_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Store" ("apiKey", "backendDomains", "createdAt", "domains", "environment", "id", "lastEventAt", "lastSyncAt", "name", "platform", "pluginVersion", "publicId", "status", "url", "workspaceId") SELECT "apiKey", "backendDomains", "createdAt", "domains", "environment", "id", "lastEventAt", "lastSyncAt", "name", "platform", "pluginVersion", "publicId", "status", "url", "workspaceId" FROM "Store";
DROP TABLE "Store";
ALTER TABLE "new_Store" RENAME TO "Store";
CREATE UNIQUE INDEX "Store_apiKey_key" ON "Store"("apiKey");
CREATE UNIQUE INDEX "Store_publicId_key" ON "Store"("publicId");
CREATE TABLE "new_TrackingReject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "url" TEXT,
    "eventType" TEXT,
    "reason" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'rejected',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrackingReject_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_TrackingReject" ("createdAt", "eventType", "host", "id", "reason", "storeId", "url") SELECT "createdAt", "eventType", "host", "id", "reason", "storeId", "url" FROM "TrackingReject";
DROP TABLE "TrackingReject";
ALTER TABLE "new_TrackingReject" RENAME TO "TrackingReject";
CREATE INDEX "TrackingReject_storeId_createdAt_idx" ON "TrackingReject"("storeId", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
