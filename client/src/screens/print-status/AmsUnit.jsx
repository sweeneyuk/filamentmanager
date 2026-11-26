import { Pencil } from 'lucide-react';
import Button from '../../ui/Button';
import SlotButton from './SlotButton';
import { humidityLabel, unitName, slotView } from '../../lib/ams.js';

export default function AmsUnit({ unit, printerId, settings, ctx, onOpenSlot, onRename }) {
  const name = unitName(settings, printerId, unit.id);
  const trays = unit.tray || [];
  const humidity = humidityLabel(unit);
  const climate = [humidity && `${humidity} humidity`, unit.temp !== undefined && `${unit.temp}°C`].filter(Boolean).join(', ');
  return (
    <div className="ps-unit" data-slots={trays.length}>
      <div className="ps-unit__head">
        <h3>{name}</h3>
        <Button variant="ghost" icon={Pencil} label={`Rename ${name}`} onClick={() => onRename(unit.id)} />
        {climate && <span className="ps-unit__climate">{climate}</span>}
      </div>
      <div className="ps-unit__slots">
        {trays.map((_, i) => (
          <SlotButton key={i} view={slotView(unit, i, ctx)} onOpen={() => onOpenSlot(unit.id, i)} />
        ))}
      </div>
    </div>
  );
}
