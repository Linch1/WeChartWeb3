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
const EnumChainId = require('../enum/chain.id');
console.log( configDB.url )
mongoose.connect(configDB.url, {
  autoIndex: false,
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => { console.log('7MongoDB is connected') })
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

(async () => {
    let tokens = await TokenBasic.find({ name: "$NULL" }).select({ contract: 1 }).lean().exec();
    for( let token of tokens ){
        console.log("SCRAPING CONTRACT: ", token.contract )
        let infos = getTokenInformations( token.contract, EnumChainId.BSC );
        await TokenBasic.findOneAndUpdate({ contract: token.contract }, { $set: infos } );
    }
    console.log("DONE");
})();



