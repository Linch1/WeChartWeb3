require('dotenv').config();

// initialize mongodb
const TokenHistory = require('../server/models/token_history');
const TokenBasic = require('../server/models/token_basic');
var configDB = require('../server/config/database');
const mongoose = require('mongoose');
const EnumChainId = require('../enum/chain.id');
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


(async () => {

    let histories = await TokenHistory.find({ $or: [ { 'token0.symbol' : { $exists: false } }, { 'token1.symbol' : { $exists: false } } ] })
    .select({ _id: 1, token0: 1, token1: 1 }).lean().exec();

    let contracts = [];
    for( let history of histories ){
      if( !contracts.includes( history.token0.contract ) )
        contracts.push( history.token0.contract )
      if( !contracts.includes( history.token1.contract ) )
        contracts.push( history.token1.contract )
    }

    let tokens = await TokenBasic.find( { contract: { $in: contracts } })

    console.log( 'HISTORIES: ', histories.length );
    console.log( 'PARSED CONTRACTS: ', contracts.length );
    console.log( 'TOKENS: ', tokens.length );

    let bulkOperations = [];

    for( let token of tokens ){
      bulkOperations.push({ 
        updateMany: {
          filter: { $or: [ { 'token0.contract' : token.contract } ] },
          update: { $set: { 'token0.symbol': token.symbol }}
        }
      })
      bulkOperations.push({ 
        updateMany: {
          filter: { $or: [ { 'token1.contract' : token.contract } ] },
          update: { $set: { 'token1.symbol': token.symbol }}
        }
      })
    };

    console.log( 'Starting bulk executions' )

    let res = await TokenHistory.bulkWrite(bulkOperations);
    
    console.log('Bulk executed: ', res);

    console.log("DONE");
})();



