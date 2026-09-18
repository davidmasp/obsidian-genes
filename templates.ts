
import { Vault, TFile } from 'obsidian';

interface GeneTemplateData {
    symbol: string;
    genename: string;
    hgncId: string;
    hgncUrl: string;
    ncbiGeneId: string;
    ncbiUrl: string;
    ensemblGeneId: string;
    ensemblUrl: string;
    location: string;
}

export async function generateArticleTemplate(
    vault: Vault, 
    templatePath: string,
    master_link: string,
    link_chain: string,
    journal: string, 
    title: string, 
    authors: string, 
    abstract: string,
    doi: string = ""
): Promise<string> {
    try {
        // Try to read the template file from the vault
        const templateFile = vault.getAbstractFileByPath(templatePath);
        
        if (templateFile instanceof TFile) {
            let templateContent = await vault.read(templateFile);
            
            // Replace placeholders with actual values
            const today = new Date().toISOString().split('T')[0];
            
            templateContent = templateContent
                .replace(/{{link}}/g, master_link)
                .replace(/{{link_chain}}/g, link_chain)
                .replace(/{{journal}}/g, journal)
                .replace(/{{title}}/g, title)
                .replace(/{{authors}}/g, authors)
                .replace(/{{abstract}}/g, abstract)
                .replace(/{{doi}}/g, doi)
                .replace(/{{date_added}}/g, today);
                
            return templateContent;
        } else {
            throw new Error('Template file not found');
        }
    } catch (error) {
        console.error('Error reading template:', error);
        // Fallback to the original hardcoded template
        return generateFallbackTemplate(link_chain, journal, title, authors, abstract, doi);
    }
}

export async function generateGeneTemplate(
    vault: Vault,
    templatePath: string,
    gene: GeneTemplateData
): Promise<string> {
    try {
        const templateFile = vault.getAbstractFileByPath(templatePath);

        if (templateFile instanceof TFile) {
            let templateContent = await vault.read(templateFile);
            const today = new Date().toISOString().split('T')[0];

            templateContent = templateContent
                .replace(/{{symbol}}/g, gene.symbol)
                .replace(/{{genename}}/g, gene.genename)
                .replace(/{{hgnc_id}}/g, gene.hgncId)
                .replace(/{{hgnc_url}}/g, gene.hgncUrl)
                .replace(/{{ncbi_gene_id}}/g, gene.ncbiGeneId)
                .replace(/{{ncbi_url}}/g, gene.ncbiUrl)
                .replace(/{{ensembl_gene_id}}/g, gene.ensemblGeneId)
                .replace(/{{ensembl_url}}/g, gene.ensemblUrl)
                .replace(/{{location}}/g, gene.location)
                .replace(/{{date_added}}/g, today);

            return templateContent;
        } else {
            throw new Error('Gene template file not found');
        }
    } catch (error) {
        console.error('Error reading gene template:', error);
        return generateFallbackGeneTemplate(gene);
    }
}

function generateFallbackTemplate(link_chain: string, journal: string, title: string, authors: string, abstract: string, doi: string): string {
    const today = new Date().toISOString().split('T')[0];
    return `
* 🔗 Links:: ${link_chain}
${doi ? `* DOI:: ${doi}
` : ""}* 🍹 Overview::
    * 
* 🙋🏻‍♂️ Authors:: 
* 📑 Journal:: [[${journal}]]
* 📅 Date Added:: ${today}

# ${title}

${authors}

Abstract:

${abstract}
    `;
}

function generateFallbackGeneTemplate(gene: GeneTemplateData): string {
    return `---
genename: ${gene.genename}
tags:
  - gene
---

* links: [HGNC](${gene.hgncUrl}), [NCBI](${gene.ncbiUrl})
* location: ${gene.location}
* ensembl gene id: ${gene.ensemblGeneId}
`;
}
