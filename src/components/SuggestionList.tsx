import type { Suggestion } from '../types';

const SEVERITY_LABEL: Record<Suggestion['severity'], string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

interface SuggestionListProps {
  suggestions: Suggestion[];
}

export function SuggestionList({ suggestions }: SuggestionListProps) {
  if (suggestions.length === 0) {
    return <p className="suggestion-list__empty">No issues found — this post is in good shape.</p>;
  }

  return (
    <ul className="suggestion-list">
      {suggestions.map((s) => (
        <li key={s.id} className="suggestion-list__item">
          <span className={`suggestion-list__severity suggestion-list__severity--${s.severity}`}>
            {SEVERITY_LABEL[s.severity]}
          </span>
          <div>
            <p className="suggestion-list__title">{s.title}</p>
            <p className="suggestion-list__detail">{s.detail}</p>
            {s.evidence ? <p className="suggestion-list__evidence">“{s.evidence}”</p> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
