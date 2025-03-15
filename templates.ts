
export function generateArticleTemplate(link_chain: string, journal: string, title: string, authors: string, abstract: string): string {
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
