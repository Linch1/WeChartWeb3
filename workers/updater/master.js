require('dotenv').config();
const listenReserves = require("../lib/scrape.block.stream");
const scrapeFromBlock = require('../blockchain.scraper/master');
const { web3 } = require('../lib/web3');
//imports
const Scraper = require('./lib/Scraper');
const fs = require('fs');

function pairUpdated( blockNumber, pairAdd ){
    blocksProgress[blockNumber].updated.push(pairAdd);
}
const { Worker } = require("worker_threads");
const sleep = require('../../utils/sleep');
const scraperConfig = require('../../config');

let workerPath = __dirname + '/slave.js';
let workersCount = 2;
let workers = [];
let pairToWorker = {/* [pairAdd]: workerId */};
let workerLoad = {/* [ID]: howManyPairsAreAssignedToThisWorker */};
let blocksProgress = {/* [blockNumber]: { updated: [ updated pairs ], complete: false } */};

let scrapingQueue = [];
let scrapingQueueInfos = {};
let scraping = false;

let callbacks = {
    'PAIR_UPDATED': pairUpdated,
    'BULK_DONE': () => { scraping = false }
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
function toggleWorkersBulkUpdate(){
    for( let i = 0; i < workersCount; i ++ ){
        workers[i].postMessage({
            type: 'TOGGLE_BULK'
        })
    }
}

async function scrapeBlock( blockNumber, pairsInfo ){
    scraping = true;
    console.log('[SCRAPING BLOCK]', blockNumber, new Date().toLocaleTimeString() );
    blocksProgress[blockNumber] = { updated: [], complete: false, inserted: Date.now()/1000 };
    
    let time = Date.now();
    let pairsToUpdateLength = Object.keys(pairsInfo).length;
    for( let pair in pairsInfo ){
        let hash = pairsInfo[pair].hash;
        let events = pairsInfo[pair].events;
        sendNewPairToWorkers( hash, pair, events.swap, events.sync, blockNumber ); // direct the pair updating to a worker
    }
    // if this is not the first block AND the block progress is not yet complete, wait 50 milliseconds
    while( Object.keys(blocksProgress).length && ( blocksProgress[blockNumber].updated.length != pairsToUpdateLength )){ 
        await sleep(50);
    }
    console.log('[SCRAPED BLOCK]', blockNumber, (Date.now()-time)/1000, new Date().toLocaleTimeString());
    console.log( blocksProgress[blockNumber].updated.length, pairsToUpdateLength, JSON.stringify(blocksProgress[blockNumber]) );
    blocksProgress[blockNumber].complete = true; // once all the workers have updated the pairs, set the progress to complete
    
    //toggleWorkersBulkUpdate(); // TO-DO: we should wait the workers to have complete the update on the db ? 

    fs.writeFileSync(Scraper.lastScrapedBlockPath, blockNumber.toString(), 'utf-8');
    //console.log('[WRITE]', blockNumber.toString());

    if( !fs.existsSync(Scraper.allScrapedBlocksPath) ) fs.writeFileSync(Scraper.allScrapedBlocksPath, '', 'utf-8');
    fs.appendFileSync(Scraper.allScrapedBlocksPath, blockNumber.toString() + '\n' , 'utf-8');
    //console.log('[WRITE]', scrapedBlocks);

    scrapingQueue = scrapingQueue.sort(); // place older blocks to the start of the queue;
    toggleWorkersBulkUpdate(); // it will toggle the function ... 'BULK_DONE': () => { scraping = false }; to allow next block to be scraped
    
    
}

( async () => {

    setInterval( () => { // check every 50ms if can scrape a new block from the queue
        if( !scrapingQueue.length ) return; // if no block in queue return
        if( scraping ) return; // if already scraping another block return
        let blockToScrape = scrapingQueue.shift();
        console.log('[SCRPING INTERVAL]', scrapingQueue.length );
        scrapeBlock( blockToScrape, scrapingQueueInfos[blockToScrape] );
    }, 50);

    let onNewReserve = ( pair, reserves, hash, blockNumber ) => {}
    let onNewBlockScraped = async ( blockNumber, pairsInfo ) => {
        scrapingQueue.push(blockNumber);
        scrapingQueueInfos[blockNumber] = pairsInfo;
    }


    let lastBlockScraped = fs.readFileSync( Scraper.lastScrapedBlockPath, 'utf-8');
    console.log('[LAST SCRAPED]', lastBlockScraped);
    let startListeningFromBlock = null;
    if( lastBlockScraped && scraperConfig[process.env.CHAIN_ID].use_checkpoint_when_restart ){
        startListeningFromBlock = await scrapeFromBlock( 
            parseInt(lastBlockScraped), 
            1,
            onNewReserve,
            onNewBlockScraped
        );
    }
    
    await listenReserves(
        onNewReserve,
        onNewBlockScraped
    )

})();