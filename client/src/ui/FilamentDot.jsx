import './FilamentDot.css';

export default function FilamentDot({ color, size = 14, className = '' }) {
  return (
    <span
      aria-hidden="true"
      className={`ui-dot ${className}`.trim()}
      style={{ '--dot-color': color || 'transparent', '--dot-size': `${size}px` }}
    />
  );
}
