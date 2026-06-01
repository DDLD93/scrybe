type SaveFilePickerWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName: string;
  }) => Promise<FileSystemFileHandle>;
};

export function parseContentDispositionFilename(header: string | null): string | null {
  if (!header) return null;

  const star = /filename\*=UTF-8''([^;\s]+)/i.exec(header);
  if (star) {
    try {
      return decodeURIComponent(star[1].replace(/"/g, ""));
    } catch {
      /* fall through */
    }
  }

  const plain = /filename="([^"]+)"/i.exec(header) ?? /filename=([^;\s]+)/i.exec(header);
  if (plain) return plain[1].trim();

  return null;
}

export async function saveDownloadResponse(
  res: Response,
  opts?: { onSaving?: () => void },
): Promise<string> {
  const filename = parseContentDispositionFilename(res.headers.get("Content-Disposition")) ?? "download";

  const pickerWindow = window as SaveFilePickerWindow;
  if (res.body && typeof pickerWindow.showSaveFilePicker === "function") {
    try {
      const handle = await pickerWindow.showSaveFilePicker({ suggestedName: filename });
      const writable = await handle.createWritable();
      opts?.onSaving?.();
      await res.body.pipeTo(writable);
      return filename;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw err;
    }
  }

  opts?.onSaving?.();
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
  return filename;
}
