import { onPageLoad } from './page-lifecycle';

onPageLoad(scope => {
  const searchForm = document.querySelector<HTMLFormElement>('.blog-search');
  const searchInput = document.querySelector<HTMLInputElement>('#blog-search');
  const postRows = Array.from(document.querySelectorAll<HTMLElement>('#blog-post-list > li[data-search]'));
  const count = document.getElementById('blog-post-count');
  const empty = document.getElementById('blog-no-results');
  const clear = document.getElementById('clear-blog-search');
  const inlineClear = document.getElementById('clear-search-input');
  const tagButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.post-tags button[data-tag]'));
  const tagFilter = document.getElementById('blog-tag-filter');
  const selectedTagLabel = document.getElementById('selected-blog-tag');
  const clearTag = document.getElementById('clear-blog-tag');

  const normalize = (value: string) => value.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

  if (searchForm && searchInput && postRows.length) {
    searchForm.hidden = false;
    let selectedTag = '';
    const posts = postRows.map(element => ({
      element,
      text: normalize(element.dataset.search ?? ''),
      tags: (JSON.parse(element.dataset.tags ?? '[]') as string[]).map(normalize),
    }));
    const filterPosts = () => {
      const query = normalize(searchInput.value);
      const terms = query.split(/\s+/).filter(Boolean);
      let visible = 0;
      posts.forEach(post => {
        const matches = (!selectedTag || post.tags.includes(normalize(selectedTag))) && terms.every(term => post.text.includes(term));
        post.element.hidden = !matches;
        if (matches) visible++;
      });
      if (count) count.textContent = query || selectedTag ? `${visible} of ${posts.length} posts` : `${posts.length} ${posts.length === 1 ? 'post' : 'posts'}`;
      if (empty) empty.hidden = visible !== 0;
      if (inlineClear) inlineClear.hidden = searchInput.value.length === 0;
      if (tagFilter) tagFilter.hidden = !selectedTag;
      if (selectedTagLabel) selectedTagLabel.textContent = selectedTag;
      tagButtons.forEach(button => button.setAttribute('aria-pressed', String(!!selectedTag && normalize(button.dataset.tag ?? '') === normalize(selectedTag))));
    };
    tagButtons.forEach(button => {
      button.disabled = false;
      button.addEventListener('click', () => {
        selectedTag = normalize(selectedTag) === normalize(button.dataset.tag ?? '') ? '' : button.dataset.tag ?? '';
        filterPosts();
        // The clicked article can disappear when changing topics.
        if (button.closest<HTMLElement>('li[data-search]')?.hidden) clearTag?.focus();
      });
    });
    clearTag?.addEventListener('click', () => {
      selectedTag = '';
      filterPosts();
      searchInput.focus();
    });
    searchInput.addEventListener('input', filterPosts);
    searchForm.addEventListener('submit', event => event.preventDefault());
    const clearSearch = () => {
      searchInput.value = '';
      filterPosts();
      searchInput.focus();
    };
    clear?.addEventListener('click', () => {
      selectedTag = '';
      clearSearch();
    });
    inlineClear?.addEventListener('click', clearSearch);
    searchInput.addEventListener('keydown', event => {
      if (event.key === 'Escape' && searchInput.value && !event.isComposing) {
        event.preventDefault();
        clearSearch();
      }
    });
    window.addEventListener('pageshow', filterPosts, { signal: scope.signal });
    filterPosts();
  }
});
