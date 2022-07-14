require('dotenv').config();

//imports
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function pairUpdated( blockNumber, pairAdd ){
    blocksProgress[blockNumber].updated.push(pairAdd);
}
const { Worker } = require("worker_threads");
const {getBlockSyncEvents} = require('../../lib/scrape.block.past');
let workerPath = __dirname + '/../slave.js';
let workersCount = 2;
let workers = [];
let pairToWorker = {/* [pairAdd]: workerId */};
let workerLoad = {/* [ID]: howManyPairsAreAssignedToThisWorker */};
let blocksProgress = {/* [blockNumber]: { updated: [ updated pairs ], complete: false } */};
let callbacks = {
    'PAIR_UPDATED': pairUpdated,
};
for( let i = 0; i < workersCount; i ++ ){
    let worker = new Worker(workerPath, { workerData: { ID: i } });
    worker.on('message', (msg) => { 
        if( msg.type && callbacks[msg.type] ){
            if( msg.data ) callbacks[msg.type](...msg.data);
            else callbacks[msg.type]()
        } else {
            console.log(`[WORKER ${i}]`, msg); 
        }
    });
    workers.push( worker );
    workerLoad[i] = 0;
}

// find worker with lowest load of work
function workerWithLowestLoad(){
    let keys = Object.keys(workerLoad);
    let sortedWorkers = keys.sort( ( id1, id2 ) => workerLoad[id1] > workerLoad[id2] ? 1 : -1 );
    return sortedWorkers[0];
}
const sendNewPairToWorkers = ( hash, pair, eventsSwap, eventsSync, blockNumber ) => {
    let workerId = 0;
    if( pairToWorker[pair] ) workerId = pairToWorker[pair];
    else {
        workerId = workerWithLowestLoad();
        pairToWorker[pair] = workerId;
        workerLoad[workerId] += 1;
    }
    //console.log('[DELEGATED PAIR]', workerId, pair );
    workers[workerId].postMessage({
        type: 'UPDATE_PAIR',
        data: [hash, pair, eventsSwap, eventsSync, blockNumber]
    })
}

async function isEmptyBlock( blockNumber ){
    let blockHeader = await web3_https.eth.getBlock( blockNumber )
    return blockHeader.transactions.length > 0;
}
async function waitBlockProgress( blockNumber ){
    console.log('[CHECKING OLD BLOCK]', blockNumber);
    let start = Date.now();
    let slept =0;
    let checkedEmpty = false;
    while( Object.keys(blocksProgress).length && ( !blocksProgress[blockNumber].complete )){ // wait the previous block to end
        await sleep(50);
        slept += 1;
        if( slept % 40 == 0 ) { // wait 2 seconds and check if was an empty block
            console.log('[WAITED OLD BLOCK]', blockNumber-1, (Date.now()-start)/1000 );
            checkedEmpty = true;
            if( !checkedEmpty && await isEmptyBlock(blockNumber) ){
                blocksProgress[blockNumber] = { updated: [], complete: true };
            }
        }
    }
    console.log('[WAITED OLD BLOCK]', blockNumber-1, (Date.now()-start)/1000 );
}


( async () => {

    let onNewBlockScraped = async ( blockNumber, pairsInfo ) => {
        
        await waitBlockProgress( blockNumber-1 );

        let time = Date.now();
        let pairsToUpdate = Object.keys(pairsInfo).length;
        console.log('[SCRAPING BLOCK]', blockNumber, new Date().toLocaleTimeString() );
        blocksProgress[blockNumber] = { updated: [], complete: false };
        for( let pair in pairsInfo ){
            let hash = pairsInfo[pair].hash;
            let events = pairsInfo[pair].events;
            sendNewPairToWorkers( hash, pair, events.swap, events.sync, blockNumber ); // direct the pair updating to a worker
        }
        // if this is not the first block AND the block progress is not yet complete, wait 50 milliseconds
        while( Object.keys(blocksProgress).length && ( blocksProgress[blockNumber].updated.length != pairsToUpdate )){ 
            await sleep(50);
        }
        console.log('[SCRAPED BLOCK]', blockNumber, (Date.now()-time)/1000, new Date().toLocaleTimeString(), blocksProgress[blockNumber].updated.length, pairsToUpdate );
        blocksProgress[blockNumber].complete = true; // once all the workers have updated the pairs, set the progress to complete
        //toggleWorkersBulkUpdate(); // TO-DO: we should wait the workers to have complete the update on the db ? 

    }

    let pairsInfo = await getBlockSyncEvents( parseInt(process.argv[2]) )
    await onNewBlockScraped( parseInt(process.argv[2]), pairsInfo );

})();