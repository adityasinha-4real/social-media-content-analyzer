import { useCallback, useRef, useState } from 'react';
import { validateFile } from '../lib/validate';
import { createError, ExtractionError } from '../lib/errors';
import { extractText, cancelOcr } from '../lib/extract';
import { normalizeExtractedText } from '../lib/normalize';
import type { QueuedFile } from '../types';

function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

type UpdateItem = (id: string, patch: Partial<QueuedFile>) => void;

interface CancelFlag {
  cancelled: boolean;
}

export interface UseDocumentProcessorResult {
  items: QueuedFile[];
  addFiles: (files: File[]) => void;
  removeItem: (id: string) => void;
  cancelItem: (id: string) => void;
}

/** Owns the upload queue end to end: validation, extraction, OCR fallback, normalisation, and cancellation. */
export function useDocumentProcessor(): UseDocumentProcessorResult {
  const [items, setItems] = useState<QueuedFile[]>([]);
  const cancelFlags = useRef<Map<string, CancelFlag>>(new Map());
  // The tesseract worker is shared and its jobs are serialized, so only one
  // item can be inside an OCR call at a time. Tracking which one lets
  // cancel/remove terminate the worker only when it would actually free the
  // item the user acted on, instead of killing a different file's OCR.
  const activeOcrId = useRef<string | null>(null);

  const updateItem = useCallback<UpdateItem>((id, patch) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const processItem = useCallback(
    async (item: QueuedFile) => {
      updateItem(item.id, { state: 'validating', stageLabel: 'Validating file' });

      const validationError = await validateFile(item.file);
      if (validationError) {
        updateItem(item.id, { state: 'error', error: validationError, stageLabel: 'Failed' });
        return;
      }

      const flag: CancelFlag = { cancelled: false };
      cancelFlags.current.set(item.id, flag);
      const isCancelled = () => flag.cancelled;

      try {
        const result = await extractText(item.file, {
          isCancelled,
          onProgress: ({ stage, current, total }) => {
            if (stage === 'ocr') activeOcrId.current = item.id;
            const progress = total > 0 ? Math.min(100, Math.max(0, (current / total) * 100)) : 0;
            updateItem(item.id, {
              state: stage,
              stageLabel: stage === 'ocr' ? 'Running OCR' : 'Extracting text',
              progress,
            });
          },
        });

        const text = normalizeExtractedText(result.pages);
        if (!text) {
          updateItem(item.id, { state: 'error', error: createError('NoTextFound'), stageLabel: 'Failed' });
          return;
        }

        updateItem(item.id, {
          state: 'done',
          stageLabel: 'Done',
          progress: 100,
          extractedText: text,
        });
      } catch (err) {
        const kind = err instanceof ExtractionError ? err.kind : 'Corrupt';
        const message = err instanceof ExtractionError ? err.message : undefined;
        updateItem(item.id, { state: 'error', error: createError(kind, message), stageLabel: 'Failed' });
      } finally {
        cancelFlags.current.delete(item.id);
      }
    },
    [updateItem],
  );

  const addFiles = useCallback(
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

      for (const item of newItems) {
        void processItem(item);
      }
    },
    [processItem],
  );

  const removeItem = useCallback((id: string) => {
    const flag = cancelFlags.current.get(id);
    if (flag) {
      // Stop any in-flight extraction/OCR from writing further updates for
      // an item that's no longer in the list.
      flag.cancelled = true;
      if (activeOcrId.current === id) void cancelOcr();
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const cancelItem = useCallback((id: string) => {
    const flag = cancelFlags.current.get(id);
    if (!flag) return;
    flag.cancelled = true;
    if (activeOcrId.current === id) void cancelOcr();
  }, []);

  return { items, addFiles, removeItem, cancelItem };
}
