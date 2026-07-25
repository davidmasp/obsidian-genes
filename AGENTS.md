# Agent Notes

## Project

Obsidian Genes is an Obsidian plugin for gene lookup and paper-note generation from selected DOI, URL, arXiv, and bioRxiv identifiers.

Core source files live at the repository root:

- `main.ts`: plugin commands and Obsidian integration
- `utils.ts`: provider/API helpers
- `templates.ts`: article-note template fallback
- `manifest.json`: Obsidian plugin metadata

## Development

- Install dependencies with `npm install`.
- Build with `npm run build`.
- Use `npm run dev` for watch mode.
- Use `just localbuild` to build and copy the plugin into the configured local Obsidian vault.

## Documentation

- Project documentation lives in `README.md`.

## Commits

- Commit only when explicitly told to commit.
- When committing, include yourself as a co-author with a `Co-authored-by:` trailer.
- For Codex, use `Co-authored-by: Codex <codex@openai.com>`.
