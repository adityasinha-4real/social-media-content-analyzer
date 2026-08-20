import { useCallback, useState } from 'react';
import { Dropzone } from './components/Dropzone';
import { FileQueue } from './components/FileQueue';
import { ErrorBanner } from './components/ErrorBanner';
import { useDocumentProcessor } from './hooks/useDocumentProcessor';

export default function App() {
  const { items, addFiles, removeItem, cancelItem } = useDocumentProcessor();
  const [activeId, setActiveId] = useState<string | null>(null);

  const handleSelect = useCallback((id: string) => setActiveId(id), []);

  const handleRemove = useCallback(
    (id: string) => {
      removeItem(id);
      setActiveId((prev) => (prev === id ? null : prev));
    },
    [removeItem],
  );

  // Nothing explicitly selected yet (fresh queue, or the selection got
  // removed) falls back to the most recently added file.
  const activeItem = items.find((item) => item.id === activeId) ?? items[items.length - 1] ?? null;

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
          <Dropzone onFilesSelected={addFiles} />
          <FileQueue
            items={items}
            activeId={activeItem?.id ?? null}
            onSelect={handleSelect}
            onRemove={handleRemove}
            onCancel={cancelItem}
          />
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
