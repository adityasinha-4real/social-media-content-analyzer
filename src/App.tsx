import { useCallback, useEffect, useState } from 'react';
import { AnalysisPanel } from './components/AnalysisPanel';
import { Dropzone } from './components/Dropzone';
import { ErrorBanner } from './components/ErrorBanner';
import { FileQueue } from './components/FileQueue';
import { TextEditor } from './components/TextEditor';
import { useDocumentProcessor } from './hooks/useDocumentProcessor';
import { analyzeText, PLATFORM_ORDER } from './lib/analysis';
import type { AnalysisResult, PlatformId } from './types';

const ANALYSIS_DEBOUNCE_MS = 300;

export default function App() {
  const { items, addFiles, removeItem, cancelItem } = useDocumentProcessor();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editsById, setEditsById] = useState<Record<string, string>>({});
  const [platform, setPlatform] = useState<PlatformId>(PLATFORM_ORDER[0]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  const handleSelect = useCallback((id: string) => setActiveId(id), []);

  const handleRemove = useCallback(
    (id: string) => {
      removeItem(id);
      setActiveId((prev) => (prev === id ? null : prev));
      setEditsById((prev) => {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    [removeItem],
  );

  // Nothing explicitly selected yet (fresh queue, or the selection got
  // removed) falls back to the most recently added file.
  const activeItem = items.find((item) => item.id === activeId) ?? items[items.length - 1] ?? null;

  const text = activeItem ? editsById[activeItem.id] ?? activeItem.extractedText ?? '' : '';

  const handleTextChange = useCallback(
    (value: string) => {
      if (!activeItem) return;
      const id = activeItem.id;
      setEditsById((prev) => ({ ...prev, [id]: value }));
    },
    [activeItem],
  );

  // Re-analyze on text or platform change, debounced so typing doesn't
  // re-run the analysis on every keystroke.
  useEffect(() => {
    if (!activeItem || activeItem.state !== 'done' || !text.trim()) {
      setAnalysis(null);
      return;
    }
    const handle = setTimeout(() => {
      setAnalysis(analyzeText(text, platform));
    }, ANALYSIS_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [text, platform, activeItem]);

  const showEditor = activeItem?.state === 'done';

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
            ) : showEditor ? (
              <TextEditor value={text} onChange={handleTextChange} fileName={activeItem.file.name} />
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

      {showEditor && analysis ? (
        <section className="app__panel app__panel--analysis">
          <AnalysisPanel analysis={analysis} platform={platform} onPlatformChange={setPlatform} />
        </section>
      ) : null}
    </div>
  );
}
