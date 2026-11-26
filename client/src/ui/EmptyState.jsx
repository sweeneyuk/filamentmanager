import './States.css';

export default function EmptyState({ title, action, className = '' }) {
  return (
    <div className={`ui-empty ${className}`.trim()}>
      <p className="ui-empty__title">{title}</p>
      {action}
    </div>
  );
}
