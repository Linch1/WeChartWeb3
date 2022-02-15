require('dotenv').config();

const EnumChainId = require('../enum/chain.id');
const EnumAbi = require('../enum/abi');
const EnumContracts = require('../enum/contracts');
const EnumMainTokens = require('../enum/mainTokens');

// initialize mongodb
const TokenBasic = require('../server/models/token_basic');
const TokenHistory = require('../server/models/token_history');
const TIME_INTERVALL_UIX_TIMESTAMP = 60;
let TOTAL_TX = 0;
let INITAL_MEMORY_USAGE = 0;

let BulkWriteOperations = {
    tokenHistory: {
    /*  
        tokenAddress: { 
            insert: {
                name: 'Eddard Stark',
                title: 'Warden of the North'
            }, 
            update: {
                updateOne: {
                filter: { name: 'Eddard Stark' },
                // If you were using the MongoDB driver directly, you'd need to do
                // `update: { $set: { title: ... } }` but mongoose adds $set for
                // you.
                update: { title: 'Hand of the King' }
                }
            },
            delete:  {
                deleteOne: {
                    {
                        filter: { name: 'Eddard Stark' }
                    }
                }
            }
        } 
    */
    }
} 


let TOKENS_CACHE_SIZE = 1000;
let TOKENS_CACHE_ORDER = [];
let TOKENS_HISTORY_CACHE_ORDER = [];
let CACHE = {
    token: {}, // tokenAddress => TokenBasic object
    tokenHistory: {}
}; 




var configDB = require('../server/config/database');
const mongoose = require('mongoose');

const abiDecoder = require('abi-decoder');
abiDecoder.addABI(EnumAbi[EnumChainId.BSC].TOKEN);
abiDecoder.addABI(EnumAbi[EnumChainId.BSC].ROUTERS.PANCAKE);



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
    let tokenInfo = CACHE.token[foundToken.contract];
    if( !newPrice ) return;

    if(!BulkWriteOperations.tokenHistory[foundToken.contract]) BulkWriteOperations.tokenHistory[foundToken.contract] = {};
    if(!BulkWriteOperations.tokenHistory[foundToken.contract].update) {
        console.log(`[BULK ADD UPDATE] ${Object.keys(BulkWriteOperations.tokenHistory).length} ${foundToken.contract}`);
        BulkWriteOperations.tokenHistory[foundToken.contract].update = {
            updateOne: {
                filter: { _id: mongoose.Types.ObjectId(foundToken._id) },
                update: { 
                    $push: { 'price.history': { $each: [] } }, 
                    $inc: { 'price.records': 0 },
                    $set: { },
                }
            }
        };
    }
    
    let latestHistoryTime = latestHistory ? latestHistory.time: 0;
    let historiesNotPushed = BulkWriteOperations.tokenHistory[foundToken.contract].update.updateOne.update.$push['price.history'].$each.length;
    if( historiesNotPushed ){
        latestHistory = BulkWriteOperations.tokenHistory[foundToken.contract].update.updateOne.update.$push['price.history'].$each[historiesNotPushed-1];
        latestHistoryTime = latestHistory.time;
    }
    
    let recordIndexToUpdate = (foundToken.price.records - 1) > 0 ? foundToken.price.records - 1 : 0;
    if( ( now - latestHistoryTime ) < TIME_INTERVALL_UIX_TIMESTAMP ){ // update latest record
        
        if( newPrice > latestHistory.high ){
            BulkWriteOperations.tokenHistory[foundToken.contract].update.updateOne.update.$set[`price.history.${recordIndexToUpdate}.high`] = newPrice;
        }
        if( newPrice < latestHistory.low ){
            BulkWriteOperations.tokenHistory[foundToken.contract].update.updateOne.update.$set[`price.history.${recordIndexToUpdate}.low`] = newPrice;
        }
        // update the value anyway also if it is not higher that the high or lower than the low 
        BulkWriteOperations.tokenHistory[foundToken.contract].update.updateOne.update.$set[`price.history.${recordIndexToUpdate}.value`] = newPrice;

    } else { // create new record
        if( latestHistory ) // update close price of latest record
            BulkWriteOperations.tokenHistory[foundToken.contract].update.updateOne.update.$set[`price.history.${recordIndexToUpdate}.close`] = newPrice;
        
        if(tokenInfo ) console.log(`[MCAP] TOTAL SUPPLY: ${tokenInfo.total_supply} BURNED: ${tokenInfo.burned}. ${tokenInfo.total_supply - tokenInfo.burned}`, tokenInfo);
        let newObj = {
            time: Math.floor(now/TIME_INTERVALL_UIX_TIMESTAMP) * TIME_INTERVALL_UIX_TIMESTAMP, // to have standard intervals, for example the exact minutes on the time. 9:01, 9:02, 9:03
            open: newPrice,
            close: newPrice,
            high: newPrice,
            low: newPrice,
            value: newPrice,
            burned: tokenInfo ? tokenInfo.burned : null,
            mcap: tokenInfo ? (tokenInfo.total_supply - tokenInfo.burned) * newPrice : null
        };
        BulkWriteOperations.tokenHistory[foundToken.contract].update.updateOne.update.$push['price.history'].$each.push(newObj);
        BulkWriteOperations.tokenHistory[foundToken.contract].update.updateOne.update.$inc['price.records'] ++;
    }
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
];
async function calculatePriceFromReserves( tx ){
    // break if the transaction didn't interacted with pancake
    if( !( tx.to.toLowerCase() == EnumContracts[EnumChainId.BSC].ROUTERS.PANCAKE.toLowerCase() ) ) {
        return;
    }
    // get the transaction reciept
    let tx_data = tx.data; // get the swap parameters
    if( !tx_data ) tx_data = tx.input; // the .data property sometime is in the .input field
    if( !tx_data ) { return; }

    let decoded_data = abiDecoder.decodeMethod(tx_data); // decode the parameters of the transaction
    if( !decoded_data ){ 
        return;
    }
    if( !METHODS.includes(decoded_data.name) ){ 
        return;
    }

    let params = decoded_data.params; // decoded parameters

    let path = [];
    for(i in params){  // loop to print parameters without unnecessary info
        if( params[i].name == 'path' ){
            path = params[i].value;
        } 
    }

    if( !path[0] ) {
        return
    }; // if not path param return

    let [ firstToken0Add, firstToken1Add ] = 
        path[0] < path[1] ? [path[0], path[1]] : [path[1], path[0]];
    let [ secondToken0Add, secondToken1Add ] = 
        path[path.length-2] < path[path.length-1] ? [path[path.length-2], path[path.length-1]] : [path[path.length-1], path[path.length-2]];
    
    await updatePairPriceWithReserves(firstToken0Add.toLowerCase(), firstToken1Add.toLowerCase());    
    
}
async function updatePairPriceWithReserves( token0, token1 ){

    let pair_contract =  getPair(token0, token1);


    let first_pair =  await new web3.eth.Contract( EnumAbi[EnumChainId.BSC].PAIR.PANCAKE, pair_contract );
    let first_reserves = await first_pair.methods.getReserves().call();
    
    let [ mainToken, dependantToken ] = await tokenHierarchy(token0, token1);
    if(!mainToken || !dependantToken) return;

    let dependantTokenPrice = null;
    if( mainToken.contract == token0 ) { // here contract
        dependantTokenPrice = (first_reserves[0]/10**mainToken.decimals)/(first_reserves[1]/10**dependantToken.decimals); // here decimals
    } else {
        dependantTokenPrice = (first_reserves[1]/10**mainToken.decimals)/(first_reserves[0]/10**dependantToken.decimals); 
    }

    if( mainToken.contract == EnumMainTokens[EnumChainId.BSC].WBNB.address )
        dependantTokenPrice = dependantTokenPrice * MAIN_TOKEN_PRICE;

    let tokenHistory = await getTokenHistory( dependantToken.contract );
    if(!BulkWriteOperations.tokenHistory[dependantToken.contract]) BulkWriteOperations.tokenHistory[dependantToken.contract] = {};

    if( !tokenHistory ){
        tokenHistory = {
            price: {
                history: [],
                records: 0 
            },
            chain: EnumChainId.BSC,
            name: dependantToken.name,
            contract: dependantToken.contract
        };

        console.log(`[BULK ADD CREATE] ${Object.keys(BulkWriteOperations.tokenHistory).length} ${dependantToken.contract}`);
        BulkWriteOperations.tokenHistory[dependantToken.contract].insert = tokenHistory;

        addTokenHistory(dependantToken.contract, tokenHistory);
    }

    console.log(`[INFO] MAIN: ${mainToken.contract} | DEPENDANT: ${dependantToken.contract}`); 
    console.log(`[INFO] DEPENDANT PRICE: ${dependantTokenPrice}$`);
    
    await updatePrice( tokenHistory, tokenHistory.price, dependantTokenPrice );
}
async function getBurnedAmount( token ){
    let tokenContract = await new web3.eth.Contract( EnumAbi[EnumChainId.BSC].PAIR.PANCAKE, token );
    let zeroAddAmount = await tokenContract.methods.balanceOf("0x0000000000000000000000000000000000000000").call();
    let burnAddAmount = await tokenContract.methods.balanceOf("0x000000000000000000000000000000000000dEaD").call();
    return zeroAddAmount + burnAddAmount;
}

// HANDLE TOKEN HISTORY CACHE
function addTokenHistory( token, history ){
    console.log(`[CACHE SIZE TOKEN HISTORY] ${Object.keys(CACHE.tokenHistory).length}`);
    let cacheSize = TOKENS_HISTORY_CACHE_ORDER.length;
    if( cacheSize > TOKENS_CACHE_SIZE ){ // keeps the tokens cache with a fixed size
        let toRemove = TOKENS_HISTORY_CACHE_ORDER.shift();
        if( toRemove === EnumMainTokens[EnumChainId.BSC].WBNB.address ) { // PICK ANOTHER ONE TO REMOVE IF IT WAS BNB ADDRESS
            TOKENS_HISTORY_CACHE_ORDER.push(EnumMainTokens[EnumChainId.BSC].WBNB);
            toRemove = TOKENS_HISTORY_CACHE_ORDER.shift();
        }
        delete CACHE.tokenHistory[toRemove];
    }
    TOKENS_HISTORY_CACHE_ORDER.push( token );
    CACHE.tokenHistory[token] = history;
}
async function getTokenHistory( token ){
    let tokenHistory = CACHE.tokenHistory[token];
    if(!tokenHistory){
        tokenHistory = await TokenHistory
        .findOne({ contract: token } ,{'price.history': { $slice: -1 } } )
        .select({ contract: 1, decimals: 1, pair: 1 })
        .lean()
        .exec();
        if(!tokenHistory) return null;
    }
    addTokenHistory( token, tokenHistory );
    return tokenHistory;
}
// END HANDLE TOKEN HISTORY CACHE

async function getTokenInfos( token ){
    let tokenInfo = CACHE.token[token];
    let cacheSize = TOKENS_CACHE_ORDER.length;
    console.log(`[CACHE SIZE TOKEN] ${cacheSize}`);
    if( cacheSize > TOKENS_CACHE_SIZE ){ // keeps the tokens cache with a fixed size
        let toRemove = TOKENS_CACHE_ORDER.shift();
        if( toRemove === EnumMainTokens[EnumChainId.BSC].WBNB.address ) { // PICK ANOTHER ONE TO REMOVE IF IT WAS BNB ADDRESS
            TOKENS_CACHE_ORDER.push(EnumMainTokens[EnumChainId.BSC].WBNB);
            toRemove = TOKENS_CACHE_ORDER.shift();
        }
        delete CACHE.token[toRemove];
    }

    let searchOnDb = true;

    if( tokenInfo && tokenInfo.notFound ){
        if( ( Date.now() - tokenInfo.date ) < 1000 * 60 ) searchOnDb = false
    }
    
    if( searchOnDb && (!tokenInfo || tokenInfo.notFound) ) {
        tokenInfo = await TokenBasic
        .findOne({ contract: token })
        .select({ contract: 1, decimals: 1, pairs_count: 1, total_supply: 1 })
        .lean()
        .exec();
        console.log(`[LOADED TOKEN] ${token} `, tokenInfo);
        if(tokenInfo) {
            TOKENS_CACHE_ORDER.push( token );
            CACHE.token[token] = tokenInfo;
        }
        else CACHE.token[token] = { notFound: true, date: Date.now() };
    } 

    if(tokenInfo && !tokenInfo.burned) tokenInfo.burned = (await getBurnedAmount(token))/10**tokenInfo.decimals;
    return tokenInfo;
}
async function tokenHierarchy( tokenA, tokenB ){
    // get the tokens from the db
    let first_token = await getTokenInfos( tokenA );
    let latest_token = await getTokenInfos( tokenB );
    
    if( !first_token || !latest_token ){
        if(!first_token) console.log("[ERR] MISSING: ", tokenA)
        if(!latest_token) console.log("[ERR] MISSING: ", tokenB)
        return [null, null];
    }
    // compare wich of the tokens is used more frequently to create pairs. This means that the one with more pairs is the more common used
    let pairs_comparison = first_token.pairs_count > latest_token.pairs_count; // here pairs_count
    let main_token = pairs_comparison ? first_token : latest_token;
    let dependant_token = pairs_comparison ? latest_token : first_token;
    return [ main_token, dependant_token ];
}
function getPair(tokenA, tokenB) {
    let _hexadem = '0x00fb7f630766e6a796048ea87d01acd3068e8ff67d078148a3fa3f4a84f69bd5';
    let _factory = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";
    let [token0, token1] = tokenA < tokenB ? [tokenA, tokenB] : [tokenB, tokenA];

    let abiEncoded1 =  web3.eth.abi.encodeParameters(['address', 'address'], [token0, token1]);
    abiEncoded1 = abiEncoded1.split("0".repeat(24)).join("");
    let salt = web3.utils.soliditySha3(abiEncoded1);
    let abiEncoded2 =  web3.eth.abi.encodeParameters(['address', 'bytes32'], [_factory, salt]);
    abiEncoded2 = abiEncoded2.split("0".repeat(24)).join("").substr(2);
    let pair = '0x' + Web3.utils.soliditySha3( '0xff' + abiEncoded2, _hexadem ).substr(26);
    return pair
}


async function updateMainTokenPrice(){

    let mainTokenPairAddress = await FACTORY.methods.getPair( EnumMainTokens[EnumChainId.BSC].WBNB.address, EnumMainTokens[EnumChainId.BSC].USDT.address ).call();
    let mainTokenPair = await new web3.eth.Contract( EnumAbi[EnumChainId.BSC].PAIR.PANCAKE, mainTokenPairAddress );
    let reserves = await mainTokenPair.methods.getReserves().call();

    let WBNB_RESERVE = reserves[1]/10**EnumMainTokens[EnumChainId.BSC].WBNB.decimals;
    let USDT_RESERVE = reserves[0]/10**EnumMainTokens[EnumChainId.BSC].USDT.decimals;

    let WBNB_PRICE = USDT_RESERVE/WBNB_RESERVE;

    let tokenHistory = await getTokenHistory(EnumMainTokens[EnumChainId.BSC].WBNB.address);
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

async function loopUpdateMainTokenPrice(){
    while( true ){
        await updateMainTokenPrice();
        await sleep(5000);
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

 let Web3 = require('web3');
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
 let maxThreads = 100;
 
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
        TOTAL_TX ++;
        try {
            await calculatePriceFromReserves(txn);
        } catch (error) {
            console.log("[ERR]", error)
        }
        TOTAL_TX --;
        //await calculatePriceFromReserves(txn);
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
        console.log('MongoDB is connected');

        
        // await loadCacheTokensBasic();
        // await loadCacheTokenHistories();

        INITAL_MEMORY_USAGE = process.memoryUsage().heapUsed;
        
        
        loopUpdateMainTokenPrice();
        // loopUpdateTokensBasic();
        loopUpdateOnDb();

        scanBlockRange(undefined, undefined);
    })
    .catch(err => {
        console.log('MongoDB connection unsuccessful');
        console.log(err)
    });

    /**
     * @description Executes the stored queries inside BulkWriteOperations object.
     * The queries are stored inside this object instead of directly executed to reduce the write operations on the database
     * and to take advandage of the bulk operations by aggregating all the stored queries
     * @returns 
     */
    async function updateOnDb(){
        let start = Date.now();
        let toExecuteInsert = [];
        let toExecutePush = [];
        let toExecuteSet = [];
        let tokenToUpdate = [];

        let tokenContracts = Object.keys(BulkWriteOperations.tokenHistory); 
        let BulkWriteOperationsClone = JSON.parse(JSON.stringify(BulkWriteOperations));
        
        delete BulkWriteOperations.tokenHistory;
        BulkWriteOperations.tokenHistory = {};

        for( let contract of tokenContracts ){

            let toInsert = BulkWriteOperationsClone.tokenHistory[contract].insert;
            if(toInsert) toExecuteInsert.push(toInsert);

            let toUpdate = BulkWriteOperationsClone.tokenHistory[contract].update;

            if(toUpdate) {
                tokenToUpdate.push(contract);
                let clonedPush = JSON.parse(JSON.stringify(toUpdate));
                let clonedSet = JSON.parse(JSON.stringify(toUpdate));

                delete clonedPush.updateOne.update['$set'];
                delete clonedPush.updateOne.update['$inc'];
                toExecutePush.push( clonedPush );

                delete clonedSet.updateOne.update['$push'];
                toExecuteSet.push( clonedSet );
            }
        }
       
        await TokenHistory.insertMany(toExecuteInsert);
        await TokenHistory.bulkWrite(toExecutePush);
        await TokenHistory.bulkWrite(toExecuteSet);

        await updateTokenHistories( tokenContracts );
        return;
    }

    async function loopUpdateOnDb(){
        while(true){
            await updateOnDb();
            await sleep(5000);
        }
    }

    /**
     * @description Loads all the tokens that are inside the db to prevent read operations every time
     */
    async function loadCacheTokensBasic(){
        let start = Date.now();
        let tokens = await TokenBasic.find({}).select({ contract: 1, decimals: 1, pairs_count: 1 }).sort({_id: -1}).lean().exec();
        for( let token of tokens ){ CACHE.token[token.contract] = token; };
        CACHE.token.LAST = tokens[0]._id;
        console.log(`[LOAD] LOADED TOKENS IN CACHE: ${tokens.length}, TIME ${(Date.now()-start)/1000}` );
    }
    /**
     * @description update the tokens to load the new ones
     */
    async function updateTokensBasic(){
        let start = Date.now();
        let tokens = await TokenBasic.find({ _id: { $gt: mongoose.Types.ObjectId(CACHE.token.LAST) } } ).select({ contract: 1, decimals: 1, pairs_count: 1 }).sort({_id: -1}).lean().exec();
        for( let token of tokens ){ CACHE.token[token.contract] = token; };
        if(tokens[0]) CACHE.token.LAST = tokens[0]._id;
        console.log(`[LOAD UPDATE] TOKENS: UPDATED ${tokens.length}, TIME ${ (Date.now()-start)/1000} - TOTAL ${Object.keys(CACHE.token).length}`);
    }
    /**
     * @description Updates every interval the tokens
     */
    async function loopUpdateTokensBasic(){
        while( true ){
            await updateTokensBasic();
            await sleep(5000);
        }
    }

    /**
     * @description Loads all the token histories that are inside the db to prevent read operations every time
     */
    async function loadCacheTokenHistories(){
        let start = Date.now();
        let tokenHistories = await TokenHistory.find({} ,{'price.history': { $slice: -1 } } ).select({ contract: 1, decimals: 1, pair: 1 }).lean().exec();
        for( let history of tokenHistories ) CACHE.tokenHistory[history.contract] = history; 
        console.log(`[LOAD] LOADED HISTORIES IN CACHE: ${tokenHistories.length}, TIME ${(Date.now()-start)/1000}` );
    }

    /**
     * @description Update/Load the token histories of the passed contracts
     */
    function relDiff(a, b) {
        return  100 * Math.abs( ( a - b ) / ( (a+b)/2 ) );
    }
    async function updateTokenHistories(contracts){
        let start = Date.now();
        INITAL_MEMORY_USAGE
        let tokenHistories = await TokenHistory.find({
            contract: { $in: contracts }
        } ,{'price.history': { $slice: -1 } } ).select({ contract: 1, decimals: 1, name: 1 }).lean().exec();
        for( let history of tokenHistories ) addTokenHistory( history.contract, history );
        console.log(`[LOAD UPDATE] HISTORIES: UPDATED ${tokenHistories.length}, TIME ${ (Date.now()-start)/1000} - TOTAL ${Object.keys(CACHE.tokenHistory).length}`);
        console.log(`[MEMORY]`, process.memoryUsage())
        console.log(`[MEMORY] USAGE INCREASE: ${relDiff(INITAL_MEMORY_USAGE, process.memoryUsage().heapUsed) }`)
    }
    
})();
