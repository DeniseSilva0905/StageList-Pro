export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function parseDuration(durationStr: string): number {
  if (!durationStr) return 0;
  const parts = durationStr.split(':');
  if (parts.length === 3) {
    // HH:MM:SS
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
  }
  if (parts.length === 2) {
    // MM:SS
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  }
  return parseInt(durationStr) || 0;
}
