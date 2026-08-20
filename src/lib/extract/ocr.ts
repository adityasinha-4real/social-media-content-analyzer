import { createWorker } from 'tesseract.js';
import type { Worker as TesseractWorker } from 'tesseract.js';
import { ExtractionError } from '../errors';

/** Images with a shorter edge below this are upscaled before OCR; tesseract reads better above ~1000px. */
const MIN_SHORT_EDGE_PX = 1000;

// A single tesseract worker is created lazily on first use and reused across
// every page and every file, per the plan. It's only torn down on an
// explicit cancel; the next OCR request after that recreates it.
let workerPromise: Promise<TesseractWorker> | null = null;
let activeProgressHandler: ((progress: number) => void) | null = null;

function getWorker(): Promise<TesseractWorker> {
  if (!workerPromise) {
    workerPromise = createWorker('eng', 1, {
      logger: (message) => {
        if (message.status === 'recognizing text') {
          activeProgressHandler?.(message.progress);
        }
      },
    });
  }
  return workerPromise;
}

/** How often a pending OCR job is polled for cancellation. */
const CANCEL_POLL_MS = 150;

/**
 * tesseract.js's worker.terminate() kills the underlying Worker thread but
 * never rejects a job already in flight - no message ever comes back, so a
 * bare `await worker.recognize()` hangs forever after a cancel. Racing it
 * against a poll of isCancelled() is what actually makes recognizeText()
 * settle promptly; cancelOcr() below still tears the worker down so the
 * abandoned job stops burning CPU and the next call starts clean.
 */
function raceCancellation<T>(work: Promise<T>, isCancelled?: () => boolean): Promise<T> {
  if (!isCancelled) return work;

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const interval = setInterval(() => {
      if (!settled && isCancelled()) {
        settled = true;
        clearInterval(interval);
        reject(new ExtractionError('Cancelled'));
      }
    }, CANCEL_POLL_MS);

    work.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearInterval(interval);
        resolve(value);
      },
      (err: unknown) => {
        if (settled) return;
        settled = true;
        clearInterval(interval);
        reject(err);
      },
    );
  });
}

/** Recognizes text in an image/canvas using the shared worker. */
export async function recognizeText(
  image: Parameters<TesseractWorker['recognize']>[0],
  onProgress?: (progress: number) => void,
  isCancelled?: () => boolean,
): Promise<string> {
  if (isCancelled?.()) {
    throw new ExtractionError('Cancelled');
  }

  const worker = await getWorker();
  activeProgressHandler = onProgress ?? null;

  try {
    const { data } = await raceCancellation(worker.recognize(image), isCancelled);
    return data.text;
  } catch (err) {
    if (err instanceof ExtractionError) throw err;
    throw new ExtractionError('OcrFailed');
  } finally {
    activeProgressHandler = null;
  }
}

/**
 * Kills the shared worker outright so an in-flight recognize() call rejects
 * immediately instead of leaving the caller waiting on a job that will
 * never be looked at again. The next recognizeText() call recreates it.
 */
export async function cancelOcr(): Promise<void> {
  const current = workerPromise;
  workerPromise = null;
  if (!current) return;
  try {
    const worker = await current;
    await worker.terminate();
  } catch {
    // Worker was already gone or never finished initializing; nothing to clean up.
  }
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new ExtractionError('Corrupt', 'This image could not be read; it may be corrupted.'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Draws an image to a canvas, upscaling it first if its shorter edge is under the OCR-friendly minimum. */
async function prepareImageForOcr(file: File): Promise<HTMLCanvasElement> {
  const image = await loadImage(file);
  const shortEdge = Math.min(image.naturalWidth, image.naturalHeight);
  const scale = shortEdge > 0 && shortEdge < MIN_SHORT_EDGE_PX ? MIN_SHORT_EDGE_PX / shortEdge : 1;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);

  const context = canvas.getContext('2d');
  if (!context) {
    throw new ExtractionError('Corrupt', 'Could not prepare this image for text recognition.');
  }
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** OCRs a standalone image file (as opposed to a rasterised PDF page). */
export async function recognizeImageFile(
  file: File,
  onProgress?: (progress: number) => void,
  isCancelled?: () => boolean,
): Promise<string> {
  const canvas = await prepareImageForOcr(file);
  return recognizeText(canvas, onProgress, isCancelled);
}
