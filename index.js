const dbConnection = require('./model/db.js');
const { stopProxyServer } = require('./utils.js');
const { MevzuatGovScraper } = require('./scrapers/mevzuat.gov.js');
const { stopProxyServer } = require('./utils.js');

const scrape = async (update, continueFrom) => {
    await new MevzuatGovScraper().scrape(update, continueFrom);
}

const gracefullyExit = (message) => {
    console.log(message);
    dbConnection.close(false).then( (res) => {
        console.log('Mongoose connection disconnected through app termination');
        stopProxyServer("aws").then( () => {
            console.log("Proxy server stopped");
            process.exit(0);
        });
    });
}


scrape(false, 1).then( () => {
    gracefullyExit("Scraping finished");
})

// graceful shutdown
process.on('SIGINT', () => {
    gracefullyExit("Caught interrupt signal");
});
