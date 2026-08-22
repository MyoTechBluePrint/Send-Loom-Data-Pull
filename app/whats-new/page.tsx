import { Shell } from "@/components/shell";
import { Card, CardHeader } from "@/components/ui";

export const metadata = { title: "What's new · Sendloom" };

// What changed, for the people using the platform rather than building it.
// Written in marketing language on purpose: nobody here cares which file a
// fix lived in, they care what they can now do.

const RELEASES: { date: string; items: { title: string; body: string }[] }[] = [
  {
    date: "22 August 2026",
    items: [
      {
        title: "Welcome automation is real",
        body: "The Welcome Flow now sends automatically: someone submits the signup popup on your store and the welcome email goes out on its own. Open Automations to edit the wording, delays and steps, pause it, or set it live. Nobody receives the same automation email twice.",
      },
      {
        title: "Workflow editing",
        body: "Edit workflow now opens a real editor: change the trigger, rewrite emails, adjust delays, add, remove and reorder steps, and publish. A re-entry setting controls whether somebody can go through a flow more than once.",
      },
      {
        title: "Marketing consent, per channel",
        body: "Every contact now shows exactly where they stand for Email, SMS and WhatsApp, with an overview bar you can click to filter. Select any number of contacts and update their consent in three clicks. Do Not Contact blocks everything with one switch. Campaigns automatically exclude anyone who should not receive them, and show you the numbers before you send.",
      },
      {
        title: "Website forms capture more",
        body: "Signup forms can now ask for SMS and WhatsApp consent alongside email, with your own wording, and record exactly what was agreed to. Storefront popups can run multi-step forms built in the form builder.",
      },
      {
        title: "Store connection monitoring",
        body: "Store Tracking now opens with a health panel: whether your site and Sendloom are talking, when the last event and last contact arrived, and whether popups, automations and email sending are on, plus a live activity feed.",
      },
      {
        title: "Imports fixed",
        body: "Drag and drop a CSV anywhere on the import screen and it just works. Download templates gives you a ready-made file including the new consent columns, and imports now understand per-channel consent, including explicit refusals.",
      },
      {
        title: "Abandoned cart and winback foundations",
        body: "Two new automation triggers: carts genuinely abandoned on your store, and customers who have gone quiet for a period you choose. Build both in the same workflow editor as the welcome flow. Buying something always stops a recovery chase.",
      },
    ],
  },
];

export default function WhatsNewPage() {
  return (
    <Shell title="What's new" subtitle="Recent improvements, in plain words">
      {RELEASES.map((r) => (
        <Card key={r.date} className="mb-4">
          <CardHeader title={r.date} />
          <div className="divide-y divide-line px-5">
            {r.items.map((item) => (
              <div key={item.title} className="py-3.5">
                <p className="text-[13.5px] font-semibold">{item.title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{item.body}</p>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </Shell>
  );
}
