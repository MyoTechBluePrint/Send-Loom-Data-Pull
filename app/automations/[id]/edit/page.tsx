import { WorkflowEditor } from "@/components/workflow-editor";

export const dynamic = "force-dynamic";

export default async function EditAutomation({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WorkflowEditor automationId={id} />;
}
