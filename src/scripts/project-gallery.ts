import { onPageLoad } from './page-lifecycle';

interface Gallery {
  name: string;
  slides: HTMLAnchorElement[];
  goTo: (index: number, smooth?: boolean) => void;
}

onPageLoad(scope => {
  if (!document.getElementById('project-image-viewer')) return;
  const viewer = document.querySelector<HTMLDialogElement>('#project-image-viewer');
  const viewerImage = viewer?.querySelector<HTMLImageElement>('[data-viewer-image]');
  const viewerTitle = viewer?.querySelector<HTMLElement>('#image-viewer-title');
  const viewerCaption = viewer?.querySelector<HTMLElement>('[data-viewer-caption]');
  const viewerCount = viewer?.querySelector<HTMLElement>('[data-viewer-count]');
  const viewerStatus = viewer?.querySelector<HTMLElement>('[data-viewer-status]');
  const viewerPrev = viewer?.querySelector<HTMLButtonElement>('[data-viewer-prev]');
  const viewerNext = viewer?.querySelector<HTMLButtonElement>('[data-viewer-next]');
  const viewerClose = viewer?.querySelector<HTMLButtonElement>('[data-viewer-close]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let activeGallery: Gallery | undefined;
  let activeIndex = 0;
  let opener: HTMLAnchorElement | undefined;
  let previousOverflow = '';
  scope.onCleanup(() => {
    if (!viewer?.open) return;
    activeGallery = undefined;
    opener = undefined;
    viewer.close();
    document.documentElement.style.overflow = previousOverflow;
  });

  const showImage = (index: number) => {
    if (!activeGallery || !viewerImage || !viewerPrev || !viewerNext) return;
    activeIndex = Math.max(0, Math.min(index, activeGallery.slides.length - 1));
    const slide = activeGallery.slides[activeIndex];
    const alt = slide.querySelector('img')?.alt ?? '';
    viewerImage.hidden = true;
    if (viewerStatus) viewerStatus.textContent = 'Loading image…';
    viewerImage.alt = alt;
    viewerImage.src = slide.href;
    if (viewerTitle) viewerTitle.textContent = activeGallery.name;
    if (viewerCaption) viewerCaption.textContent = alt;
    if (viewerCount) viewerCount.textContent = `${activeIndex + 1} / ${activeGallery.slides.length}`;
    viewerPrev.hidden = viewerNext.hidden = activeGallery.slides.length === 1;
    // Keep arrow buttons focusable while browsing; clamp navigation at either end.
    viewerPrev.setAttribute('aria-disabled', String(activeIndex === 0));
    viewerNext.setAttribute('aria-disabled', String(activeIndex === activeGallery.slides.length - 1));
  };

  viewerImage?.addEventListener('load', () => {
    viewerImage.hidden = false;
    if (viewerStatus) viewerStatus.textContent = '';
  });
  viewerImage?.addEventListener('error', () => {
    viewerImage.hidden = true;
    if (viewerStatus) viewerStatus.textContent = 'This image couldn’t load. Try another image or close the viewer.';
  });
  viewerPrev?.addEventListener('click', () => { if (activeIndex > 0) showImage(activeIndex - 1); });
  viewerNext?.addEventListener('click', () => {
    if (activeGallery && activeIndex < activeGallery.slides.length - 1) showImage(activeIndex + 1);
  });
  viewerClose?.addEventListener('click', () => viewer?.close());
  viewer?.addEventListener('click', event => { if (event.target === viewer) viewer.close(); });
  viewer?.addEventListener('keydown', event => {
    if (!activeGallery || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
    const index = event.key === 'ArrowLeft' ? activeIndex - 1
      : event.key === 'ArrowRight' ? activeIndex + 1
      : event.key === 'Home' ? 0
      : event.key === 'End' ? activeGallery.slides.length - 1 : undefined;
    if (index === undefined) return;
    event.preventDefault();
    showImage(index);
  });
  viewer?.addEventListener('close', () => {
    if (scope.signal.aborted) return;
    document.documentElement.style.overflow = previousOverflow;
    activeGallery?.goTo(activeIndex, false);
    opener?.focus({ preventScroll: true });
    activeGallery = undefined;
  });

  document.querySelectorAll<HTMLElement>('.project-gallery').forEach(element => {
    const track = element.querySelector<HTMLElement>('.gallery-track');
    const slides = Array.from(element.querySelectorAll<HTMLAnchorElement>('.gallery-slide'));
    const controls = element.querySelector<HTMLElement>('.gallery-controls');
    const count = element.querySelector<HTMLElement>('.gallery-count');
    const prev = element.querySelector<HTMLButtonElement>('[data-gallery-prev]');
    const next = element.querySelector<HTMLButtonElement>('[data-gallery-next]');
    const dots = Array.from(element.querySelectorAll<HTMLButtonElement>('[data-gallery-index]'));
    if (!track || !slides.length) return;
    let current = 0;
    let scheduled = false;
    const update = () => {
      scheduled = false;
      if (!track.clientWidth) return;
      current = Math.max(0, Math.min(slides.length - 1, Math.round(track.scrollLeft / track.clientWidth)));
      if (count) count.textContent = `${current + 1} / ${slides.length}`;
      if (prev) prev.disabled = current === 0;
      if (next) next.disabled = current === slides.length - 1;
      dots.forEach((dot, index) => dot.setAttribute('aria-pressed', String(index === current)));
    };
    const gallery: Gallery = {
      name: element.dataset.projectName ?? 'Project images',
      slides,
      goTo(index, smooth = true) {
        current = Math.max(0, Math.min(slides.length - 1, index));
        track.scrollTo({ left: current * track.clientWidth, behavior: smooth && !reducedMotion.matches ? 'smooth' : 'instant' });
      },
    };
    if (controls) controls.hidden = false;
    if (prev) prev.hidden = false;
    if (next) next.hidden = false;
    prev?.addEventListener('click', () => gallery.goTo(current - 1));
    next?.addEventListener('click', () => gallery.goTo(current + 1));
    dots.forEach((dot, index) => dot.addEventListener('click', () => gallery.goTo(index)));
    track.addEventListener('scroll', () => {
      if (scheduled) return;
      scheduled = true;
      scope.frame(update);
    }, { passive: true });
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(update);
      observer.observe(track);
      scope.onCleanup(() => observer.disconnect());
    }
    slides.forEach((slide, index) => {
      slide.addEventListener('click', event => {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
        if (!viewer || !viewerImage || typeof viewer.showModal !== 'function') return;
        event.preventDefault();
        activeGallery = gallery;
        opener = slide;
        previousOverflow = document.documentElement.style.overflow;
        showImage(index);
        viewer.showModal();
        document.documentElement.style.overflow = 'hidden';
      });
    });
    update();
  });
});
