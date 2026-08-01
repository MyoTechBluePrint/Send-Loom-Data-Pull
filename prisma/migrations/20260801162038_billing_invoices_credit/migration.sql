-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subscriptionId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "amountPence" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "status" TEXT NOT NULL,
    "description" TEXT,
    "periodStart" DATETIME,
    "periodEnd" DATETIME,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" DATETIME,
    "stripeInvoiceId" TEXT,
    "hostedUrl" TEXT,
    "pdfUrl" TEXT,
    CONSTRAINT "Invoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "planId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'trialing_no_pm',
    "billingCycle" TEXT NOT NULL DEFAULT 'monthly',
    "trialStartedAt" DATETIME,
    "trialStageOneEndsAt" DATETIME,
    "trialEndsAt" DATETIME,
    "firstBillingAt" DATETIME,
    "firstChargePence" INTEGER,
    "paymentMethodVerifiedAt" DATETIME,
    "paymentMethodBrand" TEXT,
    "paymentMethodLast4" TEXT,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripePaymentMethodId" TEXT,
    "cancelScheduledAt" DATETIME,
    "cancelledAt" DATETIME,
    "cancelReason" TEXT,
    "paymentFailedAt" DATETIME,
    "paymentRetryCount" INTEGER NOT NULL DEFAULT 0,
    "accessRestrictedAt" DATETIME,
    "creditPence" INTEGER NOT NULL DEFAULT 0,
    "complimentary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "entitlementOverrides" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subscription_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Subscription" ("accessRestrictedAt", "billingCycle", "cancelReason", "cancelScheduledAt", "cancelledAt", "complimentary", "createdAt", "entitlementOverrides", "firstBillingAt", "firstChargePence", "id", "notes", "paymentFailedAt", "paymentMethodBrand", "paymentMethodLast4", "paymentMethodVerifiedAt", "paymentRetryCount", "planId", "status", "stripeCustomerId", "stripePaymentMethodId", "stripeSubscriptionId", "trialEndsAt", "trialStageOneEndsAt", "trialStartedAt", "updatedAt", "workspaceId") SELECT "accessRestrictedAt", "billingCycle", "cancelReason", "cancelScheduledAt", "cancelledAt", "complimentary", "createdAt", "entitlementOverrides", "firstBillingAt", "firstChargePence", "id", "notes", "paymentFailedAt", "paymentMethodBrand", "paymentMethodLast4", "paymentMethodVerifiedAt", "paymentRetryCount", "planId", "status", "stripeCustomerId", "stripePaymentMethodId", "stripeSubscriptionId", "trialEndsAt", "trialStageOneEndsAt", "trialStartedAt", "updatedAt", "workspaceId" FROM "Subscription";
DROP TABLE "Subscription";
ALTER TABLE "new_Subscription" RENAME TO "Subscription";
CREATE UNIQUE INDEX "Subscription_workspaceId_key" ON "Subscription"("workspaceId");
CREATE UNIQUE INDEX "Subscription_stripeCustomerId_key" ON "Subscription"("stripeCustomerId");
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_stripeInvoiceId_key" ON "Invoice"("stripeInvoiceId");

-- CreateIndex
CREATE INDEX "Invoice_subscriptionId_issuedAt_idx" ON "Invoice"("subscriptionId", "issuedAt");
