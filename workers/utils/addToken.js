
require('dotenv').config();
const Web3 = require('web3');
const web3 = new Web3(process.env.PROVIDER_HTTPS);

// initialize mongodb
const TokenBasic = require('../../server/models/token_basic');
var configDB = require('../../server/config/database');
const mongoose = require('mongoose');
const EnumChainId = require('../../enum/chain.id');
const EnumAbi = require('../../enum/abi');
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
function toCheckSum( add ){
    if( !Web3.utils.isAddress(add) ) return null;
    return Web3.utils.toChecksumAddress(add);
}

(async () => {

    
    let tokenAddress = process.argv[2];
    tokenAddress = toCheckSum(tokenAddress);

    let alreadyPresent = await TokenBasic.findOne({contract: tokenAddress})
    if( alreadyPresent ) return console.log('Token already present', tokenAddress);
    
    let token_contract = await new web3.eth.Contract( EnumAbi[EnumChainId.BSC].TOKEN, tokenAddress );
    let token_decimals;
    let name;
    let supply;
    let symbol;
    try {
        token_decimals = parseInt( await token_contract.methods.decimals().call() );
        name = await token_contract.methods.name().call();
        supply = parseInt( await token_contract.methods.totalSupply().call() )/(10**token_decimals);
        symbol = await token_contract.methods.symbol().call();
        tokenInfo = {
            contract: tokenAddress,
            pairs_count: 0,
            decimals: token_decimals,
            name: name,
            symbol: symbol,
            total_supply: supply,
        }
        let toSave = new TokenBasic(tokenInfo);
        toSave.save();
    } catch (error) {
        console.log('[ERROR] Cannot retrive token informations', error);
    }

    console.log('SAVED')
})();



