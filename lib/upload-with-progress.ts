export type UploadPhase = "uploading" | "processing";

export type UploadProgress = {
  phase: UploadPhase;
  percent: number;
};

type UploadParams = {
  unit: string;
  size: string;
  model: string;
  prompt?: string;
  systemPromptId?: string;
  folderId?: string;
};

export function uploadTranscribeFile(
  file: File,
  params: UploadParams,
  onProgress: (progress: UploadProgress) => void,
): Promise<{ jobId: string }> {
  return new Promise((resolve, reject) => {
    const q = new URLSearchParams({
      filename: file.name,
      unit: params.unit,
      size: params.size,
      model: params.model,
    });
    if (params.prompt) q.set("prompt", params.prompt);
    if (params.systemPromptId) q.set("systemPromptId", params.systemPromptId);
    if (params.folderId) q.set("folderId", params.folderId);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/transcribe?${q}`);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress({
          phase: "uploading",
          percent: Math.round((e.loaded / e.total) * 100),
        });
      }
    };

    xhr.upload.onload = () => {
      onProgress({ phase: "processing", percent: 100 });
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as { jobId: string };
          resolve(data);
        } catch {
          reject(new Error("Invalid response from server"));
        }
        return;
      }
      try {
        const data = JSON.parse(xhr.responseText) as { error?: string };
        reject(new Error(data.error ?? "Upload failed"));
      } catch {
        reject(new Error("Upload failed"));
      }
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(new Error("Upload cancelled"));

    onProgress({ phase: "uploading", percent: 0 });
    xhr.send(file);
  });
}
