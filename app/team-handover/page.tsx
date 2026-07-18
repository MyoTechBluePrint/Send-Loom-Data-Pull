import Link from "next/link";
import { Shell } from "@/components/shell";
import { Card, CardHeader } from "@/components/ui";

export default function TeamHandoverPage() {
  return (
    <Shell title="Handover guide" subtitle="Written for Will · no jargon · 10 minutes to read, less to try">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader title="What Sendloom is" />
            <p className="px-5 py-4 text-sm leading-relaxed text-ink-2">
              Sendloom takes messy customer data (spreadsheets, WhatsApp messages, enquiry emails, store orders), organises it into contacts with a clear record of where each person came from, scores who's worth attention, shows what the market is searching for, and turns all of it into audiences, campaigns and follow-up tasks. The one-liner: <b>turn messy data, customer behaviour and market demand into revenue.</b>
            </p>
          </Card>

          <Card>
            <CardHeader title="What this staging version is" />
            <div className="px-5 py-4 text-sm leading-relaxed text-ink-2">
              <p>A demo workspace for a made-up wellness brand ("Vitalis"). It's for you to click around, break things and tell us what's confusing. Three rules:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li><b>No real customer data.</b> Make people up.</li>
                <li><b>No emails ever leave this system.</b> "Send" uses a test transport, nothing is delivered to anyone.</li>
                <li>Charts with a "Demo" label are seeded example numbers, not real performance.</li>
              </ul>
            </div>
          </Card>

          <Card>
            <CardHeader title="Try these, in order" subtitle="Each one is a real workflow writing real records to the staging database" />
            <ol className="space-y-3.5 px-5 py-4 text-sm">
              {[
                ["Take the tour", "Sidebar → Restart walkthrough if you skipped it on first login."],
                ["Paste a messy lead", "Universal Inbox → paste something like 'Sarah 07700 900123 wants collagen advice, call Friday' → Extract data → Approve. Watch it become a contact with tags and a call task."],
                ["Review what's waiting", "Universal Inbox has a WhatsApp forward already waiting. Approve Maria, reject anything that looks wrong."],
                ["Run the demo import", "Data Uploads → New import → use the demo file. Watch the quality engine block the dodgy rows and explain why."],
                ["Open a contact", "Contacts → Emma Richardson. Read 'Why this contact matters', the score reasons and the source ledger. That page is the heart of the product."],
                ["Build an audience", "Audience Builder → Build an audience. The estimate updates live as you add rules. Save it."],
                ["Send a test campaign", "Campaigns → 'Send now' on a draft. It reports exactly who was skipped and why (no consent, suppressed). Nothing is really emailed."],
                ["Complete a task", "Sales Tasks → tick one off. Check Admin afterwards: everything you did is in the audit log."],
                ["Tell us what you think", "Feedback link in the sidebar. Brutal honesty is the useful kind."],
              ].map(([title, copy], i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand">{i + 1}</span>
                  <p className="leading-relaxed"><b>{title}.</b> {copy}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-4 self-start">
          <Card>
            <CardHeader title="Your access" subtitle="Worker Admin · staging" />
            <div className="px-5 py-4 text-[13px] leading-relaxed">
              <p className="text-ink-2">You can test everything: add demo contacts, run imports, approve inbox items, build audiences, create draft campaigns, run test sends, and manage tasks.</p>
              <p className="mt-2 font-semibold text-ink-2">Locked on staging for everyone:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-ink-2">
                <li>Live email sending (test transport only)</li>
                <li>Billing and plan changes</li>
                <li>Production integrations and secrets</li>
                <li>Deleting the workspace or audit history</li>
              </ul>
            </div>
          </Card>
          <Card>
            <CardHeader title="The feedback we want" />
            <ul className="list-disc space-y-1.5 px-5 py-4 pl-9 text-[13px] text-ink-2">
              <li>Where did you get lost, even for a second?</li>
              <li>What would you use every day? What would you never touch?</li>
              <li>What's missing before this could run a real store's marketing?</li>
              <li>Does "source ledger" make sense at a glance, or does it need a better name?</li>
            </ul>
            <div className="border-t border-line px-5 py-3">
              <Link href="/feedback" className="text-[13px] font-bold text-brand hover:underline">Leave feedback →</Link>
            </div>
          </Card>
          <Card>
            <CardHeader title="More detail" />
            <p className="px-5 py-4 text-[13px] text-ink-2">
              The technical what's-real-what's-demo breakdown lives on the <Link href="/demo-notes" className="font-semibold text-brand hover:underline">demo notes</Link> page.
            </p>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
