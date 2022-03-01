// initialize mongodb
const fs = require('fs');
const Pair = require('../server/models/pair');
const TokenBasic = require('../server/models/token_basic');
var configDB = require('../server/config/database');
const mongoose = require('mongoose');
console.log( configDB.url )
mongoose.connect(configDB.url, {
  autoIndex: false,
  poolSize: 10,
  bufferMaxEntries: 0,
  useNewUrlParser: true,
  useFindAndModify: false,
  useUnifiedTopology: true
}).then(() => { console.log('5MongoDB is connected') })
.catch(err => {
  console.log('MongoDB connection unsuccessful');
  console.log(err)
});


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

( async () => {


    let tokens = await TokenBasic.find().lean().exec();
    tokens.sort(function(a, b) {
        return  b.pairs_count - a.pairs_count;
    });
    for( let i = 0;  i < tokens.length; i++ ){ 
        if( i == 100 ) break;
        let token = tokens[i]; 
        console.log( `${i} TOKEN PAIRS: ${token.pairs_count} | ${token.name} | ${token.contract}`);
        if( !token.pairs_count || token.pairs_count == 1 ) break;
    }
    console.log('done')

       
})();





