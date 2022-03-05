
const TokenHistoryModel = require('../../../server/models/token_history');
class TokenHistory {
    constructor( cache ){
        this.cache = cache;
    }
    async getTokenHistory( pair ){
        let tokenHistory = this.cache.getTokenHistory( new RegExp(`/${pair}/i`) );
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
    async loadAllPairs(){
        let allHistories = await TokenHistoryModel.find()
        .select({ 'token0.contract': 1, 'token1.contract': 1, pair: 1 })
        .lean()
        .exec();
        for( let history of allHistories ){
            this.cache.setPair( history.pair, {
                tokens: [history.token0.contract, history.token1.contract ]
            })
        }
    }
}
module.exports = TokenHistory;