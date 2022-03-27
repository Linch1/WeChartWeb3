
require('dotenv').config();
const Web3 = require('web3');
const web3 = new Web3(process.env.PROVIDER_HTTPS);

// initialize mongodb
const HistoryPirceModel = require('../../server/models/history_prices');
const TokenHistory = require('../../server/models/token_history');
var configDB = require('../../server/config/database');
const mongoose = require('mongoose');
const EnumChainId = require('../../enum/chain.id');
const EnumAbi = require('../../enum/abi');
const { getMainPair } = require('../../server/service/db.token');
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
function relDiff( today, yesterday ) {
    return  100 * ( ( today - yesterday ) /  yesterday  );
}

(async () => {

    
    let tokenAddress = process.argv[2];
    tokenAddress = toCheckSum(tokenAddress);
    if( !tokenAddress ) return console.log('No token provided. Killing.')

    let oneDayUnix = 60 * 60 * 24;
    let oneDayAgoUnix = Date.now()/1000 - oneDayUnix;

    let mainPair = await getMainPair(tokenAddress);

    let dayAgoRecord =  await HistoryPirceModel
    .find( { pair: mainPair.mainPair,  time: { $lte: oneDayAgoUnix } } )
    .sort({ time: -1})
    .limit(1)
    .lean()
    .exec();

    let dailyVariation = relDiff(mainPair.pairInfos.value, dayAgoRecord[0].value).toFixed(2);

    await TokenHistory.findOneAndUpdate({ pair: mainPair.mainPair }, { $set: {'variation.day': dailyVariation }});

    console.log('Percentage Variation: ', dailyVariation);
    console.log('SAVED');

})();



