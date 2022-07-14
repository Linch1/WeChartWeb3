const { parentPort, workerData } = require('worker_threads');
const {getBlockSyncEvents} = require("../lib/scrape.block.past");
let ID = workerData.ID;

async function analizeBlock( num ){
    let start = Date.now();
    let pairsInfo = await getBlockSyncEvents(num);
    for( let pair in pairsInfo ){
        
        if(!pairsInfo[pair].events.sync) {
            console.log('[HASH WITHOUT SYNC] ', pairsInfo[pair].hash);
            continue;
        } else {
            parentPort.postMessage({
                type: 'ON_NEW_RESERVE_FOUND',
                data: [pair, [pairsInfo[pair].events.sync.reserve0, pairsInfo[pair].events.sync.reserve1], pairsInfo[pair].hash, num]
            })
        }
        
        
    }
    console.log(`[SLAVE ${ID}] scraped ${num} ${(Date.now()-start)/1000}. Pairs updated: ${Object.keys(pairsInfo).length}`);
    parentPort.postMessage({
        type: 'ON_BLOCK_RESERVES_UPDATE',
        data: [num, pairsInfo]
    })
}
let callbacks = {
    'ON_NEW_BLOCK': analizeBlock,
}
parentPort.on('message', (msg) => {
    if( msg.type && callbacks[msg.type] ){
        if( msg.data ) callbacks[msg.type](...msg.data);
        else callbacks[msg.type]()
    }
})