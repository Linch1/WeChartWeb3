require('dotenv').config();
const configDB = require('../../server/config/database');
const Services = require('../../server/service');
const mongoose = require('mongoose');
const getDataFromLog = require('../lib/logs');
const {getBlockSyncEvents, getReceiptsBatch} = require('../lib/scrape.block.past');
const { web3 } = require('../web3');

const fs = require('fs');
const stream = require('stream');
const readline = require('readline');
const { getSyncInBlockForPairs } = require('./sync.in.block');

function toSum(add){
    return web3.utils.toChecksumAddress(add)
}

/*
0xe5c672ebf81cee90849fca88d3ecb2b75141aa847345250e6697aa5d2bc70452 -> orionPool tx arbitrage
0xe74f4a187571430afa2d432c4ff4f985d8f678ad4112d80ddde3a1369b1bf0f2 -> MDEX LP tx arbitrage
0x8de6c6997a55a9cc0223c708bf6facb852ac5f00328b39dce9b520c803829a85 -> orionPool tx arbitrage
*/


let arbitrageOutputLog = '/root/.pm2/logs/arbitrage.master-out.log';
const searchStream = (filename, text) => {
    return new Promise((resolve) => {
        const inStream = fs.createReadStream(filename);
        const outStream = new stream;
        const rl = readline.createInterface(inStream, outStream);
        const result = [];
        const regEx = new RegExp(text, "i")
        rl.on('line', function (line) {
            if (line && line.search(regEx) >= 0) {
                result.push(line)
            }
        });
        rl.on('close', function () {
            resolve(result)
        });
    })
}

/*

*/

( async () => {

    //let arbitrageLogs = fs.readFileSync("/root/.pm2/logs/arbitrage.master-out.log", "utf-8");
    
    mongoose.connect(configDB.url, {
        autoIndex: false,
        useNewUrlParser: true,
        useUnifiedTopology: true
    }).then(async () => { console.log('MongoDB connected') })
    .catch(err => { console.log('MongoDB connection unsuccessful', err); process.exit() });

    let blockToggler = null; // the block where the trasaction had to be find;

    let hash = process.argv[2];
    let txReceipt = await web3.eth.getTransactionReceipt(hash);
    let logs = txReceipt.logs;

    let pairs = [];
    for( let log of logs ){
        if( !pairs.includes( toSum(log.address) ) && getDataFromLog(log) ){
            pairs.push( toSum(log.address) );
        }
    }
    
    for( let pair of pairs ){
        let savedOnDb = await Services.history.findPairByContract( pair );
        console.log(`[FOUND ON DB] ${pair} | Fees: ${savedOnDb.router_fee} | Router: ${savedOnDb.router}`);
    }

    console.log(`[PAIRS PATH] `, pairs.join(" "));

    let block = parseInt(txReceipt.blockNumber);
    let target =  block - 5;

    console.log('[TX BLOCK]', block);

    await getSyncInBlockForPairs(pairs, block, txReceipt.from);

    let latestSyncForPairs = {};
    let prevBlock = block;
    for( let i = 1; prevBlock > target; i ++){
        
        prevBlock = block-i;
        console.log('[PREV BLOCK]', prevBlock, i);

        let pairsInfo = await getBlockSyncEvents( prevBlock );

        let status = false;
        for( let pair in pairsInfo ){
            if( pairs.includes( toSum(pair) ) ) {
                if(!blockToggler) blockToggler = prevBlock;
                console.log('[PREVIOUS SYNC FOUND FOR]', toSum(pair) );
                if(!latestSyncForPairs[toSum(pair)]){
                    latestSyncForPairs[toSum(pair)] = pairsInfo[pair].events.sync;
                    console.log(pairsInfo[pair].events.sync)
                }
                status = true;
            }
        }
        //if( blockToggler ) break;

        if(!status){
            let blockHeader = await web3.eth.getBlock(prevBlock);
            let rpcResponsesReceipts = await getReceiptsBatch( blockHeader.transactions );
            for( let rpcRes of rpcResponsesReceipts ){
                let receipt = rpcRes.result;
                let hash = receipt.transactionHash;
                for( let log of receipt.logs ){
                    if( pairs.includes(toSum(log.address))){
                        console.log( '[PREVIOUS LOG FOUND FOR]', toSum(log.address), log.transactionHash );
                    }
                }
            }
        }
    }

    

    let res = await searchStream(arbitrageOutputLog, blockToggler.toString() + ' ' + pairs.join(" "));

    console.log( latestSyncForPairs );
    console.log( 'Output: ', res.join('\n') );

})();