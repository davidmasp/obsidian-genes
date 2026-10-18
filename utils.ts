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

export interface PaperMetadata {
    masterLink: string;
    linkChain: string;
    journal: string;
    title: string;
    authors: string;
    abstract: string;
    doi: string;
    firstAuthorLastname: string;
    year: string;
    source: string;
}

function normalizeJournalName(value: string): string {
    return value
        .split(" ")
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join("");
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

    const year = result.pubYear || "";

    return [firstAuthorLastname, normalizeJournalName(journal), year];
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

export function buildEuropePmcMetadata(result: any, fallbackDoi: string): PaperMetadata {
    const [firstAuthorLastname, journal, year] = extractPaperInfo(result);

    return {
        masterLink: generateMasterLink(result),
        linkChain: generateLinkChain(result),
        journal,
        title: result.title || "",
        authors: result.authorString || "",
        abstract: result.abstractText || "",
        doi: result.doi || fallbackDoi,
        firstAuthorLastname,
        year,
        source: "Europe PMC"
    };
}

function decodeEntities(value: string): string {
    return value
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&");
}

function stripMarkup(value: string): string {
    return decodeEntities(value.replace(/<[^>]*>/g, " "))
        .replace(/\s+/g, " ")
        .trim();
}

function formatCrossrefAuthor(author: any): string {
    const family = (author?.family || author?.name || "").trim();
    const given = (author?.given || "").trim();

    if (!family) {
        return "";
    }

    if (!given) {
        return family;
    }

    const initials = given
        .split(/[\s.-]+/)
        .filter(Boolean)
        .map((part: string) => part.charAt(0).toUpperCase())
        .join("");

    return `${family} ${initials}`.trim();
}

// Crossref registers DOIs at publication time, so it can resolve very recent
// articles (e.g. new Cell/Elsevier issues) that Europe PMC has not indexed yet.
export async function fetchCrossrefWork(doi: string): Promise<any | null> {
    try {
        const response = await requestUrl({
            url: `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
            headers: {
                "Accept": "application/json"
            }
        });

        const message = response.json?.message;
        if (message && message.DOI) {
            return message;
        }

        return null;
    } catch (error) {
        console.warn(`Crossref lookup failed for DOI "${doi}":`, error);
        return null;
    }
}

export function buildCrossrefMetadata(message: any, fallbackDoi: string): PaperMetadata {
    const authors: any[] = Array.isArray(message.author) ? message.author : [];
    const firstAuthor = authors.find((author) => author?.sequence === "first") || authors[0] || {};

    const journal =
        message["container-title"]?.[0] ||
        message["short-container-title"]?.[0] ||
        message.publisher ||
        "";

    const dateParts =
        message.issued?.["date-parts"]?.[0] ||
        message.published?.["date-parts"]?.[0] ||
        message["published-print"]?.["date-parts"]?.[0] ||
        [];
    const year = dateParts[0] ? String(dateParts[0]) : "";

    const doi = message.DOI || fallbackDoi;
    const doiUrl = `https://doi.org/${doi}`;
    const publisherUrl = message.resource?.primary?.URL || "";

    // Crossref has no equivalent of Europe PMC's fullTextUrlList; build a
    // smaller link chain from the canonical DOI and the publisher landing page.
    const links = [`[DOI](${doiUrl})`];
    if (publisherUrl && publisherUrl !== doiUrl) {
        links.push(`[Publisher](${publisherUrl})`);
    }

    return {
        masterLink: doiUrl,
        linkChain: links.join(" | "),
        journal: normalizeJournalName(journal),
        title: stripMarkup(message.title?.[0] || ""),
        authors: authors.map(formatCrossrefAuthor).filter(Boolean).join(", "),
        abstract: stripMarkup(message.abstract || ""),
        doi,
        firstAuthorLastname: firstAuthor.family || firstAuthor.name || "",
        year,
        source: "Crossref"
    };
}
