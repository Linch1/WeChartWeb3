
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
    pair: String
});
historyPriceSchema.index({ 
    time: 1, pair: 1
}, {unique: true});
module.exports = mongoose.model('historyPirce', historyPriceSchema);

