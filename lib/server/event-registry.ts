// Controlled event catalogue. For every event type: which source contexts may
// produce it, and which side-effects it is allowed to drive. The ingestion
// pipeline consults this so a backend/API caller can never fabricate browser
// behaviour (e.g. product_viewed from a server context is quarantined).
export type SourceContext = "tracker" | "plugin" | "qa-panel" | "system";

export type EventDef = {
  sources: SourceContext[] | "any";
  affectsAnalytics: boolean; // funnels, launch board, demand
  affectsCarts: boolean;
  affectsScoring: boolean;
};

const BROWSER = ["tracker", "qa-panel"] as SourceContext[];
const BROWSER_OR_PLUGIN = ["tracker", "plugin", "qa-panel"] as SourceContext[];

const DEFAULT_DEF: EventDef = { sources: "any", affectsAnalytics: true, affectsCarts: false, affectsScoring: true };

export const EVENT_REGISTRY: Record<string, EventDef> = {
  // Pure browser behaviour: only the storefront tracker (or the QA panel
  // simulating it) may produce these.
  page_viewed: { sources: BROWSER_OR_PLUGIN, affectsAnalytics: true, affectsCarts: false, affectsScoring: true },
  product_viewed: { sources: BROWSER_OR_PLUGIN, affectsAnalytics: true, affectsCarts: false, affectsScoring: true },
  category_viewed: { sources: BROWSER_OR_PLUGIN, affectsAnalytics: true, affectsCarts: false, affectsScoring: true },
  search: { sources: BROWSER_OR_PLUGIN, affectsAnalytics: true, affectsCarts: false, affectsScoring: true },
  popup_viewed: { sources: BROWSER, affectsAnalytics: true, affectsCarts: false, affectsScoring: false },
  popup_closed: { sources: BROWSER, affectsAnalytics: true, affectsCarts: false, affectsScoring: false },
  popup_submitted: { sources: BROWSER, affectsAnalytics: true, affectsCarts: false, affectsScoring: true },

  // Cart/checkout journey: browser tracker, or the plugin's server-truth hooks.
  cart_add: { sources: BROWSER_OR_PLUGIN, affectsAnalytics: true, affectsCarts: true, affectsScoring: true },
  cart_remove: { sources: BROWSER_OR_PLUGIN, affectsAnalytics: true, affectsCarts: true, affectsScoring: false },
  cart_updated: { sources: BROWSER_OR_PLUGIN, affectsAnalytics: true, affectsCarts: true, affectsScoring: false },
  checkout_started: { sources: BROWSER_OR_PLUGIN, affectsAnalytics: true, affectsCarts: true, affectsScoring: true },
  checkout_email_entered: { sources: BROWSER, affectsAnalytics: true, affectsCarts: true, affectsScoring: true },
  checkout_phone_entered: { sources: BROWSER, affectsAnalytics: true, affectsCarts: true, affectsScoring: false },
  checkout_address_started: { sources: BROWSER, affectsAnalytics: true, affectsCarts: true, affectsScoring: false },

  // Server commerce truth: plugin/system only; a browser must not fabricate
  // completed checkouts or purchases.
  checkout_completed: { sources: ["plugin", "system", "qa-panel"], affectsAnalytics: true, affectsCarts: true, affectsScoring: true },
  purchase_completed: { sources: ["plugin", "system", "qa-panel"], affectsAnalytics: true, affectsCarts: true, affectsScoring: true },
  account_created: { sources: ["plugin", "system"], affectsAnalytics: true, affectsCarts: false, affectsScoring: true },

  // Marketing/system events keep the permissive default via DEFAULT_DEF
  // (imports, consent_recorded, email_open, email_click, recovery_link_clicked…).
};

export function eventDef(type: string): EventDef {
  return EVENT_REGISTRY[type] ?? DEFAULT_DEF;
}

export function sourceAllowed(type: string, source: SourceContext): boolean {
  const def = eventDef(type);
  return def.sources === "any" || def.sources.includes(source);
}
