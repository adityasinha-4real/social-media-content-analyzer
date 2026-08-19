import type { ErrorKind, ProcessingError } from '../types';

const ERROR_COPY: Record<ErrorKind, { message: string; action: string }> = {
  UnsupportedType: {
    message: 'This file type is not supported.',
    action: 'Upload a PDF, PNG, JPEG, WebP, BMP, or TIFF file.',
  },
  TooLarge: {
    message: 'This file is larger than the 15 MB limit.',
    action: 'Compress the file or split it into smaller pages and try again.',
  },
  Encrypted: {
    message: 'This PDF is password-protected.',
    action: 'Remove the password and re-upload the file.',
  },
  Corrupt: {
    message: 'This file could not be read; it may be corrupted.',
    action: 'Try re-exporting or re-saving the file, then upload it again.',
  },
  NoTextFound: {
    message: 'No readable text was found in this file.',
    action: 'Check that the scan is in focus and try a higher-resolution copy.',
  },
  OcrFailed: {
    message: 'Text recognition failed for this file.',
    action: 'Try again, or upload a clearer image.',
  },
  Cancelled: {
    message: 'Processing was cancelled.',
    action: 'Upload the file again if you want to retry.',
  },
};

export function createError(kind: ErrorKind, overrideMessage?: string): ProcessingError {
  const copy = ERROR_COPY[kind];
  return {
    kind,
    message: overrideMessage ?? copy.message,
    action: copy.action,
  };
}
