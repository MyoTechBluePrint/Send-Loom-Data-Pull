# Sendloom · Technical Architecture

Status after V3: the foundation below is BUILT and running locally. Prisma
schema in [prisma/schema.prisma](prisma/schema.prisma) (SQLite for dev,
Postgres-compatible; one-line datasource switch for production). Services in
`lib/server/`: `imports.ts` (pipeline), `events.ts` (queue-ready ingestion),
`scoring.ts` (transparent rules), `segments.ts` (rule engine with exclusions),
`views.ts` (DB → UI shapes). Store API in `app/api/v1/`, plugin in
`wordpress-plugin/sendloom/`. Flow tests: `npm run test:flows` (24 checks).
Still seeded demo: campaign/automation performance, analytics aggregates,
prospects, keyword volumes. Remaining plan below.

## Core entities

Workspace, User, Store, Contact, ContactSource, ConsentRecord, ImportBatch, ImportRow,
Segment, SegmentRule, Tag, Event, TimelineItem, Product, Order, Cart, Campaign,
CampaignSend, Automation, AutomationNode, AutomationRun, EmailTemplate, Form, LeadScore,
Keyword, KeywordCluster, DemandSignal, DataProvider, ProviderSync, EnrichmentRecord,
SuppressionRecord, ComplianceCheck, AuditLog.

Key relationships:

- Contact 1..n ContactSource. A contact cannot exist without at least one source row.
  Source rows are append-only; merges keep both.
- ConsentRecord is append-only per contact per channel (email/sms/whatsapp/phone/ad-export),
  with lawful basis, evidence pointer (form snapshot), timestamp, actor. Current permission
  is a materialised view over the history, never an editable boolean.
- ImportBatch → ImportRow (raw row preserved as JSONB) → Contact. Every contact keeps its
  originating batch id, which is what makes revenue-by-source a simple join.
- Event is the firehose (product_viewed, site_search, cart, checkout, order, email events,
  quiz_completed, guide_downloaded, consultation_requested…). TimelineItem is a curated
  projection per contact. LeadScore is recomputed from Events by a scoring worker; each
  score change stores its reason list (transparent scoring is a product requirement).
- SuppressionRecord is global per workspace and enforced at send time, not at audience
  build time. Blocked imports quarantine rows without creating Contacts.

## Provider layer

Everything external is a Provider with a common interface: type (commerce, CRM, enrichment,
keyword-data, search-data, ad-platform, sending, sms, whatsapp, analytics, storage),
auth config, sync schedule, rate limits, cost tracking, health/error log, and typed
capabilities. Planned first implementations:

- Commerce: WooCommerce plugin (webhooks + REST backfill)
- Sending: Amazon SES managed; BYO SendGrid/Mailgun/Postmark/SMTP
- Ad platform: Meta Lead Ads (lead pull with consent field mapping)
- Keyword data: DataForSEO (volumes, CPC, difficulty); Google Search Console (own queries)
- Enrichment: verification (Hunter-style) + EU B2B enrichment (Dropcontact-style);
  every EnrichmentRecord logs provider, fields, confidence, cost, permission basis
- CRM: HubSpot import first

No provider is hard-coded into product features; features consume capabilities.

## Sector mode (health/wellness)

Keyword classes: approved / needs review / restricted / internal only / blocked.
Classification rules per sector pack. Enforcement points: campaign content lint,
audience export gate, ad-audience export gate, public content suggestions. Restricted
terms remain usable for internal analytics and segmentation from first-party behaviour.

## Stack (as per client PRD)

Next.js front end · NestJS API (event-driven) · PostgreSQL (+ JSONB for raw rows/events,
partitioned events table) · Redis (queues via BullMQ, caching) · Meilisearch (contact/
global search) · S3 (imports, template assets) · SES default sending · OAuth2/JWT ·
Stripe billing. Targets: 100k+ contacts per store, millions of events, <5s event-to-
timeline latency, queue-based sending with per-domain throttling and reputation guards.

## Data movement layer (packs + dropzone)

ContactPack freezes a cleaned contact group (dedupe + suppression/unsub
exclusion at build AND render time); ExportLog records every copy/download
with counts and exclusions; ImportProject groups multi-file Dropzone uploads;
ImportBatch carries classification (classify.ts header/name/content
signatures). Suppression-list files route to SuppressionRecords only.
Savvy Mango vault: simulated aggregates only until the lawful-basis review
passes (STAGING.md); the real path reuses the batch pipeline with
sourceType=savvy_mango and enforced source tagging. V2 for >4MB files:
background ImportJob workers over the queue seam, chunked parsing, progress
polling — the UI job cards and statuses are already shaped for it.

## Universal Inbox (intake) flow

Data arrives (paste / WhatsApp forward / email forward / note / file / form /
api) → **IntakeItem** created with the raw payload preserved → extraction runs
(deterministic rules; `lib/server/extract.ts`) → **ExtractedRecord**(s) with
per-record confidence and duplicate detection → human review in /inbox →
approve creates or merges a **Contact**, appends **ContactSource**, writes a
*pending* **ConsentRecord** (intake never grants marketing consent), applies
interest **Tags**, optionally creates a **SalesTask**, adds a **TimelineItem**,
recomputes **LeadScore**, and writes **AuditLog** entries. Reject leaves only
the intake trail. Planned entities for real channel ingestion: IntakeSource
(forwarding addresses/numbers), IntakeAttachment, ExtractionJob (queue worker)
— currently extraction runs inline, same seam as event ingestion.

## Build layers (agreed order)

1. Import pipeline + source/consent ledger + contact DB + timelines
2. WooCommerce sync + segmentation + scoring + campaigns + automations
3. Keyword intent + Demand Radar + opportunities + enrichment providers
4. AI assistant + compliance engine + sales tasks/CRM + advanced attribution
