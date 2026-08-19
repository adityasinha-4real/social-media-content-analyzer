export type ProcessingState =
  | 'idle'
  | 'validating'
  | 'extracting'
  | 'ocr'
  | 'analyzing'
  | 'done'
  | 'error';

export type ErrorKind =
  | 'UnsupportedType'
  | 'TooLarge'
  | 'Encrypted'
  | 'Corrupt'
  | 'NoTextFound'
  | 'OcrFailed'
  | 'Cancelled';

export interface ProcessingError {
  kind: ErrorKind;
  message: string;
  action?: string;
}

export interface QueuedFile {
  id: string;
  file: File;
  state: ProcessingState;
  progress: number;
  stageLabel: string;
  extractedText: string | null;
  error: ProcessingError | null;
}
