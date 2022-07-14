require('dotenv').config();
const axios = require('axios');

// Initialize Ethereum Web3 client
const {web3, web3ws, account} = require('./web3');

//imports
const getDataFromLog = require('./logs');
const scraperConfig = require('../../config');


function organizeEvents( hash, receipt, blockNumber ){
    for ( let i = receipt.logs.length - 1; i >= 0; i -- ) {
        let log = receipt.logs[i];
        
        let data = getDataFromLog(log);     
        if( data && !pairs_informations[blockNumber][log.address] ) 
            pairs_informations[blockNumber][log.address] = { events: {}, hash: log.transactionHash };

        if( data && data.name == 'swap' ){
            pairs_informations[blockNumber][log.address].events.swap = { ...data };
        } else if ( 
            data && data.name == 'sync' && 
            (
                //set this sync as latest if not other sync was set
                !pairs_informations[blockNumber][log.address].events.sync || 
                //or it is in a more recent transaction with respect to the current sync
                log.transactionIndex > pairs_informations[blockNumber][log.address].events.sync.transactionIndex ||
                //or it is in the same transaction as the current sync and it has a higher logIndex
                (
                    log.transactionIndex == pairs_informations[blockNumber][log.address].events.sync.transactionIndex && 
                    log.logIndex > pairs_informations[blockNumber][log.address].events.sync.logIndex
                )
            ) 
        ){
            if(!pairs_informations[blockNumber][log.address].events.sync) pairs_informations[blockNumber][log.address].events.sync = {};
            pairs_informations[blockNumber][log.address].events.sync.reserve0 = data.reserve0;
            pairs_informations[blockNumber][log.address].events.sync.reserve1 = data.reserve1;
            pairs_informations[blockNumber][log.address].events.sync.transactionIndex = Number(log.transactionIndex);
            pairs_informations[blockNumber][log.address].events.sync.logIndex = Number(log.logIndex);
        }
    }
}


let pairs_informations = {/* [blockNum]: { pairAdd: { hash, latestReserves } } */};


async function getReceiptsBatch( hashes ){
    if(!hashes.length) return [];

    let start = Date.now();
    let body = [];
    for(let i = 0; i < hashes.length; i++ ){
        let hash = hashes[i];
        body.push({"jsonrpc":"2.0","method":"eth_getTransactionReceipt","params":[hash], "id": i })
    };
    const receipts = await axios.post(
        scraperConfig[process.env.CHAIN_ID].http_provider, 
        body, 
        { headers: { 'Content-Type': 'application/json' } }
    );
    return receipts.data;
}
async function getTransactionsBatch( hashes ){
    if(!hashes.length) return [];

    let start = Date.now();
    let body = [];
    for(let i = 0; i < hashes.length; i++ ){
        let hash = hashes[i];
        body.push({"jsonrpc":"2.0","method":"eth_getTransactionByHash","params":[hash], "id": i })
    };
    const receipts = await axios.post(
        process.env.PROVIDER_HTTPS, 
        body, 
        { headers: { 'Content-Type': 'application/json' } }
    );
    return receipts.data;
}
async function getBlockSyncEvents( blockNumber ){
    let blockInfos = await web3.eth.getBlock(blockNumber);
    pairs_informations[blockNumber] = {};
    let rpcResponsesReceipts = await getReceiptsBatch( blockInfos.transactions );
    for( let rpcRes of rpcResponsesReceipts ){
        let receipt = rpcRes.result;
        let hash = receipt.transactionHash;
        organizeEvents(hash, receipt, blockNumber); // add the infos inside pairs_informations;
    }
    return pairs_informations[blockNumber];
}
async function getBlockReceipts( blockNumber ){
    let blockInfos = await web3.eth.getBlock(blockNumber);
    pairs_informations[blockNumber] = {};
    let rpcResponsesReceipts = await getReceiptsBatch( blockInfos.transactions );
    let receipts = [];
    for( let rpcRes of rpcResponsesReceipts ){
        let receipt = rpcRes.result;
        receipts.push(receipt)
    }
    return receipts;
}
async function getBlockTransactions( blockNumber ){
    let blockInfos = await web3.eth.getBlock(blockNumber);
    pairs_informations[blockNumber] = {};
    let rpcResponsesTransactions = await getTransactionsBatch( blockInfos.transactions );
    let transactions = [];
    for( let rpcRes of rpcResponsesTransactions ){
        let tx = rpcRes.result;
        transactions.push(tx)
    }
    return transactions;
}
// if( process.argv[2] ) {
//     ( async () => { 
//         if( process.argv[2].startsWith('0x') || isNaN( parseInt(process.argv[2]) ) ) return console.log('Not a valide number')
//         let start = Date.now();
//         let res = await getBlockSyncEvents( process.argv[2] )
//         for( let pair in res ){
//             console.log( pair, res[pair].events );
//         }
//         console.log((Date.now()- start)/1000, 's');
//     })();
// }

module.exports = {
    getBlockTransactions,
    getBlockSyncEvents,
    getReceiptsBatch,
    getBlockReceipts
};