// File classification for the Mass Data Dropzone: header signatures + name
// hints + content patterns. Deterministic; the user can always override.

export type Classification = {
  kind: string;
  label: string;
  confidence: number;
  destination: string;
  note?: string;
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function hasAny(headers: string[], ...needles: string[]): boolean {
  const h = headers.map(norm);
  return needles.some((n) => h.some((x) => x.includes(norm(n))));
}

export function classifyFile(fileName: string, headers: string[], sample: string): Classification {
  const name = fileName.toLowerCase();
  const whatsappLine = /\[?\d{1,2}[/.]\d{1,2}[/.]\d{2,4},? \d{1,2}:\d{2}/;

  if (whatsappLine.test(sample) && (sample.match(/:/g)?.length ?? 0) > 3) {
    return { kind: "whatsapp_export", label: "WhatsApp chat export", confidence: 88, destination: "Universal Inbox → extraction → review queue", note: "Names, numbers and requests are extracted for approval; messages never become contacts automatically." };
  }
  if (hasAny(headers, "keyword", "search term") && hasAny(headers, "volume", "impressions", "clicks", "difficulty")) {
    return { kind: "keyword_file", label: "Keyword research file", confidence: 90, destination: "Demand Radar → keyword clusters" };
  }
  if (name.includes("savvy") || hasAny(headers, "investor", "shareholding", "company number", "companies house")) {
    return { kind: "savvy_mango", label: "Savvy Mango export", confidence: 85, destination: "Savvy Mango vault → tagged, deduplicated, consent-gated", note: "Kept clearly labelled and separated. Real personal data needs the lawful-basis check in STAGING.md before import." };
  }
  if (hasAny(headers, "unsubscribe", "suppress", "opt-out", "optout", "bounced") || name.includes("unsub") || name.includes("suppress")) {
    return { kind: "suppression_list", label: "Suppression / unsubscribe list", confidence: 87, destination: "Suppression records only · never creates marketable contacts" };
  }
  if (hasAny(headers, "billing_email", "order_id", "order_number", "order total")) {
    return { kind: "woocommerce", label: "WooCommerce export", confidence: 86, destination: "Contacts + orders + lifetime value" };
  }
  if (hasAny(headers, "member_rating", "audience id") || (hasAny(headers, "email address") && hasAny(headers, "optin_time", "last_changed"))) {
    return { kind: "mailchimp", label: "Mailchimp audience export", confidence: 84, destination: "Contacts · consent carried from original opt-in" };
  }
  if (hasAny(headers, "klaviyo", "accepts marketing") || name.includes("klaviyo")) {
    return { kind: "klaviyo", label: "Klaviyo export", confidence: 82, destination: "Contacts · consent carried from original opt-in" };
  }
  if (hasAny(headers, "email", "e-mail", "correo") || hasAny(headers, "phone", "mobile", "telefono", "teléfono")) {
    const customery = hasAny(headers, "total spend", "orders", "order value", "ltv", "value");
    return customery
      ? { kind: "customer_list", label: "Customer list", confidence: 75, destination: "Contacts + purchase rollups" }
      : { kind: "contact_list", label: "Contact / prospect list", confidence: 72, destination: "Contacts → quality review → audience" };
  }
  if (headers.length <= 1 && sample.length > 40) {
    return { kind: "sales_notes", label: "Sales notes / unstructured text", confidence: 65, destination: "Universal Inbox → extraction → review queue" };
  }
  return { kind: "unknown", label: "Unknown", confidence: 30, destination: "Needs manual classification", note: "Pick what this file is and Sendloom will route it." };
}
