
import { Vault, TFile } from 'obsidian';

export async function generateArticleTemplate(
    vault: Vault, 
    templatePath: string,
    master_link: string,
    link_chain: string,
    journal: string, 
    title: string, 
    authors: string, 
    abstract: string
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
                .replace(/{{date_added}}/g, today);
                
            return templateContent;
        } else {
            throw new Error('Template file not found');
        }
    } catch (error) {
        console.error('Error reading template:', error);
        // Fallback to the original hardcoded template
        return generateFallbackTemplate(link_chain, journal, title, authors, abstract);
    }
}

function generateFallbackTemplate(link_chain: string, journal: string, title: string, authors: string, abstract: string): string {
    const today = new Date().toISOString().split('T')[0];
    return `
* 🔗 Links:: ${link_chain}
* 🍹 Overview::
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
