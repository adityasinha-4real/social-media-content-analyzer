import { PLATFORM_LIMITS, PLATFORM_ORDER } from '../lib/analysis';
import type { PlatformFitResult, PlatformId } from '../types';

interface PlatformTabsProps {
  active: PlatformId;
  onSelect: (id: PlatformId) => void;
  fit: Record<PlatformId, PlatformFitResult>;
}

const VERDICT_LABEL: Record<PlatformFitResult['lengthVerdict'], string> = {
  short: 'Short',
  good: 'Good fit',
  long: 'Long',
  over: 'Over limit',
};

export function PlatformTabs({ active, onSelect, fit }: PlatformTabsProps) {
  return (
    <div className="platform-tabs" role="tablist">
      {PLATFORM_ORDER.map((id) => {
        const limits = PLATFORM_LIMITS[id];
        const result = fit[id];
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`platform-tabs__tab${isActive ? ' platform-tabs__tab--active' : ''}${
              result.fits ? '' : ' platform-tabs__tab--over'
            }`}
            onClick={() => onSelect(id)}
          >
            <span className="platform-tabs__name">{limits.name}</span>
            <span className="platform-tabs__verdict">{VERDICT_LABEL[result.lengthVerdict]}</span>
          </button>
        );
      })}
    </div>
  );
}
