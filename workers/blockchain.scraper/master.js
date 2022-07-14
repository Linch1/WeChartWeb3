const {
    Worker,
    isMainThread,
    parentPort,
    workerData
} = require("worker_threads");

// Initialize Ethereum Web3 client
let {web3} = require('../lib/web3')
let queue = [];

// callbacks
// handle a callback when new reserves for a pair are pushed into the cache
let ON_NEW_RESERVE_FOUND = ( pair, reserves, hash, blockNum ) => { console.log('ON_NEW_RESERVE_FOUND') };
// handle a callback when all the reserves of the sync events relative to a block are loaded into the cache
let ON_BLOCK_RESERVES_UPDATE = ( blockNumber, pairsInfo ) => { console.log('ON_BLOCK_RESERVES_UPDATE') };

function removeFromQueue( blockNumber ){
    //console.log(`[SLAVE ${id}] scraped ${blockNumber}`);
    const index = queue.indexOf(blockNumber);
    if (index > -1) queue.splice(index, 1); // 2nd parameter means remove one item only
    
}

let callbacks = {
    'ON_BLOCK_RESERVES_UPDATE': async (number, pairsInfos) => {
        let start = Date.now();
        console.log('[SCRAPED CB][OLD]', number);
        await ON_BLOCK_RESERVES_UPDATE(number, pairsInfos);
        console.log('[SCRAPED BLOCK][OLD][CB]', number, ( Date.now() - start )/1000 );
        removeFromQueue(number);
    },
    'ON_NEW_RESERVE_FOUND': ( pair, reserves, hash, blockNum  ) => {
        ON_NEW_RESERVE_FOUND( pair, reserves, hash, blockNum );
    }
}

let slavePath = __dirname + '/slave.js';
let slaveCount = 0;
let slaves = [];

function intializeWorkers(){
    for( let i = 0; i < slaveCount; i ++ ){
        let worker = new Worker(slavePath, { workerData: { ID: i } });
        worker.on('message', (msg) => {
            if( msg.type && callbacks[msg.type] ){
                if( msg.data ) callbacks[msg.type](...msg.data);
                else callbacks[msg.type]()
            } else {
                console.log(`[SLAVE ${i}]`, msg);
            }
        });
        worker.on('exit', () => { console.log('Worker dead', i )})
        slaves.push( worker );
    }
}


async function reliefQueue(){
    while( queue.length == slaveCount ) {
        await sleep(10);
    }
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeFromBlock( 
    startBlock, 
    workers,
    onNewReserve,
    onNewBlockScraped
) {

    if( onNewReserve ) ON_NEW_RESERVE_FOUND = onNewReserve;
    if( onNewBlockScraped ) ON_BLOCK_RESERVES_UPDATE = onNewBlockScraped;

    slaveCount = workers;
    intializeWorkers();

    let block = startBlock;
    let blockEnd = await web3.eth.getBlockNumber();
    let start = Date.now();

    console.log('[UPDATING UP TO BLOCK]', blockEnd)

    while( block <= blockEnd ){
        let slaveId = block % slaveCount;
        queue.push(block);
        slaves[slaveId].postMessage({
            type: 'ON_NEW_BLOCK',
            data: [block]
        });
        await reliefQueue(); // wait that a slot is reliefed from the queue
        blockEnd = await web3.eth.getBlockNumber();
        block ++;
    }
    console.log(`[DONE] Scraped ${ blockEnd - startBlock } blocks in`, (Date.now() - start)/1000 );
    return blockEnd+1;
}

module.exports = scrapeFromBlock

