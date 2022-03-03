require('dotenv').config();
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



// initialize mongodb
let TOTAL_TX = 0;

var configDB = require('../../../server/config/database');
const mongoose = require('mongoose');

let Web3 = require('web3');
let web3 = new Web3(process.env.PROVIDER_WSS); // Initialize Ethereum Web3 client

const Scraper = require('../Scraper');
const scraper = new Scraper( web3 );



 /**
  * Scan an individual transaction
  *
  * This is called once for every transaction found between the
  * starting block and the ending block.
  *
  * Do whatever you want with this transaction.
  *
  * NOTE- This is called asynchronously, so the txn/block you
  * see here might have actually happened AFTER the txn/block
  * you see the next time is is called.  To determine
  * synchronicity, you need to look at `block.timestamp`
  *
  * @param {Object} txn (See https://github.com/ethereum/wiki/wiki/JavaScript-API#web3ethgettransaction)
  * @param {Object} block The parent block of the transaction (See https://github.com/ethereum/wiki/wiki/JavaScript-API#web3ethgetblock)
  */
let SCANNED_TRANSACTIOSN = 0;
async function scanTransactionCallback(txn, pairAddress) {
    SCANNED_TRANSACTIOSN ++;
    //console.log( txn.to, txn.from )
    TOTAL_TX ++;
    try {
        await scraper.calculatePriceFromReserves(txn, pairAddress);
        console.log('[TOTAL TX] ', TOTAL_TX)
    } catch (error) {
        console.log("[ERR CALCULATING PRICE]", error)
    }
    TOTAL_TX --;
}



( async () => {
    mongoose.connect(configDB.url, {
        autoIndex: false,
        useNewUrlParser: true,
        useUnifiedTopology: true
    }).then(async () => { 
        loopUpdateOnDb(); // starts the loop that updates the db every 5 seconds
    })
    .catch(err => { console.log('MongoDB connection unsuccessful', err) });

    scanTransactionCallback({
        transactionHash: '0xcca50546c74e4ada10578ced6f6857bbb1676bab2f0ee05ad26014391e6c0d77'
    }, '0x703f1C0B4399A51704e798002281bf26D6f9c2E6') // for each swap scan the tranasction

})();