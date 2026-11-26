import StatTile from '../../ui/StatTile';
import { materialTotals } from '../../lib/spools.js';

const kg = (g) => `${(g / 1000).toFixed(1)} kg`;

export default function StatsStrip({ spools, totalConsumed, threshold }) {
  const active = spools.filter((s) => !s.archived);
  const total = active.reduce((acc, s) => acc + (Number(s.total_weight) - Number(s.used_weight) || 0), 0);
  const low = active.filter((s) => Number(s.total_weight) - Number(s.used_weight) < threshold).length;
  const materials = materialTotals(active);
  return (
    <section className="sp-stats" aria-label="Stock summary">
      <StatTile label="Total inventory" value={kg(total)} sub={`${active.length} spools`} />
      <StatTile label="Total consumed" value={kg(totalConsumed)} sub="Since tracking started" />
      <StatTile
        className="sp-stats__materials"
        label="By material"
        value={(
          <span className="sp-stats__list">
            {materials.map((m) => <span key={m.material}>{m.material} {kg(m.grams)}</span>)}
          </span>
        )}
      />
      <StatTile className="sp-stats__low" label="Low stock" value={low} sub={`Under ${threshold} g left`} />
    </section>
  );
}
