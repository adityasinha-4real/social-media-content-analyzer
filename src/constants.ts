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

/** OCR is the slow path; a document that needs more sparse pages than this stops OCR-ing further ones. */
export const MAX_OCR_PAGES_PER_DOCUMENT = 20;
