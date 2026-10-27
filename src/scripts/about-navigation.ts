import { onPageLoad } from './page-lifecycle';

onPageLoad(scope => {
  const nav = document.querySelector<HTMLElement>('.section-nav');
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('.section-nav a[href^="#"]'));
  const sections = links.flatMap(link => {
    const heading = document.getElementById(link.hash.slice(1));
    return heading ? [{ link, heading }] : [];
  });

  if (nav && sections.length) {
    let scheduled = false;
    let active: HTMLAnchorElement | undefined;
    const update = () => {
      scheduled = false;
      const threshold = Math.max(0, nav.getBoundingClientRect().bottom) + 28;
      let current = sections[0];
      for (const section of sections) {
        if (section.heading.getBoundingClientRect().top <= threshold) current = section;
      }
      if (window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
        current = sections[sections.length - 1];
      }
      if (active === current.link) return;
      active = current.link;
      for (const { link } of sections) {
        if (link === active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      }
      // Keep the active link visible in the mobile bar without moving the page.
      const left = active.offsetLeft;
      const right = left + active.offsetWidth;
      if (left < nav.scrollLeft) nav.scrollLeft = left;
      else if (right > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = right - nav.clientWidth;
    };
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      scope.frame(update);
    };
    window.addEventListener('scroll', schedule, { passive: true, signal: scope.signal });
    window.addEventListener('resize', schedule, { signal: scope.signal });
    window.addEventListener('pageshow', schedule, { signal: scope.signal });
    document.fonts?.ready.then(schedule);
    update();
  }
});
