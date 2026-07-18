# Next Level Sprint · Internal Plan (pre-coding audit)

## Audit findings

**Strongest today:** import wizard (real pipeline, safe rules), contact
intelligence profiles (score reasons + source ledger), Demand Radar sector
gating, admin risk queue. Build green, live on Render, 17 routes.

**Most disconnected:** insights don't lead anywhere. Dashboard suggestions are
static cards with no links; opportunity cards have buttons that go nowhere;
tasks don't deep-link into work; segments are a table, not a decision tool.
Campaigns/automations are still seeded-demo islands.

**Most prototype-feeling:** static dashboard numbers where real DB counts now
exist; suggestion buttons that do nothing (violates the no-dead-buttons rule);
nothing captures unstructured data (the client's core "messy data" promise).

**Build this sprint:**
1. Universal Inbox + Paste Anything: REAL extraction (rule-based, no AI API)
   through new IntakeItem/ExtractedRecord tables → approve → contact + source
   + pending consent + tags + task, via the existing ingestion path.
2. Command-centre dashboard: real counts (hot leads, open tasks, intake queue,
   imports), intake feed, next-best-actions with real links + confidence.
3. Connections: audience cards (value, contactability, suggested campaign),
   contact "why this matters", task quick actions, product demand matching gaps.
4. Nav regroup (Capture / Audience / Growth / Control), positioning line,
   staging banner, /demo-notes, /api/health, seeded intake story.

**Deliberately NOT building:** real sending, LLM-backed assistant (extraction
is deterministic regex/dictionary and labelled as such), WhatsApp/email
forwarding integrations (concept UI only, no fake claims), payments.

**Schema change:** Contact.email becomes optional (phone-only leads from
paste/WhatsApp are real; unique-per-workspace kept, nulls allowed). New:
IntakeItem, ExtractedRecord.
