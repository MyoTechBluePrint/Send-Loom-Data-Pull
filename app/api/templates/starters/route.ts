// One-click starter templates, so a new workspace's library is never empty.
// Idempotent: skips any starter whose name already exists.
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { currentUser } from "@/lib/server/permissions";
import { newBlockId, type EmailBlock } from "@/lib/server/email-blocks";

function starter(blocks: Omit<EmailBlock, "id">[]): string {
  return JSON.stringify(blocks.map((b) => ({ id: newBlockId(), ...b })));
}

const STARTERS: { name: string; category: string; description: string; content: string }[] = [
  {
    name: "Welcome",
    category: "welcome",
    description: "First email after signup: warm, one clear action.",
    content: starter([
      { type: "logo" },
      { type: "heading", text: "Welcome, {{first_name}}", level: 1 },
      { type: "text", html: "<p>Thanks for joining us. Here is what to expect: honest products, no spam, and the occasional offer worth opening.</p>" },
      { type: "button", label: "Browse the range", href: "https://example.com/shop" },
      { type: "spacer", height: 16 },
      { type: "footer" },
    ] as never),
  },
  {
    name: "Discount offer",
    category: "discount",
    description: "A coupon front and centre, terms stated plainly.",
    content: starter([
      { type: "logo" },
      { type: "heading", text: "A little something for you", level: 1 },
      { type: "text", html: "<p>{{first_name}}, here is a discount to use on your next order.</p>" },
      { type: "coupon", promotionId: "", heading: "Your discount code", shopUrl: "https://example.com/shop" },
      { type: "footer" },
    ] as never),
  },
  {
    name: "Product launch",
    category: "product_launch",
    description: "Hero product with a supporting grid.",
    content: starter([
      { type: "logo" },
      { type: "heading", text: "New in: meet your next favourite", level: 1 },
      { type: "text", html: "<p>Fresh off the line and already moving fast.</p>" },
      { type: "product", productId: "" },
      { type: "divider" },
      { type: "product_feed", rule: "newest", limit: 4 },
      { type: "footer" },
    ] as never),
  },
  {
    name: "Newsletter",
    category: "newsletter",
    description: "Two-column update with a menu and social links.",
    content: starter([
      { type: "logo" },
      { type: "menu", links: [] },
      { type: "heading", text: "This month at a glance", level: 1 },
      { type: "columns", left: "<p><strong>What is new</strong><br>Write your first story here.</p>", right: "<p><strong>Worth knowing</strong><br>And a second one here.</p>" },
      { type: "divider" },
      { type: "social", links: [] },
      { type: "footer" },
    ] as never),
  },
  {
    name: "Win-back",
    category: "re_engagement",
    description: "For customers gone quiet: one question, one offer.",
    content: starter([
      { type: "logo" },
      { type: "heading", text: "Still with us, {{first_name}}?", level: 1 },
      { type: "text", html: "<p>It has been a while. Tell us what you are interested in and we will keep it relevant.</p>" },
      { type: "poll", pollId: "" },
      { type: "footer" },
    ] as never),
  },
];

export async function POST() {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });

  let created = 0;
  for (const s of STARTERS) {
    const exists = await db.emailTemplate.findFirst({ where: { workspaceId: user.workspaceId, name: s.name } });
    if (exists) continue;
    await db.emailTemplate.create({
      data: { workspaceId: user.workspaceId, name: s.name, category: s.category, description: s.description, content: s.content, updatedBy: "starter" },
    });
    created++;
  }
  if (created) await audit(user.workspaceId, user.email, "template.starters_added", `${created} starter templates`);
  return Response.json({ ok: true, created });
}
