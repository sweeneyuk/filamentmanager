import namer from 'color-namer';

export function colorName(spool) {
  if (spool?.color_name) return spool.color_name;
  try {
    if (spool?.color && /^#?[0-9a-f]{3,8}$/i.test(spool.color)) {
      const name = namer(spool.color).basic[0].name;
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
  } catch {
    // fall through
  }
  return 'Unknown';
}

export function trayHex(trayColor) {
  if (!trayColor || typeof trayColor !== 'string') return null;
  const hex = trayColor.substring(0, 6);
  return /^[0-9a-f]{6}$/i.test(hex) ? `#${hex.toLowerCase()}` : null;
}
