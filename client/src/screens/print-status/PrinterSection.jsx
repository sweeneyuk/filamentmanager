import Card from '../../ui/Card';
import StatusPill from '../../ui/StatusPill';
import PrintHero from './PrintHero';
import IdleCard from './IdleCard';
import AmsSection from './AmsSection';
import { phaseOf } from './phase';

export default function PrinterSection({ printer, data, showHeading }) {
  const { states, amsByPrinter, assignments, spools, settings, assign, renameUnit } = data;
  const state = states[printer.id];
  const phase = state ? phaseOf(state) : null;
  const printerAssignments = assignments[printer.id] || {};
  return (
    <section className="ps-printer" aria-label={printer.name}>
      {showHeading && (
        <div className="ps-printer__head">
          <h2>{printer.name}</h2>
          {phase && <StatusPill tone={phase.tone}>{phase.label}</StatusPill>}
        </div>
      )}
      {!state && (
        <Card className="ps-waiting">
          <p>Waiting for printer. Status appears once {printer.name} reports in.</p>
        </Card>
      )}
      {state && phase.active && (
        <PrintHero
          state={state}
          printerId={printer.id}
          assignments={printerAssignments}
          spools={spools}
          settings={settings}
          headingLevel={showHeading ? 3 : 2}
        />
      )}
      {state && !phase.active && <IdleCard state={state} phase={phase} />}
      <AmsSection
        printer={printer}
        state={state}
        ams={amsByPrinter[printer.id]}
        assignments={printerAssignments}
        spools={spools}
        settings={settings}
        assign={assign}
        renameUnit={renameUnit}
      />
    </section>
  );
}
