# Cards

A deliberately minimal Kanban board for [Obsidian](https://obsidian.md) with exactly three columns: **Todo**, **Doing** and **Done**. Works on desktop and mobile (including iOS).

Each board is a plain markdown note, so it stays readable without the plugin and syncs like any other note.

## Usage

- Run **Cards: Create new board** from the command palette (or click the ribbon icon) to create a board note.
- Any note with `cards: true` in its frontmatter opens as a board. You can also right-click a note and choose **Open as board**.
- **+** adds a card to a column.
- Tap a card to edit its title and markdown description.
- **←** / **→** move a card between columns (**↑** / **↓** on phones, where columns stack vertically).
- **×** deletes a card.
- **Cards: Toggle board / markdown view**, or the header button, switches to the raw markdown and back.

In the card editor, Enter in the title saves. In the description, Enter adds a new line and Cmd/Ctrl+Enter saves.

## File format

```markdown
---
cards: true
---
## Todo
- Write blog post
  Draft for **Friday**, see [[Notes]]

  - outline

## Doing
- Plan Q4 roadmap

## Done
- Ship v1.2
```

- Each `- ` list item under one of the three headings is a card.
- Indented lines under a card are its markdown description.
- The board rewrites the note in this format when it saves. Content outside the frontmatter and the three sections is dropped, and task checkboxes (`- [ ]`) are kept as plain items.

## Installing

The plugin is not in the community plugin directory yet. To install it manually:

1. Download `main.js`, `manifest.json` and `styles.css` from the latest CI build, or build them yourself (see below).
2. Copy them into `<vault>/.obsidian/plugins/obsidian-cards/`.
3. Enable **Cards** under **Settings → Community plugins**.

For iOS, install the plugin in a vault on desktop and let Obsidian Sync carry it over. In **Settings → Sync** on both devices, turn on **Installed community plugins** and **Active community plugin list**.

## Development

```sh
npm install
npm test        # unit tests (vitest)
npm run build   # type-check and bundle main.js
npm run dev     # rebuild on change
```

Set `VAULT` to copy the built files straight into a vault after every build:

```sh
VAULT=~/path/to/vault npm run dev
```

The files are copied rather than symlinked because Obsidian Sync doesn't sync symlinks.

## Licence

[MIT](LICENSE)
