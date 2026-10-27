const filters = document.querySelector<HTMLElement>('.project-filters');
const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.project-filters button[data-category]'));
const rows = Array.from(document.querySelectorAll<HTMLElement>('#project-list > li[data-category]'));
const count = document.getElementById('project-count');

if (filters && buttons.length && rows.length) {
  filters.hidden = false;
  buttons.forEach(button => {
    button.addEventListener('click', () => {
      const category = button.dataset.category;
      let visible = 0;
      rows.forEach(row => {
        row.hidden = category !== 'All' && row.dataset.category !== category;
        if (!row.hidden) visible++;
      });
      buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      if (count) count.textContent = category === 'All'
        ? `${visible} ${visible === 1 ? 'project' : 'projects'}`
        : `${visible} of ${rows.length} projects`;
    });
  });
}
