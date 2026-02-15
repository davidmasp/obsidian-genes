# Obsidian Genes

Opinionated Obsidian plugin for gene lookup and paper-note generation from selected identifiers (DOI, arXiv, bioRxiv). 🧬

Current version: `1.1.0`

## What it does

The plugin currently provides 5 editor commands:

1. `Search selected gene`
Searches the selected text against the NCBI Clinical Tables gene API and replaces the selection with a bullet list of possible gene matches.

2. `Complete gene card`
Uses the current note filename as gene symbol, queries HGNC, and inserts a small gene card block (frontmatter + links + location + Ensembl/NCBI IDs) at the cursor.

3. `DOI search`
Looks up the selected DOI in Europe PMC, builds a paper note from a template, creates a new file, and replaces the selected DOI with a wiki-link to the created note.

4. `Arxiv search`
Looks up the selected arXiv ID via arXiv API, builds a paper note from a template, creates a new file, and replaces the selected ID with a wiki-link.

5. `Biorxiv search`
Looks up the selected DOI via bioRxiv API, builds a paper note from a template, creates a new file, and replaces the selected DOI with a wiki-link.

## Settings

The plugin adds a settings tab with:

- `Number of results`: max gene hits for `Search selected gene` (default: `5`)
- `New files`: folder where article notes are created (default: `articles`)
- `Template file path`: vault path to the article template (default: `templates/article-template.md`)

## Template placeholders

When creating article files, the plugin reads `Template file path` and replaces these placeholders:

- `{{link}}`
- `{{link_chain}}`
- `{{journal}}`
- `{{title}}`
- `{{authors}}`
- `{{abstract}}`
- `{{date_added}}` (YYYY-MM-DD)

If the template file does not exist or cannot be read, it falls back to a built-in template.

## File naming behavior

Created article files are named from provider-specific slugs:

- DOI (Europe PMC): `<FirstAuthorLastName> <JournalName> <Year>.md`
- arXiv: `<FirstAuthor> Arxiv <Year>.md`
- bioRxiv: `<FirstAuthorLastName> Biorxiv <Year>.md`

The plugin checks for duplicates both by target path and by basename across the vault before creating a new note. 📄

## External data sources

- Clinical Tables NCBI genes API
- HGNC REST API (`rest.genenames.org`)
- Europe PMC API
- arXiv API
- bioRxiv API

## Development

Install dependencies:

```bash
npm install
```

Build:

```bash
npm run build
```

Watch mode:

```bash
npm run dev
```

Local helper command used in this repo:

```bash
just localbuild
```

## Notes

- A ribbon icon and status bar item are present, but currently only show sample behavior.
- This plugin is intentionally tailored for a specific research workflow, not a general-purpose literature manager. 🔬
