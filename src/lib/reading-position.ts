export interface ReadingPosition {
  version: 1;
  progress: number;
  heading: string | null;
  offset: number;
}

export function getReadingProgress(rect: { top: number; height: number; bottom: number }, viewportHeight: number) {
  const travel = rect.height - viewportHeight;
  return travel > 0 ? Math.min(1, Math.max(0, -rect.top / travel)) : rect.bottom <= viewportHeight ? 1 : 0;
}

export function parseReadingPosition(raw: string | null): ReadingPosition | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (value?.version !== 1 || !Number.isFinite(value.progress) || value.progress < 0.03 || value.progress >= 0.98) return null;
    if (!Number.isFinite(value.offset) || value.offset < 0 || value.offset > 1) return null;
    if (value.heading !== null && (typeof value.heading !== 'string' || value.heading.length > 512)) return null;
    return { version: 1, progress: value.progress, heading: value.heading, offset: value.offset };
  } catch { return null; }
}
