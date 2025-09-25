export function extractPaperInfo(result: any): [string, string, string] {
    const firstAuthor = result.authorList?.author?.[0] || {};
    let firstAuthorLastname = firstAuthor.lastName || "";
    if (!firstAuthorLastname) {
        firstAuthorLastname = (result.authorString || "").split(",")[0].split(" ").pop() || "";
    }

    let journal = result.journalInfo?.journal?.title || "";
    if (!journal) {
        journal = result.bookOrReportDetails?.publisher || "";
    }

    journal = journal
        .split(" ")
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join("");

    const year = result.pubYear || "";

    return [firstAuthorLastname, journal, year];
}

export function generateLinkChain(result: any): string {
    const linksArr = result.fullTextUrlList.fullTextUrl.map((i: any) =>
        `[${i.site} ${i.documentStyle}](${i.url})`
    );
    return linksArr.join(" | ");
}

export function generateMasterLink(result: any): string {
    const firstUrl = result.fullTextUrlList.fullTextUrl[0];
    if (!firstUrl) {
        return "";
    }
    console.log("First URL:", firstUrl);
    return `${firstUrl.url}`;
}

export function parseArxivXML(xml: string): any {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xml, "text/xml");

    const entry = xmlDoc.querySelector("entry");
    if (!entry) {
        return null;
    }

    const title = entry.querySelector("title")?.textContent || "";
    const summary = entry.querySelector("summary")?.textContent || "";
    const authors = Array.from(entry.querySelectorAll("author")).map(author => author.querySelector("name")?.textContent || "").join(", ");
    const published = entry.querySelector("published")?.textContent || "";
    const year = new Date(published).getFullYear().toString();
    const id = entry.querySelector("id")?.textContent || "";

    return {
        title,
        summary,
        authors,
        year,
        id
    };
}
