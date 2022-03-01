
require('dotenv').config();
const Web3 = require('web3');
const web3 = new Web3(process.env.PROVIDER);

// initialize mongodb
const Pair = require('../server/models/pair');
const TokenBasic = require('../server/models/token_basic');
var configDB = require('../server/config/database');
const mongoose = require('mongoose');
const EnumChainId = require('../enum/chain.id');
const EnumAbi = require('../enum/abi');
const EnumContracts = require('../enum/contracts');
console.log( configDB.url )
mongoose.connect(configDB.url, {
  autoIndex: false,
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => { console.log('14MongoDB is connected') })
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
 * Initalize the listener that check if a new pair is created
 */
async function listen_pairs(){
    console.log('LISTENING FOR NEW PAIRS ON PANCAKESWAP');
    let factory = await new web3.eth.Contract( EnumAbi[EnumChainId.BSC].FACTORIES.PANCAKE, EnumContracts[EnumChainId.BSC].FACTORIES.PANCAKE );
    
    let current_index = parseInt( await factory.methods.allPairsLength().call() );

    while( true ){
        try {
            let totalPairs = parseInt( await factory.methods.allPairsLength().call() );
            if( totalPairs > current_index ){
                while ( totalPairs > current_index ) {// scrape all the latest tokens 
                    try {
                        await scrape_pair( factory, current_index);
                    } catch ( err ){
                        console.log('ERROR: ', err);
                        current_index --;
                    }
                    current_index ++; // the increase has to be after the call
                }
            }
        } catch (error) {
            console.log("ERROR: ", error);
        }
        await sleep(1000) // pause 1000 seconds
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
async function scrape_pair( factory, current_index){
    let pair_address;
    
    pair_address = await factory.methods.allPairs(current_index).call();
    let pair_contract = await new web3.eth.Contract( EnumAbi[EnumChainId.BSC].PAIR.PANCAKE, pair_address );

    // save token 0 informations if needed
    let token_0_address = await pair_contract.methods.token0().call();
    let mongo_token_0 = await TokenBasic.findOne({ contract: token_0_address})
    if( !mongo_token_0 ){
        let token_0 = await getTokenInformations( token_0_address, EnumChainId.BSC );
        mongo_token_0 = new TokenBasic(token_0);
        await mongo_token_0.save();
    } else {
        await TokenBasic.findByIdAndUpdate(mongo_token_0._id, { $inc: { pairs_count: 1 }})
    }
    // save token 1 informations if needed
    let token_1_address = await pair_contract.methods.token1().call();
    let mongo_token_1 = await TokenBasic.findOne({ contract: token_1_address});
    if( !mongo_token_1 ){
        let token_1 = await getTokenInformations( token_1_address, EnumChainId.BSC );
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
            token0: { contract: token_0_address, token: mongo_token_0._id },
            token1: { contract: token_1_address, token: mongo_token_1._id },
            contract: pair_address,
            index: current_index
        };
        mongo_pair = new Pair(pair);
        await mongo_pair.save();
    } else {
        console.log(`PAIR ALREADY PRESENT: ${current_index} ${pair_address} `)
    }
    

}

(async () => {
    await listen_pairs();
})();



