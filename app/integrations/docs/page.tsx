// Developer documentation, generated from the same spec as the OpenAPI
// document so the two can never drift.
import Link from "next/link";
import { Shell } from "@/components/shell";
import { V1_ENDPOINTS } from "@/lib/server/platform-spec";
import { PERMISSIONS, WEBHOOK_EVENTS } from "@/lib/server/platform";

export const dynamic = "force-dynamic";

const card = "rounded-xl border border-[#262433] bg-[#171522]";

function Code({ children }: { children: string }) {
  return <pre className="mt-2 overflow-x-auto rounded-lg border border-[#262433] bg-[#0f0d17] p-3 text-[11.5px] leading-relaxed text-emerald-200">{children}</pre>;
}

export default function ApiDocsPage() {
  return (
    <Shell
      title="API documentation"
      subtitle="Versioned, key-scoped, webhook-signed. Machine spec at /api/v1/openapi.json"
      actions={<Link href="/integrations" className="rounded-lg border border-line px-3.5 py-2 text-[13px] font-semibold text-ink-2 hover:bg-zinc-50">← Platform</Link>}
    >
      <div className="space-y-4 rounded-2xl bg-[#0f0d17] p-5 text-white">
        <div className={`${card} p-4`}>
          <p className="text-[14px] font-bold">Authentication</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-white/55">
            Every request carries your secret key as a bearer token. Keys are scoped by permission
            ({PERMISSIONS.join(", ")}), rate-limited to 120 requests/minute, and every response includes an
            x-request-id header (send your own to correlate logs).
          </p>
          <Code>{`curl https://sendloom.onrender.com/api/v1/ping \\
  -H "Authorization: Bearer sk_live_…"`}</Code>
          <p className="mt-2 text-[12px] text-white/45">
            Errors are JSON with ok:false, an error message and the requestId: 401 bad key, 403 missing
            permission or blocked IP, 404 unknown resource, 429 rate limited.
          </p>
        </div>

        <div className={`${card} p-4`}>
          <p className="text-[14px] font-bold">Webhook signatures</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-white/55">
            Deliveries are signed with your endpoint's whsec_ secret (shown once at creation). Events:
            {" "}{WEBHOOK_EVENTS.join(", ")} plus any namespaced lifecycle event. Failed deliveries retry at
            1m, 5m, 30m and 2h, then park as dead; 20 consecutive failures disables the endpoint.
          </p>
          <Code>{`// Node — verify x-sendloom-signature: "t=<ts>,v1=<hex>"
const [t, v1] = sig.split(",").map((p) => p.split("=")[1]);
const expected = crypto.createHmac("sha256", WEBHOOK_SECRET)
  .update(t + "." + rawBody).digest("hex");
const valid = crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected))
  && Math.abs(Date.now() - Number(t)) < 5 * 60_000; // replay window`}</Code>
        </div>

        {V1_ENDPOINTS.map((e) => (
          <div key={`${e.method} ${e.path}`} className={`${card} p-4`}>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="rounded-md bg-[#6d28d9]/25 px-2 py-0.5 text-[11px] font-bold text-[#c4b5fd]">{e.method}</span>
              <code className="text-[13px] text-white">{e.path}</code>
              <span className="ml-auto text-[11px] text-white/40">{e.permission ? `requires ${e.permission}` : "any active key"}</span>
            </div>
            <p className="mt-1.5 text-[12.5px] text-white/55">{e.description}</p>
            <Code>{`curl ${e.method !== "GET" ? `-X ${e.method} ` : ""}https://sendloom.onrender.com${e.path.replace("{id}", "wh_123")} \\
  -H "Authorization: Bearer sk_live_…"${e.bodyExample ? ` \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(e.bodyExample)}'` : ""}`}</Code>
            <p className="mt-2 text-[11px] uppercase tracking-wide text-white/35">Response</p>
            <Code>{JSON.stringify(e.responseExample, null, 2)}</Code>
          </div>
        ))}

        <div className={`${card} p-4`}>
          <p className="text-[14px] font-bold">SDK starters</p>
          <Code>{`// Node / Next.js
const sendloom = (path, init = {}) =>
  fetch("https://sendloom.onrender.com/api/v1" + path, {
    ...init,
    headers: { Authorization: \`Bearer \${process.env.SENDLOOM_SECRET_KEY}\`,
      "Content-Type": "application/json", ...init.headers },
  }).then((r) => r.json());

await sendloom("/track", { method: "POST", body: JSON.stringify({
  event: "marketvox.deposit.first", email: "trader@example.com",
  data: { amount: 500, ibId: "IB-2041" } }) });`}</Code>
          <Code>{`<?php // PHP / WordPress / Laravel
$res = wp_remote_post("https://sendloom.onrender.com/api/v1/contacts", [
  "headers" => ["Authorization" => "Bearer " . getenv("SENDLOOM_SECRET_KEY"),
                 "Content-Type" => "application/json"],
  "body" => json_encode(["email" => "trader@example.com",
    "attribution" => ["referralCode" => "IB-2041"]]),
]);`}</Code>
          <p className="mt-2 text-[12px] text-white/45">
            Python, React and mobile SDKs follow the same shape: one base URL, bearer key, JSON in and out.
          </p>
        </div>
      </div>
    </Shell>
  );
}
