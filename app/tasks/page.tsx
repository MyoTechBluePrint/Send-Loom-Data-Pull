import { getTasksView } from "@/lib/server/views";
import { TasksClient } from "@/components/tasks-client";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const tasks = await getTasksView();
  return <TasksClient tasks={tasks} />;
}
