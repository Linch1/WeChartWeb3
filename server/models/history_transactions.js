
var mongoose = require('mongoose');

var historyTransactionSchema = mongoose.Schema({
    time: Number, // unix timestamp
    type: Number, // buy = 0. sell = 1
    hash: String,

    from: String,
    
    amount: Number,
    
    value: Number, // estimated buy or sell price

    index: Number,
    pair: String
});
historyTransactionSchema.index({ 
    time: 1, pair: 1
}, {unique: true});
module.exports = mongoose.model('historyTransaction', historyTransactionSchema);

