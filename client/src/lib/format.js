// Formatting shared by every screen. Pure, no React.

const formatterFor = (currency) => {
  if (currency && typeof currency === 'string') {
    try {
      return new Intl.NumberFormat('en-GB', { style: 'currency', currency });
    } catch {
      // invalid code: fall through to GBP
    }
  }
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
};

export function formatMoney(value, currency = 'GBP') {
  const n = Number(value);
  return formatterFor(currency).format(value === null || value === '' || !Number.isFinite(n) ? 0 : n);
}

export function currencySymbol(currency = 'GBP') {
  const part = formatterFor(currency).formatToParts(0).find((p) => p.type === 'currency');
  return part ? part.value : '£';
}

export function formatMinutes(min) {
  const total = Math.max(0, Math.round(Number(min) || 0));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Unchanged from Archive.formatDuration.
export function formatDuration(seconds) {
  if (!seconds) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

const pad = (n) => String(n).padStart(2, '0');

export function finishTime(remainingMinutes, now = new Date()) {
  const end = new Date(now.getTime() + (Number(remainingMinutes) || 0) * 60000);
  const time = `${pad(end.getHours())}:${pad(end.getMinutes())}`;
  if (end.toDateString() === now.toDateString()) return time;
  const day = end.toLocaleDateString('en-GB', { weekday: 'short' });
  return `${day} ${time}`;
}
