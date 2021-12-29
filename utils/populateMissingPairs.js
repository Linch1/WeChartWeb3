require('dotenv').config();

const EnumChainId = require('../enum/chain.id');
const EnumAbi = require('../enum/abi');
const EnumContracts = require('../enum/contracts');

const Web3 = require('web3');
const web3 = new Web3(process.env.PROVIDER);
const fs = require('fs');
const missing = JSON.parse(fs.readFileSync("./missing.json"));

// initialize mongodb
const Pair = require('../server/models/pair');
const TokenBasic = require('../server/models/token_basic');
var configDB = require('../server/config/database');
const mongoose = require('mongoose');
console.log( configDB.url )
mongoose.connect(configDB.url, {
  autoIndex: false,
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => { console.log('MongoDB is connected') })
.catch(err => {
  console.log('MongoDB connection unsuccessful');
  console.log(err)
});



function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Retrive the informations of a token given it's address
 * @param {*} token_address the token contract address
 * @param {*} chain 
 * @returns 
 */
async function getTokenInformations( token_address, chain ){
    try {
        let token_contract = await new web3.eth.Contract( EnumAbi[EnumChainId.BSC].TOKEN, token_address );
        let token_decimals = parseInt( await token_contract.methods.decimals().call() );
        return {
            chain: chain,
            contract: token_address,
            name: await token_contract.methods.name().call(),
            symbol: await token_contract.methods.symbol().call(),
            decimals: token_decimals,
            total_supply: parseInt( await token_contract.methods.totalSupply().call() )/(10**token_decimals),
            pairs_count: 1 // initalized
        }
    } catch( error ){
        console.log('ERROR RETRIVING TOKEN WITH ADDRESS : ', token_address );
        console.log( error )
        return {
            chain: chain,
            contract: token_address,
            name: "$NULL",
            symbol: "$NULL",
            decimals: 0,
            total_supply: 0,
            pairs_count: 1 // initalized
        }
    }
} 
/**
 * Scrape for the pancakeswap pairs between the start_index and the end_index
 */
async function scrape_pairs( child_id, factory, pairs ){
    while( true ){
        if( pairs.length ) { // if there are more tokens now
            while ( pairs.length ) {// scrape all the latest tokens 
                await scrape_pair( child_id, factory, pairs.pop() );
                console.log(`[${child_id}] MISSING PAIRS: ${pairs.length}`);
            }   
        }
        break;
    }
    console.log(`THE WORKER ${child_id} HAS DONE HIS JOB. SCRAPED UNTIL ${pairs.length} PAIRS`);
}
/**
 * Initialize the scraper that check the latest pair scraped on the db
 * and scrape from that pair to the latest one,
 * 
 * the latest pair considered is the one at the startup of the script,
 * it not consider the pair created during the script running
 * 
 * To scrape also the latest pairs use the script at
 * 
 * workers/worker-listen-pairs.js
 * 111955.
 * 110119
 */

async function scrape_pairs_from_missing(){
    // scrape all the pairs from the latest one scraped to the newest one
    let factory = await new web3.eth.Contract( EnumAbi[EnumChainId.BSC].FACTORIES.PANCAKE, EnumContracts[EnumChainId.BSC].FACTORIES.PANCAKE );
    
    let childs = 25; // to speed up the process it will instantite 3 sub-workes
    let toScrape = missing.length;
    let pairs_per_child = Math.round( toScrape/childs );
    while ( pairs_per_child == 0 ){
        childs --;
        pairs_per_child = Math.round( toScrape/childs );
    }

    console.log(`TOTAL MISSING: ${toScrape}.`);
    console.log(`STARTING ${childs} SUB-WORKES. EACH WORKER WILL SCRAPE ${pairs_per_child} PAIRS`);
    for ( let i = 1; i < childs + 1; i ++ ){
        console.log("calling", i)

        let start_pair = (i-1) >= 1 ? (i-1) * pairs_per_child : 0;
        let end_pair = i * pairs_per_child;

        console.log( `STARTED CHILD: ${i}. WILL SCRAPE FROM PAIR ${start_pair} TO PAIR ${end_pair}`);
       
        scrape_pairs( i, factory, missing.slice(start_pair, end_pair) )
    }
}


/**
 * Get the information of a pancakeswap pair based on the pair index
 * and populate the db with the relative 
 * - Pair object -> the scraped pair
 * - TokenBasic objects ->  the tokens inside the pair
 * @param {*} factory pancake swap factory web3 contract 
 * @param {*} current_index the index of the pair to scrape
 */
async function scrape_pair( child_id, factory, current_index){
    let pair_address;
    try {
        pair_address = await factory.methods.allPairs(current_index).call();
        console.log(`[${child_id}] Retrived: `, pair_address)
        let pair_contract = await new web3.eth.Contract( EnumAbi[EnumChainId.BSC].PAIR.PANCAKE, pair_address );

        // save token 0 informations if needed
        let token_0_address = await pair_contract.methods.token0().call();
        let mongo_token_0 = await TokenBasic.findOne({ contract: token_0_address})
        if( !mongo_token_0 ){
            let token_0 = await getTokenInformations( token_0_address.toLowerCase(), EnumChainId.BSC );
            mongo_token_0 = new TokenBasic(token_0);
            await mongo_token_0.save();
        } else {
            await TokenBasic.findByIdAndUpdate(mongo_token_0._id, { $inc: { pairs_count: 1 }})
        }
        // save token 1 informations if needed
        let token_1_address = await pair_contract.methods.token1().call();
        let mongo_token_1 = await TokenBasic.findOne({ contract: token_1_address});
        if( !mongo_token_1 ){
            let token_1 = await getTokenInformations( token_1_address.toLowerCase(), EnumChainId.BSC );
            mongo_token_1 = new TokenBasic(token_1);
            await mongo_token_1.save();
        } else {
            await TokenBasic.findByIdAndUpdate(mongo_token_1._id, { $inc: { pairs_count: 1 }})
        }
        
        // save pair informations if needed
        let mongo_pair = await Pair.findOne({ contract: pair_address });
        if( !mongo_pair ){
            console.log(`NEW PAIR CONTRACT: ${current_index} ${pair_address} `);
            let pair = {
                token0: { contract: token_0_address.toLowerCase(), token: mongo_token_0._id },
                token1: { contract: token_1_address.toLowerCase(), token: mongo_token_1._id },
                contract: pair_address.toLowerCase(),
                index: current_index
            };
            mongo_pair = new Pair(pair);
            await mongo_pair.save();
        } else {
            console.log(`PAIR ALREADY PRESENT: ${current_index} ${pair_address} `)
        }
    } catch ( err ){
        console.log('ERROR: ', err);
    }

}

(async () => {
    await scrape_pairs_from_missing();
})();



