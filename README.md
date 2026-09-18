# Obsidian Genes

Opinionated Obsidian plugin for gene lookup and paper-note generation from selected identifiers (DOI, arXiv, bioRxiv). 🧬

Current version: `1.1.0`

## What it does

The plugin currently provides 7 editor commands:

1. `Search selected gene`
Searches the selected text against the NCBI Clinical Tables gene API and replaces the selection with a bullet list of possible gene matches.

2. `Complete gene card`
Uses the current note filename as gene symbol, queries HGNC, and inserts a small gene card block (frontmatter + links + location + Ensembl/NCBI IDs) at the cursor.

3. `DOI search`
Looks up the selected DOI in Europe PMC, builds a paper note from a template, creates a new file, and replaces the selected DOI with a wiki-link to the created note.

4. `DOI list search`
Processes a selected newline-separated DOI list through the same Europe PMC workflow as `DOI search`, then replaces the original list with the created wiki-links.

5. `URL DOI search`
Fetches the selected URL, extracts a DOI from publisher metadata or page text, then runs the same Europe PMC workflow as `DOI search`.

6. `Arxiv search`
Looks up the selected arXiv ID via arXiv API, builds a paper note from a template, creates a new file, and replaces the selected ID with a wiki-link.

7. `Biorxiv search`
Looks up the selected DOI via bioRxiv API, builds a paper note from a template, creates a new file, and replaces the selected DOI with a wiki-link.

## Settings

The plugin adds a settings tab with:

- `Number of results`: max gene hits for `Search selected gene` (default: `5`)
- `New files`: folder where article notes are created (default: `articles`)
- `Template file path`: vault path to the article template (default: `templates/article-template.md`)
- `Gene template file path`: vault path to the gene card template (default: `templates/gene-template.md`)

## Template placeholders

When creating article files, the plugin reads `Template file path` and replaces these placeholders:

- `{{link}}`
- `{{link_chain}}`
- `{{journal}}`
- `{{title}}`
- `{{authors}}`
- `{{abstract}}`
- `{{doi}}`
- `{{date_added}}` (YYYY-MM-DD)

If the template file does not exist or cannot be read, it falls back to a built-in template.

When completing gene cards, the plugin reads `Gene template file path` and replaces these placeholders:

- `{{symbol}}`
- `{{genename}}`
- `{{hgnc_id}}`
- `{{hgnc_url}}`
- `{{ncbi_gene_id}}`
- `{{ncbi_url}}`
- `{{ensembl_gene_id}}`
- `{{ensembl_url}}`
- `{{location}}`
- `{{date_added}}` (YYYY-MM-DD)

Default gene template:

```markdown
---
genename: {{genename}}
tags:
  - gene
---

* links: [HGNC]({{hgnc_url}}), [NCBI]({{ncbi_url}})
* location: {{location}}
* ensembl gene id: {{ensembl_gene_id}}
```

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
