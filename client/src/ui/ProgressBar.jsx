import './ProgressBar.css';

export default function ProgressBar({ fraction = 0, tone = 'accent', label, color, className = '' }) {
  const f = Number.isFinite(Number(fraction)) ? Math.min(1, Math.max(0, Number(fraction))) : 0;
  return (
    <div
      className={`ui-bar ui-bar--${tone} ${className}`.trim()}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(f * 100)}
    >
      <div className="ui-bar__fill" style={{ '--bar-fraction': f, ...(color ? { '--bar-color': color } : {}) }} />
    </div>
  );
}
