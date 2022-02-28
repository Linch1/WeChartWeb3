// initialize mongodb
const TokenHistory = require('../server/models/token_history');
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


function hasUpperCase(str) {
    return str.toLowerCase() != str;
}

(async () => {


    let tokens = await TokenHistory.find() // You can display result until this and check duplicates 
    let toRemove = [];

    for( let token of tokens ){
        if ( hasUpperCase(token.token0.contract ) ) {
            toRemove.push( token._id );
        }
    }
    
    console.log( 'All duplicates: ', toRemove.length );
    let res = await TokenHistory.deleteMany({_id:{$in:toRemove}})  ;
    console.log('Deleted: ', res);

})();

