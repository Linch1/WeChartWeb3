
const EnumChainId = require("../../../enum/chain.id");
const EnumContracts = require("../../../enum/contracts");
const Bulk = require("../bulk/Bulk");
const Cache = require("../Cache");
const Token = require("../entity/Token");


const EnumAbi = require("../../../enum/abi");
const EnumBulkTypes = require("../../../enum/bulk.records.type");
const abiDecoder = require('abi-decoder');
const Scraper = require("../Scraper");
abiDecoder.addABI(EnumAbi[EnumChainId.BSC].TOKEN);
abiDecoder.addABI(EnumAbi[EnumChainId.BSC].ROUTERS.PANCAKE);

function relDiff( today, yesterday ) {
    return  100 * ( ( today - yesterday ) / ( (today+yesterday)/2 ) );
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

class ScraperSpecific extends Scraper{
    constructor ( web3 ) {
        super( web3 )
    }

    /**
     * @description Add the token price inside the Bulk history
     * @param {*} token0 address
     * @param {*} token1 address
     */
    async updatePairPriceWithReserves( router, pairAddress ){

        let pair_contract = pairAddress;
        console.log('[ANALIZE PAIR] ', pairAddress)
        while( !this.CHAIN_MAIN_TOKEN_PRICE ) {
            await sleep(100);
        }
    
        let first_pair =  await new this.web3.eth.Contract( EnumAbi[EnumChainId.BSC].PAIR.PANCAKE, pair_contract );
        let first_reserves;
        let token0;
        let token1;
        try {
            first_reserves = await first_pair.methods.getReserves().call();
            token0 = await first_pair.methods.token0().call();
            token1 = await first_pair.methods.token1().call();
        } catch (error) {
            return console.log( '[ERROR] CANNOT RETRIVE RESERVES', error );
        }

        let tokenHistory = await this.tokenHistories.getTokenHistory( pair_contract );
        if(! this.bulk.bulk_normal.getHistory( pair_contract, EnumBulkTypes.TOKEN_HISTORY ) ) 
            this.bulk.bulk_normal.intializeBulkForContract( pair_contract, EnumBulkTypes.TOKEN_HISTORY );
        
        let token0Infos = await this.tokens.getToken( token0 );
        let token1Infos = await this.tokens.getToken( token1 );
        if( !token0Infos || !token0Infos.contract || !token1Infos || !token1Infos.contract ) return;

        let [ mainToken, dependantToken ] = await this.tokenHierarchy(token0Infos, token1Infos, tokenHistory); // get who is the main token in the pair
        
        let mainTokenIsBNB = this.isMainToken();

        let dependantTokenPrice = null; // calculate the dependant token price
        if( mainToken.contract == token0 ) dependantTokenPrice = (first_reserves[0]/10**mainToken.decimals)/(first_reserves[1]/10**dependantToken.decimals); // here decimals
        else dependantTokenPrice = (first_reserves[1]/10**mainToken.decimals)/(first_reserves[0]/10**dependantToken.decimals); 
        
    
        if( mainTokenIsBNB ){ // if the main token was BNB then multiply for get the token usd value
            console.log('[MAIN PRICE]', this.CHAIN_MAIN_TOKEN_PRICE)
            if(this.CHAIN_MAIN_TOKEN_PRICE){
                dependantTokenPrice = dependantTokenPrice * this.CHAIN_MAIN_TOKEN_PRICE;
            }
        } 
    
        console.log(`[INFO] MAIN: ${mainToken.contract} | DEPENDANT: ${dependantToken.contract}`); 
        console.log(`[INFO] DEPENDANT PRICE: ${dependantTokenPrice}$`);
        
        let reserve0 = first_reserves[0]/10**token0Infos.decimals;
        let reserve1 = first_reserves[1]/10**token1Infos.decimals;

        let pairHistory = await this.historyPrices.getHistory(pair_contract);

        await this.updatePrice( 
            router, pair_contract, dependantToken.contract, mainToken.contract,
            pairHistory.latest, dependantTokenPrice, 
            reserve0, reserve1 
        );

        // update the pair records
        this.bulk.bulk_normal.setTokenBulkSet( pair_contract, EnumBulkTypes.TOKEN_HISTORY ,`pair`, pair_contract );
        this.bulk.bulk_normal.setTokenBulkSet( pair_contract, EnumBulkTypes.TOKEN_HISTORY ,`mainToken`, mainToken.contract );
        this.bulk.bulk_normal.setTokenBulkSet( pair_contract, EnumBulkTypes.TOKEN_HISTORY ,`dependantToken`, dependantToken.contract );
        this.bulk.bulk_normal.setTokenBulkInc( pair_contract, EnumBulkTypes.TOKEN_HISTORY ,`records_transactions`, 1 );

        this.bulk.bulk_normal.setTokenBulkSet( pair_contract, EnumBulkTypes.TOKEN_HISTORY ,'token0.contract', token0Infos.contract);
        this.bulk.bulk_normal.setTokenBulkSet( pair_contract, EnumBulkTypes.TOKEN_HISTORY ,'token0.name', token0Infos.name);
        this.bulk.bulk_normal.setTokenBulkSet( pair_contract, EnumBulkTypes.TOKEN_HISTORY ,'token0.symbol', token0Infos.symbol);

        this.bulk.bulk_normal.setTokenBulkSet( pair_contract, EnumBulkTypes.TOKEN_HISTORY ,'token1.contract', token1Infos.contract);
        this.bulk.bulk_normal.setTokenBulkSet( pair_contract, EnumBulkTypes.TOKEN_HISTORY ,'token1.name', token1Infos.name);
        this.bulk.bulk_normal.setTokenBulkSet( pair_contract, EnumBulkTypes.TOKEN_HISTORY ,'token1.symbol', token1Infos.symbol);

        this.bulk.bulk_normal.setTokenBulkSet( pair_contract, EnumBulkTypes.TOKEN_HISTORY ,'reserve0', reserve0);
        this.bulk.bulk_normal.setTokenBulkSet( pair_contract, EnumBulkTypes.TOKEN_HISTORY ,'reserve1', reserve1);
        this.bulk.bulk_normal.setTokenBulkSet( pair_contract, EnumBulkTypes.TOKEN_HISTORY ,'price', dependantTokenPrice);

        console.log(this.bulk.bulk_normal.BulkWriteOperations[EnumBulkTypes.TOKEN_HISTORY][pair_contract],  )
        console.log( this.bulk.bulk_normal.BulkWriteOperations[EnumBulkTypes.TOKEN_HISTORY][pair_contract]['update']['updateOne']['update']['$set'] )

        // detect the main reseve and the dependant token reserve in the pair
        let mainReserve;
        let dependantReserve;
        if( mainToken.contract == token0 ) {
            mainReserve = reserve0;
            dependantReserve = reserve1;
        } else {
            mainReserve = reserve1;
            dependantReserve = reserve0;
        }

        let mainReserveValue = mainReserve; 
        if( mainTokenIsBNB ) mainReserveValue = mainReserve * this.CHAIN_MAIN_TOKEN_PRICE; // if the main token of the pair is BNB then multiply the tokens in the pair reserver * bnb price
        this.bulk.bulk_normal.setTokenBulkSet( pair_contract, EnumBulkTypes.TOKEN_HISTORY, 'mainReserveValue', mainReserveValue);

        // update daily variation percentage
        let dayAgoHistoryPrice = pairHistory.day;
        if( dayAgoHistoryPrice ){ 
            let dailyVariation = relDiff(dependantTokenPrice, dayAgoHistoryPrice.value).toFixed(2);
            this.bulk.bulk_normal.setTokenBulkSet( pair_contract, EnumBulkTypes.TOKEN_HISTORY, 'variation.day', dailyVariation );
            console.log(`[UPDATING PERCENTAGE DAILY] ${pair_contract} ${dailyVariation}`)
        }
    }

}

module.exports = ScraperSpecific;