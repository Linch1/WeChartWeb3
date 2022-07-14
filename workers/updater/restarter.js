
require('dotenv').config();

// initialize mongodb
const { exec } = require('child_process');
const fs = require('fs');
let filePath = __dirname + '/lib/not-delete.scraped-block.checkpoint.txt';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
    let lastBlock = fs.readFileSync(filePath, 'utf-8');
    while( true ){
        let newBlock = fs.readFileSync(filePath, 'utf-8');
        console.log(`${new Date().toLocaleDateString()}[block scraped] new: ${newBlock} | old: ${lastBlock}` );
        if( newBlock == lastBlock ) {
            exec(`pm2 start ${__dirname}/master.js --name "charting-bot"`, (err, stdout, stderr) => {
                if (err) {
                  // node couldn't execute the command
                  console.log('Could not execute command', err)
                  if( err.message.includes("already launched") ){
                    exec(`pm2 restart charting-bot`, (err, stdout, stderr) => {
                        if (err) {
                          // node couldn't execute the command
                          console.log('Could not execute command', err)
                          return;
                        }
                        console.log('Restarted process')
                    });
                  }
                  return;
                }
                console.log('Restarted process')
            });
        }
        lastBlock = newBlock;
        await sleep( 60 * 1000 );
    }
})();
