interface ProgressBarProps {
  progress: number;
  label?: string;
}

export function ProgressBar({ progress, label }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, progress));

  return (
    <div className="progress-bar">
      {label ? <span className="progress-bar__label">{label}</span> : null}
      <div
        className="progress-bar__track"
        role="progressbar"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="progress-bar__fill" style={{ width: `${clamped}%` }} />
      </div>
      <span className="progress-bar__percent">{Math.round(clamped)}%</span>
    </div>
  );
}
