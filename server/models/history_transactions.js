
var mongoose = require('mongoose');

var historyTransactionSchema = mongoose.Schema({
    time: Number, // unix timestamp
    type: Number, // buy = 0. sell = 1
    hash: String,

    from: String,
    
    amount: Number,
    
    value: Number, // estimated buy or sell price

    index: Number,
    pair: String,
    mainToken: String,
    dependantToken: String,
    router: String
});
historyTransactionSchema.index({  pair: 1 });
historyTransactionSchema.index({  dependantToken: 1 });
historyTransactionSchema.index({  mainToken: 1 });
historyTransactionSchema.index({  router: 1 });
module.exports = mongoose.model('historyTransaction', historyTransactionSchema);

