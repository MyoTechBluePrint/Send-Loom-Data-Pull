-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    CONSTRAINT "Form_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Form" ("createdAt", "id", "isDemo", "name", "signups", "status", "trigger", "type", "views", "workspaceId") SELECT "createdAt", "id", "isDemo", "name", "signups", "status", "trigger", "type", "views", "workspaceId" FROM "Form";
DROP TABLE "Form";
ALTER TABLE "new_Form" RENAME TO "Form";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
