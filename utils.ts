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

    return [firstAuthorLastname, journal, year];
}

export function generateLinkChain(result: any): string {
    const linksArr = result.fullTextUrlList.fullTextUrl.map((i: any) =>
        `[${i.site} ${i.documentStyle}](${i.url})`
    );
    return linksArr.join(" | ");
}
