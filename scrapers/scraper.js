const Document = require('../model/document.js');
const File = require('../model/file.js');

class ScraperWithPagination {

    constructor(url, folder) {
        this.baseUrl = url;
        this.folder = folder;
        this.currentPageIndex = 1;
    }

    getPageSize() { return 0; }
    async getMaxPageCount() { return 0; }
    async getPage(pageIndex) { return undefined; }
    async getFile(metadata) { return undefined; }
    parseFileName(metadata) { return ""; }

    async getNextPage() {
        if (this.currentPageIndex > this.maxPageCount)
            return;

        const page = await this.getPage(this.currentPageIndex);

        this.currentPageIndex++;
        return page;
    }

    async getDocument(metadata){
        let document = await Document.findOne({ name: this.parseFileName(metadata), folder: this.folder });

        if(!document)
            document = await Document.create({ name: this.parseFileName(metadata), folder: this.folder });
        
        return document;
    }
    
    async saveFile(file, document){
        if (document.sourceLastUpdated >= file.sourceLastUpdated) 
            return;

        const fileModel = new File({ ...file, document: document._id });
        await fileModel.save(); 

        document.sourceLastUpdated = file.sourceLastUpdated;
        await document.save();
    }

    async scrape() {
        this.maxPageCount = await this.getMaxPageCount();

        let page = await this.getNextPage();
        
        while (page) {
            const pageMetadata = await this.parsePage(page);

            pageMetadata.forEach(async (metadata) => {
                const file = await this.getFile(metadata);
                const document = await this.getDocument(metadata);
                
                await this.saveFile(file, document);
            });

            page = await this.getNextPage();
        }
    }
}

module.exports = { ScraperWithPagination };