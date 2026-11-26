import './States.css';

export default function Skeleton({ height = 120, count = 1, className = '' }) {
  return (
    <div className={`ui-skeletons ${className}`.trim()} aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="ui-skeleton" style={{ height }} />
      ))}
    </div>
  );
}
