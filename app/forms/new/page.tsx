import { Shell } from "@/components/shell";
import { FormEditor } from "@/components/form-editor";

export const dynamic = "force-dynamic";

export default function NewFormPage() {
  return (
    <Shell title="New form" subtitle="Build it, preview it, then set it live when you're ready">
      <FormEditor />
    </Shell>
  );
}
