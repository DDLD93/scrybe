import { TranscriptsSidebar } from "@/components/transcribe/transcripts-sidebar";

export default function TranscribeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] md:min-h-[calc(100dvh-0px)]">
      <TranscriptsSidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
