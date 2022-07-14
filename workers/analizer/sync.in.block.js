require('dotenv').config();

const getDataFromLog = require('../lib/logs');
const {getReceiptsBatch} = require('../lib/scrape.block.past');
const { web3 } = require('../web3');

function toSum(add){
    return web3.utils.toChecksumAddress(add)
}

async function getSyncInBlockForPairs( pairs, blockNum, from ){
    let blockHeader = await web3.eth.getBlock(blockNum);
    let rpcResponsesReceipts = await getReceiptsBatch( blockHeader.transactions );
    for( let rpcRes of rpcResponsesReceipts ){
        let receipt = rpcRes.result;
        let hash = receipt.transactionHash;
        if( from ){
            if( receipt.from == from ){
                console.log(`[SAME FROM] ${hash} ${from}`)
            }
        }
        for( let log of receipt.logs ){
            if( pairs.includes(toSum(log.address)) ){
                let data = getDataFromLog(log);
                if( data?.name == 'sync'){
                    console.log( `[SYNC IN BLOCK ${blockNum}][${Number(log.transactionIndex)}]`, hash, toSum(log.address), data.reserve0, data.reserve1  );
                }
                
            }
        }
    }
}

( async () => {

    //let arbitrageLogs = fs.readFileSync("/root/.pm2/logs/arbitrage.master-out.log", "utf-8");
    
    if( !process.argv[2]?.startsWith('0x') ) return console.log('- Not a valid address')
    if( process.argv[3]?.startsWith('0x') || isNaN( parseInt(process.argv[3]) ) ) return console.log('- Not a valid number')

    await getSyncInBlockForPairs( [toSum(process.argv[2])], parseInt(process.argv[3]) );

})();


module.exports = {
    getSyncInBlockForPairs
}