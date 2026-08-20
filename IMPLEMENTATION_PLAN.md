# IMPLEMENTATION_PLAN.md

Single source of truth for the Social Media Content Analyzer technical assessment.
Read this file first before making changes. If a change needs to
deviate from it, record the deviation and the reason at the bottom of this file under "Deviation log".

---

## 1. Project summary

A browser-based tool that accepts PDF and image uploads, extracts the text (using OCR when the
document has no text layer), lets the user correct the extracted text, and analyses it as a
social media post: metrics, per-platform fit, and concrete engagement suggestions.

Constraints that govern every decision:

- Technical assessment, approximately 8 hours of work. Not a production SaaS.
- No paid APIs, no API keys, no external service dependencies.
- Minimal dependencies. The submission guidelines explicitly penalise dependency bloat.
- Repository must be public, on branch `main`, containing only source and config files.

---

## 2. Locked architecture decisions

| Decision | Choice | Rationale |
|---|---|---|
| Processing location | Client-side only, no backend | No keys, no cold starts, no payload limits, no hosting cost, static deploy. Files never leave the browser, which is a real privacy property for a document tool. |
| Analysis approach | Deterministic metrics + rule-based heuristics | Works offline, unit-testable, no key rot. An LLM call would be one fetch and zero engineering judgement. |
| Extracted text | Editable, analysis re-runs on edit (300 ms debounce) | OCR is imperfect; editing turns a viewer into a tool. |
| OCR engine | `tesseract.js` inside a Web Worker | Only credible free local in-browser OCR. Worker keeps the UI responsive. |
| Scanned PDFs | Detect sparse pages, rasterise to canvas, run OCR | The main differentiator. Naive pdf.js returns an empty string on scans. |
| Language | TypeScript | Types on the extraction result are where the design shows. |
| Styling | Plain CSS with custom properties, no framework | Zero extra build dependencies. |
| Tests | Vitest on pure logic only (analysis, normalisation) | High signal, tiny config. No component or e2e tests. |

### Explicitly excluded (do not add)

Database, authentication, user accounts, job queues, Docker, microservices, object storage,
cloud OCR, paid AI APIs, Tailwind, UI component libraries, icon packages, routers, state
management libraries, axios, lodash, form libraries, i18n, PWA, theme switchers.

---

## 3. Tech stack

**Runtime dependencies (4 total)**

| Package | Purpose | Why not something simpler |
|---|---|---|
| `react`, `react-dom` | Component state for a multi-stage async pipeline with live-updating analysis | Vanilla DOM means hand-rolling the state machine and re-render logic. More code, not less. |
| `pdfjs-dist` | PDF text extraction with position data, plus canvas rendering for the scanned fallback | `pdf-parse` returns a flat string with no positions and cannot rasterise, which makes the scanned-PDF path impossible. |
| `tesseract.js` | Local OCR in the browser | Cloud OCR requires keys and violates the brief. |

**Dev dependencies**

`vite`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`, `vitest`

---

## 4. System architecture

```
User
 |
 v
Dropzone / File picker
 |
 v
Validation  (MIME + extension + magic bytes + size cap)
 |
 v
Processing orchestrator  (useDocumentProcessor, state machine)
 |
 +--> PDF route: pdf.js text layer extraction
 |       |
 |       +--> per-page yield check
 |              |
 |              +--> sparse page: render to canvas @2x -> OCR worker
 |
 +--> Image route: OCR worker (tesseract.js)
         |
         v
Normalisation  (whitespace, hyphen joins, ligatures, header/footer strip)
         |
         v
Editable text buffer  <---- user corrections
         |
         v
Analysis engine  (pure, synchronous)
   +-- deterministic metrics
   +-- platform fit
   +-- heuristic suggestions
         |
         v
Results UI  (metrics grid, platform tabs, suggestions, score)
```

Two Web Workers run: the pdf.js worker supplied by the library, and one reusable tesseract.js
worker shared across all pages and files. The main thread never blocks.

---

## 5. Repository structure

```
social-media-content-analyzer/
├── public/
│   └── samples/
│       ├── digital-post.pdf
│       ├── scanned-post.pdf
│       └── screenshot-post.png
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── constants.ts
│   ├── types.ts
│   ├── components/
│   │   ├── Dropzone.tsx
│   │   ├── FileQueue.tsx
│   │   ├── ProgressBar.tsx
│   │   ├── TextEditor.tsx
│   │   ├── AnalysisPanel.tsx
│   │   ├── MetricGrid.tsx
│   │   ├── PlatformTabs.tsx
│   │   ├── SuggestionList.tsx
│   │   └── ErrorBanner.tsx
│   ├── hooks/
│   │   └── useDocumentProcessor.ts
│   ├── lib/
│   │   ├── validate.ts
│   │   ├── errors.ts
│   │   ├── normalize.ts
│   │   ├── extract/
│   │   │   ├── index.ts
│   │   │   ├── pdf.ts
│   │   │   ├── layout.ts
│   │   │   └── ocr.ts
│   │   └── analysis/
│   │       ├── index.ts
│   │       ├── metrics.ts
│   │       ├── readability.ts
│   │       ├── platforms.ts
│   │       ├── suggestions.ts
│   │       └── score.ts
│   └── styles/
│       ├── global.css
│       └── components.css
├── tests/
│   ├── analysis.test.ts
│   └── normalize.test.ts
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
├── .gitignore
├── APPROACH.md          (the 200-word write-up)
├── IMPLEMENTATION_PLAN.md
└── README.md
```

---

## 6. Processing pipeline

1. **File selected** via drop or picker. `dataTransfer.items` normalised to `File[]`.
2. **Validation**: MIME and extension checked against `application/pdf` and
   `image/png|jpeg|webp|bmp|tiff`. Size cap 15 MB. Specific rejection message per failure.
3. **Type detection**: read the leading bytes to confirm the PDF magic number rather than
   trusting the extension.
4. **Strategy selection**: images go straight to OCR; PDFs load in pdf.js and each page calls
   `getTextContent()`.
5. **Extraction**
   - Digital page: reconstruct lines from text item transform matrices. Group by Y within a
     tolerance, sort by X, insert `\n` on Y change, `\n\n` when the Y gap exceeds about
     1.6 line heights, insert a space when the X gap exceeds a word-width threshold.
   - Sparse page (under ~40 non-whitespace characters, or a low text-to-area ratio): render at
     scale 2.0 to a canvas and pass the bitmap to the OCR worker.
   - Image: OCR directly. Upscale if the shorter edge is below 1000 px.
6. **Progress**: per-page and per-stage. Map tesseract.js `progress` events onto a page-weighted
   global percentage. Show the stage name, not just a bar.
7. **Normalisation**: collapse space runs, join hyphenated line breaks, strip lines repeated on
   every page (headers/footers), normalise smart quotes and ligatures, cap consecutive blank
   lines at one, trim.
8. **Analysis**: pure synchronous functions over the normalised text, re-run on edit (debounced).
9. **Rendering**: extracted text on the left, analysis on the right, platform tabs above metrics.
10. **Error handling**: typed error union mapped to human messages with a suggested next action.
    A failure on one file must not kill the queue.

### Error union

`UnsupportedType | TooLarge | Encrypted | Corrupt | NoTextFound | OcrFailed | Cancelled`

---

## 7. Analysis engine design

Three layers, kept separate in code and in the UI.

### Layer 1: deterministic metrics

- Character count with and without spaces
- Word count, sentence count, paragraph count
- Average words per sentence, longest sentence
- Hashtags: count, list, position (inline vs trailing block)
- Mentions: count, list
- URLs: count, list, whether any falls inside the first 100 characters
- Emoji count and density (`/\p{Extended_Pictographic}/gu`)
- Question marks, exclamation marks, ALL-CAPS word ratio
- Flesch Reading Ease: `206.835 - 1.015*(words/sentences) - 84.6*(syllables/words)`, plus grade band
- Reading time estimate

### Layer 2: platform fit

| Platform | Hard limit | Recommended length | Hashtags | Truncation point |
|---|---|---|---|---|
| X | 280 | 71 to 100 | 1 to 2 | n/a |
| LinkedIn | 3000 | 150 to 1300 | 3 to 5 | ~210 chars |
| Instagram | 2200 | 138 to 150 | 5 to 15 (max 30) | ~125 chars |
| Facebook | 63206 | 40 to 80 | 1 to 2 | ~250 chars |

Per platform output: fits or overflows, characters over, a preview of exactly what is cut at the
"see more" fold, and a hashtag count verdict.

### Layer 3: heuristic suggestions

Rule objects shaped `{ id, severity: 'high' | 'medium' | 'low', title, detail, evidence }`.
Around twelve rules:

1. No call to action detected (phrase list: comment below, link in bio, tag a friend, sign up,
   learn more, DM me, share this, subscribe, register, download, check out, swipe up)
2. No question anywhere, which suppresses replies
3. First line exceeds the platform truncation point, so the hook is cut off
4. Zero hashtags, or hashtag count outside the platform band
5. Hashtags scattered inline rather than grouped at the end
6. Average sentence length above 25 words
7. Flesch score below 50, so the text is hard to skim
8. Wall of text: no paragraph break within 300 characters
9. Zero emoji on a platform where they help
10. Link placed in the opening line
11. Excessive ALL-CAPS
12. Post exceeds the hard limit for the selected platform

### Engagement score

Weighted composite out of 100: length fit 25, CTA presence 20, hashtag usage 15,
readability 15, structure 10, hook quality 15. The README must state plainly that this is a
heuristic composite and not a trained model.

### Optional AI layer

Deliberately not implemented. Document the exclusion and the reason in the README: a
key-dependent enhancement adds a failure mode a reviewer cannot debug.

---

## 8. Four-session roadmap

Each session must end with the project in a working, committed state.

### Session 1: scaffold, upload, validation, live deployment

- **Goal**: a deployed app that accepts files and drives a stubbed pipeline through every UI state.
- **Create**: `vite.config.ts`, `tsconfig.json`, `package.json`, `index.html`, `main.tsx`,
  `App.tsx`, `types.ts`, `constants.ts`, `lib/validate.ts`, `lib/errors.ts`,
  `components/Dropzone.tsx`, `FileQueue.tsx`, `ProgressBar.tsx`, `ErrorBanner.tsx`,
  `styles/global.css`, `styles/components.css`, `.gitignore`.
- **Implement**: drag-and-drop with hover state, file picker, multi-file queue, validation with
  typed errors, the `ProcessingState` union
  (`idle | validating | extracting | ocr | analyzing | done | error`), and a fake extractor that
  resolves after a delay so every UI state is reachable.
- **Install**: `react react-dom`; dev: `vite @vitejs/plugin-react typescript @types/react @types/react-dom`
- **Verify**: drop a valid PDF, an oversized file, and a `.docx`, and confirm three distinct
  outcomes. Push to GitHub on `main`, connect Vercel, confirm the live URL loads.
- **End state**: deployed URL exists on day one. Deployment risk is retired before the hard work.
- **Status**: done. Live at https://social-media-content-analyzer-woad.vercel.app/ (commit 8d1db05).

### Session 2: real extraction

- **Goal**: correct text out of digital PDFs, scanned PDFs, and images.
- **Create**: `lib/extract/index.ts`, `pdf.ts`, `layout.ts`, `ocr.ts`, `lib/normalize.ts`,
  `hooks/useDocumentProcessor.ts`.
- **Implement**: pdf.js worker wiring via
  `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)`; line reconstruction from
  transform matrices; sparse-page detector; canvas rasterisation at scale 2.0; a single reusable
  tesseract.js worker across pages; real progress events; cancellation; normalisation pass.
- **Install**: `pdfjs-dist tesseract.js`
- **Verify**: a text PDF keeps paragraph structure; a scanned PDF auto-routes to OCR and produces
  text; a screenshot produces text; a 20-page PDF reports sane progress; cancelling mid-OCR
  leaves no stuck state. Test against `vite build && vite preview`, not just dev mode.
- **End state**: any supported file yields normalised text on screen.
- **Status**: done. All five verify scenarios passed against `vite build && vite preview`.

### Session 3: analysis engine and results UI

- **Goal**: the app earns its name.
- **Create**: all of `lib/analysis/`, plus `TextEditor.tsx`, `AnalysisPanel.tsx`,
  `MetricGrid.tsx`, `PlatformTabs.tsx`, `SuggestionList.tsx`.
- **Implement**: all three analysis layers, the score, editable text with debounced re-analysis,
  platform tabs, the truncation preview showing where the fold falls, copy and download buttons.
- **Install**: nothing.
- **Verify**: paste a known short post and hand-check the counts; switch platforms and confirm
  verdicts change; edit text and confirm metrics update without re-extracting.
- **End state**: a working analyzer, not an extractor.

### Session 4: hardening, tests, docs, submission

- **Goal**: submission-ready.
- **Create**: `tests/analysis.test.ts`, `tests/normalize.test.ts`, `README.md`, `APPROACH.md`,
  `public/samples/*`.
- **Implement**: encrypted-PDF and corrupt-file handling, empty-extraction state with an
  actionable message, OCR page cap with a warning above it, keyboard accessibility on the
  dropzone, mobile layout, an error boundary, final dependency audit.
- **Install**: dev: `vitest`
- **Verify**: run the full matrix (digital PDF, scanned PDF, mixed PDF, PNG, JPEG, corrupt PDF,
  password-protected PDF, blank page, 15 MB file, non-English text). Confirm `npm run build` is
  clean. Confirm `git ls-files` contains no `node_modules`, `dist`, or `.env`. Confirm the
  deployed URL matches local behaviour.
- **End state**: repo, hosted URL, README, and the 200-word write-up all complete.

---

## 9. Risks and mitigations

| Risk | Mitigation |
|---|---|
| tesseract.js language data is 10 to 15 MB on first run | Explicit "downloading OCR engine, one time" message with its own progress. Browser caches it. Vendor `eng.traineddata.gz` into `public/` if the CDN is slow. |
| pdf.js worker path breaks under Vite bundling | Use the `new URL(..., import.meta.url)` pattern and verify against a production build in session 2. |
| Scanned PDF returns empty text | Sparse-page detector plus canvas OCR fallback. If OCR also yields nothing, show "no readable text found, the image may be too low resolution". |
| Large or many-page files freeze the tab | 15 MB cap, 20-page OCR cap with warning, all heavy work in workers, cancel always available. |
| Encrypted or corrupt PDF | Catch pdf.js `PasswordException` and `InvalidPDFException` and map to distinct messages. |
| Poor OCR on low-quality images | Upscale small images before OCR, surface the tesseract confidence score, rely on the editable pane for corrections. |
| Weak mobile devices run out of memory | Cap render scale on small screens, degrade to 1.5. |
| Repo fails the submission guidelines | `.gitignore` covering `node_modules`, `dist`, `.env`, `.vscode`, `.idea`, plus a session-4 `git ls-files` check. |

Serverless timeouts, payload limits, and cold starts are not applicable, which is a large part of
why the static client-side architecture was chosen.

---

## 10. Definition of done

- [x] Public GitHub repo, branch `main`, no ignored artefacts committed
- [x] Live hosted URL that works on a first visit from a clean browser
- [x] Digital PDF, scanned PDF, and image all extract correctly
- [ ] Analysis panel produces metrics, platform fit, and suggestions
- [ ] All error states produce a specific, actionable message
- [ ] Loading and progress states visible for every async stage
- [ ] `README.md` explains the approach and the architectural reasoning
- [ ] `APPROACH.md` is at most 200 words
- [ ] Exactly 4 runtime dependencies
- [ ] `npm run build` and `npm test` both clean

---

## Deviation log

Record any departure from this plan here, with the session number and the reason.

- (none yet)
