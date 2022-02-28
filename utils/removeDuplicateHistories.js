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


(async () => {

    var duplicates = [];

    let tokens = await TokenHistory.aggregate([
    { $group: { 
        _id: { $toLower: "$pair" }, // can be grouped on multiple properties 
        dups: { "$addToSet": "$_id" }, 
        docs: { $push: "$$ROOT" },
        count: { "$sum": 1 } 
    }},
    { $match: { 
        count: { "$gt": 1 }    // Duplicates considered as count greater than one
    }}
    ],
    {allowDiskUse: true}       // For faster processing if set is larger
    ).exec()           // You can display result until this and check duplicates 

    console.log('Found duplciates: ', tokens.length )

    tokens.forEach(function( token ) {
        let tokenDocs = token.docs;
        let maxPairs = 0;
        let index = 0;
        tokenDocs.sort((a, b) => parseFloat(b.records_price) - parseFloat(a.records_price));
        console.log( tokenDocs )
        for( let i = 1; i < tokenDocs.length; i ++){
            duplicates.push(tokenDocs[i]._id);
            
        }
        // console.log('MAX PAIRS: ', maxPairs, ' SPLICED: ', record )
    })

    // If you want to Check all "_id" which you are deleting else print statement not needed
    //console.log('All tokens: ', tokensCount);
    console.log( 'All duplicates: ', duplicates.length );
    let res = await TokenHistory.deleteMany({_id:{$in:duplicates}})  
    console.log('Deleted: ', res)
})();

