
const { parentPort, workerData } = require('worker_threads');
var configDB = require('../../server/config/database');
const mongoose = require('mongoose');
const Scraper = require('./lib/Scraper');
let ID = workerData.ID;

// Initialize Ethereum Web3 client
let { web3 } = require('../lib/web3');
const sleep = require('../../utils/sleep');

let scraper = new Scraper( web3 );
async function updatePair ( hash, pair, eventsSwap, eventsSync, blockNumber ){
    let start = Date.now();
    
    if( eventsSync ) await scraper.updatePairPriceWithReserves(hash, pair, eventsSwap, eventsSync, blockNumber);
    
    //console.log('[PAIR UDPATED]', pair, (Date.now()-start)/1000 );
    parentPort.postMessage({
        type: 'PAIR_UPDATED',
        data: [blockNumber, pair]
    })
}
async function toggleBulk(){
    let start = Date.now();
    await scraper.executeBulk();
    parentPort.postMessage({
        type: 'BULK_DONE',
        data: []
    })
    console.log('[BULK EXECUTED]', (Date.now()-start)/1000 );
}

let callbacks = {
    'UPDATE_PAIR': updatePair,
    'TOGGLE_BULK': toggleBulk
};
parentPort.on('message', (msg) => {
    if( msg.type && callbacks[msg.type] ){
        if( msg.data ) callbacks[msg.type](...msg.data);
        else callbacks[msg.type]()
    }
});

// intialize db connection
mongoose.connect(`mongodb://localhost:27017/charting_${process.env.CHAIN_ID}`, {
    autoIndex: false,
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => { console.log('MongoDB connected') })
.catch(err => { console.log('MongoDB connection unsuccessful', err); process.exit() });