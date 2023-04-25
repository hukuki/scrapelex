const { ScraperWithPagination } = require('./scraper');
const File = require('../model/file.js');
const axios = require('axios');
const cheerio = require('cheerio');
const { uploadFile } = require('../s3/s3.js');
const { safeReq } = require('../utils.js');

class MevzuatGovScraper extends ScraperWithPagination {

    constructor() {
        super('https://mevzuat.gov.tr/', 'mevzuat');

        this.pageRequestHeaders = {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.5',
        }
        this.pageRequestUrl = 'https://mevzuat.gov.tr/anasayfa/MevzuatDatatable';
    }

    getPageSize() { return 25; }
    async parsePage(page) { return page; }

    async getMaxPageCount() {
        const headers = this.pageRequestHeaders;
        const body = this.getPageRequestBody(1);

        const response = await safeReq(axios.post, [this.pageRequestUrl, body, { headers }]);
        const totalRecords = response.data.recordsTotal;

        return parseInt(totalRecords / this.getPageSize());
    }

    async getPage(pageIndex) {
        const headers = this.pageRequestHeaders;
        const body = this.getPageRequestBody(pageIndex);

        const response = await safeReq(axios.post, [this.pageRequestUrl, body, { headers }]);

        return response.data.data;
    }

    async getFile(metadata) {
        const url = metadata.url;
        const requestOptions = { responseType: 'arraybuffer' };

        if (url.startsWith('http://') || url.startsWith('https://')) {
            const response = await safeReq(axios.get, [url, requestOptions]);
            return {file: [this.fileFromResponse(response, metadata)], fileContent: [response.data]};
        }

        const response = await safeReq(axios.get, [this.baseUrl + url]);
        const html = response.data;

        const $ = cheerio.load(html);
        const pdf = $('img[src="/img/iconPdf.png"]');
        const word = $('img[src="/img/iconWord.png"]');

        const files = [];
        const fileContents = [];

        let pdfResponse;
        if(pdf.length > 0) {
            const pdfUrl = pdf.parent().attr('href');
            pdfResponse = await safeReq(axios.get, [pdfUrl, requestOptions] );
        }

        let wordResponse;
        if (word.length > 0) {
            const wordUrl = word.parent().attr('href');
            wordResponse = await safeReq(axios.get, [wordUrl, requestOptions]);
        }

        let htmlResponse;
        try{
            const htmlUrl = this.baseUrl + $('iframe').attr('src').substring(1);
            htmlResponse = await safeReq(axios.get, [htmlUrl, requestOptions]);
        }catch(e){
            console.log(e);
            console.log('No html file found for ' + metadata)
        }

        let sourceLastUpdated;
        let noLastUpdated = false;
        if (pdfResponse.headers['last-modified'] !== undefined) {
            sourceLastUpdated = new Date(pdfResponse.headers['last-modified']);
        }
        else if (wordResponse?.headers['last-modified'] !== undefined) {
            sourceLastUpdated = new Date(wordResponse.headers['last-modified']);
        }
        else {
            noLastUpdated = true;
        }

        if(pdfResponse && pdfResponse.headers['content-type'] !== 'text/html; charset=utf-8'){
            files.push(this.fileFromResponse(pdfResponse, metadata, sourceLastUpdated, noLastUpdated));
            fileContents.push(pdfResponse.data);
        }
        if(wordResponse && wordResponse.headers['content-type'] !== 'text/html; charset=utf-8') {
            files.push(this.fileFromResponse(wordResponse, metadata, sourceLastUpdated, noLastUpdated));
            fileContents.push(wordResponse.data);
        }
        if(htmlResponse) {
            files.push(this.fileFromResponse(htmlResponse, metadata, sourceLastUpdated, noLastUpdated));
            fileContents.push(htmlResponse.data);
        }


        return {file : files, fileContent : fileContents};
    }

    parseFileName(metadata) {
        const { mevzuatTur, mevzuatTertip, mevzuatNo, mevAdi } = metadata;
        return {
            "name": `${mevzuatTur}_${mevzuatTertip}_${mevzuatNo}`,
            "title": mevAdi || "No Title"
        }
    }

    getPageRequestBody(pageIndex) {
        const pageSize = this.getPageSize();
        const start = (pageIndex - 1) * pageSize;
        return { 
            "draw": 1, "columns": [{ "data": null, "name": "", "searchable": true, "orderable": false, "search": { "value": "", "regex": false } }, { "data": null, "name": "", "searchable": true, "orderable": false, "search": { "value": "", "regex": false } }, { "data": null, "name": "", "searchable": true, "orderable": false, "search": { "value": "", "regex": false } }], "order": [], start, "length": pageSize, "search": { "value": "", "regex": false }, "parameters": { "AranacakIfade": "Kg==", "AranacakYer": "Baslik", "TamCumle": false, "MevzuatTur": 0, "GenelArama": true } }
    }

    //since for mevzuat we save three different file types, we need to override this method 
    async saveFile(files, document, fileContents) {
        if (document.sourceLastUpdated >= files[0].sourceLastUpdated)
            return;
        try { 
            for (let [index, file] of files.entries()) {
                const fileModel = new File({ ...file, document: document._id });
                const result = await uploadFile(this.folder + '/' + fileModel._id.toString(), fileContents[index]);
                const isS3Uploaded = result?.$metadata?.httpStatusCode === 200;
                fileModel.s3Uploaded = isS3Uploaded;
                await fileModel.save(); 
            }

            document.sourceLastUpdated = files[0].sourceLastUpdated;
            await document.save();
        } catch (e) {
            console.error(e);
            console.log(files)
        }
    }

    fileFromResponse(response, metadata, Date, noLastUpdated) {
        return {contentType: response.headers['content-type'], metadata, sourceLastUpdated: Date, noLastUpdated : noLastUpdated};
    }
}

module.exports = { MevzuatGovScraper };