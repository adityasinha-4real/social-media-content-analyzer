Social Media Content Analyzer is a client-side tool: upload a PDF or image,
extract its text (via pdf.js for digital pages, tesseract.js OCR for
scanned or image uploads), edit it, and see how it reads as a social post.

The biggest design decision was keeping everything in the browser. No
backend means no API keys, no payload limits, and files that never leave
the device — a real privacy property for a document tool.

Extraction uses a two-tier strategy rather than OCR-everything: pdf.js
reads a PDF's text layer directly when one exists, which is fast and
preserves paragraph structure via each item's position. It falls back to
rasterising a page and running OCR only when the text layer is missing or
too sparse to trust. A single OCR worker is created once and reused across
pages and files.

The analysis engine — metrics, per-platform fit, and about a dozen
suggestion rules — is deterministic code, not an LLM call. That keeps it
debuggable, key-free, and unit-testable. The engagement score is an
explicit heuristic composite, not a trained model.

Text stays editable after extraction, since OCR is never perfect, and
analysis re-runs on a debounce as it's corrected.
