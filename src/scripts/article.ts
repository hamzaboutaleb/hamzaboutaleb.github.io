import { onPageLoad } from './page-lifecycle';
import './reading-memory';
import { getReadingProgress } from '../lib/reading-position';

onPageLoad(scope => {
  const copyButtons = document.querySelectorAll<HTMLButtonElement>('.copy-code');
  if (navigator.clipboard?.writeText) {
    copyButtons.forEach(button => {
      button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>';
      button.title = button.getAttribute('aria-label') ?? 'Copy code';
      button.hidden = false;
      let feedbackTimer: ReturnType<typeof setTimeout>;
      scope.onCleanup(() => clearTimeout(feedbackTimer));
      button.addEventListener('click', async () => {
        const block = button.closest('.code-block');
        const code = block?.querySelector('pre code');
        const status = block?.querySelector<HTMLElement>('.code-feedback');
        if (!code) return;
        clearTimeout(feedbackTimer);
        button.disabled = true;
        if (status) status.textContent = '';
        try {
          await navigator.clipboard.writeText(code.textContent ?? '');
          if (scope.signal.aborted) return;
          if (status) status.textContent = 'Copied';
          feedbackTimer = setTimeout(() => { if (status) status.textContent = ''; }, 2000);
        } catch {
          if (status) status.textContent = 'Couldn’t copy. Select the code to copy it.';
        } finally {
          button.disabled = false;
        }
      });
    });
  }

  const prose = document.querySelector<HTMLElement>('.prose');
  const progress = document.querySelector<HTMLElement>('.reading-progress');
  const fill = document.querySelector<HTMLElement>('#reading-progress-fill');
  const articleTools = document.querySelector<HTMLElement>('.article-tools');
  const toolsSlot = document.querySelector<HTMLElement>('.article-tools-slot');
  const mobileReading = window.matchMedia('(max-width: 760px)');
  let refreshReadingLayout: () => void = () => {};
  const tocEntries = Array.from(document.querySelectorAll<HTMLAnchorElement>('.article-toc a')).map(link => ({
    link,
    heading: document.getElementById(decodeURIComponent(link.hash.slice(1))),
  })).filter(entry => entry.heading);
  if (prose && progress && fill) {
    progress.hidden = false;
    let scheduled = false;
    const updateProgress = () => {
      scheduled = false;
      const rect = prose.getBoundingClientRect();
      const value = getReadingProgress(rect, window.innerHeight);
      fill.style.transform = `scaleX(${value})`;
      if (articleTools && toolsSlot) {
        const shouldDock = mobileReading.matches && toolsSlot.getBoundingClientRect().bottom < 0 && rect.bottom > 120 && articleTools.getBoundingClientRect().height > 0;
        if (shouldDock && articleTools.dataset.docked !== 'true') {
          toolsSlot.style.minHeight = `${toolsSlot.getBoundingClientRect().height}px`;
          articleTools.dataset.docked = 'true';
        } else if (!shouldDock && articleTools.dataset.docked === 'true') {
          delete articleTools.dataset.docked;
          toolsSlot.style.minHeight = '';
        }
      }
      let active = tocEntries[0];
      for (const entry of tocEntries) {
        if (entry.heading!.getBoundingClientRect().top <= 120) active = entry;
      }
      for (const entry of tocEntries) {
        if (entry === active) entry.link.setAttribute('aria-current', 'location');
        else entry.link.removeAttribute('aria-current');
      }
    };
    const scheduleProgress = () => {
      if (!scheduled) { scheduled = true; scope.frame(updateProgress); }
    };
    refreshReadingLayout = scheduleProgress;
    window.addEventListener('scroll', scheduleProgress, { passive: true, signal: scope.signal });
    window.addEventListener('resize', scheduleProgress, { signal: scope.signal });
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(scheduleProgress);
      observer.observe(prose);
      scope.onCleanup(() => observer.disconnect());
    }
    document.fonts?.ready.then(scheduleProgress);
    updateProgress();
  }

  const readingControls = document.querySelector<HTMLElement>('.reading-controls');
  const sizeButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.reading-controls button'));
  if (readingControls && sizeButtons.length) {
    readingControls.hidden = false;
    const applyReadingSize = (size: string) => {
      const value = size === 'large' ? 'large' : 'normal';
      document.documentElement.dataset.readingSize = value;
      sizeButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.readingSize === value)));
      refreshReadingLayout();
    };
    applyReadingSize(document.documentElement.dataset.readingSize ?? 'normal');
    sizeButtons.forEach(button => button.addEventListener('click', () => {
      const size = button.dataset.readingSize === 'large' ? 'large' : 'normal';
      applyReadingSize(size);
      try { localStorage.setItem('portfolio-reading-size', size); } catch {}
    }));
  }

  const focusToggle = document.querySelector<HTMLButtonElement>('#focus-toggle');
  const exitFocus = document.querySelector<HTMLButtonElement>('#exit-focus');
  if (focusToggle && exitFocus) {
    const root = document.documentElement;
    const setFocusMode = (enabled: boolean) => {
      const anchor = Array.from(prose?.querySelectorAll<HTMLElement>('h2, h3, p, figure, blockquote, table, li') ?? [])
        .find(element => element.getBoundingClientRect().bottom > 0);
      const previousTop = anchor?.getBoundingClientRect().top;
      if (enabled) root.dataset.focusMode = 'true';
      else delete root.dataset.focusMode;
      focusToggle.setAttribute('aria-pressed', String(enabled));
      exitFocus.hidden = !enabled;
      if (enabled) exitFocus.focus({ preventScroll: true });
      else focusToggle.focus({ preventScroll: true });
      scope.frame(() => {
        if (anchor && previousTop !== undefined) window.scrollBy(0, anchor.getBoundingClientRect().top - previousTop);
        refreshReadingLayout();
      });
    };
    focusToggle.hidden = false;
    focusToggle.addEventListener('click', () => setFocusMode(root.dataset.focusMode !== 'true'));
    exitFocus.addEventListener('click', () => setFocusMode(false));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !event.defaultPrevented && !event.isComposing && root.dataset.focusMode === 'true') {
        event.preventDefault();
        setFocusMode(false);
      }
    }, { signal: scope.signal });
  }
});
