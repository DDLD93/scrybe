export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  try {
    const { startWorker } = await import("@/lib/worker/queue");
    const { startRetentionSweeper } = await import("@/lib/worker/retention");
    startWorker();
    startRetentionSweeper();
  } catch (err) {
    console.error("Worker start failed:", err);
  }
}
