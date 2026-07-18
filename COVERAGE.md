# Sendloom · Brief Coverage Checklist

Status against all three client briefs. Legend:
**✅ built** (demonstrable in the prototype UI) · **◐ partial** (represented but thinner than the brief) · **✗ not built** (gap, listed with a recommendation).

Everything is prototype/mock: "built" means the UI, flows and data model story exist; no real backend runs yet (see ARCHITECTURE.md).

---

## Brief 1 · WooCommerce Email Marketing PRD

| Section | Status | Where / notes |
|---|---|---|
| Objectives & user types | ✅ | Whole app; Owner/Marketing/Admin reflected in Settings→Team + /admin |
| WooCommerce sync: customers, orders, products | ✅ | Settings→Store connection (sync counts, manual sync, error log) |
| Real-time events (view/cart/checkout/purchase/signup) | ✅ | Settings→Store connection webhook feed; events power timelines |
| Subscriber management (import/export/search/filter/bulk/suppress) | ✅ | /subscribers + bulk-action bar; suppression enforced in copy + admin |
| Segmentation engine, AND/OR | ✅ | /segments builder with live estimate |
| Email builder (blocks, previews, templates) | ◐ | /campaigns/new: block builder, mobile/desktop preview, merge tags. No drag-drop (click-to-add + reorder), no dark-mode preview, no template gallery |
| Personalisation / merge tags | ✅ | Builder renders tags as chips; tag palette in right rail |
| Automation builder, visual, branching | ✅ | /automations/[id] canvas with yes/no branch, inspector, flow settings |
| Triggers: welcome, abandoned cart, abandoned checkout, browse, first purchase, repeat, win-back | ✅ | 6 live flows (checkout recovery folded into consultation flow copy + cart flow) |
| Triggers: birthday, anniversary, back-in-stock, price drop, shipping | ◐ | "Recipes" card only; no built flows (brief itself marks most as optional/future) |
| Campaign builder (audience, schedule, time zones, batch) | ✅ | Builder right rail + scheduled campaign in list |
| A/B testing with auto-winner | ◐ | Toggle in builder, winner shown on list/report; no dedicated variant editor/results view |
| Reporting dashboard (opens, clicks, CTOR, revenue, recovered carts, ROI) | ✅ | Dashboard + /campaigns/[id] report |
| Analytics (LTV, repeat rate, revenue by segment, devices, clients, countries) | ✅ | /analytics; no click heatmap overlay (table of clicks-by-link instead) |
| Popups & forms (popup, slide-in, bar, exit, spin-to-win, multi-step) | ◐ | /forms list + live preview + quiz; no form design editor; spin-to-win replaced by quiz in demo data (type still supported) |
| Discount codes (auto WooCommerce coupons, one-time, expiry) | ◐ | Represented inside flows/emails; no standalone coupon manager screen |
| Deliverability (providers, SPF/DKIM/DMARC, reputation, suppression) | ✅ | Settings→Sending & deliverability |
| WooCommerce plugin dashboard (in WP admin) | ✗ | Not mocked; platform-side connection view only. Recommend one WP-admin mock screen for the client demo |
| Customer profile timeline | ✅ | /subscribers/[id] |
| Global search | ✗ | Not built. Recommend a ⌘K command palette in the next pass |
| Notifications | ✅ | Dashboard activity feed |
| Roles & permissions | ✅ | Settings→Team |
| Billing/SaaS plans (Stripe) | ✅ | Settings→Billing |
| API (REST, keys, OAuth, webhooks) | ✅ | Settings→API & webhooks |
| Security (2FA, audit, sessions) | ◐ | 2FA states + audit log shown; no session-management UI |
| GDPR (double opt-in, consent log, preference centre, erasure, export) | ✅ | Settings→Compliance + per-contact consent record + wizard consent step |
| Performance/scale requirements | ✅ | ARCHITECTURE.md (plan, not implementation) |
| Tech stack & roadmap | ✅ | ARCHITECTURE.md |

## Brief 2 · Growth Data Intelligence Platform upgrade

| # | Section | Status | Where / notes |
|---|---|---|---|
| 1 | Data Upload Centre (all list types, formats, mapping, preview, dedupe, source tagging) | ✅ | /imports + wizard; JSON/API/webhook/Zapier marked future per brief |
| 2 | Source & Permission Ledger | ✅ | Contact profile ledger card + wizard step 4; channel-level permissions incl. ad export |
| 3 | Data Quality Engine (detections, summary, actions) | ✅ | Wizard step 3; disposable email, suppression match, invalid format shown |
| 4 | Data Enrichment Engine (provider-based, logged) | ◐ | Provider slots + per-contact enrichment log with cost/confidence; no "run enrichment" bulk flow UI |
| 5 | Keyword Intent Engine | ✅ | /demand→Keyword intent (incl. the client's keyword list, review-gated) |
| 6 | Public Demand Scanner (Demand Radar) | ✅ | /demand→Demand radar; provider-ready copy, mock signals |
| 7 | First-party search intent | ✅ | /demand→Site search + timeline attachment for consented contacts |
| 8 | Prospect Discovery | ✅ | /prospects with consent/contactability filters |
| 9 | Intent-based segments (nested, exclusions, channel eligibility) | ◐ | Intent/quiz/score/source fields + AND/OR built; nested groups and explicit exclusion rows not in the builder UI yet |
| 10 | Lead scoring, transparent, statuses | ✅ | Profiles: score, status, reasons with points |
| 11 | Customer & prospect timeline (CRM-level) | ✅ | Profiles; import/enrich/score/task event types included |
| 12 | Campaign builder (types, goals, new audience sources) | ◐ | Email + audiences from segments/imports; SMS/WhatsApp/push marked future; no explicit "goal" picker |
| 13 | Automation builder upgrade (new triggers/nodes) | ◐ | Task node + consultation trigger live; full trigger catalogue (webhook/API/score thresholds) described, not all demonstrated as flows |
| 14 | Sales tasks & follow-up | ✅ | /tasks + automation task node |
| 15 | Content Opportunity Engine | ✅ | /demand→Opportunities + Growth assistant cards |
| 16 | Product demand matching (opportunity score, missing assets) | ✅ | Opportunity cards have/missing checklists |
| 17 | Dashboards ×6 | ◐ | Growth overview, uploads, radar, attribution, compliance all exist; no dedicated Audience Intelligence dashboard (no lead-score distribution chart) |
| 18 | Admin Control Centre | ✅ | /admin (pause sending, block imports, risk queue, audit) |
| 19 | Provider architecture | ✅ | /admin provider table + ARCHITECTURE.md |
| 20 | Health/wellness sector mode (review states) | ✅ | Sector chip, keyword review states, enforcement copy, admin audit entries |
| 21 | AI assistant (never invents, states basis) | ◐ | Dashboard suggestion cards with explicit "Based on"; not an interactive chat assistant |
| 22 | Data warehouse structure (entities) | ✅ | ARCHITECTURE.md, full entity list from the brief |
| 23 | Layered build order | ✅ | Followed; layers recorded in ARCHITECTURE.md |
| 24 | Final review personas | ✅ | Reviewed; remaining persona gaps are the ✗/◐ rows above |

## Brief 3 · V2 Sprint

| # | Section | Status | Notes |
|---|---|---|---|
| 1 | Data Upload Centre | ✅ | 5-step wizard covers the brief's 7 steps (map+preview merged; segment-from-import at the end) |
| 2 | Field Mapping Engine | ✅ | Auto-detection, custom-field fallback, preview values |
| 3 | Source & Permission Ledger | ✅ | Profile + wizard |
| 4 | Data Quality Review | ✅ | Cards + actions + export-rejected |
| 5 | Contact Intelligence Profile | ✅ | Score, ledger, next action, timeline; "campaigns received / automations entered" lists ◐ (timeline shows them, no dedicated tab) |
| 6 | Lead Scoring Engine | ✅ | Transparent reasons + statuses |
| 7 | Keyword Intent | ✅ | Regional interest, questions, difficulty, opportunity link |
| 8 | Demand Radar | ✅ | Provider-ready |
| 9 | First-party search intent | ✅ | Reports incl. no-result and revenue attribution |
| 10 | Audience Builder upgrade | ◐ | New fields + saved audiences; nested groups/exclusions outstanding |
| 11 | Prospect Discovery | ✅ | Filters per brief |
| 12 | Enrichment provider architecture | ✅ | Slots + logs (bulk-run UI outstanding, see Brief 2 §4) |
| 13 | Campaign & automation connection | ◐ | Audiences-from-imports + task nodes done; launch-campaign shortcuts exist on opportunity cards; not every entry point wired |
| 14 | Revenue attribution by source | ✅ | /analytics revenue by source + by keyword; by form/landing page ✗ (add two more bars when form data model lands) |
| 15 | Admin Control Centre | ✅ | /admin |
| 16 | Database & architecture plan | ✅ | ARCHITECTURE.md |
| 17 | Build order + commits + build passes | ✅ | Grouped commits; 17 routes, build green |
| 18 | Final review personas | ✅ | This document is the persona-by-persona evidence |

---

## Consolidated gap list (what to build next, in priority order)

1. Nested groups + exclusion rules in the Audience builder (Briefs 2§9, 3§10)
2. Audience Intelligence dashboard with lead-score distribution (Brief 2§17)
3. Revenue by form / landing page / lead magnet (Brief 3§14)
4. Bulk "run enrichment" flow with provider choice + cost preview (Briefs 2§4, 3§12)
5. Global search / ⌘K palette (Brief 1)
6. Dedicated coupon manager screen (Brief 1)
7. WP-admin plugin dashboard mock, one screen for the sales demo (Brief 1)
8. A/B variant editor + results detail (Brief 1)
9. Drag-drop + template gallery + dark-mode preview in email builder (Brief 1)
10. Recipe flows: birthday, anniversary, back-in-stock, price drop (Brief 1, marked future in PRD)

None of these block the demo; 1 to 4 are the ones the client will notice first.
