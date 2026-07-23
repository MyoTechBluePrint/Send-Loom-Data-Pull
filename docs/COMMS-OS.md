# SendLoom as the Communications OS

SendLoom is no longer "the email platform". Business platforms are producers of structured events; SendLoom owns the Customer Intelligence Profile and is the decision layer for who is contacted, when, on which channel, with what content, and why. NITO is the first producer; every other company plugs into the same API.

## The shared API

`POST /api/v1/intelligence` (v1 ApiKey auth, durable idempotency by requestId):

```json
{
  "requestId": "nito:intel:wealth.application_submitted:PW-ABC123",
  "eventType": "wealth.application_submitted",
  "platform": "nito",
  "person": { "email": "…", "name": "…", "country": "…" },
  "consent": { "channel": "email", "basis": "Private Wealth application consent" },
  "tags": ["nito:private-wealth", "nito:income-100-250"],
  "attributes": { "lifecycle": "eligible_for_consultation", "incomeBand": "100-250" },
  "data": { "refCode": "PW-ABC123", "checklist": ["Latest filed accounts"], "slot": "2026-07-30T10:00:00Z" }
}
```

One call updates the whole profile: contact upsert, consent record (before any channel is used), namespaced tags, per-platform attributes under `customFields.intel`, a timeline entry, a lead-score recompute, and journey enrolment. `POST /api/v1/journeys/run` executes due steps (cron-ready; immediate steps run in-request).

## The ten modules, honestly mapped

| Module | Status today |
|---|---|
| 1. Universal CRM | REAL (existing contacts + sources + consent ledger + timeline, now fed cross-platform) |
| 2. Segmentation engine | REAL (existing segments; intelligence tags/attributes are targetable) |
| 3. AI content engine | Data-driven personalisation REAL (deterministic, from the person's own answers); LLM generation deferred |
| 4. Journey builder | REAL engine (Journey/JourneyEnrolment, slot-relative scheduling, restart-on-retrigger); visual builder UI deferred |
| 5. Multi-channel delivery | Email REAL when armed; SMS/WhatsApp/push/Telegram record honest "simulated (provider not configured)" |
| 6. Document request engine | Checklist-driven personalised requests REAL (from producer data); upload detection deferred |
| 7. Meeting & calendar engine | Slot-relative confirmations/reminders/follow-ups REAL; Zoom/calendar APIs deferred |
| 8. Behavioural scoring | REAL (existing lead score recomputed on every ingested event) |
| 9. Analytics & attribution | Existing analytics; per-journey reporting deferred |
| 10. Shared API | REAL (`/api/v1/intelligence`, same key scheme as the whole v1 platform) |

## Live journeys (seeded)

- **private-wealth-intake**: personalised application-received email with the adaptive document checklist → 48h SMS reminder → 5-day WhatsApp follow-up.
- **private-wealth-meeting**: confirmation + preparation checklist → reminder at slot minus 24h → slot minus 1h → follow-up 2h after.
- **brokerage-intake** → **brokerage-blueprint** → **brokerage-design-call**: assessment received → blueprint + design-call invitation → session confirmation, reminder and next-steps.

Retriggering an event restarts its journey with fresh context (a rescheduled call carries the new slot). Every executed step lands on the contact timeline with its exact channel outcome: the CRM record of every message.

## Producers across the group (the plug-in map)

| Platform | Example events |
|---|---|
| NITO (live) | wealth.application_submitted, wealth.consultation_booked, brokerage.application_submitted, brokerage.blueprint_saved, brokerage.design_call_booked |
| Savvy Mango | investor.onboarding_started, raise.milestone_reached, kyc.reminder_due, shareholder.update |
| HOMIKASA | buyer.journey_started, seller.wizard_completed, legal.case_update, property.alert, viewing.reminder |
| Land Ledger | planning.update, bng.project_milestone, landowner.document_request |
| Frenzi | driver.onboarding, rider.campaign, airport.promotion |
| MyoTech | cart.abandoned (already live via plugin), subscription.renewal_due, product.education, reorder.sequence |

Each producer needs only: a v1 API key, event names in `platform.event_name` form, and consent carried on the event. Event types outside the known map are accepted when well-formed, so new platforms onboard without a SendLoom deploy.

## Boundaries

Consent arrives with the event and is checked again at send time; no consent, no send, recorded as skipped. Unconfigured channels never fake delivery. Generated content is deterministic personalisation from declared data, labelled as such. Proof: `npx tsx scripts/proof-comms-os.ts` (14 checks).
