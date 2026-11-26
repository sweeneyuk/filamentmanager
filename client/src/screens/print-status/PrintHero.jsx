import { AlertTriangle, RefreshCcw } from 'lucide-react';
import FilamentRing from '../../ui/FilamentRing';
import Readings from './Readings';
import { formatMinutes, finishTime } from '../../lib/format.js';
import { predictedTotal, latestTakeover } from '../../lib/printState.js';
import { colorName } from '../../lib/colors.js';
import { unitName, slotNumber } from '../../lib/ams.js';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function materialLine({ state, printerId, assignments, spools, settings }) {
  const trayId = state?.currentTrayId;
  if (!trayId || typeof trayId !== 'string' || !trayId.includes('-')) return null;
  const [unitId, index] = trayId.split('-');
  const spoolId = assignments?.[trayId];
  const spool = spoolId != null ? spools.find((s) => s.id == spoolId) : null; // eslint-disable-line eqeqeq
  const where = `from ${unitName(settings, printerId, unitId)} slot ${slotNumber(unitId, parseInt(index, 10) || 0)}`;
  if (!spool) return where.charAt(0).toUpperCase() + where.slice(1);
  const name = [spool.brand_name, spool.material_name, spool.subtype && spool.subtype.toLowerCase() !== 'basic' ? spool.subtype : null]
    .filter(Boolean).join(' ');
  const colour = colorName(spool);
  return [name, colour !== 'Unknown' ? colour.toLowerCase() : null, where].filter(Boolean).join(', ');
}

export default function PrintHero({ state, printerId, assignments, spools, settings, headingLevel = 2 }) {
  const Title = `h${headingLevel}`;
  const progress = Math.min(100, Math.max(0, Math.round(num(state.progress))));
  const trayId = state.currentTrayId;
  const spoolId = trayId ? assignments?.[trayId] : null;
  const spool = spoolId != null ? spools.find((s) => s.id == spoolId) : null; // eslint-disable-line eqeqeq
  const layer = num(state.layerNum);
  const totalLayers = num(state.totalLayerNum);
  const remaining = num(state.remainingTime);
  const predicted = predictedTotal(state);
  const used = num(state.totalGramsDeducted);
  const takeover = latestTakeover(state);
  const runout = typeof state.stage === 'string' && state.stage.includes('Runout');
  const showStage = state.stage && !['Printing', 'Idle'].includes(state.stage);
  const started = state.startTime ? new Date(state.startTime) : null;
  const line = materialLine({ state, printerId, assignments, spools, settings });

  return (
    <section className="ps-hero" aria-label="Current print">
      <FilamentRing
        className="ps-hero__ring"
        color={spool?.color}
        fraction={progress / 100}
        size={216}
        hole={0.83}
        label={`${progress} percent complete`}
      >
        <span className="ps-hero__pct">{progress}%</span>
        {totalLayers > 0 && <span className="ps-hero__layer">Layer {layer} of {totalLayers}</span>}
      </FilamentRing>

      <div className="ps-hero__body">
        <div>
          <Title className="ps-hero__name">{state.name || 'Unnamed print'}</Title>
          {showStage && <div className="ps-hero__stage">{state.stage}</div>}
          {line && <div className="ps-hero__line">{line}</div>}
          {started && !Number.isNaN(started.getTime()) && (
            <div className="ps-hero__started">Started {started.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
          )}
        </div>

        {runout && (
          <div className="ps-banner ps-banner--danger" role="status">
            <AlertTriangle size={18} aria-hidden="true" />
            <span><strong>Filament runout.</strong> Print paused waiting for spool reload.</span>
          </div>
        )}
        {takeover && (
          <div className="ps-banner ps-banner--info">
            <RefreshCcw size={18} aria-hidden="true" />
            <span>
              <strong>Auto-refill takeover.</strong> Switched from slot {takeover.fromTray} to slot {takeover.toTray} at {num(takeover.progress)}%.
            </span>
          </div>
        )}

        <dl className="ps-stats">
          <div>
            <dd>{remaining > 0 ? formatMinutes(remaining) : 'Calculating…'}</dd>
            <dt>Time left</dt>
          </div>
          <div>
            <dd>{remaining > 0 ? finishTime(remaining) : '–'}</dd>
            <dt>Finishes at</dt>
          </div>
          <div>
            <dd>{used.toFixed(1)} g</dd>
            <dt>{predicted ? `Used of ${predicted} g` : 'Used'}</dt>
          </div>
        </dl>

        <Readings state={state} />
      </div>
    </section>
  );
}
