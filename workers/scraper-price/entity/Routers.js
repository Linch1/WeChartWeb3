const EnumAbi = require('../../../enum/abi');
const EnumBulkTypes = require('../../../enum/bulk.records.type');
const EnumChainId = require('../../../enum/chain.id');
const Routers = require('../../../server/models/routers');

class Router {
    constructor( cache, web3, bulk ){
        this.cache = cache;
        this.web3 = web3;
        this.bulk = bulk;
    }
    async getRouter( routerAdd, token0, token1, token0Decimals ){
        let routerCached = this.cache.getRouter( routerAdd );
        if( !routerCached ){
            let router = await Routers.findOne({ contract: routerAdd}).lean().exec();
            if(!router){
                let result = await this.isValid( routerAdd, token0, token1, token0Decimals );
                this.cache.setRouter(routerAdd, {valid: result, contract: routerAdd, token0: token0, token1: token1, amount: 10**token0Decimals } );
                this.bulk.bulk_normal.setNewDocument(routerAdd, EnumBulkTypes.ROUTERS,  {valid: result, contract: routerAdd, token0: token0, token1: token1, amount: 10**token0Decimals }  );
            } else {
                this.cache.setRouter(routerAdd, router);
            }
            console.log(`[ROUTER] Loaded in cache ${routerAdd} `);  
        } 
    }
    async isValid( routerAdd, token0, token1, token0Decimals ){
        let routerContract = await new this.web3.eth.Contract( EnumAbi[EnumChainId.BSC].ROUTERS.PANCAKE, routerAdd );
        // try to call the getAmountOutMin on the router, if it sucessfull than the router is valid, else it is not valid
        let callResult;
        try{
            let getAmountOutMin = await routerContract.methods.getAmountsOut( 10**token0Decimals, [token0, token1]);
            let factory = await routerContract.methods.factory().call();
            console.log(`[ROUTER] Valid ${routerAdd}. Factory: ${factory} `);
            callResult = true;
        } catch( err ){
            console.log(`[ROUTER] Not valid ${routerAdd} `, err);
            callResult = false
        }
        return callResult;
    }
}

module.exports = Router;