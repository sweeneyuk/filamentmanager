import { Save } from 'lucide-react';
import Button from '../../ui/Button';

export default function QuoteSummary({ q, money, markup, onSave }) {
  const rows = [
    ['Material', q.materialCost],
    ['Labour', q.labourCost],
    ['Machine wear', q.machineCost],
    ['Electricity', q.energyCost],
  ];
  return (
    <section className="ca-summary ui-card" aria-label="Quote">
      <h2>Quote</h2>
      <dl className="ca-summary__rows">
        {rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{money(value)}</dd></div>)}
        <div className="is-sub"><dt>Cost to produce</dt><dd>{money(q.totalCost)}</dd></div>
        <div className="is-final"><dt>Quote price</dt><dd>{money(q.finalPrice)}</dd></div>
      </dl>
      <p className="ui-muted ca-summary__note">Includes {markup}% markup.</p>
      <Button variant="primary" icon={Save} onClick={onSave}>Save quote</Button>
    </section>
  );
}
