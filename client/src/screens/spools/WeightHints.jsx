import { Lightbulb } from 'lucide-react';

export default function WeightHints({ knowledge, onPick }) {
  if (!knowledge) return null;
  return (
    <div className="sp-hint">
      <div className="sp-hint__note">
        <Lightbulb size={16} aria-hidden="true" />
        <span><strong>{knowledge.brand}:</strong> {knowledge.note}</span>
      </div>
      {knowledge.variants?.length > 0 && (
        <div className="sp-hint__variants">
          {knowledge.variants.map((v, i) => (
            <button key={i} type="button" className="sp-hint__chip" onClick={() => onPick(v.weight)}>
              {v.label} ({v.weight} g)
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
