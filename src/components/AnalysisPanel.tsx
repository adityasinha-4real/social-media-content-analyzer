import type { CSSProperties } from 'react';
import { PLATFORM_LIMITS } from '../lib/analysis';
import type { AnalysisResult, PlatformId } from '../types';
import { MetricGrid } from './MetricGrid';
import { PlatformTabs } from './PlatformTabs';
import { SuggestionList } from './SuggestionList';

interface AnalysisPanelProps {
  analysis: AnalysisResult;
  platform: PlatformId;
  onPlatformChange: (id: PlatformId) => void;
}

export function AnalysisPanel({ analysis, platform, onPlatformChange }: AnalysisPanelProps) {
  const limits = PLATFORM_LIMITS[platform];
  const fit = analysis.platformFit[platform];
  const scoreStyle = { '--score': analysis.score.total } as CSSProperties;
  const scoreTier = analysis.score.total >= 70 ? 'good' : analysis.score.total >= 40 ? 'mid' : 'low';

  return (
    <div className="analysis-panel">
      <div className="analysis-panel__score">
        <div className={`score-ring score-ring--${scoreTier}`} style={scoreStyle}>
          <span>{analysis.score.total}</span>
        </div>
        <div>
          <p className="analysis-panel__score-label">Engagement score</p>
          <p className="analysis-panel__score-hint">Heuristic composite, not a trained model.</p>
        </div>
      </div>

      <PlatformTabs active={platform} onSelect={onPlatformChange} fit={analysis.platformFit} />

      <div className="platform-detail">
        <p className="platform-detail__count">
          {analysis.metrics.charCount} / {limits.hardLimit} characters
          {!fit.fits ? ` · ${fit.overBy} over` : ''}
        </p>
        {fit.cutText ? (
          <p className="platform-detail__fold">
            {limits.name} folds behind "see more" after <strong>{fit.preview.length}</strong> characters.
          </p>
        ) : null}
        <p className="platform-detail__hashtags">
          Hashtags: {analysis.metrics.hashtags.count} (recommended {limits.hashtagMin}-{limits.hashtagMax})
        </p>
      </div>

      <MetricGrid metrics={analysis.metrics} />

      <SuggestionList suggestions={analysis.suggestions} />
    </div>
  );
}
