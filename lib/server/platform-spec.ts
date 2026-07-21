// Single source of truth for the v1 API surface. The OpenAPI document and
// the developer docs UI are both generated from this, so they cannot drift.

export type EndpointSpec = {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  permission: string | null;
  summary: string;
  description: string;
  bodyExample?: Record<string, unknown>;
  responseExample: Record<string, unknown>;
};

export const V1_ENDPOINTS: EndpointSpec[] = [
  {
    method: "GET",
    path: "/api/v1/ping",
    permission: null,
    summary: "Verify a key",
    description: "Confirms the key is valid and returns its integration and permissions.",
    responseExample: { ok: true, integration: "marketvox", permissions: ["contacts:write", "events:write"], requestId: "req_…" },
  },
  {
    method: "GET",
    path: "/api/v1/contacts",
    permission: "contacts:read",
    summary: "List or find contacts",
    description: "Query parameters: email (exact match), limit (max 100).",
    responseExample: { ok: true, contacts: [{ id: "c_…", email: "trader@example.com", firstName: "Ana" }], count: 1, requestId: "req_…" },
  },
  {
    method: "POST",
    path: "/api/v1/contacts",
    permission: "contacts:write",
    summary: "Create or update a contact",
    description: "Upserts by email. Attribution becomes a timeline event; consent writes an auditable consent record and fans out webhooks.",
    bodyExample: {
      email: "trader@example.com",
      firstName: "Ana",
      attribution: { source: "ib-referral", referralCode: "IB-2041", utmSource: "instagram", utmCampaign: "july-push" },
      consent: { channel: "email", status: "granted", wording: "Email me offers and updates (opt out anytime)" },
    },
    responseExample: { ok: true, contact: { id: "c_…", email: "trader@example.com", created: true }, requestId: "req_…" },
  },
  {
    method: "POST",
    path: "/api/v1/track",
    permission: "events:write",
    summary: "Push lifecycle events",
    description: "Namespaced events (marketvox.lead.created, mvsocial.trader.followed, custom.anything). Single event or {events:[…]} batch up to 50. Events with an email attach to (or create) that contact.",
    bodyExample: { event: "marketvox.deposit.first", email: "trader@example.com", data: { amount: 500, currency: "USD", ibId: "IB-2041" } },
    responseExample: { ok: true, accepted: 1, results: [{ event: "marketvox.deposit.first", eventId: "e_…", contactId: "c_…" }], requestId: "req_…" },
  },
  {
    method: "GET",
    path: "/api/v1/segments",
    permission: "segments:read",
    summary: "List audience segments",
    description: "Read-only segment list with live counts.",
    responseExample: { ok: true, segments: [{ id: "s_…", name: "Hot leads", count: 42 }], requestId: "req_…" },
  },
  {
    method: "GET",
    path: "/api/v1/webhooks",
    permission: "webhooks:manage",
    summary: "List webhook endpoints",
    description: "Endpoints registered by this integration.",
    responseExample: { ok: true, endpoints: [{ id: "wh_…", url: "https://example.com/hooks", events: ["contact.created"], status: "active" }], requestId: "req_…" },
  },
  {
    method: "POST",
    path: "/api/v1/webhooks",
    permission: "webhooks:manage",
    summary: "Register a webhook endpoint",
    description: "Subscribe to events (or [\"*\"]). The signing secret is returned once, never again. Verify deliveries with the x-sendloom-signature header: HMAC-SHA256(secret, \"<t>.<body>\").",
    bodyExample: { url: "https://example.com/hooks/sendloom", events: ["contact.created", "form.submitted", "integration.event"] },
    responseExample: { ok: true, endpoint: { id: "wh_…", url: "https://example.com/hooks/sendloom", secret: "whsec_… (shown once)" }, requestId: "req_…" },
  },
  {
    method: "GET",
    path: "/api/v1/webhooks/{id}",
    permission: "webhooks:manage",
    summary: "Inspect an endpoint",
    description: "Endpoint status plus the last 25 deliveries with response codes and retry state.",
    responseExample: { ok: true, endpoint: { id: "wh_…", status: "active", failCount: 0 }, deliveries: [{ eventType: "contact.created", status: "success", responseCode: 200 }], requestId: "req_…" },
  },
  {
    method: "PATCH",
    path: "/api/v1/webhooks/{id}",
    permission: "webhooks:manage",
    summary: "Enable, disable, test or retry",
    description: "Actions: enable, disable, test (sends webhook.test), retry_due (runs the retry sweep).",
    bodyExample: { action: "test" },
    responseExample: { ok: true, sent: 1, requestId: "req_…" },
  },
  {
    method: "DELETE",
    path: "/api/v1/webhooks/{id}",
    permission: "webhooks:manage",
    summary: "Delete an endpoint",
    description: "Removes the endpoint and its delivery history.",
    responseExample: { ok: true, deleted: true, requestId: "req_…" },
  },
];

export function buildOpenApi(baseUrl: string) {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const e of V1_ENDPOINTS) {
    const p = e.path.replace(baseUrl, "");
    paths[p] ??= {};
    paths[p][e.method.toLowerCase()] = {
      summary: e.summary,
      description: e.description + (e.permission ? ` Requires permission: ${e.permission}.` : " Requires any active key."),
      security: [{ bearerAuth: [] }],
      ...(e.bodyExample
        ? { requestBody: { content: { "application/json": { example: e.bodyExample } } } }
        : {}),
      responses: { "200": { description: "OK", content: { "application/json": { example: e.responseExample } } } },
    };
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "Sendloom Integration Platform API",
      version: "1.0.0",
      description: "Versioned API for external systems: contacts, lifecycle events, segments and webhooks. Authenticate with your secret key: Authorization: Bearer sk_live_…",
    },
    servers: [{ url: baseUrl }],
    components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", description: "Secret API key (sk_…)" } } },
    paths,
  };
}
