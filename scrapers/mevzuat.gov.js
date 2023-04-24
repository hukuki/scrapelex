const { ScraperWithPagination } = require('./scraper');
const File = require('../model/file.js');
const axios = require('axios');
const cheerio = require('cheerio');

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

        const response = await axios.post(this.pageRequestUrl, body, { headers });
        const totalRecords = response.data.recordsTotal;

        return parseInt(totalRecords / this.getPageSize());
    }

    async getPage(pageIndex) {
        const headers = this.pageRequestHeaders;
        const body = this.getPageRequestBody(pageIndex);

        const response = await axios.post(this.pageRequestUrl, body, { headers });

        return response.data.data;
    }

    async getFile(metadata) {
        const url = metadata.url;
        const requestOptions = { responseType: 'arraybuffer' };

        if (url.startsWith('http://') || url.startsWith('https://')) {
            const response = await axios.get(url, requestOptions);
            return [this.fileFromResponse(response, metadata)];
        }

        const response = await axios.get(this.baseUrl + url);
        const html = response.data;

        const $ = cheerio.load(html);
        const pdf = $('img[src="/img/iconPdf.png"]');
        const word = $('img[src="/img/iconWord.png"]');

        const files = [];

        const pdfUrl = pdf.parent().attr('href');
        const pdfResponse = await axios.get(pdfUrl, requestOptions);

        files.push(this.fileFromResponse(pdfResponse, metadata));

        if (word.length > 0) {
            const wordUrl = word.parent().attr('href');
            const wordResponse = await axios.get(wordUrl, requestOptions);

            files.push(this.fileFromResponse(wordResponse, metadata));
        }

        try{
            const htmlUrl = this.baseUrl + $('iframe').attr('src').substring(1);
            const htmlResponse = await axios.get(htmlUrl, requestOptions);
            files.push(this.fileFromResponse(htmlResponse, metadata, pdfResponse.headers['last-modified']));
        }catch(e){
            console.log(e);
            console.log('No html file found for ' + metadata)
        }

        return files;
    }

    parseFileName(metadata) {
        const { mevzuatTur, mevzuatTertip, mevzuatNo } = metadata;
        return `${mevzuatTur}_${mevzuatTertip}_${mevzuatNo}`;
    }

    getPageRequestBody(pageIndex) {
        const pageSize = this.getPageSize();
        const start = (pageIndex - 1) * pageSize;
        return { 
            "draw": 1, "columns": [{ "data": null, "name": "", "searchable": true, "orderable": false, "search": { "value": "", "regex": false } }, { "data": null, "name": "", "searchable": true, "orderable": false, "search": { "value": "", "regex": false } }, { "data": null, "name": "", "searchable": true, "orderable": false, "search": { "value": "", "regex": false } }], "order": [], start, "length": pageSize, "search": { "value": "", "regex": false }, "parameters": { "AranacakIfade": "Kg==", "AranacakYer": "Baslik", "TamCumle": false, "MevzuatTur": 0, "GenelArama": true } }
    }

    //since for mevzuat we save three different file types, we need to override this method 
    async saveFile(files, document) {
        if (document.sourceLastUpdated >= files[0].sourceLastUpdated)
            return;
        try { 
            for (let file of files) {
                const fileModel = new File({ ...file, document: document._id });
                await fileModel.save();
            }

            document.sourceLastUpdated = files[0].sourceLastUpdated;
            await document.save();
        } catch (e) {
            console.error(e);
            console.log(files)
        }
    }

    fileFromResponse(response, metadata, overrideDate = undefined) {
        return { content: response.data, contentType: response.headers['content-type'], metadata, sourceLastUpdated: new Date(overrideDate || response.headers['last-modified']) };
    }
}

module.exports = { MevzuatGovScraper };