interface PageScope {
  signal: AbortSignal;
  onCleanup: (callback: () => void) => void;
  frame: (callback: FrameRequestCallback) => number;
}

// Modules run once; controls must initialize against each page's new DOM.
export function onPageLoad(initialize: (scope: PageScope) => void) {
  let dispose = () => {};
  document.addEventListener('astro:before-swap', () => dispose());
  document.addEventListener('astro:page-load', () => {
    dispose();
    const controller = new AbortController();
    const cleanups: (() => void)[] = [];
    const frames = new Set<number>();
    dispose = () => {
      if (controller.signal.aborted) return;
      controller.abort();
      frames.forEach(cancelAnimationFrame);
      frames.clear();
      cleanups.forEach(cleanup => cleanup());
      cleanups.length = 0;
    };
    initialize({
      signal: controller.signal,
      onCleanup(callback) {
        if (controller.signal.aborted) callback();
        else cleanups.push(callback);
      },
      frame(callback) {
        if (controller.signal.aborted) return 0;
        const id = requestAnimationFrame(time => {
          frames.delete(id);
          if (!controller.signal.aborted) callback(time);
        });
        frames.add(id);
        return id;
      },
    });
  });
}
