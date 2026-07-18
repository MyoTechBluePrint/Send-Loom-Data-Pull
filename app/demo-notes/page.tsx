import Link from "next/link";
import { Shell } from "@/components/shell";
import { Card, CardHeader } from "@/components/ui";

export default function DemoNotesPage() {
  return (
    <Shell title="Demo notes" subtitle="What this staging build is, what's real, and the 5-minute tour">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="The story to follow" subtitle="Click along in this order and the product explains itself" />
          <ol className="space-y-3 px-5 py-4 text-sm">
            {[
              ["Universal Inbox", "/inbox", "A WhatsApp forward with two messy leads is waiting for review. Approve Maria: watch her become a contact with interests, a pending consent state and a 'call tomorrow' sales task, all from one blob of text. Then paste your own."],
              ["Contacts", "/subscribers", "Open Maria (or Laura Fenwick, who arrived by email forward). The profile shows why she matters, her lead score with reasons, and the source ledger proving where she came from."],
              ["Sales Tasks", "/tasks", "The call task the inbox created is here, marked 'via Universal Inbox', with a link back to her profile."],
              ["Data Uploads", "/imports", "Run the demo CSV. The quality engine blocks a disposable email, an invalid address and two suppressed contacts in front of you, then imports the clean rows for real."],
              ["Audience Builder", "/segments", "Audience cards with suggested plays. Build one: the estimate evaluates live against the contact database, including anyone you just approved."],
              ["Demand Radar", "/demand", "Keyword intent with sector-mode review states, and Product Demand Matching: the gaps between what people search for and what exists."],
              ["Admin", "/admin", "The audit log recorded everything you just did."],
            ].map(([title, href, text], i) => (
              <li key={href as string} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand">{i + 1}</span>
                <p className="leading-relaxed">
                  <Link href={href as string} className="font-semibold text-brand hover:underline">{title}</Link>
                  {" · "}{text}
                </p>
              </li>
            ))}
          </ol>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Real vs seeded" subtitle="Honest state of this build" />
            <div className="px-5 py-4 text-[13px] leading-relaxed">
              <p className="font-semibold text-emerald-700">Real (database-backed, works end to end):</p>
              <p className="mt-1 text-ink-2">Contacts, imports with quality review, source and consent ledgers, Paste Anything extraction and approval, lead scoring with reasons, timelines, audiences with live estimates, sales tasks, site-search demand signals, audit log, the store event API, and the WooCommerce plugin skeleton.</p>
              <p className="mt-3 font-semibold text-amber-700">Seeded demo (labelled in the UI):</p>
              <p className="mt-1 text-ink-2">Campaign and automation performance numbers, revenue attribution charts, keyword volumes and CPC, prospect discovery list. No emails send yet; nothing here contacts a real person.</p>
              <p className="mt-3 font-semibold text-ink-2">Not built yet:</p>
              <p className="mt-1 text-ink-2">Email sending, WhatsApp/email-in forwarding addresses, password reset (staging auth is invitation-only), LLM assistant (extraction is deterministic rules, which is why it never invents data).</p>
            </div>
          </Card>
          <Card>
            <CardHeader title="Feedback we want" />
            <ul className="list-disc space-y-1.5 px-5 py-4 pl-9 text-[13px] text-ink-2">
              <li>Does the inbox → contact → task loop feel magical or fiddly?</li>
              <li>Is the source ledger understandable at a glance?</li>
              <li>What would you expect "Create campaign" to do from an audience card?</li>
              <li>Anything that feels like a dead end?</li>
            </ul>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
