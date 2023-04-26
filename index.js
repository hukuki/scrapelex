const dbConnection = require('./model/db.js');

const { MevzuatGovScraper } = require('./scrapers/mevzuat.gov.js');

const scrape = async (update, continueFrom) => {
    await new MevzuatGovScraper().scrape(update, continueFrom);
}

scrape(false, 1).then( () => {
    console.log("Done");
    dbConnection.close(false).then( (res) => {
        console.log('Mongoose connection disconnected through app termination');
        process.exit(0);
    });
});

// graceful shutdown
process.on('SIGINT', () => {
    console.log("Caught interrupt signal");
    // boolean means [force]
    dbConnection.close(false).then( (res) => {
        console.log('Mongoose connection disconnected through app termination');
        process.exit(0);
    });
});
