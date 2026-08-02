// The shared condition engine: ONE rule format for forms, surveys, polls and
// audience-feeding actions. Forms evaluate rules per step; polls apply their
// option actions; both funnel through applyActions so tagging, properties and
// journey triggers behave identically everywhere.
//
// A rule: { if: Condition, then: Action[] }
// Conditions compare a submitted answer or a contact fact.
// Actions change the contact or route the form.

import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";

export type Condition = {
  /** Field key from the current submission, or a contact fact prefixed "contact." */
  field: string;
  op: "equals" | "not_equals" | "contains" | "has_tag" | "not_has_tag" | "gt" | "lt";
  value: string;
};

export type Action =
  | { action: "add_tag"; tag: string }
  | { action: "remove_tag"; tag: string }
  | { action: "set_property"; key: string; value: string }
  | { action: "go_to_step"; step: number }
  | { action: "skip_step"; step: number }
  | { action: "show_success"; message: string }
  | { action: "trigger_journey"; journeyId: string }
  | { action: "generate_coupon"; promotionId: string };

export type Rule = { if: Condition; then: Action[] };

export function parseRules(json: string | null | undefined): Rule[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? (v as Rule[]) : [];
  } catch {
    return [];
  }
}

/** Evaluate one condition against submitted answers and contact facts. */
export async function evaluateCondition(
  c: Condition,
  answers: Record<string, string>,
  contact: { id: string; workspaceId: string } | null
): Promise<boolean> {
  // Tag conditions read the contact, everything else reads answers first.
  if (c.op === "has_tag" || c.op === "not_has_tag") {
    if (!contact) return c.op === "not_has_tag";
    const tagged = await db.contactTag.findFirst({
      where: { contactId: contact.id, tag: { workspaceId: contact.workspaceId, name: c.value } },
    });
    return c.op === "has_tag" ? Boolean(tagged) : !tagged;
  }

  const raw = c.field.startsWith("contact.")
    ? await contactFact(c.field.slice(8), contact)
    : answers[c.field] ?? "";
  const a = (raw ?? "").toString().toLowerCase().trim();
  const b = c.value.toLowerCase().trim();

  switch (c.op) {
    case "equals": return a === b;
    case "not_equals": return a !== b;
    case "contains": return a.includes(b);
    case "gt": return parseFloat(a) > parseFloat(b);
    case "lt": return parseFloat(a) < parseFloat(b);
    default: return false;
  }
}

async function contactFact(key: string, contact: { id: string } | null): Promise<string> {
  if (!contact) return "";
  const c = await db.contact.findUnique({ where: { id: contact.id } });
  if (!c) return "";
  switch (key) {
    case "country": return c.country ?? "";
    case "orders_count": return String(c.ordersCount);
    case "revenue": return String(c.revenue);
    case "engagement": return c.engagement;
    default: {
      try {
        const custom = c.customFields ? (JSON.parse(c.customFields) as Record<string, unknown>) : {};
        return String(custom[key] ?? "");
      } catch {
        return "";
      }
    }
  }
}

export type AppliedResult = {
  tagsAdded: string[];
  tagsRemoved: string[];
  propertiesSet: Record<string, string>;
  goToStep: number | null;
  skipSteps: number[];
  successMessage: string | null;
  triggeredJourneys: string[];
  couponPromotions: string[];
};

/**
 * Apply contact-mutating actions. Routing actions (go_to_step, skip_step,
 * show_success) are returned to the caller rather than executed, because only
 * the form runtime knows what a step is.
 */
export async function applyActions(
  workspaceId: string,
  contactId: string | null,
  actions: Action[],
  actorLabel: string
): Promise<AppliedResult> {
  const result: AppliedResult = {
    tagsAdded: [], tagsRemoved: [], propertiesSet: {},
    goToStep: null, skipSteps: [], successMessage: null,
    triggeredJourneys: [], couponPromotions: [],
  };

  for (const a of actions) {
    switch (a.action) {
      case "add_tag": {
        if (!contactId) break;
        const tag = await db.tag.upsert({
          where: { workspaceId_name: { workspaceId, name: a.tag } },
          create: { workspaceId, name: a.tag },
          update: {},
        });
        await db.contactTag.upsert({
          where: { contactId_tagId: { contactId, tagId: tag.id } },
          create: { contactId, tagId: tag.id },
          update: {},
        });
        result.tagsAdded.push(a.tag);
        break;
      }
      case "remove_tag": {
        if (!contactId) break;
        const tag = await db.tag.findUnique({ where: { workspaceId_name: { workspaceId, name: a.tag } } });
        if (tag) {
          await db.contactTag.deleteMany({ where: { contactId, tagId: tag.id } });
          result.tagsRemoved.push(a.tag);
        }
        break;
      }
      case "set_property": {
        if (!contactId) break;
        const c = await db.contact.findUnique({ where: { id: contactId } });
        if (c) {
          let custom: Record<string, unknown> = {};
          try { custom = c.customFields ? (JSON.parse(c.customFields) as Record<string, unknown>) : {}; } catch { custom = {}; }
          custom[a.key] = a.value;
          await db.contact.update({ where: { id: contactId }, data: { customFields: JSON.stringify(custom) } });
          result.propertiesSet[a.key] = a.value;
        }
        break;
      }
      case "go_to_step": result.goToStep = a.step; break;
      case "skip_step": result.skipSteps.push(a.step); break;
      case "show_success": result.successMessage = a.message; break;
      case "trigger_journey": {
        if (!contactId) break;
        // Enrol through the existing journey engine's table; the journey tick
        // picks enrolments up from here.
        const journey = await db.journey.findFirst({ where: { id: a.journeyId, workspaceId } }).catch(() => null);
        if (journey) {
          await db.journeyEnrolment.upsert({
            where: { journeyId_contactId: { journeyId: a.journeyId, contactId } },
            create: { journeyId: a.journeyId, contactId, status: "active" },
            update: {},
          }).catch(() => {});
          result.triggeredJourneys.push(a.journeyId);
        }
        break;
      }
      case "generate_coupon": result.couponPromotions.push(a.promotionId); break;
    }
  }

  if (result.tagsAdded.length || result.tagsRemoved.length || Object.keys(result.propertiesSet).length) {
    await audit(
      workspaceId, actorLabel, "conditions.applied",
      [
        result.tagsAdded.length ? `tags added: ${result.tagsAdded.join(", ")}` : null,
        result.tagsRemoved.length ? `tags removed: ${result.tagsRemoved.join(", ")}` : null,
        Object.keys(result.propertiesSet).length ? `properties: ${Object.entries(result.propertiesSet).map(([k, v]) => `${k}=${v}`).join(", ")}` : null,
      ].filter(Boolean).join(" · ")
    );
  }

  return result;
}
