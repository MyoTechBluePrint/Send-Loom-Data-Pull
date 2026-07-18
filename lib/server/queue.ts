// Queue seam. Today: in-process with immediate execution and one retry —
// enough for a single-instance staging deployment. The interface is the
// contract; swapping the internals for BullMQ/Redis changes nothing at the
// call sites. Jobs are fire-and-forget from the caller's perspective unless
// awaited explicitly.
type Job<T> = { name: string; payload: T };
type Handler<T> = (payload: T) => Promise<void>;

const handlers = new Map<string, Handler<unknown>>();

export function registerHandler<T>(name: string, handler: Handler<T>) {
  handlers.set(name, handler as Handler<unknown>);
}

export async function enqueue<T>(job: Job<T>): Promise<void> {
  let handler = handlers.get(job.name);
  if (!handler && job.name === "event.ingest") {
    // Self-heal: routes that only type-import events.ts never trigger its
    // module-load registration. Dynamic import avoids the static cycle.
    await import("./events");
    handler = handlers.get(job.name);
  }
  if (!handler) throw new Error(`No handler registered for job '${job.name}'`);
  try {
    await handler(job.payload);
  } catch (err) {
    // One retry after a short delay, then surface. A real queue adds
    // exponential backoff and a dead-letter table here.
    await new Promise((r) => setTimeout(r, 250));
    await handler(job.payload);
  }
}
