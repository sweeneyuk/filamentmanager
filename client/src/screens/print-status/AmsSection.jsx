import { useState } from 'react';
import AmsUnit from './AmsUnit';
import EmptyHolders from './EmptyHolders';
import SlotPanel from './SlotPanel';
import { isEmptyHolder, slotView, unitName } from '../../lib/ams.js';
import { lowStockThreshold } from '../../lib/spools.js';
import { printPhase } from '../../lib/printState.js';

export default function AmsSection({ printer, state, ams, assignments, spools, settings, assign, renameUnit }) {
  const [open, setOpen] = useState(null); // { unitId, index }
  const threshold = lowStockThreshold(settings);
  // Feeding and in-use marks only mean something while a print is under way.
  const ctx = { assignments, spools, state: printPhase(state).active ? state : null, threshold };

  if (!ams || Object.keys(ams).length === 0) {
    return <p className="ps-ams-note">No AMS data received yet. Ensure your Bambu printer is connected via MQTT in Settings.</p>;
  }
  if (!Array.isArray(ams)) return <p className="ps-ams-note">Waiting for detailed AMS payload…</p>;

  const units = ams.filter((u) => !isEmptyHolder(u, assignments));
  const holders = ams.filter((u) => isEmptyHolder(u, assignments));
  const openUnit = open ? ams.find((u) => u.id === open.unitId) : null;
  const view = openUnit ? slotView(openUnit, open.index, ctx) : null;

  const onAssign = async (spoolId) => {
    const ok = await assign(printer.id, view.key, spoolId);
    if (ok) setOpen(null);
  };

  return (
    <>
      <section className="ps-ams" aria-label="Loaded filament">
        {units.map((u) => (
          <AmsUnit
            key={u.id}
            unit={u}
            printerId={printer.id}
            settings={settings}
            ctx={ctx}
            onOpenSlot={(unitId, index) => setOpen({ unitId, index })}
            onRename={(unitId) => renameUnit(printer.id, unitId)}
          />
        ))}
      </section>
      <EmptyHolders units={holders} onAssign={(unitId) => setOpen({ unitId, index: 0 })} />
      <SlotPanel
        open={Boolean(view)}
        title={view ? `${unitName(settings, printer.id, openUnit.id)}, slot ${view.number}` : ''}
        view={view}
        spools={spools}
        threshold={threshold}
        onAssign={onAssign}
        onClose={() => setOpen(null)}
      />
    </>
  );
}
