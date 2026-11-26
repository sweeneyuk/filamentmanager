import './StatTile.css';

export default function StatTile({ label, value, sub, className = '' }) {
  return (
    <div className={`ui-stat ${className}`.trim()}>
      <div className="ui-stat__label">{label}</div>
      <div className="ui-stat__value">{value}</div>
      {sub && <div className="ui-stat__sub">{sub}</div>}
    </div>
  );
}
