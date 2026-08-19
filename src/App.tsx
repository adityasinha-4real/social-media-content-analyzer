import { useCallback, useState } from 'react';
import { Dropzone } from './components/Dropzone';
import { FileQueue } from './components/FileQueue';
import { ErrorBanner } from './components/ErrorBanner';
import { validateFile } from './lib/validate';
import { FAKE_PIPELINE_STEP_MS } from './constants';
import type { ProcessingState, QueuedFile } from './types';

function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type UpdateItem = (id: string, patch: Partial<QueuedFile>) => void;

/**
 * Stand-in for the real extraction pipeline (session 2). Walks a file through
 * the same processing states the real pipeline will use, so every stage of
 * the UI is reachable before any actual PDF or OCR handling exists.
 */
async function runFakePipeline(item: QueuedFile, updateItem: UpdateItem): Promise<void> {
  const isImage = item.file.type.startsWith('image/');
  const stages: { state: ProcessingState; label: string }[] = isImage
    ? [
        { state: 'ocr', label: 'Running OCR' },
        { state: 'analyzing', label: 'Analyzing content' },
      ]
    : [
        { state: 'extracting', label: 'Extracting text' },
        { state: 'analyzing', label: 'Analyzing content' },
      ];

  for (const stage of stages) {
    updateItem(item.id, { state: stage.state, stageLabel: stage.label, progress: 0 });
    const steps = 5;
    for (let step = 1; step <= steps; step += 1) {
      await delay(FAKE_PIPELINE_STEP_MS);
      updateItem(item.id, { progress: (step / steps) * 100 });
    }
  }

  updateItem(item.id, {
    state: 'done',
    stageLabel: 'Done',
    progress: 100,
    extractedText: `[placeholder] Extracted text for "${item.file.name}" will appear here once real extraction lands.`,
  });
}

export default function App() {
  const [items, setItems] = useState<QueuedFile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const updateItem = useCallback<UpdateItem>((id, patch) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const processItem = useCallback(
    async (item: QueuedFile) => {
      updateItem(item.id, { state: 'validating', stageLabel: 'Validating file' });
      const error = await validateFile(item.file);
      if (error) {
        updateItem(item.id, { state: 'error', error, stageLabel: 'Failed' });
        return;
      }
      await runFakePipeline(item, updateItem);
    },
    [updateItem],
  );

  const handleFilesSelected = useCallback(
    (files: File[]) => {
      const newItems: QueuedFile[] = files.map((file) => ({
        id: createId(),
        file,
        state: 'idle',
        progress: 0,
        stageLabel: '',
        extractedText: null,
        error: null,
      }));

      setItems((prev) => [...prev, ...newItems]);
      setActiveId((prev) => prev ?? newItems[0]?.id ?? null);

      for (const item of newItems) {
        void processItem(item);
      }
    },
    [processItem],
  );

  const handleSelect = useCallback((id: string) => setActiveId(id), []);

  const handleRemove = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    setActiveId((prev) => (prev === id ? null : prev));
  }, []);

  const activeItem = items.find((item) => item.id === activeId) ?? null;

  return (
    <div className="app">
      <header className="app__header">
        <h1>Social Media Content Analyzer</h1>
        <p className="app__subtitle">
          Upload a PDF or image, extract the text, and check how it reads before you post it.
        </p>
      </header>

      <main className="app__main">
        <section className="app__panel">
          <Dropzone onFilesSelected={handleFilesSelected} />
          <FileQueue items={items} activeId={activeId} onSelect={handleSelect} onRemove={handleRemove} />
        </section>

        <section className="app__panel app__panel--preview">
          {activeItem ? (
            activeItem.state === 'error' && activeItem.error ? (
              <ErrorBanner error={activeItem.error} />
            ) : (
              <div className="preview">
                <h2>Extracted text</h2>
                <p className="preview__status">{activeItem.stageLabel || 'Waiting'}</p>
                <pre className="preview__text">{activeItem.extractedText ?? 'Processing…'}</pre>
              </div>
            )
          ) : (
            <p className="app__empty">Upload a file to get started.</p>
          )}
        </section>
      </main>
    </div>
  );
}
