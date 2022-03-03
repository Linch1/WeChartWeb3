require('dotenv').config();
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * 
 * 
 * This script will listen for all the latest transactions in the binance smart chain ( or wathever ETHEREUM compatible chain )
 * The script is provided by @Linch1 -> https://github.com/Linch1/PancakeSwapTokenCharting without warranty of any kind.
 * 
 * The provider used in this example is a free one with a rate limit of 10K requests each 5 min ( 10k/5min )
 * so probably you will encounter some errors during the testing if you not stop it before reaching the limit
 * 
 * Usually it makes ~2K requests each 15 seconds
 * so it can reach the rate limit in 1:15 minutes
 * 
*/

// Initialize Ethereum Web3 client
let Web3 = require('web3');
let web3_wss = new Web3(process.env.PROVIDER_WSS); 
let web3_https = new Web3(process.env.PROVIDER_HTTPS);

//imports
var configDB = require('../server/config/database');
const mongoose = require('mongoose');
const Scraper = require('./scraper-price/Scraper');
const Queue = require('./scraper-price/Queue');
const scraper = new Scraper( web3_https );


( async () => {

    let queue = new Queue(1, scraper);

    mongoose.connect(configDB.url, {
        autoIndex: false,
        useNewUrlParser: true,
        useUnifiedTopology: true
    }).then(async () => { 
        loopUpdateOnDb(); // starts the loop that updates the db every 5 seconds
    })
    .catch(err => { console.log('MongoDB connection unsuccessful', err) });

    // Listen for all the swap events on the blockchain
    let filter = [ '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822'/*swap*/ ];
    var subscription = web3_wss.eth.subscribe('logs', {
        topics: filter
    }, async function(error, tx){
        
        if( error )
            return console.log( error );

        let pair = tx.address;
        queue.add(tx, pair);

    })

    // unsubscribes the subscription
    subscription.unsubscribe(function(error, success){
        if(success)
            console.log('Successfully unsubscribed!');
    });


    /**
     * @description Executes the stored queries inside BulkWriteOperations object of the scraper.
     * The queries are stored inside this object instead of directly executed to reduce the write operations on the database
     * and to take advandage of the bulk operations by aggregating all the stored queries
     * @returns 
     */
    function getWriteTime( timeMs ) { return Math.floor( (timeMs/1000) / process.env.WRITE_TO_DB_SECONDS) * process.env.WRITE_TO_DB_SECONDS; }
    async function loopUpdateOnDb(){
        while(true){
            let now = getWriteTime(Date.now());
            await sleep(1000);
            // push the updates every minute change to optimize the writes on the database
            if( now != getWriteTime( Date.now() + 1000 ) )  await scraper.bulk.execute();
            // await sleep(5000);
            // await scraper.bulk.execute();
        }
    }
    
})();