// initialize mongodb
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

    var duplicates = [];

    let tokensCount = await TokenBasic.countDocuments();

    let tokens = await TokenBasic.aggregate([
    { $group: { 
        _id: { contract: "$contract"}, // can be grouped on multiple properties 
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

    tokens.forEach(function( token ) {

        let tokenDocs = token.docs;
        let maxPairs = 0;
        let index = 0;
        for( doc of tokenDocs ){
            duplicates.push(doc._id); 
            if( doc.pairs_count > maxPairs ){
                index = duplicates.length - 1;
                maxPairs = doc.pairs_count;
            }
        } 
        let record = duplicates.splice( index, 1 ); // remove the token with most pairs
        console.log('MAX PAIRS: ', maxPairs, ' SPLICED: ', record.pairs_count )
    })

    // If you want to Check all "_id" which you are deleting else print statement not needed
    console.log('All tokens: ', tokensCount);
    console.log( 'All duplicates: ', duplicates.length );
    // let res = await TokenBasic.deleteMany({_id:{$in:duplicates}})  
    // console.log('Deleted: ', res)
})();

