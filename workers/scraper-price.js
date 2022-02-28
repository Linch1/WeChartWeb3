
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


require('dotenv').config();

const EnumChainId = require('../enum/chain.id');
const EnumAbi = require('../enum/abi');
const EnumContracts = require('../enum/contracts');
const EnumMainTokens = require('../enum/mainTokens');

// initialize mongodb
let TOTAL_TX = 0;

var configDB = require('../server/config/database');
const mongoose = require('mongoose');

let Web3 = require('web3');
let web3 = new Web3(process.env.PROVIDER_WSS); // Initialize Ethereum Web3 client

let MAIN_TOKEN_PRICE = [0];

const Scraper = require('./scraper-price/Scraper');
const scraper = new Scraper( web3, MAIN_TOKEN_PRICE );
const UPDATE_DATABASE_INTERVAL = 5000; // 5seconds in milliseconds
const UPDATE_MAIN_TOKEN_INTERVAL = 5000; // 5seconds in milliseconds

let FACTORY;


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// END HANDLE TOKEN HISTORY CACHE
async function updateMainTokenPrice(){
    let mainTokenPairAddress = await FACTORY.methods.getPair( EnumMainTokens[EnumChainId.BSC].WBNB.address, EnumMainTokens[EnumChainId.BSC].USDT.address ).call();
    let mainTokenPair = await new web3.eth.Contract( EnumAbi[EnumChainId.BSC].PAIR.PANCAKE, mainTokenPairAddress );
    let reserves = await mainTokenPair.methods.getReserves().call();
    let WBNB_RESERVE = reserves[1]/10**EnumMainTokens[EnumChainId.BSC].WBNB.decimals;
    let USDT_RESERVE = reserves[0]/10**EnumMainTokens[EnumChainId.BSC].USDT.decimals;
    let WBNB_PRICE = USDT_RESERVE/WBNB_RESERVE;
    MAIN_TOKEN_PRICE[0] = WBNB_PRICE;
}

async function loopUpdateMainTokenPrice(){
    while( true ){
        try {
            await updateMainTokenPrice();
        } catch (error) {
            console.log(`[ERR UPDATING MAIN PRICE] ${error}`);
        }
        await sleep(UPDATE_MAIN_TOKEN_INTERVAL);
    }
}


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
    FACTORY = await new web3.eth.Contract( EnumAbi[EnumChainId.BSC].FACTORIES.PANCAKE, EnumContracts[EnumChainId.BSC].FACTORIES.PANCAKE );
    
    mongoose.connect(configDB.url, {
        autoIndex: false,
        useNewUrlParser: true,
        useUnifiedTopology: true
    }).then(async () => { 
        loopUpdateMainTokenPrice(); // starts the loop that updates the main token price every 5 seconds
        loopUpdateOnDb(); // starts the loop that updates the db every 5 seconds
    })
    .catch(err => { console.log('MongoDB connection unsuccessful', err) });

    // Listen for all the swap events on the blockchain
    let filter = [ '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822'/*swap*/ ];
    var subscription = web3.eth.subscribe('logs', {
        topics: filter
    }, async function(error, tx){
        
        if( error )
            return console.log( error );

        let pair = tx.address;
        scanTransactionCallback(tx, pair.toLowerCase()) // for each swap scan the tranasction

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