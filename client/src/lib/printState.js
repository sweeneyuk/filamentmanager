const PHASES = {
  PREPARE: { id: 'preparing', label: 'Preparing', active: true },
  RUNNING: { id: 'printing', label: 'Printing', active: true },
  PAUSE: { id: 'paused', label: 'Paused', active: true },
  FINISH: { id: 'finished', label: 'Finished', active: false },
  FAILED: { id: 'failed', label: 'Failed', active: false },
  IDLE: { id: 'idle', label: 'Idle', active: false },
};

export function printPhase(state) {
  const status = state?.status;
  if (!status) return { ...PHASES.IDLE };
  if (PHASES[status]) return { ...PHASES[status] };
  return { id: 'other', label: String(status), active: false };
}

export function predictedTotal(state) {
  const list = Array.isArray(state?.slicerFilaments) ? state.slicerFilaments : [];
  const total = list.reduce((sum, f) => sum + (Number(f?.used_g) || 0), 0);
  return total > 0 ? Math.round(total * 10) / 10 : null;
}

export function latestTakeover(state) {
  const valid = (state?.takeovers || []).filter(
    (t) => t.fromTray && t.toTray && !t.fromTray.includes('255') && !t.toTray.includes('255'),
  );
  return valid.length ? valid[valid.length - 1] : null;
}
