export function mediaUrl(path, token) {
  if (!path) return null;
  return `${path}?token=${token ?? ''}`;
}
