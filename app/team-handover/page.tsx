import Link from "next/link";
import { Shell } from "@/components/shell";
import { Card, CardHeader } from "@/components/ui";
import { FirstDayChecklist } from "@/components/first-day-checklist";

const HOW_TOS: { title: string; steps: string[] }[] = [
  {
    title: "How to add a contact",
    steps: [
      "Contacts → Add contact (top right).",
      "Name is required; give an email OR a phone number. Make them up.",
      "The new contact gets a source ledger entry ('Manual · staging') and consent set to pending, so they can never be emailed by accident.",
    ],
  },
  {
    title: "How to use Paste Anything",
    steps: [
      "Universal Inbox → paste something messy, like: 'Sarah 07700 900123 wants collagen advice, call Friday'.",
      "Click Extract data. Check the coloured chips: name, phone, interests, task.",
      "Approve to create the contact (and the call task). Reject if the extraction got it wrong. Both are fine, that's the point of review.",
    ],
  },
  {
    title: "How to create a sales task",
    steps: [
      "Sales Tasks → New task.",
      "Pick the task type, who it's about, priority and due date.",
      "Tick the circle to complete it; use Delete on anything you created while testing.",
    ],
  },
  {
    title: "How to create an audience",
    steps: [
      "Audience Builder → Build an audience.",
      "Add rules (for example Lead score is at least 60). The count on the right updates live from the real database.",
      "The NOT button turns a rule into an exclusion. Save it and it appears as a card with a suggested play.",
    ],
  },
  {
    title: "How to use Demand Radar",
    steps: [
      "Demand Radar → Keyword intent shows what the market searches for; the Review column is the compliance state for sensitive terms.",
      "Site search shows what visitors typed on the demo store, including searches with no results (missed demand).",
      "Opportunities lists the gaps: demand that exists with no product, page or flow behind it.",
    ],
  },
  {
    title: "How to leave useful feedback",
    steps: [
      "Feedback link in the sidebar, or the Feedback page.",
      "One thing per submission beats one giant essay; say where you were and what you expected to happen.",
      "'The Approve button on the inbox didn't tell me what it did' is perfect feedback. 'It's fine' is not.",
    ],
  },
];

export default function TeamHandoverPage() {
  return (
    <Shell title="Handover guide" subtitle="Written for Will · plain English · start with the checklist on the right">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader title="1 · What Sendloom is" />
            <p className="px-5 py-4 text-sm leading-relaxed text-ink-2">
              Sendloom takes messy customer data (spreadsheets, WhatsApp messages, enquiry emails, store orders), turns it into
              contacts with a clear record of where each person came from, scores who deserves attention, shows what the market is
              searching for, and turns all of it into audiences, campaigns and follow-up tasks. One line: <b>turn messy data,
              customer behaviour and market demand into revenue.</b>
            </p>
          </Card>

          <Card>
            <CardHeader title="2 · What this staging version is (and isn't)" />
            <div className="px-5 py-4 text-sm leading-relaxed text-ink-2">
              <ul className="list-disc space-y-1.5 pl-5">
                <li><b>Demo workspace</b> for a made-up wellness brand, "Vitalis". Break things freely.</li>
                <li><b>No real emails ever send.</b> Campaign sends use a test transport; the button says Demo send because that's what it is.</li>
                <li><b>Demo-labelled numbers</b> (campaign performance charts, keyword volumes) are seeded examples. Everything else you touch is a real database record.</li>
                <li><b>Never upload real customer data.</b> Invented people only. If it's in your real phone book, it doesn't go in here.</li>
              </ul>
            </div>
          </Card>

          {HOW_TOS.map((h, i) => (
            <Card key={h.title}>
              <CardHeader title={`${i + 3} · ${h.title}`} />
              <ol className="space-y-2 px-5 py-4 text-sm">
                {h.steps.map((s, j) => (
                  <li key={j} className="flex gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-bold text-brand">{j + 1}</span>
                    <span className="leading-relaxed text-ink-2">{s}</span>
                  </li>
                ))}
              </ol>
            </Card>
          ))}

          <Card>
            <CardHeader title="9 · How to move data in and out" />
            <ol className="space-y-2 px-5 py-4 text-sm">
              {[
                "Data in: Data Dropzone → drop a CSV/TXT (or several). Sendloom tells you what it thinks each file is; correct it if wrong, then Map fields & import.",
                "Suppression lists: use 'Import as suppression list'. It only blocks addresses; it never creates contacts.",
                "Data out: any audience card → Pack, or select contacts → Create Contact Pack. A pack is a cleaned, frozen group with unsubscribed and suppressed people already removed.",
                "Copy emails for Gmail (comma) or BCC for Outlook (semicolon) from the pack page. Big list? Turn on batch splitting (25/50/100) and copy one batch at a time.",
                "Call sheets: Sales Tasks → Copy call sheet gives you name | phone | interest | notes | next action, ready to paste anywhere.",
                "Downloads: CSV, CRM, Mailchimp or Klaviyo formats from the pack page. Every copy and download is logged in Export history, that's a feature, not surveillance.",
              ].map((s, j) => (
                <li key={j} className="flex gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-bold text-brand">{j + 1}</span>
                  <span className="leading-relaxed text-ink-2">{s}</span>
                </li>
              ))}
            </ol>
          </Card>

          <Card>
            <CardHeader title="10 · Common mistakes" />
            <ul className="list-disc space-y-1.5 px-5 py-4 pl-9 text-sm text-ink-2">
              <li>Searching for someone who's still in the inbox queue: they only become a contact after you approve them.</li>
              <li>Expecting a new contact to be emailable: consent starts pending on purpose. That's the platform protecting you.</li>
              <li>Thinking Demo send emails a real person: it never does. It records who would have received it and who was skipped.</li>
              <li>Being polite in feedback. Blunt is useful.</li>
            </ul>
          </Card>

          <Card>
            <CardHeader title="11 · What to test first" />
            <p className="px-5 py-4 text-sm leading-relaxed text-ink-2">
              The checklist on the right, top to bottom. It's ordered so each step teaches the next one. When you finish, spend ten
              minutes clicking anywhere you like and leave feedback on whatever felt slow, confusing or pointless.
            </p>
          </Card>
        </div>

        <div className="space-y-4 self-start">
          <FirstDayChecklist />
          <Card>
            <CardHeader title="Your access" subtitle="Worker Admin · Operator · staging" />
            <div className="px-5 py-4 text-[13px] leading-relaxed">
              <p className="text-ink-2">Test everything: demo contacts, imports, inbox approvals, audiences, draft campaigns, demo sends, tasks, and admin monitoring.</p>
              <p className="mt-2 font-semibold text-ink-2">Locked on staging:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-ink-2">
                <li>Live email sending, billing, production secrets</li>
                <li>Feedback triage and demo reset (owner tools)</li>
                <li>Deleting the workspace or audit history</li>
              </ul>
            </div>
          </Card>
          <Card>
            <CardHeader title="More detail" />
            <p className="px-5 py-4 text-[13px] text-ink-2">
              Technical what's-real-what's-demo: <Link href="/demo-notes" className="font-semibold text-brand hover:underline">demo notes</Link>.
              Anything broken or confusing: <Link href="/feedback" className="font-semibold text-brand hover:underline">feedback</Link>.
            </p>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
