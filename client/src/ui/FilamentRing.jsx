import './FilamentRing.css';

/** Ring filled to `fraction` (0..1) in the filament colour, always outlined. */
export default function FilamentRing({ color, fraction = 0, size = 68, hole = 0.65, label, className = '', children }) {
  const f = Number.isFinite(Number(fraction)) ? Math.min(1, Math.max(0, Number(fraction))) : 0;
  const style = {
    '--ring-color': color || 'var(--accent)',
    '--ring-fraction': f,
    '--ring-size': `${size}px`,
    '--ring-hole': `${Math.round(size * hole)}px`,
  };
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': children ? undefined : true };
  return (
    <span className={`ui-ring ${className}`.trim()} style={style} {...a11y}>
      <span className="ui-ring__hole">{children}</span>
    </span>
  );
}
