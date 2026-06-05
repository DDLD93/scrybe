import { writeFile } from "fs/promises";
import { join } from "path";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { config } from "@/lib/config";

export type PdfPageSegment = {
  idx: number;
  path: string;
  pageNumber: number;
};

export async function splitPdfToPages(
  pdfPath: string,
  workDir: string,
): Promise<PdfPageSegment[]> {
  const data = await import("fs/promises").then((fs) => fs.readFile(pdfPath));
  const loadingTask = getDocument({
    data: new Uint8Array(data),
    useSystemFonts: true,
    disableFontFace: true,
  });
  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;

  if (pageCount > config.pdfMaxPages) {
    throw new Error(`PDF has ${pageCount} pages; maximum is ${config.pdfMaxPages}`);
  }

  const scale = config.pdfRenderDpi / 72;
  const segments: PdfPageSegment[] = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const ctx = canvas.getContext("2d");

    await page.render({
      canvasContext: ctx as unknown as CanvasRenderingContext2D,
      viewport,
      canvas: canvas as unknown as HTMLCanvasElement,
    }).promise;

    const png = canvas.toBuffer("image/png");
    const idx = pageNum - 1;
    const path = join(workDir, `page-${String(idx).padStart(3, "0")}.png`);
    await writeFile(path, png);
    segments.push({ idx, path, pageNumber: pageNum });
  }

  return segments;
}
