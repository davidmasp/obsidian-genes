
import { TFile, App, Editor, MarkdownEditView, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, Vault } from 'obsidian';
import { extractPaperInfo, generateLinkChain } from './utils';
import { generateArticleTemplate } from './templates';

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	hsNumber: string;
	newFilesFolder: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	hsNumber: '5',
	newFilesFolder: 'articles'
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

				const hgncResponse = await fetch(hgnc_url, {
					headers: {
						'Accept': 'application/json'
					}
				});
				const hgncData = await hgncResponse.json();
				const geneInfo = hgncData.response.docs[0];
				const location = geneInfo.location;
				const ensemblGeneId = geneInfo.ensembl_gene_id;
				const ncbiGeneId = geneInfo.entrez_id;
				const genename = geneInfo.name;

				const geneText = `---
genename: ${genename}
tags:
  - gene
---

* links: [Hugo](https://www.genenames.org/data/gene-symbol-report/#!/hgnc_id/${hgnc_id}), [ncbi](https://www.ncbi.nlm.nih.gov/gene/${ncbiGeneId}), 
* location: ${location}
* ensembl gene id: ${ensemblGeneId}
`;

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

				const query = `DOI:"${selection}"`;

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

				const response = await fetch(url.toString());
				const data = await response.json();

				if (data.hitCount !== 1) {
					console.log(`Error: Expected 1 result, but got ${data.hitCount} results.`);
					return;
				}

				const result = data.resultList.result[0];
				const linkChain = generateLinkChain(result);

				const year = parseInt(result.pubYear || "0");
				const author = result.authorString || "";
				const journal = (result.journalInfo?.journal?.title || result.bookOrReportDetails?.publisher) || "";
				const abstract = result.abstractText || "";
				const full_title = result.title || "";
				const link_chain = linkChain;

				const [auth_name, journal_name, year_name] = extractPaperInfo(result);

				const articleTxt = generateArticleTemplate(
					link_chain,
					journal_name,
					full_title,
					author,
					abstract
				)

				const folder = this.settings.newFilesFolder.replace(/\/+$/, '');
				const slug = `${auth_name} ${journal_name} ${year_name}`;
				const fileName = `${slug}.md`;
				const filePath = `${folder}/${fileName}`;

				// check if file exists in that specific path
				const vault = this.app.vault;
				const fileExists = await vault.adapter.exists(filePath);
				if (fileExists) {
					console.log(`File already exists at: ${filePath}`);
					new ErrorArticleCreation(this.app).open();
					return;
				}

				const all_files: TFile[] = await vault.getFiles();
				console.log(all_files.length);
				const vaultFileExists = all_files.some(file => file.basename === slug);
				
				if (vaultFileExists) {
					console.log(`File already exists with basename: ${fileName}`);
					new ErrorArticleCreation(this.app).open();
					return;
				}

				try {
					const fileobj: TFile = await this.app.vault.create(filePath, articleTxt);
					console.log(`File created at: ${fileobj.path}`);
				} catch (error) {
					new ErrorArticleCreation(this.app).open();
					console.error(`Failed to create file: ${error}`);
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
		contentEl.setText('Error in searching the gene symbol');
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class ErrorArticleCreation extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText('Error in creating the article');
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
	}
}
