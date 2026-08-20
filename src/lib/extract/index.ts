import { extractFromPdf, type PdfExtractionProgress } from './pdf';
import { recognizeImageFile } from './ocr';
import { ExtractionError } from '../errors';

export type { PdfExtractionProgress as ExtractionProgress } from './pdf';
export { ExtractionError } from '../errors';
export { cancelOcr } from './ocr';

export interface ExtractionOptions {
  onProgress?: (progress: PdfExtractionProgress) => void;
  isCancelled?: () => boolean;
}

export interface ExtractionResult {
  /** Raw text per page (or a single entry for a standalone image), before normalisation. */
  pages: string[];
  ocrPagesUsed: number;
  /** True when the document had more OCR-eligible pages than the cap and some were skipped. */
  ocrCapped: boolean;
}

function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

/** Extracts raw, un-normalised text from a validated file, routing PDFs through pdf.js and everything else through OCR. */
export async function extractText(file: File, options: ExtractionOptions = {}): Promise<ExtractionResult> {
  if (isPdfFile(file)) {
    const result = await extractFromPdf(file, options);
    const hasText = result.pages.some((page) => page.trim().length > 0);
    if (!hasText) {
      throw new ExtractionError('NoTextFound');
    }
    return result;
  }

  const text = await recognizeImageFile(
    file,
    (progress) => options.onProgress?.({ stage: 'ocr', current: progress, total: 1 }),
    options.isCancelled,
  );

  if (!text.trim()) {
    throw new ExtractionError('NoTextFound');
  }

  return { pages: [text], ocrPagesUsed: 1, ocrCapped: false };
}
