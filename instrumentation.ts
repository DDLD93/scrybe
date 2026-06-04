export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  try {
    const { startWorker } = await import("@/lib/worker/queue");
    startWorker();
  } catch (err) {
    console.error("Worker start failed:", err);
  }
}
