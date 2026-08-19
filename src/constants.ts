export const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/bmp',
  'image/tiff',
] as const;

export const ACCEPTED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff', '.tif'];

export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

// "%PDF"
export const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46];

export const FAKE_PIPELINE_STEP_MS = 130;
