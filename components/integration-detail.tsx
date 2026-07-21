"use client";

// The interactive half of an integration's page: create/rotate/disable
// keys (secret shown exactly once), manage webhook endpoints, and a Try-it
// console that hits the real v1 API with a pasted key.
import { useState } from "react";
import { useRouter } from "next/navigation";

export type KeyRow = {
  id: string; name: string; publicKey: string; secretHint: string; permissions: string[];
  status: string; lastUsedAt: string | null; expiresAt: string | null; createdAt: string;
};
export type EndpointRow = {
  id: string; url: string; events: string[]; status: string; failCount: number;
  lastSuccessAt: string | null; lastFailureAt: string | null;
};

const card = "rounded-xl border border-[#262433] bg-[#171522]";
const btn = "rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors";
const btnGhost = `${btn} border border-[#262433] text-white/70 hover:border-[#6d28d9] hover:text-white`;
const btnBrand = `${btn} bg-[#6d28d9] text-white hover:bg-[#5b21b6]`;
const input = "w-full rounded-lg border border-[#262433] bg-[#0f0d17] px-3 py-2 text-[13px] text-white outline-none focus:border-[#6d28d9]";

function StatusChip({ status }: { status: string }) {
  const tone =
    status === "active" || status === "success" ? "text-emerald-300 border-emerald-300/30"
    : status === "failed" || status === "dead" ? "text-red-300 border-red-300/30"
    : status === "pending" ? "text-amber-300 border-amber-300/30"
    : "text-white/50 border-[#262433]";
  return <span className={`rounded-full border px-2 py-0.5 text-[10.5px] uppercase tracking-wide ${tone}`}>{status}</span>;
}

export function IntegrationDetailClient({
  integrationId, slug, allPermissions, defaultPermissions, webhookEvents, vocabulary, keys, endpoints,
}: {
  integrationId: string; slug: string; allPermissions: string[]; defaultPermissions: string[];
  webhookEvents: string[]; vocabulary: string[]; keys: KeyRow[]; endpoints: EndpointRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [secretModal, setSecretModal] = useState<{ title: string; secret: string; extra?: string } | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // Key creation state
  const [keyName, setKeyName] = useState(`${slug} server key`);
  const [perms, setPerms] = useState<string[]>(defaultPermissions);
  // Webhook creation state
  const [hookUrl, setHookUrl] = useState("");
  const [hookEvents, setHookEvents] = useState<string[]>(["*"]);
  // Try-it state
  const [tryKey, setTryKey] = useState("");
  const [tryChoice, setTryChoice] = useState("ping");
  const [tryOut, setTryOut] = useState<string | null>(null);

  function flash(msg: string) {
    setNote(msg);
    setTimeout(() => setNote(null), 2600);
  }

  async function createKey() {
    if (!perms.length) return flash("Pick at least one permission.");
    setBusy(true);
    try {
      const res = await fetch(`/api/integrations/${integrationId}/keys`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: keyName || "API key", permissions: perms }),
      });
      const d = await res.json();
      if (!d.ok) return flash("Key creation failed.");
      setSecretModal({ title: "API key created", secret: d.key.secretKey, extra: `Public key: ${d.key.publicKey}` });
      router.refresh();
    } finally { setBusy(false); }
  }

  async function keyAction(keyId: string, action: "rotate" | "disable" | "enable") {
    setBusy(true);
    try {
      const res = await fetch(`/api/integrations/${integrationId}/keys`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyId, action }),
      });
      const d = await res.json();
      if (!d.ok) return flash(`${action} failed`);
      if (action === "rotate" && d.key) setSecretModal({ title: "Key rotated — new secret", secret: d.key.secretKey, extra: "The old key stopped working the moment this was created." });
      else flash(`Key ${action}d.`);
      router.refresh();
    } finally { setBusy(false); }
  }

  async function createHook() {
    if (!hookUrl.startsWith("http")) return flash("Enter a full URL.");
    setBusy(true);
    try {
      const res = await fetch(`/api/integrations/${integrationId}/webhooks`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: hookUrl, events: hookEvents.length ? hookEvents : ["*"] }),
      });
      const d = await res.json();
      if (!d.ok) return flash("Endpoint creation failed.");
      setSecretModal({ title: "Webhook endpoint created", secret: d.endpoint.secret, extra: "Verify deliveries with x-sendloom-signature: HMAC-SHA256(secret, \"<t>.<body>\")." });
      setHookUrl("");
      router.refresh();
    } finally { setBusy(false); }
  }

  async function hookAction(endpointId: string, action: "enable" | "disable" | "delete" | "test") {
    setBusy(true);
    try {
      const res = await fetch(`/api/integrations/${integrationId}/webhooks`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpointId, action }),
      });
      const d = await res.json();
      flash(d.ok ? (action === "test" ? `Test sent to ${d.sent} endpoint(s).` : `Endpoint ${action}d.`) : `${action} failed`);
      router.refresh();
    } finally { setBusy(false); }
  }

  async function runTry() {
    if (!tryKey.startsWith("sk_")) return setTryOut("Paste a secret key (sk_…) first. Create one above — it is shown once.");
    setTryOut("…");
    const opts: RequestInit = { headers: { Authorization: `Bearer ${tryKey}` } };
    let path = "/api/v1/ping";
    if (tryChoice === "contacts") path = "/api/v1/contacts?limit=3";
    if (tryChoice === "segments") path = "/api/v1/segments";
    if (tryChoice === "track") {
      path = "/api/v1/track";
      opts.method = "POST";
      opts.headers = { ...opts.headers, "Content-Type": "application/json" };
      opts.body = JSON.stringify({ event: `${slug === "custom-api" ? "custom" : slug}.demo.ping`, data: { from: "try-it console" } });
    }
    try {
      const res = await fetch(path, opts);
      const d = await res.json();
      setTryOut(JSON.stringify(d, null, 2));
      router.refresh();
    } catch {
      setTryOut("Request failed.");
    }
  }

  return (
    <div className="space-y-4">
      {/* API keys */}
      <div className={`${card} p-4`}>
        <p className="text-[13.5px] font-bold text-white">API keys</p>
        <div className="mt-2 divide-y divide-[#262433]">
          {keys.map((k) => (
            <div key={k.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-white">{k.name} <span className="text-white/35">· ····{k.secretHint}</span></p>
                <p className="text-[11px] text-white/40">
                  {k.publicKey} · {k.permissions.join(", ")} · {k.lastUsedAt ? `last used ${new Date(k.lastUsedAt).toLocaleString("en-GB")}` : "never used"}
                </p>
              </div>
              <StatusChip status={k.status} />
              {k.status === "active" && (
                <>
                  <button disabled={busy} onClick={() => keyAction(k.id, "rotate")} className={btnGhost}>Rotate</button>
                  <button disabled={busy} onClick={() => keyAction(k.id, "disable")} className={btnGhost}>Disable</button>
                </>
              )}
              {k.status === "disabled" && <button disabled={busy} onClick={() => keyAction(k.id, "enable")} className={btnGhost}>Enable</button>}
            </div>
          ))}
          {keys.length === 0 && <p className="py-3 text-[12.5px] text-white/40">No keys yet. Create the first one below.</p>}
        </div>
        <div className="mt-3 rounded-lg border border-[#262433] bg-[#0f0d17] p-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1">
              <p className="mb-1 text-[10.5px] uppercase tracking-wide text-white/40">Key name</p>
              <input value={keyName} onChange={(e) => setKeyName(e.target.value)} className={input} />
            </div>
            <button disabled={busy} onClick={createKey} className={btnBrand}>Create key</button>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {allPermissions.map((p) => {
              const on = perms.includes(p);
              return (
                <button
                  key={p}
                  onClick={() => setPerms(on ? perms.filter((x) => x !== p) : [...perms, p])}
                  className={`rounded-full border px-2.5 py-1 text-[11px] ${on ? "border-[#6d28d9] bg-[#6d28d9]/20 text-[#c4b5fd]" : "border-[#262433] text-white/45 hover:text-white/70"}`}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Webhooks */}
      <div className={`${card} p-4`}>
        <div className="flex items-center justify-between">
          <p className="text-[13.5px] font-bold text-white">Webhook endpoints</p>
          <button disabled={busy} onClick={() => hookAction("", "test")} className={btnGhost}>Send test event</button>
        </div>
        <div className="mt-2 divide-y divide-[#262433]">
          {endpoints.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-white">{e.url}</p>
                <p className="text-[11px] text-white/40">
                  {e.events.join(", ")} · {e.failCount} consecutive failure{e.failCount === 1 ? "" : "s"}
                  {e.lastSuccessAt ? ` · last ok ${new Date(e.lastSuccessAt).toLocaleString("en-GB")}` : ""}
                </p>
              </div>
              <StatusChip status={e.status} />
              {e.status === "active"
                ? <button disabled={busy} onClick={() => hookAction(e.id, "disable")} className={btnGhost}>Disable</button>
                : <button disabled={busy} onClick={() => hookAction(e.id, "enable")} className={btnGhost}>Enable</button>}
              <button disabled={busy} onClick={() => hookAction(e.id, "delete")} className={btnGhost}>Delete</button>
            </div>
          ))}
          {endpoints.length === 0 && <p className="py-3 text-[12.5px] text-white/40">No endpoints yet. Deliveries are signed, retried on failure (1m, 5m, 30m, 2h) and logged below.</p>}
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border border-[#262433] bg-[#0f0d17] p-3">
          <div className="min-w-[260px] flex-1">
            <p className="mb-1 text-[10.5px] uppercase tracking-wide text-white/40">Endpoint URL</p>
            <input value={hookUrl} onChange={(e) => setHookUrl(e.target.value)} placeholder="https://your-app.com/hooks/sendloom" className={input} />
          </div>
          <div className="min-w-[200px]">
            <p className="mb-1 text-[10.5px] uppercase tracking-wide text-white/40">Events</p>
            <select
              value={hookEvents[0] ?? "*"}
              onChange={(e) => setHookEvents([e.target.value])}
              className={input}
            >
              <option value="*">All events (*)</option>
              {webhookEvents.map((ev) => <option key={ev} value={ev}>{ev}</option>)}
            </select>
          </div>
          <button disabled={busy} onClick={createHook} className={btnBrand}>Add endpoint</button>
        </div>
      </div>

      {/* Try it */}
      <div className={`${card} p-4`}>
        <p className="text-[13.5px] font-bold text-white">Try it</p>
        <p className="mt-0.5 text-[11.5px] text-white/40">Runs against the real v1 API with your key. Nothing is stored.</p>
        <div className="mt-2.5 flex flex-wrap items-end gap-3">
          <div className="min-w-[260px] flex-1">
            <p className="mb-1 text-[10.5px] uppercase tracking-wide text-white/40">Secret key</p>
            <input value={tryKey} onChange={(e) => setTryKey(e.target.value)} placeholder="sk_live_…" className={input} />
          </div>
          <div>
            <p className="mb-1 text-[10.5px] uppercase tracking-wide text-white/40">Request</p>
            <select value={tryChoice} onChange={(e) => setTryChoice(e.target.value)} className={input}>
              <option value="ping">GET /api/v1/ping</option>
              <option value="contacts">GET /api/v1/contacts</option>
              <option value="segments">GET /api/v1/segments</option>
              <option value="track">POST /api/v1/track</option>
            </select>
          </div>
          <button onClick={runTry} className={btnBrand}>Run</button>
        </div>
        {tryOut && (
          <pre className="mt-3 max-h-64 overflow-auto rounded-lg border border-[#262433] bg-[#0f0d17] p-3 text-[11.5px] leading-relaxed text-emerald-200">{tryOut}</pre>
        )}
      </div>

      {/* Vocabulary */}
      {vocabulary.length > 0 && (
        <div className={`${card} p-4`}>
          <p className="text-[13.5px] font-bold text-white">Lifecycle event vocabulary</p>
          <p className="mt-0.5 text-[11.5px] text-white/40">Push these through POST /api/v1/track. Anything namespaced works; these are the expected set for this connector.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {vocabulary.map((v) => (
              <code key={v} className="rounded-md border border-[#262433] bg-[#0f0d17] px-2 py-1 text-[11px] text-[#c4b5fd]">{v}</code>
            ))}
          </div>
        </div>
      )}

      {/* Secret modal — the only time a secret is visible */}
      {secretModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#262433] bg-[#171522] p-5">
            <p className="text-[15px] font-bold text-white">{secretModal.title}</p>
            <p className="mt-1 text-[12px] text-amber-300">Copy it now. For security it is stored hashed and can never be shown again.</p>
            <code className="mt-3 block overflow-x-auto rounded-lg border border-[#262433] bg-[#0f0d17] p-3 text-[12px] text-emerald-200">{secretModal.secret}</code>
            {secretModal.extra && <p className="mt-2 text-[11.5px] text-white/50">{secretModal.extra}</p>}
            <div className="mt-4 flex gap-2">
              <button onClick={() => { navigator.clipboard?.writeText(secretModal.secret).catch(() => {}); }} className={btnBrand}>Copy</button>
              <button onClick={() => setSecretModal(null)} className={btnGhost}>Done, it's saved</button>
            </div>
          </div>
        </div>
      )}

      {note && (
        <div className="fixed inset-x-0 bottom-8 z-50 flex justify-center">
          <span className="rounded-full bg-white px-4 py-2 text-[12.5px] font-bold text-[#0f0d17] shadow-lg">{note}</span>
        </div>
      )}
    </div>
  );
}
