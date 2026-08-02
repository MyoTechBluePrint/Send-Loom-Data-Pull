// Alias: checkout is reached by choosing a plan, which hands off to the
// payment provider (or the labelled simulation). Landing here directly means
// no plan is chosen yet, so the plan page is the right destination.
import { redirect } from "next/navigation";

export default function BillingCheckoutRedirect() {
  redirect("/plans");
}
