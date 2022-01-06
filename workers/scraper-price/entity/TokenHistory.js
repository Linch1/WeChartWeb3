
const TokenHistoryModel = require('../../../server/models/token_history');
class TokenHistory {
    constructor( cache ){
        this.cache = cache;
    }
    async getTokenHistory( pair ){
        let tokenHistory = this.cache.getTokenHistory( pair );
        if(!tokenHistory){

            tokenHistory = await TokenHistoryModel
            .findOne( { pair: pair } )
            .select({ mainToken: 1 })
            .lean()
            .exec();
            if(!tokenHistory) return null;

            this.cache.setHistory( pair, tokenHistory );
        }
        return tokenHistory;
    }
}
module.exports = TokenHistory;