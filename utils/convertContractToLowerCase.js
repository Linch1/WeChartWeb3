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
}).then(() => { console.log('6MongoDB is connected') })
.catch(err => {
  console.log('MongoDB connection unsuccessful');
  console.log(err)
});


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

let missing = [];
let indexes = [];
( async () => {


    let tokens = await TokenBasic.find().lean().exec();

    for( let i = 0;  i < tokens.length; i++ ){  
        if( i % 1000 == 0 ) console.log( i );
        let token = tokens[i];
        await TokenBasic.findOneAndUpdate( { contract: token.contract }, { $set: { contract: token.contract }} );
    }
    console.log('done')

       
})();





