// initialize mongodb
const fs = require('fs');
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

let missing = [];
let indexes = [];
( async () => {


    let tokens = await TokenBasic.find({ name: "$NULL" }).select({ contract: 1 }).lean().exec();
    
    console.log(`TOTAL MISSING: ${tokens.length}`);
    fs.writeFileSync('./missing-tokens.json', JSON.stringify(tokens), 'utf-8');
    console.log('done')

       
})();





