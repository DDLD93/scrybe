"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { saveDownloadResponse } from "@/lib/download/save-stream-response";
import {
  IconDownload,
  IconDotsVertical,
  IconMicrophone,
  IconPlayerStop,
  IconRefresh,
  IconSearch,
  IconTrash,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { DeleteDownloadJobDialog } from "@/components/download/delete-download-job-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Format = { id: string; ext?: string; resolution?: string; filesize?: string };
type Job = {
  id: string;
  url: string;
  status: string;
  progress?: { percent?: number; speed?: string; eta?: number };
  artifacts: Array<{ name: string; size?: number; role: string }>;
  error?: string | null;
};

type DownloadProgressState = {
  phase: "starting" | "downloading" | "saving";
  percent?: number;
  speed?: string;
  eta?: number;
};

const PRESETS = ["mp3", "aac", "mp4", "mkv", "best"] as const;

function formatEta(seconds?: number): string | null {
  if (seconds == null || !Number.isFinite(seconds)) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function JobProgressCell({
  isActive,
  progress,
}: {
  isActive: boolean;
  progress?: { percent?: number; speed?: string; eta?: number };
}) {
  if (!isActive) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const pct = progress?.percent;
  const etaLabel = formatEta(progress?.eta);

  if (pct != null) {
    return (
      <div className="space-y-1.5">
        <Progress value={pct} className="h-1.5 animate-pulse" />
        <div className="flex flex-wrap items-center gap-x-2 text-[0.65rem] tabular-nums text-muted-foreground">
          <span>{Math.round(pct)}%</span>
          {progress?.speed && <span>{progress.speed}</span>}
          {etaLabel && <span>ETA {etaLabel}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="relative h-1.5 overflow-hidden rounded-md bg-muted">
        <div className="absolute inset-y-0 w-1/3 animate-[shimmer_1.5s_ease-in-out_infinite] rounded-md bg-primary" />
      </div>
      <span className="text-[0.65rem] text-muted-foreground">Starting…</span>
    </div>
  );
}

export default function DownloadPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [preset, setPreset] = useState<string>("mp3");
  const [format, setFormat] = useState("");
  const [info, setInfo] = useState<{ title?: string; duration?: number; thumbnail?: string } | null>(null);
  const [formats, setFormats] = useState<Format[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgressState | null>(null);
  const downloadAbortRef = useRef<AbortController | null>(null);
  const progressSourceRef = useRef<EventSource | null>(null);
  const [writeSubs, setWriteSubs] = useState(false);
  const [noPlaylist, setNoPlaylist] = useState(false);
  const [playlistItems, setPlaylistItems] = useState("");
  const [sponsorblock, setSponsorblock] = useState("");
  const [jobToDelete, setJobToDelete] = useState<{ id: string; label: string; isActive: boolean } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/download/jobs");
      const data = await res.json();
      if (data.jobs) setJobs(data.jobs);
    } catch {
      /* ignore */
    } finally {
      setJobsLoading(false);
    }
  }, []);

  useEffect(() => {
    const run = () => {
      void loadJobs();
    };
    const initial = window.setTimeout(run, 0);
    const t = window.setInterval(run, 2000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(t);
    };
  }, [loadJobs]);

  useEffect(() => {
    return () => {
      downloadAbortRef.current?.abort();
      progressSourceRef.current?.close();
    };
  }, []);

  async function inspect() {
    setLoading(true);
    try {
      const [infoRes, fmtRes] = await Promise.all([
        fetch(`/api/download/info?url=${encodeURIComponent(url)}`),
        fetch(`/api/download/formats?url=${encodeURIComponent(url)}`),
      ]);
      const infoData = await infoRes.json();
      const fmtData = await fmtRes.json();
      if (!infoRes.ok) throw new Error(infoData.error ?? "Info failed");
      if (!fmtRes.ok) throw new Error(fmtData.error ?? "Formats failed");
      setInfo({ title: infoData.title, duration: infoData.duration, thumbnail: infoData.thumbnail });
      setFormats(fmtData.formats ?? []);
      toast.success("Media inspected");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function startDownload() {
    if (playlistItems) {
      toast.error("Playlist items are not supported for direct downloads. Clear playlist items or use Transcribe from URL.");
      return;
    }

    downloadAbortRef.current?.abort();
    progressSourceRef.current?.close();

    const controller = new AbortController();
    downloadAbortRef.current = controller;
    const sessionId = crypto.randomUUID();

    setDownloading(true);
    setDownloadProgress({ phase: "starting" });

    const source = new EventSource(
      `/api/download/stream/progress?sessionId=${encodeURIComponent(sessionId)}`,
    );
    progressSourceRef.current = source;

    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as {
          percent?: number;
          speed?: string;
          eta?: number;
          done?: boolean;
          error?: string;
        };
        if (data.error) return;
        if (data.done) {
          source.close();
          return;
        }
        setDownloadProgress({
          phase: "downloading",
          percent: data.percent,
          speed: data.speed,
          eta: data.eta,
        });
      } catch {
        /* ignore malformed events */
      }
    };

    try {
      const res = await fetch("/api/download/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          preset,
          sessionId,
          options: {
            format: format || undefined,
            writeSubs,
            noPlaylist: true,
            sponsorblockRemove: sponsorblock ? sponsorblock.split(",").map((s) => s.trim()) : undefined,
          },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Download failed");
      }

      const filename = await saveDownloadResponse(res, {
        onSaving: () => setDownloadProgress((prev) => ({ ...prev!, phase: "saving" })),
      });
      toast.success(`Saved ${filename}`);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      source.close();
      progressSourceRef.current = null;
      if (downloadAbortRef.current === controller) {
        downloadAbortRef.current = null;
      }
      setDownloading(false);
      setDownloadProgress(null);
    }
  }

  async function sendToTranscriber(jobId: string) {
    const res = await fetch(`/api/download/jobs/${jobId}/transcribe`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Bridge failed");
    } else {
      toast.success("Transcription started");
      router.push("/transcribe");
    }
  }

  async function handleStop(jobId: string) {
    await fetch(`/api/download/jobs/${jobId}/stop`, { method: "POST" });
    toast.info("Download stopped");
    loadJobs();
  }

  async function handleResume(jobId: string) {
    await fetch(`/api/download/jobs/${jobId}/resume`, { method: "POST" });
    toast.success("Download resumed");
    loadJobs();
  }

  async function confirmDeleteJob() {
    if (!jobToDelete) return;
    setDeletingId(jobToDelete.id);
    try {
      const res = await fetch(`/api/download/jobs/${jobToDelete.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Delete failed");
      }
      toast.success("Download deleted");
      setJobToDelete(null);
      loadJobs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setDeletingId(null);
    }
  }

  const hasActiveJobs = jobs.some((j) => ["pending", "processing"].includes(j.status));
  const streamEtaLabel = formatEta(downloadProgress?.eta);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <DeleteDownloadJobDialog
        job={jobToDelete}
        deleting={deletingId !== null}
        onOpenChange={(open) => {
          if (!open && deletingId === null) setJobToDelete(null);
        }}
        onConfirm={confirmDeleteJob}
      />

      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Media Downloader
          </h1>
          {hasActiveJobs && (
            <span className="size-2 rounded-full bg-primary live-pulse" title="Downloads active" />
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Stream downloads directly to your computer. Background jobs in the table are used for transcribe bridge.
        </p>
      </div>

      <Card className="glass-card ring-1 ring-border/50">
        <CardHeader>
          <CardTitle className="text-sm">New Download</CardTitle>
          <CardDescription>Paste a URL, inspect formats, then save to your device</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="download-url">URL</Label>
            <Input
              id="download-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2">
            <Label>Preset</Label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <Button
                  key={p}
                  type="button"
                  variant={preset === p ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPreset(p)}
                >
                  {p.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={inspect}
              disabled={!url || loading}
            >
              {loading ? <Spinner className="size-4" /> : <IconSearch className="size-4" />}
              Inspect
            </Button>
            <Button type="button" onClick={startDownload} disabled={!url || downloading}>
              {downloading ? <Spinner className="size-4" /> : <IconDownload className="size-4" />}
              Download
            </Button>
          </div>

          {downloadProgress && (
            <div className="space-y-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-foreground">
                  {downloadProgress.phase === "starting" && "Starting download…"}
                  {downloadProgress.phase === "downloading" && "Downloading…"}
                  {downloadProgress.phase === "saving" && "Saving to device…"}
                </span>
                {downloadProgress.percent != null && (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {Math.round(downloadProgress.percent)}%
                  </span>
                )}
              </div>
              {downloadProgress.phase === "starting" || downloadProgress.percent == null ? (
                <div className="relative h-1.5 overflow-hidden rounded-md bg-muted">
                  <div className="absolute inset-y-0 w-1/3 animate-[shimmer_1.5s_ease-in-out_infinite] rounded-md bg-primary" />
                </div>
              ) : (
                <Progress value={downloadProgress.percent} className="h-1.5" />
              )}
              {downloadProgress.phase === "downloading" && (downloadProgress.speed || streamEtaLabel) && (
                <div className="flex flex-wrap gap-x-3 text-[0.65rem] tabular-nums text-muted-foreground">
                  {downloadProgress.speed && <span>{downloadProgress.speed}</span>}
                  {streamEtaLabel && <span>ETA {streamEtaLabel}</span>}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {info && (
        <Card className="glass-card ring-1 ring-border/50">
          <CardHeader>
            <CardTitle className="text-sm">{info.title}</CardTitle>
            {info.duration != null && (
              <CardDescription>{Math.round(info.duration)}s duration</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {formats.length > 0 && (
              <div className="overflow-hidden rounded-lg ring-1 ring-border/50">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>ID</TableHead>
                      <TableHead>EXT</TableHead>
                      <TableHead>Resolution</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formats.slice(0, 20).map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="font-mono text-xs">{f.id}</TableCell>
                        <TableCell className="text-xs">{f.ext}</TableCell>
                        <TableCell className="text-xs">{f.resolution}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setFormat(f.id);
                              toast.success(`Format ${f.id} selected`);
                            }}
                          >
                            Use
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="glass-card ring-1 ring-border/50">
        <CardHeader>
          <CardTitle className="text-sm">Advanced Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={writeSubs}
              onChange={(e) => setWriteSubs(e.target.checked)}
              className="accent-primary"
            />
            Write subtitles
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={noPlaylist}
              onChange={(e) => setNoPlaylist(e.target.checked)}
              className="accent-primary"
            />
            No playlist
          </label>
          <div className="space-y-2">
            <Label htmlFor="playlist-items">Playlist items</Label>
            <Input
              id="playlist-items"
              value={playlistItems}
              onChange={(e) => setPlaylistItems(e.target.value)}
              placeholder="1:5"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sponsorblock">SponsorBlock remove (comma-separated)</Label>
            <Input
              id="sponsorblock"
              value={sponsorblock}
              onChange={(e) => setSponsorblock(e.target.value)}
              placeholder="sponsor,intro"
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">Recent Downloads</h2>
        {jobsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <Card className="glass-card ring-1 ring-border/50">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No downloads yet. Paste a URL above to get started.
            </CardContent>
          </Card>
        ) : (
          <div className="glass-card overflow-hidden rounded-xl ring-1 ring-border/50">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/50">
                  <TableHead>Status</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead className="w-[20%]">Progress</TableHead>
                  <TableHead className="w-12 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => {
                  const media = job.artifacts.find((a) => a.role === "media");
                  const isActive = ["pending", "processing"].includes(job.status);
                  const label = media?.name ?? job.url.slice(0, 50);

                  return (
                    <TableRow key={job.id} className="border-border/30">
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <StatusBadge status={job.status} />
                          {job.error && (
                            <span className="line-clamp-1 text-[0.65rem] font-mono text-destructive">
                              {job.error}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-0 font-mono text-xs">
                        <span className="block truncate" title={media?.name ?? job.url}>
                          {label}
                        </span>
                      </TableCell>
                      <TableCell>
                        <JobProgressCell isActive={isActive} progress={job.progress} />
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm">
                              <IconDotsVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {media && job.status === "completed" && (
                              <>
                                <DropdownMenuItem asChild>
                                  <a
                                    href={`/api/download/jobs/${job.id}/file/${encodeURIComponent(media.name)}`}
                                  >
                                    <IconDownload className="size-3.5" />
                                    Download file
                                  </a>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => sendToTranscriber(job.id)}>
                                  <IconMicrophone className="size-3.5" />
                                  Transcribe
                                </DropdownMenuItem>
                              </>
                            )}
                            {isActive && (
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => handleStop(job.id)}
                              >
                                <IconPlayerStop className="size-3.5" />
                                Stop
                              </DropdownMenuItem>
                            )}
                            {["failed", "stopped"].includes(job.status) && (
                              <DropdownMenuItem onClick={() => handleResume(job.id)}>
                                <IconRefresh className="size-3.5" />
                                Resume
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              disabled={deletingId === job.id}
                              onClick={() =>
                                setJobToDelete({ id: job.id, label, isActive })
                              }
                            >
                              <IconTrash className="size-3.5" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Separator />

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer text-sm text-foreground">API reference</summary>
        <ul className="mt-2 space-y-1 list-disc pl-4 font-mono">
          <li>GET /api/download/info?url=</li>
          <li>GET /api/download/formats?url=</li>
          <li>POST /api/download/stream {"{ url, preset, sessionId?, options }"}</li>
          <li>GET /api/download/stream/progress?sessionId=</li>
          <li>POST /api/download/jobs {"{ url, preset, options }"} (background / transcribe)</li>
          <li>GET /api/download/jobs/{"{id}"}</li>
          <li>DELETE /api/download/jobs/{"{id}"}</li>
        </ul>
      </details>
    </div>
  );
}
