import { branding } from "@/lib/branding";
import { startWorker } from "@/lib/worker/queue";

console.log(`${branding.name} worker running`);
startWorker();
