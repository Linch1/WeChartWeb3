require('dotenv').config();
const ethers = require('ethers')

const fs = require('fs');
let logPath = 'log/reserves-to-update.log';
fs.writeFileSync(logPath, '', 'utf-8');
let fileContent = fs.readFileSync(logPath, 'utf-8');
function logInFile(txt){
    fileContent += txt;
    fs.writeFileSync(logPath, fileContent, 'utf-8');
}

//imports



const BlockListener = require('./block.listner');

async function listenReserves(
    onSingleReservesUpdate,
    onBlockReservesScraped
){
    
    let listener = new BlockListener( 
        (pair, reserves, hash, blockNumber) => {
            logInFile(`\t[${blockNumber}]\n\t[UPDATE ${new Date().toLocaleTimeString()}:${Math.floor(Date.now()/100% 100)}] ${pair} ${hash}\n\t${reserves}\n`)
            onSingleReservesUpdate(pair, reserves, hash, blockNumber)
        },  
        async (number, pairsInfos) => {
            let start = Date.now();
            console.log('[SCRAPING CB][NEW]', number);
            logInFile(`[SCRAPING BLOCK][NEW] ${number} ${new Date().toLocaleTimeString()}:${Math.floor(Date.now()/100% 100)}`)
            await onBlockReservesScraped(number, pairsInfos);
            console.log('[SCRAPED BLOCK][NEW][CB]', number, ( Date.now() - start )/1000 );
        }
    );
    listener.start();
    
}

module.exports = listenReserves;