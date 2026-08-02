// The trial introduction moved to /onboarding/trial. This stub keeps any
// bookmarked or emailed /welcome link working.
import { redirect } from "next/navigation";

export default function WelcomeRedirect() {
  redirect("/onboarding/trial");
}
