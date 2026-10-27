# Portfolio

A minimal static Astro portfolio. The homepage fills the viewport and offers four destinations: Projects, Blog, About, and Contact me.

```sh
npm install
npm run dev
```

- `src/pages/index.astro`: full-screen introduction and navigation.
- `src/pages/projects.astro`: projects page.
- `src/pages/blog.astro`: blog page.
- `src/pages/about.astro`: about page.
- `src/pages/contact.astro`: contact page.
- `src/layouts/Layout.astro`: shared document, styles, and inner-page navigation.
- `src/components/DestinationNav.astro`: shared homepage and compact inner-page navigation.
- `src/data/contact.ts`: public GitHub URL, LinkedIn URL, and email for the footer. Empty entries are hidden.

Project and about content are placeholders. The blog is ready for Markdown articles and starts with no published posts. The contact page includes a direct email link. No backend is required. Manrope loads from Google Fonts with a system-font fallback. A small theme script follows the system appearance by default and remembers manual light/dark mode choices in local storage. The theme also follows the system when JavaScript is disabled. All pages include a small copyright footer.

```sh
npm run build
npm run preview
```

Static output is in `dist/`.

## GitHub Pages deployment

The repository is `hamzaboutaleb/hamzaboutaleb.github.io`, published at `https://hamzaboutaleb.github.io`. The workflow in `.github/workflows/deploy.yml` builds Astro with Node 24 and deploys the generated site whenever changes are pushed to `main`. It can also be started manually from the Actions tab.

In the repository’s **Settings → Pages → Build and deployment**, set **Source** to **GitHub Actions**. The default branch-based Jekyll build does not build the Astro source. Commit and push the deployment workflow and `astro.config.mjs` changes to trigger the first Astro deployment.

No `base` prefix is needed for this repository name. `SITE_URL` can override the site URL when moving to a custom domain.

The homepage uses a four-column destination row on desktop and a 2×2 grid on mobile, with a single-column fallback on very narrow screens. Astro’s `ClientRouter` handles internal navigation and browser Back/Forward without full document reloads. In supported browsers, the name and navigation move between their homepage and compact positions over 480ms when entering or leaving home. Inner-page navigation skips snapshot animations, keeping the name and menu still. All snapshot pairs use normal blending without cross-fades, and the transition overlay keeps the page’s background color. Unsupported browsers swap content without animation, and reduced-motion preferences disable animations. Downloads, image-file fallbacks, and external links keep their normal browser behavior. Without JavaScript, the static pages still support normal links.

The theme palette and initial theme setup are inline before external stylesheets. During `astro:before-swap`, the incoming document receives the active theme and reading-size preference before Astro replaces the root attributes. Theme controls rebind on `astro:page-load`; the theme also reapplies on `astro:after-swap`. Scrollbar space stays reserved to avoid horizontal movement between short and long pages.

Page controls initialize through `src/scripts/page-lifecycle.ts`. Before leaving a page, global listeners are aborted, observers disconnect, animation frames and timers are cleared, and reading positions are saved. Focus mode resets on navigation. The site still builds as static HTML for GitHub Pages.

Homepage keyboard shortcuts: `1` Projects, `2` Blog, `3` About, `4` Contact. Shortcuts work without visible hints or controls and ignore typing fields, interactive form controls, modifier keys, composition, and held-key repeats.

The first and last name also transition from the large homepage heading into the compact home link, alongside the navigation. Each word has its own transition name so the two-line heading can move into a single line without stretching the full text block.

The homepage has no entrance fade. The underscore in the hero and compact name blinks slowly for three cycles on every page load, respecting reduced-motion preferences. Name and navigation transitions remain active.

## Page metadata & social previews

Each page defines its own description. The shared layout adds Open Graph and Twitter metadata. The preview image is `public/social-preview.png`; its editable source is `public/social-preview.svg`.

The public origin defaults to `https://hamzaboutaleb.github.io`. To use a custom domain, set `SITE_URL` when building:

```sh
SITE_URL=https://your-domain.com npm run build
```

Canonical links and absolute social-image URLs use this public origin, including during local builds, so local development URLs are not published.


## Writing a blog post

Create a Markdown file in `src/content/blog/`, such as `my-post.md`, with frontmatter and article text:

```md
---
title: "Your article title"
description: "A short summary for the list and sharing previews."
pubDate: "2026-10-26"
draft: false
---

Write your article in Markdown here.
```

The filename determines its URL: `my-post.md` becomes `/blog/my-post/`. Posts appear newest first. Drafts and future-dated posts are excluded from both the list and generated article pages. Rebuild the site to publish changes; scheduled dates also require a rebuild after the date arrives.

The article layout includes dates, approximate reading time, code blocks, tables, quotations, and article-specific sharing metadata. It uses the same navigation, theme toggle, and footer as the rest of the site.

## Article tools

- A table of contents uses the article’s level-two and level-three headings. It stays in a sticky right sidebar on desktop, highlights the current section as you scroll, and becomes a collapsible list above the article on smaller screens.
- Code blocks show language labels generated by `src/plugins/code-blocks.mjs`. Copy buttons appear when the browser supports clipboard access and give success or failure feedback.
- Long code lines wrap by default, including without JavaScript. Wrapping changes only whitespace styling, preserves indentation, and leaves copied code unchanged.
- Previous/next links follow the published-post order and exclude drafts and future-dated posts.
- A thin progress bar tracks the article body as you scroll and recalculates after resizing or content-size changes.
- Default/larger text controls near the article header remember the reader’s preference in local storage. Body text, headings, code, and tables scale together; reading progress and the active contents link update after a size change.
- Focus mode hides site navigation, the footer, the contents sidebar, and end-of-article links while keeping the article centered. A fixed exit button and Escape restore the normal layout. Focus mode applies only to the current page and preserves the visible reading position when toggled.
- Related reading shows up to three published posts with shared `tags`, ranked by overlap and then publication date. The current post, drafts, future posts, and unrelated posts are excluded. Add a frontmatter field such as `tags: ["Web development", "Learning"]`; the related section is hidden when no matches exist.

Client behavior is in `src/scripts/article.ts`; article markup and styling are in `src/pages/blog/[...id].astro`.

## Reading memory and article images

Unfinished reading positions are saved locally per article. Returning readers can choose **Continue reading** or **Start over**; the page never jumps automatically. Memory tracks a section and relative offset, with a whole-article fallback if that section changes. Finishing clears the bookmark, and direct section links take priority. Storage failures do not prevent reading.

Markdown images referenced from `public/` automatically receive dimensions at build time through `src/plugins/article-images.mjs`. Images stored beside Markdown in `src/` use Astro’s built-in image handling. Images default to lazy loading and asynchronous decoding, and have a subtle background while loading. If writing a raw HTML image or using a remote image, provide its actual `width` and `height` to reserve the correct space.

On mobile, the existing reading toolbar docks above the safe-area inset after its header position scrolls offscreen. A placeholder preserves the article layout, and the toolbar returns to the header when scrolling back or switching to desktop width. It stops docking once the article body has passed. The controls keep their state and keyboard focus because the same elements are reused.

Code toolbars use an accessible Copy icon with a tooltip and live success/error feedback. Article paragraphs, lists, quotes, and related-reading sections use consistent spacing that scales with the reading-size setting.

The blog index includes a search field between the name and theme toggle on desktop, with a full-width second header row on mobile. It filters published posts locally by title, description, and all tags, supports case/accent-insensitive multi-word queries, announces result counts, and provides a clear action for empty results. Other pages, including article pages, do not render this field. With JavaScript disabled, all posts remain visible.

## Project images

Project content lives in `src/data/projects.ts`. Each project can optionally have an `images` array. Put screenshots in `public/images/projects/` and reference them like this (use the actual image dimensions):

```ts
images: [
  { src: '/images/projects/7irafi-home.webp', alt: '7irafi home page with local service listings', width: 1440, height: 900 },
  { src: '/images/projects/7irafi-chat.webp', alt: 'A conversation between a client and a professional', width: 1440, height: 900 },
],
```

Omit `images` or use an empty array for projects without screenshots. Galleries support scrolling and touch swipes, previous/next controls, and a large modal viewer with captions. In the viewer, use arrow keys, Home/End, the close button, or Escape. Closing restores page scrolling and focus. Without JavaScript, screenshots still scroll and link directly to the original images. Images load lazily and retain their full proportions. Source links can be added separately with `sources: [{ label: 'Source code', href: 'https://github.com/owner/repository' }]`.
