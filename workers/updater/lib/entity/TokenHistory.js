
const EnumChainId = require('../../../../enum/chain.id');
const EnumMainTokens = require('../../../../enum/mainTokens');
const TokenHistoryModel = require('../../../../server/models/token_history');
class TokenHistory {
    constructor( cache ){
        this.cache = cache;
    }
    async getTokenHistory( pair ){
        let tokenHistory = this.cache.getTokenHistory( new RegExp(`/${pair}/i`) );
        if(!tokenHistory){

            let s = Date.now();
            tokenHistory = await TokenHistoryModel
            .findOne( { pair: pair } )
            .select({ 'token0.contract': 1, 'token1.contract': 1, pair: 1, router: 1, reserve0: 1, reserve1: 1, mainToken: 1, hasFees: 1, fees: 1 })
            .lean()
            .exec();
            //console.log(`\t\t[LOADED HISTORY] ${pair} [${(Date.now() - s)/1000}]`);
            if(!tokenHistory) return null;

            this.cache.setHistory( pair, tokenHistory );
        }
        return tokenHistory;
    }
    async loadAllPairs(){
        let allHistories = await TokenHistoryModel.find()
        .select({ 'token0.contract': 1, 'token1.contract': 1, pair: 1, router: 1, reserve0: 1, reserve1: 1, mainToken: 1 })
        .lean()
        .exec();
        for( let history of allHistories ){
            this.cache.setPair( history.pair, {
                tokens: [history.token0.contract, history.token1.contract ]
            })
        }
        return allHistories;
    }
    async getPairWithMainTokens( token ){
        return await TokenHistoryModel.find(
            {
                $or: [
                    {
                        'token0.contract': token,
                        'token1.contract': {$in: [
                            ...EnumMainTokens[process.env.CHAIN_ID].STABLECOINS,
                            EnumMainTokens[process.env.CHAIN_ID].MAIN.address
                        ]}
                    },
                    {
                        'token1.contract': token,
                        'token0.contract': {$in: [
                            ...EnumMainTokens[process.env.CHAIN_ID].STABLECOINS,
                            EnumMainTokens[process.env.CHAIN_ID].MAIN.address
                        ]}
                    }
                ],
                $and: [ { router_fee: { $exists: true } }, { router_fee:  { $ne: -1 } }] // valid router condition
            }
        )
    }
    async getPairWithMainToken( token ){
        return await TokenHistoryModel.findOne(
            {
                $or: [
                    {
                        'token0.contract': token,
                        'token1.contract': EnumMainTokens[process.env.CHAIN_ID].MAIN.address
                    },
                    {
                        'token1.contract': token,
                        'token0.contract': EnumMainTokens[process.env.CHAIN_ID].MAIN.address
                    }
                ],
                $and: [ { router_fee: { $exists: true } }, { router_fee:  { $ne: -1 } }] // valid router condition
            }
        )
    }
}
module.exports = TokenHistory;