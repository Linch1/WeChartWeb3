var mongoose = require('mongoose');

var pairSchema = mongoose.Schema({
    contract: String,
    valid: Boolean,
    token0: String,
    token1: String,
    amount: Number

}, { timestamps: { createdAt: 'created_at' } });

pairSchema.index({'contract': 1});
pairSchema.index({'valid': 1});
/*
db.pairs.ensureIndex({'token0.contract': 1});
db.pairs.ensureIndex({'token1.contract': 1});
db.pairs.ensureIndex({contract: 1});
db.pairs.ensureIndex({router: 1});
db.pairs.ensureIndex({chain: 1});
*/
module.exports = mongoose.model('Router', pairSchema);

