
var mongoose = require('mongoose');

var historyPriceSchema = mongoose.Schema({
    time: Number, // unix timestamp
    
    open: Number,
    close: Number,
    high: Number,
    low: Number,
    value: Number,
    dependantValue: Number, // the value based on the token with which it is in pair

    index: Number,
    pair: String,
    router: String,
    mainToken: String,
    dependantToken: String,
});
historyPriceSchema.index({ pair: 1 });
historyPriceSchema.index({  dependantToken: 1 });
historyPriceSchema.index({  mainToken: 1 });
historyPriceSchema.index({ router: 1 });
module.exports = mongoose.model('historyPirce', historyPriceSchema);

