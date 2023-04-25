const Document = require('../model/document.js');
const File = require('../model/file.js');
const cliProgress = require('cli-progress');
const { uploadFile } = require('../s3/s3.js');

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
        let document = await Document.findOne({ ...this.parseFileName(metadata), folder: this.folder });
        let isNewDocument = false;
        if(!document) {
            isNewDocument = true;
            document = await Document.create({ ...this.parseFileName(metadata), folder: this.folder });
        }
        
        return {document, isNewDocument};
    }
    
    async saveFile(file, document, fileContent){
        if (document.sourceLastUpdated >= file.sourceLastUpdated) 
            return;

        const fileModel = new File({ ...file, document: document._id });
        result = await uploadFile(this.folder + '/' + fileModel._id.toString(), fileContent);
        const isS3Uploaded = result?.$metadata?.httpStatusCode === 200;
        fileModel.s3Uploaded = isS3Uploaded;
        await fileModel.save(); 

        document.sourceLastUpdated = file.sourceLastUpdated;
        await document.save();
    }

    // async doesDocumentExist(metadata) {
    //     const document = await Document.findOne({ name: this.parseFileName(metadata) });
    //     return document;
    // }


    async scrape(update = true, continueFrom = 1) {
        this.currentPageIndex = continueFrom;
        const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
        this.maxPageCount = await this.getMaxPageCount();

        progressBar.start(this.maxPageCount * this.getPageSize(), 0);

        let page = await this.getNextPage();
        
        while (page) {
            const pageMetadata = await this.parsePage(page);

            pageMetadata.forEach(async (metadata) => {
                const {document, isNewDocument} = await this.getDocument(metadata);
                if (!update && !isNewDocument) {
                    console.log(`Skipping ${this.parseFileName(metadata)}...`);
                    return;
                }
                // console.log(update, isNewDocument)
                const {file, fileContent} = await this.getFile(metadata);
                // const document = await this.getDocument(metadata);
                
                await this.saveFile(file, document, fileContent);
            });

            page = await this.getNextPage();
            progressBar.update(this.currentPageIndex * this.getPageSize());
        }

        progressBar.stop();
    }
}

module.exports = { ScraperWithPagination };