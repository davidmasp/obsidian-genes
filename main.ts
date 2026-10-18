
import { TFile, App, Editor, MarkdownEditView, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, Vault, requestUrl } from 'obsidian';
import { extractDoiFromUrl, buildEuropePmcMetadata, buildCrossrefMetadata, fetchCrossrefWork, parseArxivXML } from './utils';
import type { PaperMetadata } from './utils';
import { generateArticleTemplate, generateGeneTemplate } from './templates';

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	hsNumber: string;
	newFilesFolder: string;
	templatePath: string;
	geneTemplatePath: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	hsNumber: '5',
	newFilesFolder: 'articles',
	templatePath: 'templates/article-template.md',
	geneTemplatePath: 'templates/gene-template.md'
}

function sanitizeFileNameSegment(value: string): string {
	return value
		.replace(/[\u0000-\u001f]/g, ' ')
		.replace(/[\\/:]/g, ' ')
		.replace(/\s+/g, ' ')
		.replace(/^\.+/, '')
		.replace(/\.+$/, '')
		.trim();
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Genes', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('This is a notice hellow!');
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');


		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'selection-search-genes',
			name: 'Search selected gene',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				const number_of_hits = this.settings.hsNumber;
				console.log(number_of_hits);
				const selection = editor.getSelection();
				console.log(selection);

				const response = await fetch(`https://clinicaltables.nlm.nih.gov/api/ncbi_genes/v3/search?terms=${selection}&maxList=${number_of_hits}`);
				const data = await response.json();

				const geneList = data[3].map((genes: Array<string>) => {
					// console.log(genes);
					const gene_symbol: string = genes[3];
					const type: string = genes[5];
					const full_name: string = genes[4];
					// const hgnc_id: string = genes[1];
					//
					console.log(gene_symbol);
					return `* [[${gene_symbol}]] - ${full_name} (${type})`
				}).join('\n');
				const result = `Possible genes:\n${geneList}`;

				editor.replaceSelection(result);
			}
		});

		this.addCommand({
			id: 'fill-gene-card',
			name: 'Complete gene card',
			editorCallback: async (editor: Editor, view: MarkdownEditView) => {

				const fbase = view.file.basename;
				console.log(fbase);

				const query_url = `https://clinicaltables.nlm.nih.gov/api/ncbi_genes/v3/search?terms=${fbase}&sf=Symbol&maxList=1`;
				const response = await fetch(query_url);
				const data = await response.json();

				if (data[3].length < 1) {
					new ErrorGeneSymbol(this.app).open();
					return;
				}
				const hgnc_id = data[1][0];
				const hgnc_url = `https://rest.genenames.org/fetch/hgnc_id/${hgnc_id}`;
				const hgncReportUrl = `https://www.genenames.org/data/gene-symbol-report/#!/hgnc_id/${hgnc_id}`;

				const hgncResponse = await fetch(hgnc_url, {
					headers: {
						'Accept': 'application/json'
					}
				});
				const hgncData = await hgncResponse.json();
				const geneInfo = hgncData.response.docs[0];
				const location = geneInfo.location || "";
				const ensemblGeneId = geneInfo.ensembl_gene_id || "";
				const ncbiGeneId = geneInfo.entrez_id || "";
				const genename = geneInfo.name || "";

				const geneText = await generateGeneTemplate(
					this.app.vault,
					this.settings.geneTemplatePath,
					{
						symbol: fbase,
						genename,
						hgncId: hgnc_id,
						hgncUrl: hgncReportUrl,
						ncbiGeneId,
						ncbiUrl: `https://www.ncbi.nlm.nih.gov/gene/${ncbiGeneId}`,
						ensemblGeneId,
						ensemblUrl: ensemblGeneId ? `https://www.ensembl.org/Homo_sapiens/Gene/Summary?g=${ensemblGeneId}` : "",
						location
					}
				);

				editor.replaceRange(
					geneText,
					editor.getCursor()
				);
			}
		});

		this.addCommand({
			id: 'retrieve-doi-info',
			name: 'DOI search',
			editorCallback: async (editor: Editor, view: MarkdownEditView) => {
				const selection = editor.getSelection();
				await this.createArticleFromDoi(selection, editor);
			}
		});

		this.addCommand({
			id: 'retrieve-doi-list-info',
			name: 'DOI list search',
			editorCallback: async (editor: Editor, view: MarkdownEditView) => {
				const selection = editor.getSelection();
				await this.createEuropePmcArticlesFromDoiList(selection, editor);
			}
		});

		this.addCommand({
			id: 'retrieve-url-doi-info',
			name: 'URL DOI search',
			editorCallback: async (editor: Editor, view: MarkdownEditView) => {
				const selection = editor.getSelection().trim();

				try {
					const doi = await extractDoiFromUrl(selection);
					if (!doi) {
						new ErrorNoDoiInUrl(this.app).open();
						return;
					}

					await this.createArticleFromDoi(doi, editor);
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error);
					new ErrorDoiExtraction(this.app, errorMessage).open();
					console.error(`Failed to extract DOI from URL: ${errorMessage}`);
				}
			}
		});

		this.addCommand({
			id: 'retrieve-arxiv-info',
			name: 'Arxiv search',
			editorCallback: async (editor: Editor, view: MarkdownEditView) => {
				const selection = editor.getSelection();

				const query_url = `https://export.arxiv.org/api/query?id_list=${selection}`;
				const response = await requestUrl({ url: query_url });
				const data = response.text;

				const paperInfo = parseArxivXML(data);

				if (!paperInfo) {
					new ErrorNoPaperArxiv(this.app).open();
					return;
				}

				const { title, summary, authors, year, id } = paperInfo;

				const articleTxt = await generateArticleTemplate(
					this.app.vault,
					this.settings.templatePath,
				 	id,
					`[Arxiv](${id})`,
					"Arxiv",
					title,
					authors,
					summary
				)

				const folder = this.settings.newFilesFolder.replace(/\/+$/, '');
				const rawSlug = `${authors.split(",")[0]} Arxiv ${year}`;
				const slug = sanitizeFileNameSegment(rawSlug);
				if (!slug) {
					new ErrorInvalidArticleName(this.app, rawSlug).open();
					return;
				}
				const fileName = `${slug}.md`;
				const filePath = `${folder}/${fileName}`;

				// check if file exists in that specific path
				const vault = this.app.vault;
				const fileExists = await vault.adapter.exists(filePath);
				if (fileExists) {
					console.log(`File already exists at: ${filePath}`);
					new ErrorArticleAlreadyExists(this.app, fileName).open();
					return;
				}

				const all_files: TFile[] = await vault.getFiles();
				console.log(all_files.length);
				const vaultFileExists = all_files.some(file => file.basename === slug);
				
				if (vaultFileExists) {
					console.log(`File already exists with basename: ${fileName}`);
					new ErrorArticleAlreadyExistsInVault(this.app, fileName).open();
					return;
				}

				try {
					const fileobj: TFile = await this.app.vault.create(filePath, articleTxt);
					console.log(`File created at: ${fileobj.path}`);
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error);
					new ErrorArticleCreation(this.app, errorMessage).open();
					console.error(`Failed to create file: ${errorMessage}`);
					return;
				}

				const txtback = `[[${slug}]]`;
				editor.replaceSelection(txtback);
			}
		});

		this.addCommand({
			id: 'retrieve-biorxiv-info',
			name: 'Biorxiv search',
			editorCallback: async (editor: Editor, view: MarkdownEditView) => {
				const selection = editor.getSelection();

				const query_url = `https://api.biorxiv.org/details/biorxiv/${selection}/na/json`;
				const response = await fetch(query_url);
				const data = await response.json();

				if (!data.collection || data.collection.length === 0) {
					new ErrorNoPaperBiorxiv(this.app).open();
					return;
				}

				const paper = data.collection[0];
				const title = paper.title || "";
				const abstract = (paper.abstract || "").replace(/\n\n/g, " ");
				const authors = paper.authors || "";
				const doi = paper.doi || selection.trim();
				const date = paper.date || "";
				const year = date.split("-")[0];

				const doiUrl = `https://doi.org/${doi}`;
				const masterLink = doiUrl;
				const linkChain = `[Biorxiv](https://www.biorxiv.org/content/${doi})`;

				const articleTxt = await generateArticleTemplate(
					this.app.vault,
					this.settings.templatePath,
					masterLink,
					linkChain,
					"Biorxiv",
					title,
					authors,
					abstract,
					doi
				)

				const folder = this.settings.newFilesFolder.replace(/\/+$/, '');
				// Get first author's last name (authors are semicolon separated)
				const firstAuthor = authors.split(";")[0].split(",")[0].trim();
				const rawSlug = `${firstAuthor} Biorxiv ${year}`;
				const slug = sanitizeFileNameSegment(rawSlug);
				if (!slug) {
					new ErrorInvalidArticleName(this.app, rawSlug).open();
					return;
				}
				const fileName = `${slug}.md`;
				const filePath = `${folder}/${fileName}`;

				// check if file exists in that specific path
				const vault = this.app.vault;
				const fileExists = await vault.adapter.exists(filePath);
				if (fileExists) {
					console.log(`File already exists at: ${filePath}`);
					new ErrorArticleAlreadyExists(this.app, fileName).open();
					return;
				}

				const all_files: TFile[] = await vault.getFiles();
				console.log(all_files.length);
				const vaultFileExists = all_files.some(file => file.basename === slug);
				
				if (vaultFileExists) {
					console.log(`File already exists with basename: ${fileName}`);
					new ErrorArticleAlreadyExistsInVault(this.app, fileName).open();
					return;
				}

				try {
					const fileobj: TFile = await this.app.vault.create(filePath, articleTxt);
					console.log(`File created at: ${fileobj.path}`);
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error);
					new ErrorArticleCreation(this.app, errorMessage).open();
					console.error(`Failed to create file: ${errorMessage}`);
					return;
				}

				const txtback = `[[${slug}]]`;
				editor.replaceSelection(txtback);
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async createArticleFromDoi(doiInput: string, editor: Editor) {
		const doiQuery = doiInput.trim();
		const query = `DOI:"${doiQuery}"`;

		const base_url = "https://www.ebi.ac.uk/europepmc/webservices/rest/search";
		const params: { [key: string]: string } = {
			query: query,
			resultType: "core",
			cursorMark: "*",
			pageSize: "25",
			format: "json"
		};

		const url = new URL(base_url);
		Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

		const response = await requestUrl({ url: url.toString() });
		const data = response.json;

		if (data.hitCount > 1) {
			new ErrorUnexpectedEuropePmcHits(this.app, data.hitCount).open();
			return;
		}

		if (data.hitCount === 1) {
			const result = data.resultList.result[0];
			await this.writeArticleNote(buildEuropePmcMetadata(result, doiQuery), editor);
			return;
		}

		// Europe PMC has not indexed this DOI yet (common for very recent articles).
		// Fall back to Crossref, which registers DOIs at publication time.
		const crossrefMessage = await fetchCrossrefWork(doiQuery);
		if (!crossrefMessage) {
			new ErrorNoPaperEuropePmc(this.app).open();
			return;
		}

		const metadata = buildCrossrefMetadata(crossrefMessage, doiQuery);
		if (!metadata.abstract) {
			new Notice('Note created from Crossref: no abstract available for this DOI.');
		}
		await this.writeArticleNote(metadata, editor);
	}

	async writeArticleNote(metadata: PaperMetadata, editor: Editor) {
		console.log(`Creating article note from ${metadata.source} metadata for DOI ${metadata.doi}`);

		const articleTxt = await generateArticleTemplate(
			this.app.vault,
			this.settings.templatePath,
			metadata.masterLink,
			metadata.linkChain,
			metadata.journal,
			metadata.title,
			metadata.authors,
			metadata.abstract,
			metadata.doi
		)

		const folder = this.settings.newFilesFolder.replace(/\/+$/, '');
		const rawSlug = `${metadata.firstAuthorLastname} ${metadata.journal} ${metadata.year}`;
		const slug = sanitizeFileNameSegment(rawSlug);
		if (!slug) {
			new ErrorInvalidArticleName(this.app, rawSlug).open();
			return;
		}
		const fileName = `${slug}.md`;
		const filePath = `${folder}/${fileName}`;

		// check if file exists in that specific path
		const vault = this.app.vault;
		const fileExists = await vault.adapter.exists(filePath);
		if (fileExists) {
			console.log(`File already exists at: ${filePath}`);
			new ErrorArticleAlreadyExists(this.app, fileName).open();
			return;
		}

		const all_files: TFile[] = await vault.getFiles();
		console.log(all_files.length);
		const vaultFileExists = all_files.some(file => file.basename === slug);
		
		if (vaultFileExists) {
			console.log(`File already exists with basename: ${fileName}`);
			new ErrorArticleAlreadyExistsInVault(this.app, fileName).open();
			return;
		}

		try {
			const fileobj: TFile = await this.app.vault.create(filePath, articleTxt);
			console.log(`File created at: ${fileobj.path}`);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			new ErrorArticleCreation(this.app, errorMessage).open();
			console.error(`Failed to create file: ${errorMessage}`);
			return;
		}

		const txtback = `[[${slug}]]`;
		editor.replaceSelection(txtback);
	}

	async createEuropePmcArticlesFromDoiList(doiInput: string, editor: Editor) {
		const seen = new Set<string>();
		const dois = doiInput
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter((doi) => {
				if (!doi || seen.has(doi)) {
					return false;
				}

				seen.add(doi);
				return true;
			});

		if (dois.length === 0) {
			new Notice('Select one DOI per line before running DOI list search.');
			return;
		}

		const links: string[] = [];

		for (const doi of dois) {
			let replacement: string | null = null;
			const captureEditor = {
				replaceSelection: (text: string) => {
					replacement = text;
				}
			} as Editor;

			await this.createArticleFromDoi(doi, captureEditor);

			if (replacement) {
				links.push(replacement);
			}
		}

		if (links.length === 0) {
			new Notice('No article notes were created from the selected DOI list.');
			return;
		}

		editor.replaceSelection(links.join('\n'));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class ErrorGeneSymbol extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText('⚠️ Error in searching the gene symbol');
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class ErrorNoPaperEuropePmc extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText('🔎 No paper found for this DOI in Europe PMC.');
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class ErrorUnexpectedEuropePmcHits extends Modal {
	hitCount: number;

	constructor(app: App, hitCount: number) {
		super(app);
		this.hitCount = hitCount;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText(`⚠️ Expected 1 paper, but got ${this.hitCount}.`);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class ErrorNoDoiInUrl extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText('No DOI found in the selected URL.');
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class ErrorDoiExtraction extends Modal {
	errorMessage: string;

	constructor(app: App, errorMessage: string) {
		super(app);
		this.errorMessage = errorMessage;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText(`Failed to extract a DOI from the selected URL.\n${this.errorMessage}`);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class ErrorArticleAlreadyExists extends Modal {
	fileName: string;

	constructor(app: App, fileName: string) {
		super(app);
		this.fileName = fileName;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText(`📄 Article already exists: ${this.fileName}`);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class ErrorArticleAlreadyExistsInVault extends Modal {
	fileName: string;

	constructor(app: App, fileName: string) {
		super(app);
		this.fileName = fileName;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText(`📄 Article already exists in vault: ${this.fileName}`);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class ErrorArticleCreation extends Modal {
	errorMessage: string;

	constructor(app: App, errorMessage: string) {
		super(app);
		this.errorMessage = errorMessage;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText(`⚠️ Failed to create the article file.\n${this.errorMessage}`);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class ErrorInvalidArticleName extends Modal {
	rawName: string;

	constructor(app: App, rawName: string) {
		super(app);
		this.rawName = rawName;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText(`⚠️ Could not create a valid file name from: ${this.rawName}`);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class ErrorNoPaperArxiv extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText('🔎 No paper found for this arXiv ID.');
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class ErrorNoPaperBiorxiv extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText('🔎 No paper found for this DOI in bioRxiv.');
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Number of results')
			.setDesc('Number of genes to return when using the highlight search.')
			.addText(text => text
				.setPlaceholder('5')
				.setValue(this.plugin.settings.hsNumber)
				.onChange(async (value) => {
					this.plugin.settings.hsNumber = value;
					await this.plugin.saveSettings();
				}));
		
		new Setting(containerEl)
			.setName('New files')
			.setDesc('Path to create new article files')
			.addText(text => text
				.setPlaceholder('articles')
				.setValue(this.plugin.settings.newFilesFolder)
				.onChange(async (value) => {
					this.plugin.settings.newFilesFolder = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Template file path')
			.setDesc('Path to the template file in your vault (e.g., templates/article-template.md)')
			.addText(text => text
				.setPlaceholder('templates/article-template.md')
				.setValue(this.plugin.settings.templatePath)
				.onChange(async (value) => {
					this.plugin.settings.templatePath = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Gene template file path')
			.setDesc('Path to the gene card template file in your vault (e.g., templates/gene-template.md)')
			.addText(text => text
				.setPlaceholder('templates/gene-template.md')
				.setValue(this.plugin.settings.geneTemplatePath)
				.onChange(async (value) => {
					this.plugin.settings.geneTemplatePath = value;
					await this.plugin.saveSettings();
				}));
	}
}
