/*
  Warnings:

  - The required column `publicId` was added to the `Store` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Cart" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "contactId" TEXT,
    "externalId" TEXT,
    "token" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "items" TEXT,
    "total" REAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "status" TEXT NOT NULL DEFAULT 'open',
    "checkoutStartedAt" DATETIME,
    "checkoutStep" TEXT,
    "abandonedAt" DATETIME,
    "recoveredAt" DATETIME,
    "recoveryToken" TEXT,
    "lastActivityAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Cart_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Cart_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Cart" ("contactId", "externalId", "id", "items", "status", "storeId", "total", "updatedAt") SELECT "contactId", "externalId", "id", "items", "status", "storeId", "total", "updatedAt" FROM "Cart";
DROP TABLE "Cart";
ALTER TABLE "new_Cart" RENAME TO "Cart";
CREATE UNIQUE INDEX "Cart_token_key" ON "Cart"("token");
CREATE UNIQUE INDEX "Cart_recoveryToken_key" ON "Cart"("recoveryToken");
CREATE INDEX "Cart_storeId_status_idx" ON "Cart"("storeId", "status");
CREATE INDEX "Cart_status_lastActivityAt_idx" ON "Cart"("status", "lastActivityAt");
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
    "lastEventAt" DATETIME,
    "pluginVersion" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Store_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Store" ("apiKey", "createdAt", "id", "lastSyncAt", "name", "platform", "pluginVersion", "status", "url", "workspaceId", "publicId") SELECT "apiKey", "createdAt", "id", "lastSyncAt", "name", "platform", "pluginVersion", "status", "url", "workspaceId", 'pub_' || "id" FROM "Store";
DROP TABLE "Store";
ALTER TABLE "new_Store" RENAME TO "Store";
CREATE UNIQUE INDEX "Store_apiKey_key" ON "Store"("apiKey");
CREATE UNIQUE INDEX "Store_publicId_key" ON "Store"("publicId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
