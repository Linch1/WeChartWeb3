
var mongoose = require('mongoose');

var historyTransactionSchema = mongoose.Schema({
    time: Number, // unix timestamp
    hash: String,

    from: String,
    
    amountIn: Number,
    amountOut: Number,

    tokenIn: String,
    tokenOut: String,

    value: Number, // estimated buy or sell price

    index: Number,
    pair: String,
    mainToken: String,
    dependantToken: String,
    router: String
});
historyTransactionSchema.index({ pair: 1 });
historyTransactionSchema.index({ dependantToken: 1 });
historyTransactionSchema.index({ mainToken: 1 });
historyTransactionSchema.index({ router: 1 });
historyTransactionSchema.index({ time: 1 });
/*
db.historytransactions.ensureIndex({ pair: 1 });
db.historytransactions.ensureIndex({ dependantToken: 1 });
db.historytransactions.ensureIndex({ mainToken: 1 });
db.historytransactions.ensureIndex({ router: 1 });
db.historytransactions.ensureIndex({ time: 1 });
*/

module.exports = mongoose.model('historyTransaction', historyTransactionSchema);

