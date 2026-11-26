import ProgressBar from '../../ui/ProgressBar';

/** Horizontal bars with labelled values. Series colours come from the chart tokens. */
export default function BarList({ items, format }) {
  const max = Math.max(...items.map((i) => i.value), 0) || 1;
  return (
    <ul className="an-bars">
      {items.map((it, i) => (
        <li key={it.name} className={`an-bar an-series-${(i % 5) + 1}`}>
          <span className="an-bar__name">{it.name}</span>
          <span className="an-bar__value">{format(it.value)}</span>
          <ProgressBar fraction={it.value / max} label={`${it.name}: ${format(it.value)}`} />
        </li>
      ))}
    </ul>
  );
}
