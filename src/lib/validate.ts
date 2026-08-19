import { ACCEPTED_EXTENSIONS, ACCEPTED_MIME_TYPES, MAX_FILE_SIZE_BYTES, PDF_MAGIC_BYTES } from '../constants';
import { createError } from './errors';
import type { ProcessingError } from '../types';

function getExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot).toLowerCase();
}

async function readLeadingBytes(file: File, count: number): Promise<Uint8Array> {
  const buffer = await file.slice(0, count).arrayBuffer();
  return new Uint8Array(buffer);
}

async function looksLikePdf(file: File): Promise<boolean> {
  const bytes = await readLeadingBytes(file, PDF_MAGIC_BYTES.length);
  return PDF_MAGIC_BYTES.every((byte, index) => bytes[index] === byte);
}

/**
 * Runs the full accept/reject pass on a single file: extension, MIME type,
 * size cap, and (for anything claiming to be a PDF) the leading magic bytes,
 * since the extension and the declared MIME type can both lie.
 */
export async function validateFile(file: File): Promise<ProcessingError | null> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return createError('TooLarge');
  }

  const extension = getExtension(file.name);
  const mimeOk = (ACCEPTED_MIME_TYPES as readonly string[]).includes(file.type);
  const extensionOk = ACCEPTED_EXTENSIONS.includes(extension);

  if (!mimeOk && !extensionOk) {
    return createError('UnsupportedType');
  }

  const claimsPdf = extension === '.pdf' || file.type === 'application/pdf';
  if (claimsPdf) {
    const isPdf = await looksLikePdf(file);
    if (!isPdf) {
      return createError('UnsupportedType', 'This file has a .pdf name but is not a real PDF.');
    }
  }

  return null;
}
