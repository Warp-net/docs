# Warpnet documentation

Source of the Warpnet documentation published at **https://warp-net.github.io/docs/**. Created by LLM.

The site is plain Markdown built by GitHub Pages (Jekyll) from the `main` branch.
Every push to `main` republishes it; there is no separate build step to run.

## Layout

| Path | What it is |
|---|---|
| `*.md`, `user-guide/`, `developer-guide/`, `legal/` | documentation pages |
| `_data/navigation.yml` | sidebar, docs home grid and previous/next order |
| `_layouts/`, `_includes/` | page templates (sidebar, language switcher, home grid) |
| `assets/css/style.scss` | theme, same palette and font as warpnet.site |
| `assets/js/docs.js` | table of contents, heading anchors, copy buttons, Mermaid diagrams |
| `assets/` | images used by pages |

## Languages

English pages live at the repository root; their Russian twins live under `ru/` with the same
path and file name (`security.md` → `ru/security.md`). The language switcher links each page to
its twin and falls back to the other language's home page when a twin is missing.

- Pages under `ru/` get `lang: ru` automatically (see `defaults` in `_config.yml`).
- Russian headings carry the English anchor explicitly, e.g. `## Модель угроз {#threat-model}`,
  so `page.md#anchor` links work in both languages.
- Sidebar titles are in `_data/navigation.yml` (`title` / `title_ru`); UI strings in `_data/i18n.yml`.
- When you change an English page, update its Russian twin in the same pull request.

## Adding or editing a page

1. Create or edit a `.md` file. Start it with front matter:

   ```markdown
   ---
   title: Page Title
   description: One sentence shown on the docs home card and in search results.
   ---

   # Page Title
   ```

2. Link other pages with relative Markdown links that keep the `.md`
   extension, e.g. `[Protocol](protocol.md)` or `[Protocol](../protocol.md)`.
3. Add the page to `_data/navigation.yml` (with `title_ru`) so it shows up in the sidebar and on the docs home, and add its Russian twin under `ru/`.
4. Diagrams: a ```` ```mermaid ```` fenced block is rendered as a diagram.
5. Callouts: a blockquote followed by `{: .note }` or `{: .warning }`.
6. Renamed a page? Add the old URL to the new page's front matter so old links keep working:

   ```yaml
   redirect_from:
     - /old-name.html
   ```

## Local preview

With Docker, no Ruby setup needed:

```bash
docker run --rm -it -p 4000:4000 -v "$PWD":/srv/jekyll -w /srv/jekyll ruby:3.3 \
  bash -lc "bundle install && bundle exec jekyll serve --host 0.0.0.0 --force_polling"
```

With a local Ruby 3.x: `bundle install && bundle exec jekyll serve`.

Then open http://localhost:4000/docs/.

## Contributing

Corrections are welcome: use the "Edit this page on GitHub" link at the bottom of any page,
or open an issue. Facts in these docs should match the code in
[Warp-net/warpnet](https://github.com/Warp-net/warpnet).
