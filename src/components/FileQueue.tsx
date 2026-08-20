import type { QueuedFile } from '../types';
import { ProgressBar } from './ProgressBar';
import { ErrorBanner } from './ErrorBanner';

interface FileQueueProps {
  items: QueuedFile[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onCancel: (id: string) => void;
}

const STATE_LABELS: Record<QueuedFile['state'], string> = {
  idle: 'Queued',
  validating: 'Validating',
  extracting: 'Extracting text',
  ocr: 'Running OCR',
  analyzing: 'Analyzing',
  done: 'Done',
  error: 'Failed',
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileQueue({ items, activeId, onSelect, onRemove, onCancel }: FileQueueProps) {
  if (items.length === 0) return null;

  const isBusy = (state: QueuedFile['state']) =>
    state !== 'idle' && state !== 'done' && state !== 'error';

  return (
    <ul className="file-queue">
      {items.map((item) => (
        <li
          key={item.id}
          className={`file-queue__item${item.id === activeId ? ' file-queue__item--active' : ''}`}
        >
          <button type="button" className="file-queue__select" onClick={() => onSelect(item.id)}>
            <span className="file-queue__name">{item.file.name}</span>
            <span className="file-queue__meta">
              {formatSize(item.file.size)} &middot; {STATE_LABELS[item.state]}
            </span>
          </button>

          {isBusy(item.state) ? <ProgressBar progress={item.progress} label={item.stageLabel} /> : null}

          {item.state === 'error' && item.error ? <ErrorBanner error={item.error} /> : null}

          <div className="file-queue__actions">
            {isBusy(item.state) ? (
              <button
                type="button"
                className="file-queue__cancel"
                onClick={() => onCancel(item.id)}
                aria-label={`Cancel processing ${item.file.name}`}
              >
                Cancel
              </button>
            ) : null}
            <button
              type="button"
              className="file-queue__remove"
              onClick={() => onRemove(item.id)}
              aria-label={`Remove ${item.file.name}`}
            >
              Remove
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
