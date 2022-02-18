var mongoose = require('mongoose');

var tokenBasicSchema = mongoose.Schema({
    chain: String,
    contract: String,
    name: String,
    symbol: String,
    decimals: Number,
    total_supply: Number,
    pairs_count: Number
}, { timestamps: { createdAt: 'created_at' } });

tokenBasicSchema.index({chain: 1, contract: 1, name: 1, pairs_count: 1});

module.exports = mongoose.model('TokenBasic', tokenBasicSchema);
