
/**
 * 
 * 
 * This script will listen for all the latest transactions in the binance smart chain ( or wathever ETHEREUM compatible chain )
 * The script is provided by @Linch1 -> https://github.com/Linch1/PancakeSwapTokenCharting without warranty of any kind.
 * 
 * Before running the script 
 * - be sure to populate the mongo db with the provided exported database
 * - be sure to update the db with the latest pairs ( read the repo description to understand how )
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
const TokenHistory = require('../server/models/token_history');
let TOTAL_TX = 0;

var configDB = require('../server/config/database');
const mongoose = require('mongoose');

let Web3 = require('web3');
let web3 = new Web3(process.env.PROVIDER); // Initialize Ethereum Web3 client

const Scraper = require('./scraper-price/Scraper');
const scraper = new Scraper( web3 );
const UPDATE_DATABASE_INTERVAL = 5000; // 5seconds in milliseconds
const UPDATE_MAIN_TOKEN_INTERVAL = 5000; // 5seconds in milliseconds


let START_TIME = Date.now();
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
    MAIN_TOKEN_PRICE = WBNB_PRICE;
}

async function loopUpdateMainTokenPrice(){
    while( true ){
        await updateMainTokenPrice();
        await sleep(UPDATE_MAIN_TOKEN_INTERVAL);
    }
}

/**
 * Ethereum Account Scanner by @ross-p 
 * 
 * https://gist.github.com/ross-p/bd5d4258ac23319f363dc75c2b722dd9
 *
 * To run this, you need your own geth node, accepting RPC
 * connections on a port you can access.
 *
 * Install pre-requisites:
 *     sudo npm install -g web3
 *
 * Usage:
 *     nodejs ./ethereum-account-scanner.js
*/

 
 /**
  * Address of the Ethereum account you wish to scan
  *
  * Example: 0x0123456789012345678090123456789012345678
  *
  * @type {string}
  */
 let wallet = "0x10ED43C718714eb63d5aA57B78B54704E256024E"; // change this to your Ethereum account number
 
 /**
  * Maximum number of threads to create.
  *
  * The higher you set this, the faster the scan will run.  However if
  * you set it too high, you will overload the geth server and/or your
  * client machine and you may start getting networking errors.
  *
  * Generally speaking on a dual-core CPU that runs both geth
  * and this scanning client, I can scan ~ 300 blocks/second,
  * but in so doing, the CPU maxed at 100%.
  *
  * On the same dual-core CPU, settings higher than 200 threads
  * actually SLOW DOWN the processing since the I/O overhead exceeds
  * the capabilities of the machine.  Your results may vary.
  *
  * @type {number}
  */
 let maxThreads = 100;
 
 ////////////////////////////////////////////////////////////////////////////////
 // END CONFIGURATION SECTION
 ////////////////////////////////////////////////////////////////////////////////
 


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
async function scanTransactionCallback(txn, block) {
    SCANNED_TRANSACTIOSN ++;
    //console.log( txn.to, txn.from )
    TOTAL_TX ++;
    try {
        await scraper.calculatePriceFromReserves(txn);
    } catch (error) {
        console.log("[ERR CALCULATING PRICE]", error)
    }
    TOTAL_TX --;
 }
 
 /**
  * Scan an individual block
  *
  * This is called once for every block found between the
  * starting block and the ending block.
  *
  * Here we just look for transactions in the block, and then
  * we scan each of those.
  *
  * NOTE- This is called asynchronously, so the block you
  * see here might have actually happened AFTER the block
  * you see the next time this is called.  To determine
  * synchronicity, you need to look at `block.timestamp`
  * 
  * @param {Object} block (See https://github.com/ethereum/wiki/wiki/JavaScript-API#web3ethgetblock)
  */
async function scanBlockCallback(block) {
 
     if (block.transactions) {
        console.log( `[BLOCK ${block.number}] SCANNING ${block.transactions.length} TX`);
        for (var i = 0; i < block.transactions.length; i++) {
            var txn = block.transactions[i];
            scanTransactionCallback(txn, block);
        }
        console.log(`[TX SCANNED]`, SCANNED_TRANSACTIOSN);
        console.log(`[TX TOTAL]`, TOTAL_TX);
     }
 }
 
 /**
  * Scan a range of blocks
  *
  * Spawn up to `maxThreads` threads to scan blocks in the
  * range provided.
  *
  * Note that if you pass undefined for `stoppingBlock`, its
  * value will be computed at the beginning of the function,
  * so any blocks added during the scan will not be processed.
  *
  * @param {number|hex} startingBlock First block to scan.
  * @param {number|hex} stoppingBlock (Optional) Last block to scan. If undefined, scan all blocks.
  * @param {function} callback Function to call after this range has been fully scanned.
  * It must accept these arguments: (error, lastScannedBlockNumber)
  * @returns {number} Number of threads started. They will continue working asynchronously in the background.
  */
async function scanBlockRange(startingBlock, stoppingBlock, callback) {
    
    if(!startingBlock) {
        startingBlock = parseInt( await web3.eth.getBlockNumber() ) - 1;
    }

     // If they didn't provide an explicit stopping block, then read
     // ALL of the blocks up to the current one.
 
     if (typeof stoppingBlock === 'undefined') {
         stoppingBlock = parseInt( await web3.eth.getBlockNumber() );
         console.log( stoppingBlock )
     }
 
     // If they asked for a starting block that's after the stopping block,
     // that is an error (or they're waiting for more blocks to appear,
     // which hasn't yet happened).
 
     if (startingBlock > stoppingBlock) {
         return -1;
     }
 
     let blockNumber = startingBlock,
         gotError = false,
         numThreads = 0,
         startTime = new Date();
 

     function getPercentComplete(bn) {
        
         var t = stoppingBlock - startingBlock,
             n = bn - startingBlock;
         return Math.floor(n / t * 100, 2);
     }
 
     function exitThread() {
        
         if (--numThreads == 0) {
             var numBlocksScanned = 1 + stoppingBlock - startingBlock,
                 stopTime = new Date(),
                 duration = (stopTime.getTime() - startTime.getTime())/1000,
                 blocksPerSec = Math.floor(numBlocksScanned / duration, 2),
                 msg = `Scanned to block ${stoppingBlock} (${numBlocksScanned} in ${duration} seconds; ${blocksPerSec} blocks/sec).`,
                 len = msg.length,
                 numSpaces = process.stdout.columns - len,
                 spaces = Array(1+numSpaces).join(" ");
 
             process.stdout.write("\r"+msg+spaces+"\n");
             if (callback) {
                 callback(gotError, stoppingBlock);
             }
         }
         return numThreads;
     }
 
     async function asyncScanNextBlock() {
         console.log(`[BLOCK] SCANNED ${SCANNED_TRANSACTIOSN} IN ${ ( Date.now() - START_TIME ) / 1000 }s`);
         // If we've encountered an error, stop scanning blocks
         if (gotError) {
             return exitThread();
         }
 
         // If we've reached the end, keep updating and retriving the last blocks minted
         if (blockNumber > stoppingBlock) {
            do {
                await sleep(3000);
                stoppingBlock = parseInt( await web3.eth.getBlockNumber() );
            } while (blockNumber > stoppingBlock)
         }
 
         // Scan the next block and assign a callback to scan even more
         // once that is done.
         var myBlockNumber = blockNumber++;
  
         // Write periodic status update so we can tell something is happening
         if (myBlockNumber % maxThreads == 0 || myBlockNumber == stoppingBlock) {
             var pctDone = getPercentComplete(myBlockNumber);
             process.stdout.write(`\rScanning block ${myBlockNumber} - ${pctDone} %\n`);
         }
 
         // Async call to getBlock() means we can run more than 1 thread
         // at a time, which is MUCH faster for scanning.
 
         web3.eth.getBlock(myBlockNumber.toString(), true, (error, block) => {
 
             if (error) {
                 // Error retrieving this block
                 gotError = true;
                 console.error("Error retriving the block:", error);
             } else {
                 scanBlockCallback(block);
                 asyncScanNextBlock();
             }
         });
     }
 
     var nt = 0;
     console.log( maxThreads, startingBlock + nt, stoppingBlock )
     for (nt = 0; nt < maxThreads && startingBlock + nt <= stoppingBlock; nt++) {
         numThreads++;
         try {
            asyncScanNextBlock();
         } catch (error) {
             console.log("[ERR] ERROR SCANNING BLOCK: ", error);
         }
     }
     return nt; // number of threads spawned (they'll continue processing)
 }
 
 // Scan all blocks from the starting block up to current,
 // and then keep scanning forever.
 

( async () => {
    FACTORY = await new web3.eth.Contract( EnumAbi[EnumChainId.BSC].FACTORIES.PANCAKE, EnumContracts[EnumChainId.BSC].FACTORIES.PANCAKE );
    
    mongoose.connect(configDB.url, {
        autoIndex: false,
        useNewUrlParser: true,
        useUnifiedTopology: true
    }).then(async () => { 
        loopUpdateMainTokenPrice(); // starts the loop that updates the main token price every 5 seconds
        loopUpdateOnDb(); // starts the loop that updates the db every 5 seconds
        scanBlockRange(undefined, undefined); // starts the blocks scanner
    })
    .catch(err => { console.log('MongoDB connection unsuccessful', err) });

    /**
     * @description Executes the stored queries inside BulkWriteOperations object of the scraper.
     * The queries are stored inside this object instead of directly executed to reduce the write operations on the database
     * and to take advandage of the bulk operations by aggregating all the stored queries
     * @returns 
     */
    async function loopUpdateOnDb(){
        while(true){
            await scraper.bulk.execute();
            await sleep(UPDATE_DATABASE_INTERVAL);
        }
    }

    /**
     * @description Update/Load the token histories of the passed contracts
     */
    function relDiff(a, b) {
        return  100 * Math.abs( ( a - b ) / ( (a+b)/2 ) );
    }
    
})();
