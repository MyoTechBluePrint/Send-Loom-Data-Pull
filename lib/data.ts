// Mock data layer for the Sendloom prototype. Everything here stands in for
// the platform API + synced WooCommerce store data.

export const store = {
  name: "Aurelia Home & Living",
  url: "aureliahome.co.uk",
  platform: "WooCommerce 9.8",
  plugin: "Sendloom Connect v1.4.2",
  status: "connected" as const,
  lastSync: "2 minutes ago",
  contacts: 18432,
  syncedOrders: 42917,
  syncedProducts: 386,
};

export type Subscriber = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  location: string;
  consent: "subscribed" | "unsubscribed" | "pending" | "suppressed";
  source: string;
  signup: string;
  tags: string[];
  lists: string[];
  orders: number;
  revenue: number;
  aov: number;
  lastOrder: string;
  lastActivity: string;
  engagement: "high" | "medium" | "low" | "none";
};

export const subscribers: Subscriber[] = [
  { id: "sub_01", name: "Emma Richardson", email: "emma.richardson@gmail.com", phone: "+44 7911 240 881", location: "London, UK", consent: "subscribed", source: "Checkout opt-in", signup: "12 Mar 2025", tags: ["VIP", "Repeat buyer"], lists: ["Newsletter", "VIP Club"], orders: 14, revenue: 2840.5, aov: 202.89, lastOrder: "9 Jul 2026", lastActivity: "2 hours ago", engagement: "high" },
  { id: "sub_02", name: "James Okafor", email: "j.okafor@outlook.com", location: "Manchester, UK", consent: "subscribed", source: "Exit-intent popup", signup: "28 Jan 2026", tags: ["First-time buyer"], lists: ["Newsletter"], orders: 1, revenue: 89.99, aov: 89.99, lastOrder: "3 Feb 2026", lastActivity: "1 day ago", engagement: "medium" },
  { id: "sub_03", name: "Sofia Marchetti", email: "sofia.marchetti@icloud.com", phone: "+44 7700 900 442", location: "Edinburgh, UK", consent: "subscribed", source: "Spin-to-win", signup: "4 Nov 2025", tags: ["Repeat buyer", "Candle lover"], lists: ["Newsletter", "Home Fragrance"], orders: 6, revenue: 512.4, aov: 85.4, lastOrder: "1 Jul 2026", lastActivity: "5 hours ago", engagement: "high" },
  { id: "sub_04", name: "Daniel Hughes", email: "dan.hughes88@gmail.com", location: "Cardiff, UK", consent: "subscribed", source: "Footer form", signup: "19 Jun 2026", tags: ["Prospect"], lists: ["Newsletter"], orders: 0, revenue: 0, aov: 0, lastOrder: "Never", lastActivity: "3 days ago", engagement: "medium" },
  { id: "sub_05", name: "Priya Nair", email: "priya.nair@yahoo.co.uk", location: "Birmingham, UK", consent: "subscribed", source: "Checkout opt-in", signup: "2 Sep 2025", tags: ["Repeat buyer"], lists: ["Newsletter"], orders: 4, revenue: 367.2, aov: 91.8, lastOrder: "22 May 2026", lastActivity: "6 days ago", engagement: "medium" },
  { id: "sub_06", name: "Tom Bergström", email: "tom.bergstrom@gmail.com", location: "Bristol, UK", consent: "unsubscribed", source: "Checkout opt-in", signup: "14 Feb 2025", tags: ["Lapsed"], lists: [], orders: 2, revenue: 156, aov: 78, lastOrder: "3 Oct 2025", lastActivity: "4 months ago", engagement: "none" },
  { id: "sub_07", name: "Charlotte Webb", email: "charlie.webb@hotmail.com", phone: "+44 7833 118 220", location: "Leeds, UK", consent: "subscribed", source: "Embedded form", signup: "8 Apr 2026", tags: ["Cart abandoner"], lists: ["Newsletter"], orders: 1, revenue: 124.5, aov: 124.5, lastOrder: "11 Apr 2026", lastActivity: "12 hours ago", engagement: "high" },
  { id: "sub_08", name: "Marcus Delaney", email: "m.delaney@protonmail.com", location: "Dublin, IE", consent: "subscribed", source: "Referral", signup: "30 May 2026", tags: ["First-time buyer"], lists: ["Newsletter"], orders: 1, revenue: 210, aov: 210, lastOrder: "30 May 2026", lastActivity: "2 days ago", engagement: "medium" },
  { id: "sub_09", name: "Yuki Tanaka", email: "yuki.t@gmail.com", location: "London, UK", consent: "pending", source: "Popup (double opt-in)", signup: "16 Jul 2026", tags: [], lists: ["Newsletter"], orders: 0, revenue: 0, aov: 0, lastOrder: "Never", lastActivity: "2 days ago", engagement: "low" },
  { id: "sub_10", name: "Grace Adeyemi", email: "grace.adeyemi@gmail.com", phone: "+44 7455 662 019", location: "Glasgow, UK", consent: "subscribed", source: "Checkout opt-in", signup: "21 Dec 2024", tags: ["VIP", "Repeat buyer"], lists: ["Newsletter", "VIP Club"], orders: 22, revenue: 4106.75, aov: 186.67, lastOrder: "15 Jul 2026", lastActivity: "30 minutes ago", engagement: "high" },
  { id: "sub_11", name: "Oliver Kaminski", email: "olly.kaminski@gmail.com", location: "Newcastle, UK", consent: "suppressed", source: "Import (CSV)", signup: "10 Jan 2025", tags: ["Hard bounce"], lists: [], orders: 0, revenue: 0, aov: 0, lastOrder: "Never", lastActivity: "6 months ago", engagement: "none" },
  { id: "sub_12", name: "Isabelle Fournier", email: "isa.fournier@gmail.com", location: "Brighton, UK", consent: "subscribed", source: "Spin-to-win", signup: "3 Jul 2026", tags: ["Cart abandoner"], lists: ["Newsletter"], orders: 0, revenue: 0, aov: 0, lastOrder: "Never", lastActivity: "1 hour ago", engagement: "high" },
];

export type TimelineEvent = {
  time: string;
  type: "signup" | "view" | "cart" | "checkout" | "purchase" | "email_open" | "email_click" | "email_sent" | "automation";
  title: string;
  detail: string;
  value?: string;
};

export const timelines: Record<string, TimelineEvent[]> = {
  sub_01: [
    { time: "Today, 09:41", type: "email_click", title: "Clicked email", detail: "Campaign: Summer Linen Edit · link: /collections/linen" },
    { time: "Today, 09:39", type: "email_open", title: "Opened email", detail: "Campaign: Summer Linen Edit" },
    { time: "9 Jul, 14:22", type: "purchase", title: "Placed order #42881", detail: "Linen Duvet Set, Oak Diffuser · Visa", value: "£214.00" },
    { time: "9 Jul, 14:18", type: "checkout", title: "Started checkout", detail: "2 items · £214.00" },
    { time: "9 Jul, 14:02", type: "cart", title: "Added to cart", detail: "Linen Duvet Set (Sage)" },
    { time: "9 Jul, 13:57", type: "view", title: "Viewed product", detail: "Linen Duvet Set" },
    { time: "28 Jun, 19:03", type: "automation", title: "Entered automation", detail: "VIP win-back · exited: made purchase" },
    { time: "12 Mar 2025", type: "signup", title: "Newsletter signup", detail: "Checkout opt-in · consent logged (GDPR)" },
  ],
  sub_12: [
    { time: "Today, 11:12", type: "email_sent", title: "Automation email sent", detail: "Abandoned cart · Email 2 of 3: 'Still thinking it over?'" },
    { time: "Yesterday, 22:40", type: "cart", title: "Added to cart", detail: "Marble Table Lamp · £149.00" },
    { time: "Yesterday, 22:31", type: "view", title: "Viewed product", detail: "Marble Table Lamp" },
    { time: "Yesterday, 22:26", type: "view", title: "Viewed category", detail: "Lighting" },
    { time: "3 Jul, 20:15", type: "signup", title: "Newsletter signup", detail: "Spin-to-win popup · won WELCOME15" },
  ],
};

export function timelineFor(id: string): TimelineEvent[] {
  return (
    timelines[id] ?? [
      { time: "2 days ago", type: "email_open", title: "Opened email", detail: "Campaign: New In · July" },
      { time: "Last week", type: "view", title: "Viewed product", detail: "Stoneware Dinner Set" },
      { time: "Signup date", type: "signup", title: "Newsletter signup", detail: "Consent logged (GDPR)" },
    ]
  );
}

export type Condition = { field: string; operator: string; value: string };
export type Segment = {
  id: string;
  name: string;
  description: string;
  match: "all" | "any";
  conditions: Condition[];
  count: number;
  revenue: number;
  updated: string;
};

export const segments: Segment[] = [
  { id: "seg_01", name: "VIP customers", description: "Spent over £500 lifetime with 3+ orders", match: "all", conditions: [{ field: "Total spend", operator: "is greater than", value: "£500" }, { field: "Order count", operator: "is at least", value: "3" }], count: 412, revenue: 386420, updated: "Live · updates in real time" },
  { id: "seg_02", name: "At-risk (90 days inactive)", description: "Bought before, no purchase in 90 days", match: "all", conditions: [{ field: "Last order", operator: "is more than", value: "90 days ago" }, { field: "Order count", operator: "is at least", value: "1" }], count: 2318, revenue: 0, updated: "Live · updates in real time" },
  { id: "seg_03", name: "Candle & fragrance buyers", description: "Purchased from Home Fragrance category", match: "any", conditions: [{ field: "Purchased category", operator: "is", value: "Home Fragrance" }, { field: "Purchased product", operator: "is", value: "Oak Diffuser" }], count: 1874, revenue: 94210, updated: "Live · updates in real time" },
  { id: "seg_04", name: "Never purchased", description: "Subscribed but no orders yet", match: "all", conditions: [{ field: "Order count", operator: "is exactly", value: "0" }, { field: "Consent", operator: "is", value: "Subscribed" }], count: 5102, revenue: 0, updated: "Live · updates in real time" },
  { id: "seg_05", name: "Engaged non-buyers (30d)", description: "Opened or clicked in 30 days, never bought", match: "all", conditions: [{ field: "Email engagement", operator: "opened in last", value: "30 days" }, { field: "Order count", operator: "is exactly", value: "0" }], count: 1466, revenue: 0, updated: "Live · updates in real time" },
  { id: "seg_06", name: "Discount-driven shoppers", description: "Every order used a coupon", match: "all", conditions: [{ field: "Coupon usage", operator: "used on", value: "100% of orders" }, { field: "Order count", operator: "is at least", value: "2" }], count: 733, revenue: 41205, updated: "Live · updates in real time" },
];

export type Campaign = {
  id: string;
  name: string;
  subject: string;
  status: "sent" | "scheduled" | "draft" | "sending";
  audience: string;
  recipients: number;
  sentAt: string;
  openRate: number;
  clickRate: number;
  revenue: number;
  abTest?: string;
};

export const campaigns: Campaign[] = [
  { id: "cmp_01", name: "Summer Linen Edit", subject: "The linen your bedroom has been waiting for", status: "sent", audience: "All subscribers", recipients: 16204, sentAt: "16 Jul 2026, 09:00", openRate: 41.2, clickRate: 5.8, revenue: 12480, abTest: "Subject line · winner: B" },
  { id: "cmp_02", name: "VIP early access · Autumn preview", subject: "48 hours before everyone else", status: "scheduled", audience: "VIP customers", recipients: 412, sentAt: "21 Jul 2026, 08:00", openRate: 0, clickRate: 0, revenue: 0 },
  { id: "cmp_03", name: "New In · July", subject: "Fresh arrivals for slow mornings", status: "sent", audience: "Engaged (90 days)", recipients: 11730, sentAt: "8 Jul 2026, 10:00", openRate: 38.7, clickRate: 4.4, revenue: 8912 },
  { id: "cmp_04", name: "Candle restock", subject: "Back: the sell-out Oak Diffuser", status: "sent", audience: "Candle & fragrance buyers", recipients: 1874, sentAt: "1 Jul 2026, 12:00", openRate: 52.9, clickRate: 9.1, revenue: 6340 },
  { id: "cmp_05", name: "Mid-season sale", subject: "20% off ends Sunday", status: "draft", audience: "All subscribers", recipients: 16204, sentAt: "Not scheduled", openRate: 0, clickRate: 0, revenue: 0 },
  { id: "cmp_06", name: "Father's Day gift guide", subject: "Gifts he'll actually keep", status: "sent", audience: "All subscribers", recipients: 15891, sentAt: "10 Jun 2026, 09:30", openRate: 35.1, clickRate: 3.9, revenue: 7205 },
];

export type AutomationNode = {
  id: string;
  kind: "trigger" | "delay" | "condition" | "email" | "split" | "exit" | "webhook";
  label: string;
  detail: string;
  stats?: string;
};

export type Automation = {
  id: string;
  name: string;
  trigger: string;
  status: "live" | "paused" | "draft";
  entered: number;
  completed: number;
  revenue: number;
  conversion: number;
  nodes: AutomationNode[];
  branches?: { at: string; yes: AutomationNode[]; no: AutomationNode[] };
};

export const automations: Automation[] = [
  {
    id: "auto_01", name: "Abandoned cart recovery", trigger: "Cart abandoned for 1 hour", status: "live", entered: 4218, completed: 3390, revenue: 48210, conversion: 12.4,
    nodes: [
      { id: "n1", kind: "trigger", label: "Trigger", detail: "Product added to cart · no purchase after 1 hour", stats: "4,218 entered" },
      { id: "n2", kind: "email", label: "Email 1 · Reminder", detail: "'You left something behind' · dynamic cart contents + restore link", stats: "48.1% open · 11.2% click" },
      { id: "n3", kind: "delay", label: "Wait 23 hours", detail: "Skip if purchase completed" },
      { id: "n4", kind: "condition", label: "Purchased?", detail: "Checks order completed since entry" },
    ],
    branches: {
      at: "n4",
      yes: [{ id: "n5", kind: "exit", label: "Exit · Converted", detail: "523 contacts · £48,210 attributed" }],
      no: [
        { id: "n6", kind: "email", label: "Email 2 · Social proof", detail: "'Still thinking it over?' · reviews + bestsellers", stats: "39.4% open · 7.8% click" },
        { id: "n7", kind: "delay", label: "Wait 24 hours", detail: "Skip if purchase completed" },
        { id: "n8", kind: "email", label: "Email 3 · Incentive", detail: "10% one-time code · auto-generated WooCommerce coupon, 48h expiry", stats: "36.0% open · 9.5% click" },
        { id: "n9", kind: "exit", label: "Exit", detail: "Suppress re-entry for 14 days" },
      ],
    },
  },
  {
    id: "auto_02", name: "Welcome series", trigger: "Newsletter signup", status: "live", entered: 6120, completed: 5714, revenue: 21630, conversion: 8.9,
    nodes: [
      { id: "n1", kind: "trigger", label: "Trigger", detail: "Subscribes to Newsletter list · double opt-in confirmed", stats: "6,120 entered" },
      { id: "n2", kind: "email", label: "Welcome email", detail: "Brand story + bestsellers", stats: "62.3% open · 14.1% click" },
      { id: "n3", kind: "delay", label: "Wait 1 day", detail: "" },
      { id: "n4", kind: "email", label: "Discount code", detail: "WELCOME15 · personalised one-time coupon", stats: "51.8% open · 18.9% click" },
      { id: "n5", kind: "delay", label: "Wait 3 days", detail: "" },
      { id: "n6", kind: "email", label: "Recommendations", detail: "Product block · picked from browse history", stats: "44.2% open · 9.7% click" },
      { id: "n7", kind: "exit", label: "Exit", detail: "Tag added: 'Welcomed'" },
    ],
  },
  {
    id: "auto_03", name: "Abandoned checkout", trigger: "Checkout started, not completed", status: "live", entered: 1892, completed: 1544, revenue: 31890, conversion: 17.8,
    nodes: [
      { id: "n1", kind: "trigger", label: "Trigger", detail: "Checkout started · no order after 30 minutes", stats: "1,892 entered" },
      { id: "n2", kind: "email", label: "Recovery email", detail: "Customer details prefilled · checkout recovery link", stats: "54.6% open · 16.3% click" },
      { id: "n3", kind: "delay", label: "Wait 24 hours", detail: "Skip if purchase completed" },
      { id: "n4", kind: "email", label: "Follow-up", detail: "'Your order is one click away' + delivery reassurance", stats: "41.0% open · 10.2% click" },
      { id: "n5", kind: "exit", label: "Exit", detail: "" },
    ],
  },
  {
    id: "auto_04", name: "Browse abandonment", trigger: "Viewed product, left site", status: "live", entered: 7431, completed: 7156, revenue: 9840, conversion: 3.1,
    nodes: [
      { id: "n1", kind: "trigger", label: "Trigger", detail: "Product viewed · no cart, no purchase, session ended", stats: "7,431 entered" },
      { id: "n2", kind: "delay", label: "Wait 2 hours", detail: "" },
      { id: "n3", kind: "email", label: "Viewed product", detail: "The product they looked at + 4 similar items", stats: "33.9% open · 5.4% click" },
      { id: "n4", kind: "exit", label: "Exit", detail: "Max 1 per contact per week" },
    ],
  },
  {
    id: "auto_05", name: "Post-purchase nurture", trigger: "First order completed", status: "live", entered: 2204, completed: 1911, revenue: 15420, conversion: 11.2,
    nodes: [
      { id: "n1", kind: "trigger", label: "Trigger", detail: "Order completed · first purchase only", stats: "2,204 entered" },
      { id: "n2", kind: "email", label: "Thank you", detail: "Order confirmation warmth + care instructions", stats: "68.4% open" },
      { id: "n3", kind: "delay", label: "Wait 7 days", detail: "After estimated delivery" },
      { id: "n4", kind: "email", label: "Review request", detail: "1-click star rating", stats: "41.7% open · 12.8% click" },
      { id: "n5", kind: "delay", label: "Wait 14 days", detail: "" },
      { id: "n6", kind: "email", label: "Cross-sell", detail: "Recommended products · excludes purchased category", stats: "36.5% open · 6.9% click" },
      { id: "n7", kind: "exit", label: "Exit", detail: "Moves to repeat-purchase flow on next order" },
    ],
  },
  {
    id: "auto_06", name: "Win-back · 90 days", trigger: "No purchase for 90 days", status: "paused", entered: 1218, completed: 1080, revenue: 6870, conversion: 4.6,
    nodes: [
      { id: "n1", kind: "trigger", label: "Trigger", detail: "Last order 90 days ago · was previously active", stats: "1,218 entered" },
      { id: "n2", kind: "email", label: "We miss you", detail: "What's new since their last order", stats: "28.2% open · 4.1% click" },
      { id: "n3", kind: "delay", label: "Wait 5 days", detail: "" },
      { id: "n4", kind: "email", label: "15% incentive", detail: "Personalised one-time coupon · 7 day expiry", stats: "24.9% open · 5.5% click" },
      { id: "n5", kind: "exit", label: "Exit", detail: "If no engagement, moves to 180-day sunset flow" },
    ],
  },
];

export type Form = {
  id: string;
  name: string;
  type: "Popup" | "Embedded" | "Slide-in" | "Floating bar" | "Spin-to-win" | "Exit intent";
  trigger: string;
  status: "live" | "paused" | "draft";
  views: number;
  signups: number;
};

export const forms: Form[] = [
  { id: "frm_01", name: "Welcome offer popup", type: "Popup", trigger: "After 8 seconds · all pages · once per visitor", status: "live", views: 48210, signups: 2892 },
  { id: "frm_02", name: "Exit intent · 10% off", type: "Exit intent", trigger: "Cursor leaves viewport · cart page only", status: "live", views: 12440, signups: 1108 },
  { id: "frm_03", name: "Spin-to-win · summer", type: "Spin-to-win", trigger: "After 40% scroll · homepage + category pages", status: "live", views: 31905, signups: 3510 },
  { id: "frm_04", name: "Footer newsletter form", type: "Embedded", trigger: "Static · site footer", status: "live", views: 96120, signups: 1442 },
  { id: "frm_05", name: "Back-in-stock bar", type: "Floating bar", trigger: "Out-of-stock product pages", status: "draft", views: 0, signups: 0 },
];

// 12 weeks of attributed revenue (campaigns vs automations), in £.
export const revenueSeries = {
  weeks: ["28 Apr", "5 May", "12 May", "19 May", "26 May", "2 Jun", "9 Jun", "16 Jun", "23 Jun", "30 Jun", "7 Jul", "14 Jul"],
  campaigns: [4100, 5200, 4800, 6900, 5400, 7205, 6100, 5800, 6600, 9140, 8912, 12480],
  automations: [6800, 7100, 7400, 7900, 8200, 8600, 8100, 8900, 9400, 9800, 10400, 11020],
};

export const channelSplit = [
  { label: "Automations", value: 113620, color: "var(--s2)" },
  { label: "Campaigns", value: 82841, color: "var(--s1)" },
];

export const topAutomationsByRevenue = automations
  .slice()
  .sort((a, b) => b.revenue - a.revenue)
  .map((a) => ({ label: a.name, value: a.revenue }));

export const deliverability = {
  provider: "Sendloom Managed (Amazon SES)",
  domain: "mail.aureliahome.co.uk",
  spf: "pass",
  dkim: "pass",
  dmarc: "pass",
  bounceRate: 0.42,
  complaintRate: 0.018,
  reputation: 96,
};

export const notifications = [
  { time: "09:02", level: "good", text: "Campaign 'Summer Linen Edit' finished sending · 16,204 delivered" },
  { time: "08:47", level: "info", text: "A/B test winner selected automatically: Subject B (+9.4% opens)" },
  { time: "Yesterday", level: "warn", text: "Bounce rate ticked up on gmail.com (0.9%) · monitoring" },
  { time: "Tuesday", level: "info", text: "Store sync completed · 214 new orders, 38 new contacts" },
];

export function gbp(n: number): string {
  return "£" + n.toLocaleString("en-GB", { maximumFractionDigits: n < 100 ? 2 : 0 });
}

export function num(n: number): string {
  return n.toLocaleString("en-GB");
}
