require('dotenv').config();

const EnumChainId = require('../enum/chain.id');
const EnumAbi = require('../enum/abi');
const EnumContracts = require('../enum/contracts');

// initialize mongodb
const Pair = require('../models/pair');
const TokenBasic = require('../models/token_basic');
const TokenHistory = require('../models/token_history');
const TIME_INTERVALL_UIX_TIMESTAMP = 10;
let TOTAL_TX = 0;
var configDB = require('../server/config/database');
const mongoose = require('mongoose');

/**
 * UTILS FUNCTION FOR UPDATE THE PRICE ON THE DATABASE
 * 
 * 
 */

 function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function updatePrice( foundToken, priceObj, newPrice ) {
    let now = Date.now()/1000;
    let latestHistory = priceObj.history[ priceObj.history.length - 1 ];
    let latestHistoryTime = latestHistory ? latestHistory.time: 0;
    if( !newPrice ) newPrice = 0;

    if( ( now - latestHistoryTime ) < TIME_INTERVALL_UIX_TIMESTAMP ){ // update latest record
      
        if( newPrice > latestHistory.high ){
            console.log("UPDATED: ", foundToken._id );
            await TokenHistory.findByIdAndUpdate( foundToken._id, 
                { $set: { 'price.history.$[el].high': newPrice, 'price.history.$[el].value': newPrice } }, 
                { arrayFilters: [{ "el.time": latestHistoryTime }] } 
            ); 
        }
        if( newPrice < latestHistory.low ){
            console.log("UPDATED: ", foundToken._id );
            await TokenHistory.findByIdAndUpdate( foundToken._id, 
                { $set: { 'price.history.$[el].low': newPrice } }, 
                { arrayFilters: [{ "el.time": latestHistoryTime }] } 
            ); 
        }

    } else { // create new record
        if( latestHistory ) latestHistory.close = newPrice; // update close price of latest record
        let newObj = {
            time: now,
            open: newPrice,
            close: newPrice,
            high: newPrice,
            low: newPrice,
            value: newPrice
        };
        console.log("UPDATED: ", foundToken._id );
        await TokenHistory.findByIdAndUpdate( foundToken._id, { $push: {'price.history': newObj }, $inc: { 'price.records': 1 } } ); 
    }
    TOTAL_TX --;
    console.log("TOTAL TX: ", TOTAL_TX);
}

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




// methods used from pancakeswap for swap tokens
let METHODS = [
    "swapETHForExactTokens",
    "swapExactETHForTokens",
    "swapExactETHForTokensSupportingFeeOnTransferTokens",
    "swapExactTokensForETH",
    "swapExactTokensForETHSupportingFeeOnTransferTokens",
    "swapExactTokensForTokens",
    "swapExactTokensForTokensSupportingFeeOnTransferTokens",
    "swapTokensForExactETH",
    "swapTokensForExactTokens"
]
// function to retrive the token price
async function calculateSwappedTokensFromTx( tx ){
    // break if the transaction didn't interacted with pancake
    if( !( tx.to.toLowerCase() == EnumContracts[EnumChainId.BSC].ROUTERS.PANCAKE.toLowerCase() ) ) return;
    // get the transaction reciept
    let tx_data = tx.data; // get the swap parameters
    if( !tx_data ) tx_data = tx.input; // the .data property sometime is in the .input field
    if( !tx_data ) { console.log('CANNOT RETRIVE THE TRANSACTION DATAS'); return; }

    let decoded_data = abiDecoder.decodeMethod(tx_data); // decode the parameters of the transaction
    if( !decoded_data ) return;
    if( !METHODS.includes(decoded_data.name) ) return;

    let params = decoded_data.params; // decoded parameters
    let sent_tokens; // get the sent tokens to swap 

    let tokens_from_swap; // get the recived tokens from the swap
    let path = [];
    for(i in params){  // loop to print parameters without unnecessary info
        if( params[i].name == 'path' ){
        path = params[i].value;
        } else if( params[i].name == 'amountIn' || params[i].name == 'amountInMax' ){
        sent_tokens = params[i].value;
        } else if( params[i].name == 'amountOutMin' || params[i].name == 'amountOut' ){
        tokens_from_swap = params[i].value;
        }
    }

    if( !sent_tokens && tx.value ) { sent_tokens = tx.value }
    if( !path[0] ) return; // if not path param return
    if( !sent_tokens || !tokens_from_swap ) return; // if not amountIn or amountOut return

    // retrive informations about the tokens involved in the transaction
    let first_token_contract_in_path = path[0].toLowerCase();
    let latest_token_contract_in_path = path[ path.length - 1 ].toLowerCase();

    // get the tokens from the db
    let first_token = await TokenBasic.findOne({ contract: first_token_contract_in_path });
    let latest_token = await TokenBasic.findOne({ contract: latest_token_contract_in_path });
    console.log(`FIRST TOKEN NOT FOUND: ${!first_token} | LAST TOKEN NOT FOUND: ${!latest_token}`);
    
    if( !first_token || !latest_token ){
        console.log( "METHOD: ", decoded_data.name );
        console.log( "PATH: ", path );
        if(!first_token) console.log("MISSING 1: ", first_token)
        if(!latest_token) console.log("MISSING 2: ", latest_token)
        return;
    }
    // specify the amount of tokens in the transactions of the first_token and latest_token
    first_token.tokens = sent_tokens / ( 10**first_token.decimals );
    latest_token.tokens = tokens_from_swap / ( 10**latest_token.decimals );

    // compare wich of the tokens is used more frequently to create pairs. This means that the one with more pairs is the more common used
    let pairs_comparison = first_token.pairs_count > latest_token.pairs_count;
    let main_token = pairs_comparison ? first_token : latest_token;
    let dependant_token = pairs_comparison ? latest_token : first_token;
    console.log( `MAIN TOKEN: ${main_token.contract}| DEPENDANT TOKEN: ${dependant_token.contract} ` );
    console.log( `MAIN TOKEN: ${main_token.name} ${main_token.tokens} | DEPENDANT TOKEN: ${dependant_token.name} ${dependant_token.tokens}` );

    // calculating the price of the dependant_token using the main_token
    dependant_token.price = main_token.tokens/dependant_token.tokens;

    console.log( `${dependant_token.name} PRICE: ${dependant_token.price} ${main_token.symbol}. \n${dependant_token.contract}`);

    if( main_token.contract == EnumMainTokens[EnumChainId.BSC].WBNB.address ){
        dependant_token.price = dependant_token.price * MAIN_TOKEN_PRICE;
    } else if( [ 
        EnumMainTokens[EnumChainId.BSC].BUSD.address,
        EnumMainTokens[EnumChainId.BSC].USDC.address,
        EnumMainTokens[EnumChainId.BSC].USDT.address,
        EnumMainTokens[EnumChainId.BSC].DAI.address
    ].includes( main_token.contract ) ){
        dependant_token.price = dependant_token.price;
    }
        

    console.log( `${dependant_token.name} PRICE: ${dependant_token.price}$.\n\n` );
    

    let tokenHistory = await TokenHistory.findOne({ contract: dependant_token.contract }).lean().exec();
    if( !tokenHistory ){
        tokenHistory = new TokenHistory({
            price: {
                history: [],
                records: 0 
            },
            chain: EnumChainId.BSC,
            name: dependant_token.name,
            contract: dependant_token.contract
        });
        await tokenHistory.save();
    }

    
    await updatePrice( tokenHistory, tokenHistory.price, dependant_token.price );
}
async function updateTokenPriceFromTx(){

}
async function updateMainTokenPrice(){

    let mainTokenPairAddress = await FACTORY.methods.getPair( EnumMainTokens[EnumChainId.BSC].WBNB.address, EnumMainTokens[EnumChainId.BSC].USDT.address ).call();
    let mainTokenPair = await new web3.eth.Contract( EnumAbi[EnumChainId.BSC].PAIR.PANCAKE, mainTokenPairAddress );
    let reserves = await mainTokenPair.methods.getReserves().call();

    let WBNB_RESERVE = reserves[1]/10**EnumMainTokens[EnumChainId.BSC].WBNB.decimals;
    let USDT_RESERVE = reserves[0]/10**EnumMainTokens[EnumChainId.BSC].USDT.decimals;

    let WBNB_PRICE = USDT_RESERVE/WBNB_RESERVE;

    let tokenHistory = await TokenHistory.findOne({ contract: EnumMainTokens[EnumChainId.BSC].WBNB.address }).lean().exec();
    if( !tokenHistory ){
        tokenHistory = new TokenHistory({
            price: {
                history: [],
                records: 0 
            },
            chain: EnumChainId.BSC,
            name: "Wrapped BNB",
            contract: EnumMainTokens[EnumChainId.BSC].WBNB.address
        });
        await tokenHistory.save();
    }

    await updatePrice( tokenHistory, tokenHistory.price, WBNB_PRICE );
    MAIN_TOKEN_PRICE = WBNB_PRICE;
}


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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

 let Web3 = require('web3');
const EnumChainId = require('../enum/chain.id');
const EnumMainTokens = require('../enum/mainTokens');
 ////////////////////////////////////////////////////////////////////////////////
 // BEGIN CONFIGURATION SECTION
 ////////////////////////////////////////////////////////////////////////////////
 
 /**
  * Location of your geth server
  *
  * It must be running with RPC enabled, and you must have access to
  * connect to it through your and its firewall.
  *
  * @type {{host: string, port: number}}
  */
 let gethServer = {
     host: '127.0.0.1', // change this to your geth hostname/IP
     port: 27147 // change this to your geth RPC port
 };
 
 /**
  * Address of the Ethereum account you wish to scan
  *
  * Example: 0x0123456789012345678090123456789012345678
  *
  * @type {string}
  */
 let wallet = "0x10ED43C718714eb63d5aA57B78B54704E256024E"; // change this to your Ethereum account number
 
 /**
  * Which block to start scanning.
  *
  * You can start at block 0, but it will take FOREVER to scan,
  * so you probably don't want to do that.
  *
  * Generally speaking on a dual-core CPU that runs both geth
  * and this scanning client, I can scan ~ 300 blocks/second,
  * but in so doing, the CPU maxed at 100%.
  *
  * @type {number}
  */
 let firstBlockNumber = 11651457;
 
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
 let maxThreads = 50;
 
 ////////////////////////////////////////////////////////////////////////////////
 // END CONFIGURATION SECTION
 ////////////////////////////////////////////////////////////////////////////////
 
 /**
  * Initialize Ethereum Web3 client (if we haven't already)
  * @type {Web3}
  */

  let web3 = new Web3(process.env.PROVIDER); 


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
    if (txn.to === wallet || txn.from === wallet ) {
        await calculateSwappedTokensFromTx(txn);
        //await calculatePriceFromReserves(txn);
        TOTAL_TX ++;
    } 
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
         console.log( `BLOCK ${block.number}: ${block.transactions.length} Transaction` )
         for (var i = 0; i < block.transactions.length; i++) {
             var txn = block.transactions[i];
             await scanTransactionCallback(txn, block);
         }
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
         console.log(`SCANNED: ${SCANNED_TRANSACTIOSN} IN ${ ( Date.now() - START_TIME ) / 1000 }s`);
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
                console.log( block )
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
         asyncScanNextBlock();
     }
     return nt; // number of threads spawned (they'll continue processing)
 }
 
 // Scan all blocks from the starting block up to current,
 // and then keep scanning forever.
 
let START_TIME = Date.now();
let FACTORY;
let MAIN_TOKEN_PRICE;
( async () => {
    FACTORY = await new web3.eth.Contract( EnumAbi[EnumChainId.BSC].FACTORIES.PANCAKE, EnumContracts[EnumChainId.BSC].FACTORIES.PANCAKE );
    

    

    mongoose.connect(configDB.url, {
        autoIndex: false,
        useNewUrlParser: true,
        useUnifiedTopology: true
    }).then(async () => { 
        console.log('MongoDB is connected') 

        await updateMainTokenPrice();

        scanBlockRange(undefined, undefined);

        setInterval( async () => {
            try {
                await updateMainTokenPrice();
            } catch (error) {
                console.log("ERROR RETRIVING MAIN TOKEN PRICE: ", error);
            }
        }, 1000);
    })
    .catch(err => {
        console.log('MongoDB connection unsuccessful');
        console.log(err)
    });
    
})();
