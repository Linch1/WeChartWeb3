const { parentPort, workerData } = require('worker_threads');
const Scraper = require('./scraper-price/Scraper');
let { scraper } = workerData;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
Object.setPrototypeOf(scraper, Scraper.prototype);

( () => {
    
    let transactions = [];
    parentPort.once('message', (value) => {
        transactions.push( value );
    });
    while(true){
        for( tx of transactions ){
            await scraper.
            parentPort.postMessage('DONE');
        }
        sleep(100)
    }
})

