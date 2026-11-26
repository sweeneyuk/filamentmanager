export function statusPill(status) {
  if (status === 'FINISH' || status === 'COMPLETED') return { tone: 'accent', label: 'Finished' };
  if (status === 'FAILED') return { tone: 'danger', label: 'Failed' };
  if (status === 'In Progress' || status === 'RUNNING') return { tone: 'info', label: 'In progress' };
  return { tone: 'neutral', label: status || 'Unknown' };
}

export function aiAnalysis(raw) {
  if (!raw) return null;
  try {
    const ai = JSON.parse(raw);
    if (!ai || typeof ai !== 'object' || !ai.status) return null;
    const tone = ai.status === 'SUCCESS' ? 'accent'
      : ai.status === 'SPAGHETTI' ? 'danger'
        : ['STRINGING', 'WARPED', 'LAYER_SHIFT'].includes(ai.status) ? 'warning' : 'neutral';
    return { status: ai.status, reason: ai.reason || '', tone };
  } catch {
    return null;
  }
}

export function printedAt(value) {
  const d = value ? new Date(String(value).replace(' ', 'T')) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  return `${d.toLocaleDateString('en-GB')} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}
