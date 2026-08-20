# Social Media Content Analyzer

Upload a PDF or image, get the text out of it (including scanned documents,
via OCR), edit it to fix any mistakes, and see how it reads as a social
media post — character/word counts, per-platform fit against X, LinkedIn,
Instagram, and Facebook, and a set of concrete suggestions for tightening
it up.

Everything runs in the browser. There's no backend, no API keys, and no
server-side processing — files never leave the device they're uploaded on.

## Running it locally

Requirements: Node 20.19+ or 22.12+, npm.

```bash
git clone https://github.com/adityasinha-4real/social-media-content-analyzer.git
cd social-media-content-analyzer
npm install
npm run dev
```

That starts a dev server at `http://localhost:5173`. Other scripts:

```bash
npm run build     # type-check, then produce a production build in dist/
npm run preview   # serve the production build locally
npm test          # run the Vitest suite
```

Try it with the files in `public/samples/`: `digital-post.pdf` has a real
text layer, `scanned-post.pdf` is an image-only PDF with no text layer (so
it exercises the OCR fallback), and `screenshot-post.png` is a plain image
upload.

## Architecture

Client-side only, by design — see [Why no backend](#why-no-backend) below.

```
Dropzone / file picker
        |
        v
Validation (MIME + extension + magic bytes + 15 MB cap)
        |
        v
useDocumentProcessor (state machine: idle -> validating -> extracting/ocr -> done/error)
        |
        +-- PDF: pdf.js text-layer extraction per page
        |     |
        |     +-- sparse page (little/no text layer) -> rasterise -> OCR
        |
        +-- Image: rasterise/upscale -> OCR
        |
        v
Normalisation (whitespace, hyphen joins, repeated header/footer strip, quotes/ligatures)
        |
        v
Editable text buffer  <---- user corrections
        |
        v
Analysis engine (pure, synchronous, re-runs on a 300ms debounce)
        |
        v
Results UI (metrics grid, platform tabs, suggestions, engagement score)
```

Two web workers do the heavy lifting: the worker `pdfjs-dist` ships for PDF
parsing/rendering, and a single `tesseract.js` OCR worker that's created once
and reused across every page and every file in the session (creating a fresh
worker per OCR call would mean re-downloading the language model each time).

### Key design decisions

- **Client-side only.** No server means no API keys to leak, no cold starts,
  no payload size limits to work around, and a genuinely private tool — a
  document never leaves the browser it was opened in. The trade-off is that
  everything, OCR included, has to run in JavaScript in the tab.
- **Text extraction is a two-tier strategy, not just OCR.** Most PDFs already
  have a text layer; reading it directly (`lib/extract/pdf.ts` +
  `lib/extract/layout.ts`) is fast and far more accurate than OCR. Pages are
  only rasterised and OCR'd when their text layer is missing or too sparse to
  trust (`isSparsePage` in `layout.ts`) — the common case for a scanned
  document mixed in with normal ones. Line and paragraph structure is
  reconstructed from each text item's position (its transform matrix), not
  just concatenated in whatever order pdf.js returns them.
- **Extracted text is editable, and analysis re-runs on edit.** OCR is never
  perfect. Making the text a normal editable field, with analysis
  recalculating on a debounce, turns this from a one-shot extractor into an
  actual editing tool.
- **The analysis engine is deterministic, not an API call.** Metrics,
  platform-fit checks, and suggestions are plain synchronous functions over
  the text (`lib/analysis/`). See [Why no AI-generated
  analysis](#why-no-ai-generated-analysis) below.
- **An OCR page cap.** OCR is the slow, CPU-heavy path. A document with more
  than 20 pages needing OCR stops there and surfaces a warning rather than
  letting the tab churn through an unbounded amount of image recognition.
- **A single reusable OCR worker.** `lib/extract/ocr.ts` creates one
  `tesseract.js` worker lazily and keeps it alive across pages and files;
  it's only torn down on an explicit cancel. Worth noting:
  `worker.terminate()` in tesseract.js doesn't reject a job that's already in
  flight, so a bare cancel would hang the UI — cancellation is implemented as
  a race against a polled cancel flag instead, so it always resolves quickly
  even though the abandoned job is left running until the worker is torn
  down.

### Why no backend

Considered and rejected. A server would mean hosting/scaling cost, cold
starts on serverless, request payload limits to design around, and files
leaving the browser. None of that buys anything here — pdf.js and
tesseract.js both run fine client-side, and a static deploy is simpler to
reason about and to review.

### Why no AI-generated analysis

There's no LLM in this project, on purpose. The whole analysis layer —
metrics, platform-fit checks, and the ~12 suggestion rules — is deterministic
code, not a model call. A couple of reasons:

- It removes a class of failure a reviewer can't debug: a wrong or
  inconsistent suggestion from a rules engine can be traced to the exact rule
  that produced it; a wrong suggestion from a model call can't be traced at
  all.
- It removes an API key dependency, which conflicts with the "no paid
  external services" constraint this project is built under.

The **engagement score** shown in the results panel is a weighted composite
of those same deterministic checks (length fit, CTA presence, hashtag usage,
readability, structure, hook quality) — it's explicitly a heuristic, not a
trained model, and the UI says so.

## Known limitations

- OCR only recognises English text (`tesseract.js` is loaded with the `eng`
  language pack). A digital PDF's text layer has no such restriction —
  non-English digital text extracts correctly, only OCR is English-only.
- OCR quality depends on image resolution; a low-DPI scan will produce more
  recognition errors. Small images are upscaled before OCR, but there's a
  limit to what that fixes — the text is editable specifically so those
  mistakes can be corrected by hand.
- Files are capped at 15 MB and a document is limited to 20 OCR'd pages per
  upload; both are enforced client-side with a specific, actionable message
  when hit.

## Tech stack and dependencies

React + TypeScript, built with Vite, no CSS framework (plain CSS custom
properties in `src/styles/`). This is a Node project, so `package.json` is
the dependency manifest — versions below are what's currently pinned there.

**Runtime dependencies (4, intentionally kept minimal):**

| Package | Version | Why it's here |
|---|---|---|
| `react` / `react-dom` | ^19.2.8 | Component state for a multi-stage async pipeline with live-updating analysis. |
| `pdfjs-dist` | ^6.2.108 | PDF text extraction with per-item position data, plus canvas rendering for the scanned-page fallback. |
| `tesseract.js` | ^7.0.0 | Local, in-browser OCR — no cloud OCR service or API key. |

**Dev dependencies:** `vite`, `@vitejs/plugin-react`, `typescript`,
`@types/react`, `@types/react-dom`, `vitest`.

Deliberately not used: any UI component library, icon package, router,
state-management library, CSS framework, `axios`/`lodash`-style utility
package, or backend of any kind.

## Testing

`tests/analysis.test.ts` and `tests/normalize.test.ts` cover the pure logic:
the metrics/platform-fit/suggestion-scoring engine and the text
normalisation pass. One fixture in `analysis.test.ts` is a hand-checked post
whose exact expected counts, suggestions, and score were verified against
the running app before being pinned as test assertions, rather than derived
from the implementation.

Extraction and OCR aren't unit tested — they need a real browser (Canvas,
Web Workers, `File`) — and were instead verified manually against
`vite build && vite preview` across the file-type matrix described in
`IMPLEMENTATION_PLAN.md`.
