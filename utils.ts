import { requestUrl } from 'obsidian';

const DOI_PATTERN = /10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i;
const DOI_META_NAMES = new Set([
    "citation_doi",
    "dc.identifier",
    "dc.identifier.doi",
    "prism.doi",
    "doi"
]);

function cleanDoiValue(value: string): string | null {
    const match = value
        .trim()
        .replace(/^doi:\s*/i, "")
        .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
        .replace(/^urn:doi:/i, "")
        .match(DOI_PATTERN);

    if (!match) {
        return null;
    }

    let doi = match[0].replace(/[<>"'\s]+$/g, "").replace(/[.,;:]+$/g, "");

    while (doi.endsWith(")") && (doi.match(/\(/g) || []).length < (doi.match(/\)/g) || []).length) {
        doi = doi.slice(0, -1);
    }

    return doi;
}

export function extractDoiFromHtml(html: string): string | null {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const metaTags = Array.from(doc.querySelectorAll("meta"));

    for (const tag of metaTags) {
        const name = (tag.getAttribute("name") || tag.getAttribute("property") || "").toLowerCase();
        if (!DOI_META_NAMES.has(name)) {
            continue;
        }

        const content = tag.getAttribute("content");
        if (!content) {
            continue;
        }

        const doi = cleanDoiValue(content);
        if (doi) {
            return doi;
        }
    }

    return cleanDoiValue(html);
}

export async function extractDoiFromUrl(url: string): Promise<string | null> {
    const response = await requestUrl({
        url,
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
    });

    return extractDoiFromHtml(response.text);
}

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
