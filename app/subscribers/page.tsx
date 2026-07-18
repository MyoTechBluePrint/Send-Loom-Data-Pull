import { getContactsView } from "@/lib/server/views";
import { ContactsClient } from "@/components/contacts-client";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const contacts = await getContactsView();
  return <ContactsClient contacts={contacts} />;
}
