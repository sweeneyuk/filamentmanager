import StatTile from '../../ui/StatTile';
import { nozzleReadings, chamberReading, fanReadings } from '../../lib/temperature.js';

const deg = (n) => `${Math.round(Number(n) || 0)}°`;

export function fanLine(state) {
  const parts = fanReadings(state?.raw).map((f, i) => {
    const name = `${i === 0 ? f.label : f.label.toLowerCase()} fan`;
    return `${name} ${f.percent ? `${f.percent}%` : 'off'}`;
  });
  parts.push(`light ${state?.light ? 'on' : 'off'}`);
  return parts.join(', ');
}

export default function Readings({ state }) {
  const chamber = chamberReading(state);
  const tiles = [
    ...nozzleReadings(state),
    { label: 'Bed', temp: state?.bedTemp, target: state?.bedTarget },
    { label: 'Chamber', temp: chamber.temp, target: chamber.target },
  ];
  return (
    <div className="ps-readings">
      <div className="ps-tiles">
        {tiles.map((t) => (
          <StatTile
            key={t.label}
            label={t.label}
            value={<>{deg(t.temp)} {Number(t.target) > 0 && <span className="ps-target">of {deg(t.target)}</span>}</>}
          />
        ))}
      </div>
      <p className="ps-fans">{fanLine(state)}</p>
    </div>
  );
}
