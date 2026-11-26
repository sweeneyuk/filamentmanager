import './StatusPill.css';

export default function StatusPill({ tone = 'neutral', children, className = '' }) {
  return (
    <span className={`ui-pill ui-pill--${tone} ${className}`.trim()}>
      <span className="ui-pill__dot" aria-hidden="true" />
      {children}
    </span>
  );
}
