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
}).then(() => { console.log('MongoDB is connected') })
.catch(err => {
  console.log('MongoDB connection unsuccessful');
  console.log(err)
});


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function checkIfArrayIsUnique(myArray) {
    return myArray.length === new Set(myArray).size;
}

let missing = [];
let indexes = [];
let contracts = [];
( async () => {


    let per_page = 20000;
    let page = 0;
    let start = Date.now();
        
    let pairs = await Pair.find()
    console.log( 'LEN: ', pairs.length )
    for( let i = 0;  i < pairs.length; i++ ){  
        if( i%1000 == 0 ) console.log( i );
        let pair = pairs[i];
        contracts.push(pair.contract);
    }

    console.log(`PAIRS ARRAY IS UNIQUE: ${checkIfArrayIsUnique(pairs)}`)
      

    let end = Date.now();

    console.log(`DURATION: ${ (end - start)/1000 }s`);
    console.log('done')
  

})();





