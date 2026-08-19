import type { ProcessingError } from '../types';

interface ErrorBannerProps {
  error: ProcessingError;
  onDismiss?: () => void;
}

export function ErrorBanner({ error, onDismiss }: ErrorBannerProps) {
  return (
    <div className="error-banner" role="alert">
      <div className="error-banner__body">
        <p className="error-banner__message">{error.message}</p>
        {error.action ? <p className="error-banner__action">{error.action}</p> : null}
      </div>
      {onDismiss ? (
        <button type="button" className="error-banner__dismiss" onClick={onDismiss} aria-label="Dismiss error">
          &times;
        </button>
      ) : null}
    </div>
  );
}
