require('dotenv').config();
const ethers = require('ethers')
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

let swapSign = "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822";
let syncSign = "0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1";
let transferSign = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

//imports
var configDB = require('../server/config/database');
const mongoose = require('mongoose');
const Scraper = require('./scraper-price/Scraper');
const Queue = require('./scraper-price/Queue');
const scraper = new Scraper( web3_https );

const abiDecoder = require('abi-decoder');
const EnumAbi = require('../enum/abi');
const EnumChainId = require('../enum/chain.id');
const UtilsAddresses = require('../utils/addresses');
abiDecoder.addABI(EnumAbi[EnumChainId.BSC].TOKEN);
abiDecoder.addABI(EnumAbi[EnumChainId.BSC].ROUTERS.PANCAKE);


// extract swap informations from the log
function getSwapDatas( log ){
    let router = '0x' + log.topics[1].substr(26);
    let sender = '0x' + log.topics[2].substr(26);
    let decodedParams = ethers.utils.defaultAbiCoder.decode(['uint256','uint256','uint256','uint256'], log.data);
    let params = [];
    for( let param of decodedParams ) params.push(param.toString());
    let pair = log.address;
    return {
        router: toSum(router),
        sender: toSum(sender),
        pair: toSum(pair),
        params: params
    }
}
// extract transfer informations from the log
function getTransferDatas( log ){
    let from = '0x' + log.topics[1].substr(26);
    let to = '0x' + log.topics[2].substr(26);
    let decodedParams = ethers.utils.defaultAbiCoder.decode(['uint256'], log.data);
    let params = [];
    for( let param of decodedParams ) params.push(param.toString());
    let token = log.address;
    return {
        token: toSum(token),
        params: params,
        from: toSum(from),
        to: toSum(to)
    }
}
// extract sync informations from the log
function getSyncDatas( log ){
    let pair = log.address;
    let decodedParams = ethers.utils.defaultAbiCoder.decode(['uint112','uint112'], log.data);
    let params = [];
    for( let param of decodedParams ) params.push(param.toString());
    return {
        pair: toSum(pair),
        params: params
    }
}

function toSum( add ){
    return UtilsAddresses.toCheckSum(add);
}
function organizeEvents( hash, receipt ){
    let relevantEvents = {};
    let transfers = {}; // { [pairAdd]: { from: token0, to: token1 } }
    for ( let i = receipt.logs.length - 1; i >= 0; i -- ) {
        let log = receipt.logs[i];

        if( log.topics.includes(swapSign) ){
            let datas = getSwapDatas(log);
            if( !relevantEvents[datas.pair] ) relevantEvents[datas.pair] = {};
            relevantEvents[datas.pair].swap = datas;
        } else if ( log.topics.includes(syncSign) ){
            let datas = getSyncDatas(log);
                if( !relevantEvents[datas.pair] ) relevantEvents[datas.pair] = {};
            relevantEvents[datas.pair].sync = datas;
        } if( log.topics.includes(transferSign) ){
            let datas;
            try {
                datas = getTransferDatas(log);
            } catch( err ){
                console.log('Had error: ', hash, err); // error happens usualy when there is a transfer or erc-721 tokens
                continue;
            }
            if(!transfers[datas.from]) transfers[datas.from] = {};
            transfers[datas.from].from = {
                token: datas.token,
                amount: datas.params[0]
            };
            if(!transfers[datas.to]) transfers[datas.to] = {};
            transfers[datas.to].to = {
                token: datas.token,
                amount: datas.params[0]
            };
        }
    }

    for( pair in relevantEvents ){ // organize the transfer events inside the swaps
        if( !relevantEvents[pair].swap ) continue;
        relevantEvents[pair].swap.transfer = { }
        if(transfers[pair].to){ // happens that a swap has only one transfer ( on not verified contracts )
            relevantEvents[pair].swap.transfer.sold = {
                token: transfers[pair].to.token,
                amount: transfers[pair].to.amount
            }
        }
        if(transfers[pair].from){ // happens that a swap has only one transfer ( on not verified contracts )
            relevantEvents[pair].swap.transfer.bought = {
                token: transfers[pair].from.token,
                amount: transfers[pair].from.amount
            }
        }
    }
    return relevantEvents;
}
// prints out the swap/sync events
function printEvents( hash, events ){
    console.log('Transaction hash: ', hash);
    for( let pair in events ){
        console.log('-Pair: ', pair);
        let pairDatas = events[pair];
        if( pairDatas.swap ){
            console.log('\t-Swap')
            console.log('\t\tRouter: ', pairDatas.swap.router );
            console.log('\t\tSender: ', pairDatas.swap.sender );
            if( pairDatas.swap.transfer.bought )
                console.log('\t\tBought: ', pairDatas.swap.transfer.bought.token, pairDatas.swap.transfer.bought.amount );
            if( pairDatas.swap.transfer.sold )
                console.log('\t\tSold: ', pairDatas.swap.transfer.sold.token, pairDatas.swap.transfer.sold.amount );
        }
        if( pairDatas.sync ){
            console.log('\t-Updated Reserves');
            console.log('\t\tReserve0: ', pairDatas.sync.params[0]);
            console.log('\t\tReserve1: ', pairDatas.sync.params[1]);
        }
    }
}



async function scanTransactionCallback(hash, pair, pairDatas) {
    //console.log( txn.to, txn.from )
 
        await scraper.calculatePriceFromReserves(hash, pair, pairDatas);
        //TotalTx --;
        //console.log('[TOTAL TX] ', TotalTx);
  
}

( async () => {

    mongoose.connect(configDB.url, {
        autoIndex: false,
        useNewUrlParser: true,
        useUnifiedTopology: true
    }).then(async () => { 
        loopUpdateOnDb(); // starts the loop that updates the db every 5 seconds
    })
    .catch(err => { console.log('MongoDB connection unsuccessful', err); process.exit() });

    let scrapedTxs = []; 
    async function logCallback(error, tx){
        let hash = tx.transactionHash;
        if( error ) return console.log( error );
        if( scrapedTxs.indexOf(hash) != -1 ) return;
        
        scrapedTxs.push(hash);
        let receipt;
        try {
            receipt = await web3_https.eth.getTransactionReceipt(hash);
        } catch (error) {
            return console.log('[RECEIPT ERR]', error);
        }
        if(!receipt) return;
        
        let relevantEvents = organizeEvents(hash, receipt);
        // printEvents( hash, relevantEvents );

        for( let pair in relevantEvents ) scanTransactionCallback( hash, pair, relevantEvents[pair] );
    }
     
    let queue = new Queue(100, logCallback);
    let filter = [ syncSign ];
    var subscription = web3_wss.eth.subscribe('logs', {
        topics: filter
    }, 
        async (error, tx) => {
            console.log(tx)
            console.log('Detected new log', tx.transactionHash);
            queue.add(error, tx) 
        }
    );

    // unsubscribes the subscription
    subscription.unsubscribe(function(error, success){
        if(success) console.log('Successfully unsubscribed!');
    });


    /**
     * @description Executes the stored queries inside BulkWriteOperations object of the scraper.
     * The queries are stored inside this object instead of directly executed to reduce the write operations on the database
     * and to take advandage of the bulk operations by aggregating all the stored queries
     * @returns null
     */
    function getWriteTime( timeMs ) { return Math.floor( (timeMs/1000) / process.env.WRITE_TO_DB_SECONDS) * process.env.WRITE_TO_DB_SECONDS; }
    async function loopUpdateOnDb(){
        while(true){
            let now = getWriteTime(Date.now());
            await sleep(1000);
            // push the updates every minute change to optimize the writes on the database
            if( now != getWriteTime( Date.now() + 1000 ) ) { await scraper.bulk.execute(); }
            // await sleep(5000);
            // await scraper.bulk.execute();
        }
    }
    
})();