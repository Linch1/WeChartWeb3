var mongoose = require('mongoose');

var tokenBasicSchema = mongoose.Schema({
    chain: String,
    contract: String,
    name: String,
    symbol: String,
    decimals: Number,
    total_supply: Number,
    pairs_count: Number,
    score: Object, // { [day]: { tx_count: 0 } }
    score_points: Number,
    
}, { timestamps: { createdAt: 'created_at' } });

tokenBasicSchema.index({chain: 1});
tokenBasicSchema.index({contract: 1}, {unique: true});
tokenBasicSchema.index({name: 1});
tokenBasicSchema.index({pairs_count: 1});
tokenBasicSchema.index({score_point: 1});
/*
db.tokenbasics.ensureIndex({chain: 1});
db.tokenbasics.ensureIndex({contract: 1});
db.tokenbasics.ensureIndex({name: "hashed"});
db.tokenbasics.ensureIndex({pairs_count: 1});
db.tokenbasics.ensureIndex({score_points: 1});
*/

module.exports = mongoose.model('TokenBasic', tokenBasicSchema);
