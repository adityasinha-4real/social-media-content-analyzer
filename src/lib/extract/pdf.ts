import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentLoadingTask, PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { MAX_OCR_PAGES_PER_DOCUMENT } from '../../constants';
import { ExtractionError } from '../errors';
import { isSparsePage, reconstructPageText, type PositionedItem } from './layout';
import { recognizeText } from './ocr';
import type { ProcessingState } from '../../types';

// Vite bundles the worker file and gives it a hashed, fetchable URL; this is
// the pattern pdf.js itself recommends for bundlers and the one the plan
// calls for.
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

/** Scale used when a page has to be rasterised for OCR; higher reads better but costs more time/memory. */
const RENDER_SCALE = 2.0;

export type PdfExtractionStage = Extract<ProcessingState, 'extracting' | 'ocr'>;

export interface PdfExtractionProgress {
  stage: PdfExtractionStage;
  /** Pages fully processed, plus fractional progress (0-1) through the current OCR page, if any. */
  current: number;
  total: number;
}

export interface PdfExtractionOptions {
  onProgress?: (progress: PdfExtractionProgress) => void;
  isCancelled?: () => boolean;
}

export interface PdfExtractionResult {
  pages: string[];
  ocrPagesUsed: number;
  /** True when the document had more OCR-eligible pages than MAX_OCR_PAGES_PER_DOCUMENT and some were skipped. */
  ocrCapped: boolean;
}

// pdfjs-dist doesn't re-export TextItem/TextMarkedContent from its package
// root, so the item type is pulled from what getTextContent() actually
// resolves to rather than reaching into the library's internal paths.
type TextContentItem = Awaited<ReturnType<PDFPageProxy['getTextContent']>>['items'][number];

function toPositionedItems(items: TextContentItem[]): PositionedItem[] {
  const positioned: PositionedItem[] = [];
  for (const item of items) {
    if (!('str' in item) || item.str.length === 0) continue;
    const [, , c, d, x, y] = item.transform;
    positioned.push({
      str: item.str,
      x,
      y,
      width: item.width,
      // Text items don't always carry a usable height; fall back to the
      // transform's vertical scale, which approximates font size.
      height: item.height || Math.hypot(c, d) || 10,
    });
  }
  return positioned;
}

async function renderPageToCanvas(page: PDFPageProxy, scale: number): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  if (!canvas.getContext('2d')) {
    throw new ExtractionError('Corrupt', 'Could not render this page for text recognition.');
  }

  await page.render({ canvas, viewport }).promise;
  return canvas;
}

interface LoadedDocument {
  doc: PDFDocumentProxy;
  loadingTask: PDFDocumentLoadingTask;
}

async function loadDocument(data: ArrayBuffer): Promise<LoadedDocument> {
  const loadingTask = pdfjsLib.getDocument({ data });
  try {
    const doc = await loadingTask.promise;
    return { doc, loadingTask };
  } catch (err) {
    if (err instanceof pdfjsLib.PasswordException) {
      throw new ExtractionError('Encrypted');
    }
    if (err instanceof pdfjsLib.InvalidPDFException) {
      throw new ExtractionError('Corrupt');
    }
    throw new ExtractionError('Corrupt');
  }
}

/** Extracts text from every page of a PDF, falling back to OCR for pages with too little text layer to trust. */
export async function extractFromPdf(file: File, options: PdfExtractionOptions = {}): Promise<PdfExtractionResult> {
  const { onProgress, isCancelled } = options;
  const data = await file.arrayBuffer();
  const { doc, loadingTask } = await loadDocument(data);

  const pages: string[] = [];
  let ocrPagesUsed = 0;
  let ocrCapped = false;

  try {
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
      if (isCancelled?.()) throw new ExtractionError('Cancelled');

      const page = await doc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const viewport = page.getViewport({ scale: 1 });
      const positioned = toPositionedItems(textContent.items);
      let pageText = reconstructPageText(positioned);

      if (isSparsePage(pageText, viewport.width, viewport.height)) {
        if (ocrPagesUsed >= MAX_OCR_PAGES_PER_DOCUMENT) {
          // Over the cap: leave this page's text as whatever the (likely
          // near-empty) text layer gave us, flag it, and move on rather
          // than let OCR run unbounded on a huge scanned document.
          ocrCapped = true;
          onProgress?.({ stage: 'extracting', current: pageNum, total: doc.numPages });
          pages.push(pageText);
          continue;
        }

        if (isCancelled?.()) throw new ExtractionError('Cancelled');
        onProgress?.({ stage: 'ocr', current: pageNum - 1, total: doc.numPages });

        const canvas = await renderPageToCanvas(page, RENDER_SCALE);
        pageText = await recognizeText(
          canvas,
          (progress) => onProgress?.({ stage: 'ocr', current: pageNum - 1 + progress, total: doc.numPages }),
          isCancelled,
        );
        ocrPagesUsed += 1;
      } else {
        onProgress?.({ stage: 'extracting', current: pageNum, total: doc.numPages });
      }

      pages.push(pageText);
    }
  } finally {
    await loadingTask.destroy();
  }

  return { pages, ocrPagesUsed, ocrCapped };
}
