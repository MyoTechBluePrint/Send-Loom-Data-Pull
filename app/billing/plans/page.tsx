// Alias: the sprint brief's route for plan selection. The page itself lives at
// /plans, which older links and emails already point to.
import { redirect } from "next/navigation";

export default function BillingPlansRedirect() {
  redirect("/plans");
}
