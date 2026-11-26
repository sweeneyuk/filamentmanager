import StatTile from '../../ui/StatTile';
import { nozzleReadings, chamberReading } from '../../lib/temperature.js';
import { fanLine } from './text';

const deg = (n) => `${Math.round(Number(n) || 0)}°`;

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
