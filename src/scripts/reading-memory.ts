import { onPageLoad } from './page-lifecycle';
import { getReadingProgress, parseReadingPosition, type ReadingPosition } from '../lib/reading-position';

onPageLoad(scope => {
  const prose = document.querySelector<HTMLElement>('.prose[data-reading-id]');
  const banner = document.querySelector<HTMLElement>('#reading-resume');
  const continueButton = document.querySelector<HTMLButtonElement>('#continue-reading');
  const restartButton = document.querySelector<HTMLButtonElement>('#restart-reading');
  const message = document.getElementById('resume-message');

  if (prose && banner && continueButton && restartButton) {
    const key = `portfolio-reading-position:${prose.dataset.readingId}`;
    const headings = Array.from(prose.querySelectorAll<HTMLElement>('h2[id], h3[id]'));
    let saved: ReadingPosition | null = null;
    try { saved = parseReadingPosition(localStorage.getItem(key)); } catch {}
    if (saved && !window.location.hash) {
      if (message) message.textContent = `You were about ${Math.round(saved.progress * 100)}% through this article.`;
      banner.hidden = false;
    }

    const clearPosition = () => {
      try { localStorage.removeItem(key); } catch {}
      saved = null;
      banner.hidden = true;
    };

    const savePosition = () => {
      const rect = prose.getBoundingClientRect();
      const progress = getReadingProgress(rect, window.innerHeight);
      if (progress >= 0.98) { clearPosition(); return; }
      if (progress < 0.03) return;
      let headingIndex = -1;
      headings.forEach((heading, index) => { if (heading.getBoundingClientRect().top <= 120) headingIndex = index; });
      const heading = headings[headingIndex];
      const top = heading?.getBoundingClientRect().top ?? 0;
      const end = headings[headingIndex + 1]?.getBoundingClientRect().top ?? rect.bottom;
      const offset = heading && end > top ? Math.min(1, Math.max(0, (120 - top) / (end - top))) : 0;
      const position: ReadingPosition = { version: 1, progress, heading: heading?.id ?? null, offset };
      try { localStorage.setItem(key, JSON.stringify(position)); } catch {}
    };

    let saveTimer: ReturnType<typeof setTimeout>;
    window.addEventListener('scroll', () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(savePosition, 500);
    }, { passive: true, signal: scope.signal });
    window.addEventListener('pagehide', () => { clearTimeout(saveTimer); savePosition(); }, { signal: scope.signal });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') savePosition(); }, { signal: scope.signal });
    scope.onCleanup(() => { clearTimeout(saveTimer); savePosition(); });

    continueButton.addEventListener('click', () => {
      if (!saved) return;
      const position = saved;
      banner.hidden = true;
      scope.frame(() => {
        const rect = prose.getBoundingClientRect();
        const index = headings.findIndex(heading => heading.id === position.heading);
        const heading = headings[index];
        let top = window.scrollY + rect.top + position.progress * Math.max(0, rect.height - window.innerHeight);
        if (heading) {
          const headingTop = heading.getBoundingClientRect().top;
          const end = headings[index + 1]?.getBoundingClientRect().top ?? rect.bottom;
          top = window.scrollY + headingTop + position.offset * Math.max(0, end - headingTop) - 120;
        }
        window.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
        const target = heading ?? prose;
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      });
    });

    restartButton.addEventListener('click', () => {
      clearPosition();
      window.scrollTo({ top: 0, behavior: 'auto' });
      const title = prose.closest('article')?.querySelector<HTMLElement>('h1');
      title?.setAttribute('tabindex', '-1');
      title?.focus({ preventScroll: true });
    });
  }
});
