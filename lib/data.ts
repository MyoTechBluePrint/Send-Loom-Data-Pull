// Mock data layer for the Sendloom prototype. Everything here stands in for
// the platform API + synced store data. Demo workspace: a wellness/longevity
// brand, to exercise the sector-mode and intent features.

export const store = {
  name: "Vitalis Wellness & Longevity",
  url: "vitaliswellness.co.uk",
  platform: "WooCommerce 9.8",
  plugin: "Sendloom Connect v2.0.1",
  status: "connected" as const,
  lastSync: "2 minutes ago",
  contacts: 24817,
  syncedOrders: 42917,
  syncedProducts: 148,
  sectorMode: "Health & Wellness" as const,
};

export type ChannelPermissions = {
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  phone: boolean;
  adExport: boolean;
};

export type Subscriber = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  location: string;
  consent: "subscribed" | "unsubscribed" | "pending" | "suppressed";
  source: string;
  lawfulBasis: string;
  channels: ChannelPermissions;
  confidence: number;
  signup: string;
  tags: string[];
  lists: string[];
  orders: number;
  revenue: number;
  aov: number;
  lastOrder: string;
  lastActivity: string;
  engagement: "high" | "medium" | "low" | "none";
  score: number;
  status: "cold" | "warm" | "hot" | "ready" | "customer" | "VIP" | "suppressed";
  scoreReasons: { reason: string; points: number }[];
};

const fullChannels: ChannelPermissions = { email: true, sms: true, whatsapp: true, phone: true, adExport: true };
const emailOnly: ChannelPermissions = { email: true, sms: false, whatsapp: false, phone: false, adExport: false };
const none: ChannelPermissions = { email: false, sms: false, whatsapp: false, phone: false, adExport: false };

export const subscribers: Subscriber[] = [
  { id: "sub_01", name: "Emma Richardson", email: "emma.richardson@gmail.com", phone: "+44 7911 240 881", location: "London, UK", consent: "subscribed", source: "Checkout opt-in", lawfulBasis: "Consent (double opt-in)", channels: fullChannels, confidence: 98, signup: "12 Mar 2025", tags: ["VIP", "NAD+ buyer"], lists: ["Newsletter", "VIP Club"], orders: 14, revenue: 2840.5, aov: 202.89, lastOrder: "9 Jul 2026", lastActivity: "2 hours ago", engagement: "high", score: 94, status: "VIP",
    scoreReasons: [
      { reason: "Repeat purchase (14 orders)", points: 80 },
      { reason: "Searched \"NAD+ dosage\" on site", points: 20 },
      { reason: "Opened 6 of last 8 emails", points: 5 },
      { reason: "Clicked consultation CTA", points: 10 },
    ] },
  { id: "sub_02", name: "James Okafor", email: "j.okafor@outlook.com", location: "Manchester, UK", consent: "subscribed", source: "Exit-intent popup", lawfulBasis: "Consent (double opt-in)", channels: emailOnly, confidence: 91, signup: "28 Jan 2026", tags: ["First-time buyer"], lists: ["Newsletter"], orders: 1, revenue: 89.99, aov: 89.99, lastOrder: "3 Feb 2026", lastActivity: "1 day ago", engagement: "medium", score: 48, status: "warm",
    scoreReasons: [
      { reason: "Purchased once", points: 60 },
      { reason: "Viewed Recovery Complex twice", points: 15 },
      { reason: "Inactive 90+ days since order", points: -20 },
      { reason: "Opened last email", points: 5 },
    ] },
  { id: "sub_03", name: "Sofia Marchetti", email: "sofia.marchetti@icloud.com", phone: "+44 7700 900 442", location: "Edinburgh, UK", consent: "subscribed", source: "Quiz funnel: Longevity Type", lawfulBasis: "Consent (double opt-in)", channels: fullChannels, confidence: 96, signup: "4 Nov 2025", tags: ["Repeat buyer", "Sleep stack"], lists: ["Newsletter", "Longevity"], orders: 6, revenue: 512.4, aov: 85.4, lastOrder: "1 Jul 2026", lastActivity: "5 hours ago", engagement: "high", score: 78, status: "hot",
    scoreReasons: [
      { reason: "Completed Longevity Type quiz", points: 25 },
      { reason: "Repeat purchase (6 orders)", points: 40 },
      { reason: "Searched \"magnesium sleep\"", points: 20 },
      { reason: "Opened 3 emails this month", points: 5 },
      { reason: "No consultation booked yet", points: -12 },
    ] },
  { id: "sub_04", name: "Daniel Hughes", email: "dan.hughes88@gmail.com", location: "Cardiff, UK", consent: "subscribed", source: "Guide download: Metabolic Reset", lawfulBasis: "Consent (double opt-in)", channels: emailOnly, confidence: 88, signup: "19 Jun 2026", tags: ["Prospect", "Weight management"], lists: ["Newsletter"], orders: 0, revenue: 0, aov: 0, lastOrder: "Never", lastActivity: "3 days ago", engagement: "medium", score: 63, status: "ready",
    scoreReasons: [
      { reason: "Downloaded Metabolic Reset guide", points: 25 },
      { reason: "Searched \"GLP-1 support\" on site", points: 20 },
      { reason: "Viewed Metabolic Support twice", points: 15 },
      { reason: "Clicked consultation CTA, no booking", points: 10 },
      { reason: "No purchase yet", points: -7 },
    ] },
  { id: "sub_05", name: "Priya Nair", email: "priya.nair@yahoo.co.uk", location: "Birmingham, UK", consent: "subscribed", source: "Checkout opt-in", lawfulBasis: "Consent (double opt-in)", channels: emailOnly, confidence: 95, signup: "2 Sep 2025", tags: ["Repeat buyer"], lists: ["Newsletter"], orders: 4, revenue: 367.2, aov: 91.8, lastOrder: "22 May 2026", lastActivity: "6 days ago", engagement: "medium", score: 55, status: "warm",
    scoreReasons: [
      { reason: "Repeat purchase (4 orders)", points: 40 },
      { reason: "Opened 2 emails this month", points: 10 },
      { reason: "56 days since last order", points: -10 },
      { reason: "Viewed Collagen restock page", points: 15 },
    ] },
  { id: "sub_06", name: "Tom Bergström", email: "tom.bergstrom@gmail.com", location: "Bristol, UK", consent: "unsubscribed", source: "Checkout opt-in", lawfulBasis: "Consent withdrawn", channels: none, confidence: 92, signup: "14 Feb 2025", tags: ["Lapsed"], lists: [], orders: 2, revenue: 156, aov: 78, lastOrder: "3 Oct 2025", lastActivity: "4 months ago", engagement: "none", score: 0, status: "suppressed",
    scoreReasons: [{ reason: "Unsubscribed", points: -100 }] },
  { id: "sub_07", name: "Charlotte Webb", email: "charlie.webb@hotmail.com", phone: "+44 7833 118 220", location: "Leeds, UK", consent: "subscribed", source: "Embedded form", lawfulBasis: "Consent (double opt-in)", channels: fullChannels, confidence: 93, signup: "8 Apr 2026", tags: ["Cart abandoner"], lists: ["Newsletter"], orders: 1, revenue: 124.5, aov: 124.5, lastOrder: "11 Apr 2026", lastActivity: "12 hours ago", engagement: "high", score: 71, status: "hot",
    scoreReasons: [
      { reason: "Abandoned checkout yesterday", points: 35 },
      { reason: "Purchased once", points: 30 },
      { reason: "Clicked 2 emails this week", points: 20 },
      { reason: "No repeat in 90 days", points: -14 },
    ] },
  { id: "sub_08", name: "Marcus Delaney", email: "m.delaney@protonmail.com", location: "Dublin, IE", consent: "subscribed", source: "Partner referral: FitLab Gyms", lawfulBasis: "Consent (referral opt-in)", channels: emailOnly, confidence: 84, signup: "30 May 2026", tags: ["First-time buyer", "Recovery"], lists: ["Newsletter"], orders: 1, revenue: 210, aov: 210, lastOrder: "30 May 2026", lastActivity: "2 days ago", engagement: "medium", score: 52, status: "warm",
    scoreReasons: [
      { reason: "Purchased Recovery Complex", points: 60 },
      { reason: "Partner-referred (FitLab)", points: 5 },
      { reason: "No email click in 3 weeks", points: -13 },
    ] },
  { id: "sub_09", name: "Yuki Tanaka", email: "yuki.t@gmail.com", location: "London, UK", consent: "pending", source: "Popup (double opt-in)", lawfulBasis: "Consent pending confirmation", channels: none, confidence: 70, signup: "16 Jul 2026", tags: [], lists: ["Newsletter"], orders: 0, revenue: 0, aov: 0, lastOrder: "Never", lastActivity: "2 days ago", engagement: "low", score: 5, status: "cold",
    scoreReasons: [{ reason: "Signed up, not yet confirmed", points: 5 }] },
  { id: "sub_10", name: "Grace Adeyemi", email: "grace.adeyemi@gmail.com", phone: "+44 7455 662 019", location: "Glasgow, UK", consent: "subscribed", source: "Checkout opt-in", lawfulBasis: "Consent (double opt-in)", channels: fullChannels, confidence: 99, signup: "21 Dec 2024", tags: ["VIP", "Longevity stack"], lists: ["Newsletter", "VIP Club"], orders: 22, revenue: 4106.75, aov: 186.67, lastOrder: "15 Jul 2026", lastActivity: "30 minutes ago", engagement: "high", score: 97, status: "VIP",
    scoreReasons: [
      { reason: "22 orders · £4,106 lifetime", points: 80 },
      { reason: "Booked longevity consultation", points: 50 },
      { reason: "Opens nearly every email", points: 8 },
    ] },
  { id: "sub_11", name: "Oliver Kaminski", email: "olly.kaminski@gmail.com", location: "Newcastle, UK", consent: "suppressed", source: "Import: Mailchimp export (Mar 2025)", lawfulBasis: "Suppressed (hard bounce)", channels: none, confidence: 40, signup: "10 Jan 2025", tags: ["Hard bounce"], lists: [], orders: 0, revenue: 0, aov: 0, lastOrder: "Never", lastActivity: "6 months ago", engagement: "none", score: 0, status: "suppressed",
    scoreReasons: [{ reason: "Hard bounce", points: -40 }] },
  { id: "sub_12", name: "Isabelle Fournier", email: "isa.fournier@gmail.com", location: "Brighton, UK", consent: "subscribed", source: "Quiz funnel: Longevity Type", lawfulBasis: "Consent (double opt-in)", channels: emailOnly, confidence: 90, signup: "3 Jul 2026", tags: ["Cart abandoner", "Weight management"], lists: ["Newsletter"], orders: 0, revenue: 0, aov: 0, lastOrder: "Never", lastActivity: "1 hour ago", engagement: "high", score: 68, status: "ready",
    scoreReasons: [
      { reason: "Abandoned cart (Metabolic Support)", points: 30 },
      { reason: "Completed quiz: 'Metabolic' type", points: 25 },
      { reason: "Opened both welcome emails", points: 10 },
      { reason: "No purchase yet", points: 3 },
    ] },
];

export type TimelineEvent = {
  time: string;
  type: "signup" | "view" | "cart" | "checkout" | "purchase" | "email_open" | "email_click" | "email_sent" | "automation" | "search" | "import" | "enrich" | "task" | "score";
  title: string;
  detail: string;
  value?: string;
};

export const timelines: Record<string, TimelineEvent[]> = {
  sub_01: [
    { time: "Today, 09:41", type: "email_click", title: "Clicked email", detail: "Campaign: NAD+ Restock · link: /products/nad-cellular-complex" },
    { time: "Today, 09:39", type: "email_open", title: "Opened email", detail: "Campaign: NAD+ Restock" },
    { time: "12 Jul, 21:04", type: "search", title: "Searched on site", detail: "\"NAD+ dosage\" · 4 results · clicked product" },
    { time: "9 Jul, 14:22", type: "purchase", title: "Placed order #42881", detail: "NAD+ Cellular Complex ×2, Deep Sleep Magnesium · Visa", value: "£214.00" },
    { time: "9 Jul, 14:18", type: "checkout", title: "Started checkout", detail: "3 items · £214.00" },
    { time: "9 Jul, 14:02", type: "cart", title: "Added to cart", detail: "NAD+ Cellular Complex" },
    { time: "28 Jun, 19:03", type: "score", title: "Lead score changed", detail: "82 → 94 · reason: repeat purchase + consultation click" },
    { time: "12 Mar 2025", type: "signup", title: "Newsletter signup", detail: "Checkout opt-in · consent logged (GDPR)" },
  ],
  sub_04: [
    { time: "Today, 08:15", type: "task", title: "Sales task created", detail: "Follow up re consultation · assigned to Hannah · due tomorrow" },
    { time: "Yesterday, 20:31", type: "search", title: "Searched on site", detail: "\"GLP-1 support\" · restricted keyword class · internal only" },
    { time: "Yesterday, 20:26", type: "view", title: "Viewed product", detail: "Metabolic Support Complex · 2nd view this week" },
    { time: "21 Jun, 09:12", type: "email_click", title: "Clicked email", detail: "Welcome series · consultation CTA" },
    { time: "19 Jun, 18:44", type: "signup", title: "Guide downloaded", detail: "Metabolic Reset guide · consent + source logged" },
  ],
  sub_12: [
    { time: "Today, 11:12", type: "email_sent", title: "Automation email sent", detail: "Abandoned cart · Email 2 of 3: 'Still thinking it over?'" },
    { time: "Yesterday, 22:40", type: "cart", title: "Added to cart", detail: "Metabolic Support Complex · £74.00" },
    { time: "Yesterday, 22:31", type: "view", title: "Viewed product", detail: "Metabolic Support Complex" },
    { time: "3 Jul, 20:19", type: "automation", title: "Entered automation", detail: "Welcome series · via quiz signup" },
    { time: "3 Jul, 20:15", type: "signup", title: "Quiz completed", detail: "Longevity Type quiz · result: Metabolic · consent logged" },
  ],
  sub_11: [
    { time: "12 Mar 2025", type: "email_sent", title: "Suppressed", detail: "Hard bounce on first send · auto-suppressed" },
    { time: "10 Jan 2025", type: "import", title: "Imported", detail: "Mailchimp export (Mar 2025 batch) · uploaded by Steve · source + lawful basis recorded" },
  ],
};

export function timelineFor(id: string): TimelineEvent[] {
  return (
    timelines[id] ?? [
      { time: "2 days ago", type: "email_open", title: "Opened email", detail: "Campaign: New In · July" },
      { time: "Last week", type: "view", title: "Viewed product", detail: "Marine Collagen Peptides" },
      { time: "Signup date", type: "signup", title: "Newsletter signup", detail: "Consent logged (GDPR)" },
    ]
  );
}

export type EnrichmentEntry = { provider: string; fields: string; confidence: number; when: string; cost: string };
export const enrichmentLog: Record<string, EnrichmentEntry[]> = {
  sub_04: [{ provider: "Dropcontact-style (EU)", fields: "Company, job title, city", confidence: 87, when: "20 Jun 2026", cost: "£0.012" }],
  sub_08: [{ provider: "Hunter-style verification", fields: "Email deliverability verified", confidence: 96, when: "30 May 2026", cost: "£0.004" }],
};

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
  { id: "seg_01", name: "VIP customers", description: "Spent over £500 lifetime with 3+ orders", match: "all", conditions: [{ field: "Total spend", operator: "is greater than", value: "£500" }, { field: "Order count", operator: "is at least", value: "3" }], count: 412, revenue: 386420, updated: "Live" },
  { id: "seg_02", name: "Weight-management intent", description: "Searched or browsed metabolic/weight topics, consented", match: "any", conditions: [{ field: "Keyword searched", operator: "is in cluster", value: "Weight management" }, { field: "Viewed category", operator: "is", value: "Metabolic Support" }], count: 1966, revenue: 48120, updated: "Live" },
  { id: "seg_03", name: "Consultation requested, not booked", description: "Clicked consultation CTA without completing booking", match: "all", conditions: [{ field: "Clicked link", operator: "contains", value: "/consultation" }, { field: "Booked consultation", operator: "is", value: "false" }], count: 284, revenue: 0, updated: "Live" },
  { id: "seg_04", name: "Quiz: Metabolic type", description: "Longevity Type quiz result = Metabolic", match: "all", conditions: [{ field: "Quiz result", operator: "is", value: "Metabolic" }, { field: "Consent", operator: "is", value: "Subscribed" }], count: 1102, revenue: 22040, updated: "Live" },
  { id: "seg_05", name: "Hot leads (score 70+)", description: "Lead score above 70, not yet customers", match: "all", conditions: [{ field: "Lead score", operator: "is at least", value: "70" }, { field: "Order count", operator: "is exactly", value: "0" }], count: 337, revenue: 0, updated: "Live" },
  { id: "seg_06", name: "At-risk (90 days inactive)", description: "Bought before, no purchase in 90 days", match: "all", conditions: [{ field: "Last order", operator: "is more than", value: "90 days ago" }, { field: "Order count", operator: "is at least", value: "1" }], count: 2318, revenue: 0, updated: "Live" },
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
  isDemo?: boolean;
  delivered?: number;
  opened?: number;
  clicked?: number;
};

export const campaigns: Campaign[] = [
  { id: "cmp_01", name: "NAD+ Restock", subject: "Back in stock: NAD+ Cellular Complex", status: "sent", audience: "Longevity interest", recipients: 9204, sentAt: "16 Jul 2026, 09:00", openRate: 44.6, clickRate: 7.2, revenue: 14210, abTest: "Subject line · winner: B" },
  { id: "cmp_02", name: "VIP early access · Sleep Series", subject: "48 hours before everyone else", status: "scheduled", audience: "VIP customers", recipients: 412, sentAt: "21 Jul 2026, 08:00", openRate: 0, clickRate: 0, revenue: 0 },
  { id: "cmp_03", name: "New In · July", subject: "Fresh formulas for slow mornings", status: "sent", audience: "Engaged (90 days)", recipients: 14730, sentAt: "8 Jul 2026, 10:00", openRate: 38.7, clickRate: 4.4, revenue: 8912 },
  { id: "cmp_04", name: "Recovery education series", subject: "How athletes actually recover", status: "sent", audience: "Recovery interest", recipients: 3874, sentAt: "1 Jul 2026, 12:00", openRate: 52.9, clickRate: 9.1, revenue: 6340 },
  { id: "cmp_05", name: "Consultation push · metabolic", subject: "A plan built around your metabolism", status: "draft", audience: "Weight-management intent", recipients: 1966, sentAt: "Not scheduled", openRate: 0, clickRate: 0, revenue: 0 },
  { id: "cmp_06", name: "Collagen loyalty offer", subject: "A thank-you for sticking with us", status: "sent", audience: "Repeat collagen buyers", recipients: 2891, sentAt: "10 Jun 2026, 09:30", openRate: 41.1, clickRate: 5.9, revenue: 7205 },
];

export type AutomationNode = {
  id: string;
  kind: "trigger" | "delay" | "condition" | "email" | "split" | "exit" | "webhook" | "task" | "tag";
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
    id: "auto_02", name: "Welcome series", trigger: "Newsletter or quiz signup", status: "live", entered: 6120, completed: 5714, revenue: 21630, conversion: 8.9,
    nodes: [
      { id: "n1", kind: "trigger", label: "Trigger", detail: "Subscribes via any form or quiz · double opt-in confirmed", stats: "6,120 entered" },
      { id: "n2", kind: "email", label: "Welcome email", detail: "Brand story + bestsellers · quiz-aware intro", stats: "62.3% open · 14.1% click" },
      { id: "n3", kind: "delay", label: "Wait 1 day", detail: "" },
      { id: "n4", kind: "email", label: "Discount code", detail: "WELCOME15 · personalised one-time coupon", stats: "51.8% open · 18.9% click" },
      { id: "n5", kind: "delay", label: "Wait 3 days", detail: "" },
      { id: "n6", kind: "email", label: "Recommendations", detail: "Product block · picked from quiz result + browse history", stats: "44.2% open · 9.7% click" },
      { id: "n7", kind: "exit", label: "Exit", detail: "Tag added: 'Welcomed'" },
    ],
  },
  {
    id: "auto_03", name: "Consultation follow-up", trigger: "Consultation requested, not booked", status: "live", entered: 892, completed: 704, revenue: 31890, conversion: 22.4,
    nodes: [
      { id: "n1", kind: "trigger", label: "Trigger", detail: "Clicked consultation CTA · no booking after 4 hours", stats: "892 entered" },
      { id: "n2", kind: "email", label: "Booking link", detail: "One-click booking + what to expect", stats: "58.2% open · 19.3% click" },
      { id: "n3", kind: "delay", label: "Wait 24 hours", detail: "Skip if booked" },
      { id: "n4", kind: "task", label: "Sales task", detail: "If lead score 70+: 'Call this lead' assigned to clinic team" },
      { id: "n5", kind: "email", label: "Follow-up", detail: "FAQ + practitioner intro", stats: "44.7% open · 12.6% click" },
      { id: "n6", kind: "exit", label: "Exit", detail: "" },
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
      { id: "n2", kind: "email", label: "Thank you", detail: "Usage guidance + what to expect in week 1", stats: "68.4% open" },
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
  type: "Popup" | "Embedded" | "Slide-in" | "Floating bar" | "Spin-to-win" | "Exit intent" | "Quiz";
  trigger: string;
  status: "live" | "paused" | "draft";
  views: number;
  signups: number;
};

export const forms: Form[] = [
  { id: "frm_01", name: "Welcome offer popup", type: "Popup", trigger: "After 8 seconds · all pages · once per visitor", status: "live", views: 48210, signups: 2892 },
  { id: "frm_02", name: "Longevity Type quiz", type: "Quiz", trigger: "Linked from homepage + ads · 7 questions", status: "live", views: 21440, signups: 4102 },
  { id: "frm_03", name: "Exit intent · 10% off", type: "Exit intent", trigger: "Cursor leaves viewport · cart page only", status: "live", views: 12440, signups: 1108 },
  { id: "frm_04", name: "Metabolic Reset guide", type: "Embedded", trigger: "Gated download · education pages", status: "live", views: 9605, signups: 2210 },
  { id: "frm_05", name: "Footer newsletter form", type: "Embedded", trigger: "Static · site footer", status: "live", views: 96120, signups: 1442 },
];

export const revenueSeries = {
  weeks: ["28 Apr", "5 May", "12 May", "19 May", "26 May", "2 Jun", "9 Jun", "16 Jun", "23 Jun", "30 Jun", "7 Jul", "14 Jul"],
  campaigns: [4100, 5200, 4800, 6900, 5400, 7205, 6100, 5800, 6600, 9140, 8912, 14210],
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
  domain: "mail.vitaliswellness.co.uk",
  spf: "pass",
  dkim: "pass",
  dmarc: "pass",
  bounceRate: 0.42,
  complaintRate: 0.018,
  reputation: 96,
};

export const notifications = [
  { time: "09:02", level: "good", text: "Campaign 'NAD+ Restock' finished sending · 9,204 delivered" },
  { time: "08:47", level: "info", text: "Import 'Webinar attendees · July' passed quality review · 1,088 ready" },
  { time: "Yesterday", level: "warn", text: "Keyword 'semaglutide' flagged Restricted by sector mode · campaigns blocked" },
  { time: "Tuesday", level: "info", text: "Store sync completed · 214 new orders, 38 new contacts" },
];

// ---------- Growth platform additions ----------

export type ImportBatch = {
  id: string;
  name: string;
  source: string;
  format: string;
  folderId?: string | null;
  folderName?: string | null;
  date: string;
  uploadedBy: string;
  total: number;
  ready: number;
  duplicates: number;
  merged: number;
  blocked: number;
  missingConsent: number;
  status: "complete" | "needs review" | "processing" | "blocked";
  revenue: number;
};

export const importBatches: ImportBatch[] = [
  { id: "imp_01", name: "Webinar attendees · July", source: "Zoom webinar · consent at registration", format: "CSV", date: "17 Jul 2026", uploadedBy: "Hannah Morris", total: 1240, ready: 1088, duplicates: 96, merged: 74, blocked: 12, missingConsent: 44, status: "needs review", revenue: 0 },
  { id: "imp_02", name: "Meta lead forms · Metabolic quiz ads", source: "Meta Lead Ads API · consent checkbox", format: "API sync", date: "Rolling · daily", uploadedBy: "System", total: 3808, ready: 3702, duplicates: 61, merged: 61, blocked: 0, missingConsent: 45, status: "complete", revenue: 18420 },
  { id: "imp_03", name: "Klaviyo export · legacy list", source: "Previous ESP · original consent carried", format: "CSV", date: "2 Jul 2026", uploadedBy: "Steve Clark", total: 11204, ready: 10480, duplicates: 512, merged: 402, blocked: 88, missingConsent: 124, status: "complete", revenue: 64110 },
  { id: "imp_04", name: "FitLab partner referrals", source: "Partner dataset · referral opt-in", format: "XLSX", date: "28 Jun 2026", uploadedBy: "Hannah Morris", total: 486, ready: 441, duplicates: 22, merged: 18, blocked: 4, missingConsent: 19, status: "complete", revenue: 8240 },
  { id: "imp_05", name: "Clinic enquiry backlog", source: "Website enquiry forms 2024-25", format: "XLSX", date: "24 Jun 2026", uploadedBy: "Steve Clark", total: 902, ready: 517, duplicates: 130, merged: 96, blocked: 41, missingConsent: 214, status: "needs review", revenue: 0 },
  { id: "imp_06", name: "Purchased list · unknown origin", source: "No verifiable consent trail", format: "CSV", date: "20 Jun 2026", uploadedBy: "Studio North", total: 5000, ready: 0, duplicates: 0, merged: 0, blocked: 5000, missingConsent: 5000, status: "blocked", revenue: 0 },
];

export type Prospect = {
  id: string;
  name: string;
  email: string;
  source: string;
  interest: string;
  score: number;
  status: "cold" | "warm" | "hot" | "ready";
  consent: "granted" | "pending" | "missing";
  channels: string;
  location: string;
  confidence: number;
};

export const prospects: Prospect[] = [
  { id: "pr_01", name: "Laura Chen", email: "laura.chen@…", source: "Meta lead form", interest: "Weight management", score: 74, status: "ready", consent: "granted", channels: "Email", location: "London, UK", confidence: 92 },
  { id: "pr_02", name: "Ben Whitfield", email: "b.whitfield@…", source: "Webinar · July", interest: "Longevity", score: 68, status: "hot", consent: "granted", channels: "Email, phone", location: "Manchester, UK", confidence: 89 },
  { id: "pr_03", name: "Amara Diallo", email: "amara.d@…", source: "Quiz funnel", interest: "Sleep", score: 61, status: "hot", consent: "granted", channels: "Email", location: "Bristol, UK", confidence: 94 },
  { id: "pr_04", name: "Kieran O'Shea", email: "kieran.os@…", source: "FitLab referral", interest: "Recovery", score: 57, status: "warm", consent: "granted", channels: "Email, WhatsApp", location: "Dublin, IE", confidence: 85 },
  { id: "pr_05", name: "Natalie Brooks", email: "nat.brooks@…", source: "Clinic enquiry backlog", interest: "Metabolic health", score: 49, status: "warm", consent: "pending", channels: "None until consent", location: "Leeds, UK", confidence: 71 },
  { id: "pr_06", name: "David Okon", email: "d.okon@…", source: "Guide download", interest: "NAD+ / longevity", score: 66, status: "hot", consent: "granted", channels: "Email", location: "Glasgow, UK", confidence: 90 },
];

export type Keyword = {
  term: string;
  cluster: string;
  volume: number;
  trend: number;
  cpc: string;
  seo: number;
  intent: "buyer" | "research" | "question";
  review: "approved" | "needs review" | "restricted" | "internal only";
};

export const keywords: Keyword[] = [
  { term: "NAD+ supplement", cluster: "NAD+ / longevity", volume: 74000, trend: 64, cpc: "£1.86", seo: 42, intent: "buyer", review: "approved" },
  { term: "NAD+ vs NMN", cluster: "NAD+ / longevity", volume: 22000, trend: 38, cpc: "£0.94", seo: 35, intent: "research", review: "approved" },
  { term: "collagen peptides benefits", cluster: "Collagen & beauty", volume: 61000, trend: 12, cpc: "£1.12", seo: 58, intent: "research", review: "approved" },
  { term: "magnesium for sleep", cluster: "Sleep & recovery", volume: 90000, trend: 21, cpc: "£0.88", seo: 61, intent: "buyer", review: "approved" },
  { term: "muscle recovery supplements", cluster: "Sleep & recovery", volume: 33000, trend: 17, cpc: "£1.44", seo: 55, intent: "buyer", review: "approved" },
  { term: "GLP-1 support supplement", cluster: "Weight management", volume: 41000, trend: 96, cpc: "£2.61", seo: 38, intent: "buyer", review: "needs review" },
  { term: "semaglutide", cluster: "Weight management", volume: 823000, trend: 41, cpc: "£3.20", seo: 88, intent: "research", review: "restricted" },
  { term: "Mounjaro side effects", cluster: "Weight management", volume: 246000, trend: 29, cpc: "£2.05", seo: 82, intent: "question", review: "restricted" },
  { term: "peptides for recovery", cluster: "Peptide education", volume: 18000, trend: 52, cpc: "£1.71", seo: 33, intent: "research", review: "needs review" },
  { term: "BPC-157", cluster: "Peptide education", volume: 135000, trend: 44, cpc: "£1.28", seo: 71, intent: "research", review: "internal only" },
  { term: "longevity clinic UK", cluster: "Clinic & consultation", volume: 6200, trend: 73, cpc: "£4.10", seo: 24, intent: "buyer", review: "approved" },
  { term: "metabolic health test", cluster: "Clinic & consultation", volume: 9800, trend: 31, cpc: "£2.88", seo: 29, intent: "buyer", review: "approved" },
];

export type Opportunity = {
  cluster: string;
  score: number;
  demand: string;
  have: string[];
  missing: string[];
};

export const opportunities: Opportunity[] = [
  { cluster: "NAD+ / longevity", score: 86, demand: "Rising 64% · buyer intent strong", have: ["Product in stock", "Email flow", "Landing page"], missing: ["NAD+ vs NMN comparison page", "Quiz branch"] },
  { cluster: "Weight management", score: 74, demand: "Rising 96% · sector review required", have: ["Product in stock", "Guide lead magnet", "Quiz result path"], missing: ["Dedicated landing page", "Consultation nurture flow", "Compliant FAQ content"] },
  { cluster: "Clinic & consultation", score: 71, demand: "Rising 73% · high CPC, low SEO difficulty", have: ["Booking system", "Follow-up automation"], missing: ["'Longevity clinic UK' landing page", "Practitioner bio content"] },
  { cluster: "Sleep & recovery", score: 62, demand: "Steady · high volume", have: ["Products", "Landing page", "Email flow"], missing: ["Sleep quiz funnel"] },
  { cluster: "Peptide education", score: 44, demand: "Rising · education-only under sector mode", have: ["Blog hub"], missing: ["Compliance-reviewed guide", "Internal-only segment plan"] },
];

export type SiteSearch = {
  term: string;
  searches: number;
  trend: number;
  conversion: number;
  revenue: number;
  note?: string;
};

export const siteSearches: SiteSearch[] = [
  { term: "nad+", searches: 1840, trend: 44, conversion: 6.8, revenue: 9120 },
  { term: "collagen", searches: 1422, trend: 8, conversion: 5.1, revenue: 6240 },
  { term: "sleep", searches: 1210, trend: 19, conversion: 4.4, revenue: 3980 },
  { term: "glp-1", searches: 986, trend: 122, conversion: 2.1, revenue: 1820, note: "Sector mode: internal only" },
  { term: "menopause support", searches: 512, trend: 67, conversion: 0, revenue: 0, note: "No product · missed demand" },
  { term: "creatine gummies", searches: 388, trend: 91, conversion: 0, revenue: 0, note: "No results · missed demand" },
  { term: "recovery", searches: 344, trend: 12, conversion: 5.9, revenue: 2210 },
];

export type SalesTask = {
  id: string;
  type: string;
  contact: string;
  contactId?: string;
  due: string;
  priority: "high" | "medium" | "low";
  status: "open" | "done" | "overdue";
  note: string;
  assignee: string;
  source?: string;
};

export const salesTasks: SalesTask[] = [
  { id: "tsk_01", type: "Call lead", contact: "Daniel Hughes", contactId: "sub_04", due: "Today", priority: "high", status: "open", note: "Score 63 · consultation clicked, not booked · discuss metabolic plan", assignee: "Hannah" },
  { id: "tsk_02", type: "WhatsApp follow-up", contact: "Laura Chen", due: "Today", priority: "high", status: "open", note: "Meta lead · ready status · send consultation link (WhatsApp consented)", assignee: "Clinic team" },
  { id: "tsk_03", type: "Check consent", contact: "Natalie Brooks", due: "Tomorrow", priority: "medium", status: "open", note: "Clinic backlog import · consent pending · do not contact until confirmed", assignee: "Steve" },
  { id: "tsk_04", type: "Send manual quote", contact: "Ben Whitfield", due: "Tomorrow", priority: "medium", status: "open", note: "Webinar Q&A asked about practitioner packages", assignee: "Hannah" },
  { id: "tsk_05", type: "Review prospect", contact: "Kieran O'Shea", due: "Fri 24 Jul", priority: "low", status: "open", note: "FitLab referral · verify phone before WhatsApp", assignee: "Clinic team" },
  { id: "tsk_06", type: "Call lead", contact: "Grace Adeyemi", contactId: "sub_10", due: "Yesterday", priority: "high", status: "overdue", note: "VIP · consultation booked, confirm prep call", assignee: "Clinic team" },
];

export type Provider = {
  name: string;
  type: string;
  status: "healthy" | "syncing" | "error" | "not connected";
  lastSync: string;
  note: string;
};

export const providers: Provider[] = [
  { name: "WooCommerce Connect", type: "Commerce", status: "healthy", lastSync: "2 min ago", note: "Webhooks live · 1.8s median latency" },
  { name: "Amazon SES (managed)", type: "Email sending", status: "healthy", lastSync: "Continuous", note: "Reputation 96/100" },
  { name: "Meta Lead Ads", type: "Ad platform", status: "healthy", lastSync: "18 min ago", note: "Daily lead pull · consent field mapped" },
  { name: "Google Search Console", type: "Search data", status: "healthy", lastSync: "Today 06:00", note: "Feeds Demand Radar organic queries" },
  { name: "DataForSEO", type: "Keyword data", status: "healthy", lastSync: "Today 06:10", note: "Volumes, CPC, difficulty · £12.40 this month" },
  { name: "Dropcontact-style enrichment (EU)", type: "Enrichment", status: "healthy", lastSync: "On demand", note: "GDPR-aligned B2B enrichment · per-record log" },
  { name: "HubSpot CRM", type: "CRM", status: "error", lastSync: "Failed 04:12", note: "OAuth token expired · re-auth required" },
  { name: "Twilio SMS", type: "SMS", status: "not connected", lastSync: "–", note: "Planned · Phase 2" },
];

export const aiSuggestions = [
  { title: "Build 'menopause support' collection page", detail: "512 on-site searches in 30 days with zero results. Estimated missed demand £4k+/mo at category-average conversion.", basis: "Based on: your site-search log, category conversion averages" },
  { title: "Launch consultation nurture for quiz 'Metabolic' types", detail: "1,102 contacts hold this quiz result; 284 clicked the consultation CTA without booking. A 3-email nurture + sales task at score 70 is projected from your consultation flow's 22.4% conversion.", basis: "Based on: segment sizes, Consultation follow-up flow performance" },
  { title: "Create NAD+ vs NMN comparison page", detail: "22k monthly searches, SEO difficulty 35, and your NAD+ flow already converts at 8.9%. The comparison page is the missing asset in your top-scoring cluster.", basis: "Based on: DataForSEO volumes, opportunity scan of existing assets" },
  { title: "Review 'Clinic enquiry backlog' consent gaps", detail: "214 records lack a consent trail. Recommend a re-permission campaign to the 156 with a documented enquiry, and suppression for the rest.", basis: "Based on: import quality review, source ledger" },
];

export const dataQuality = {
  score: 91,
  ready: 22103,
  needsReview: 731,
  suppressed: 612,
  missingConsent: 402,
  duplicatesMerged: 651,
};

export function gbp(n: number): string {
  return "£" + n.toLocaleString("en-GB", { maximumFractionDigits: n < 100 ? 2 : 0 });
}

export function num(n: number): string {
  return n.toLocaleString("en-GB");
}
