const dbConnection = require('./model/db.js');

const { MevzuatGovScraper } = require('./scrapers/mevzuat.gov.js');

const scrape = async (update) => {
    await new MevzuatGovScraper().scrape(update);
}

scrape(false);

// graceful shutdown
process.on('SIGINT', () => {
    console.log("Caught interrupt signal");
    // boolean means [force]
    dbConnection.close(false).then( (res) => {
        console.log('Mongoose connection disconnected through app termination');
        process.exit(0);
    });
});
