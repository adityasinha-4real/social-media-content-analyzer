import type { Metrics } from '../types';

interface MetricGridProps {
  metrics: Metrics;
}

function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
}

export function MetricGrid({ metrics }: MetricGridProps) {
  const items: { label: string; value: string }[] = [
    { label: 'Characters', value: `${metrics.charCount} (${metrics.charCountNoSpaces} no spaces)` },
    { label: 'Words', value: String(metrics.wordCount) },
    { label: 'Sentences', value: String(metrics.sentenceCount) },
    { label: 'Paragraphs', value: String(metrics.paragraphCount) },
    { label: 'Avg words / sentence', value: metrics.avgWordsPerSentence.toFixed(1) },
    { label: 'Longest sentence', value: `${metrics.longestSentenceWords} words` },
    { label: 'Hashtags', value: String(metrics.hashtags.count) },
    { label: 'Mentions', value: String(metrics.mentions.count) },
    { label: 'Links', value: String(metrics.urls.count) },
    { label: 'Emoji', value: String(metrics.emojiCount) },
    {
      label: 'Readability',
      value: `${metrics.readability.fleschScore.toFixed(0)} · ${metrics.readability.gradeBand}`,
    },
    { label: 'Reading time', value: formatSeconds(metrics.readingTimeSeconds) },
  ];

  return (
    <dl className="metric-grid">
      {items.map((item) => (
        <div className="metric-grid__item" key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
