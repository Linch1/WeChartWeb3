
const EnumChainId = require("../../enum/chain.id");
const EnumContracts = require("../../enum/contracts");
const Bulk = require("./bulk/Bulk");
const Cache = require("./Cache");
const Token = require("./entity/Token");


const EnumAbi = require("../../enum/abi");
const EnumMainTokens = require("../../enum/mainTokens");
const EnumBulkTypes = require("../../enum/bulk.records.type");
const TokenHistory = require("./entity/TokenHistory");
const HistoryPirce = require("./entity/HistoryPirce");

const abiDecoder = require('abi-decoder');
abiDecoder.addABI(EnumAbi[EnumChainId.BSC].TOKEN);
abiDecoder.addABI(EnumAbi[EnumChainId.BSC].ROUTERS.PANCAKE);

function relDiff( today, yesterday ) {
    return  100 * ( ( today - yesterday ) / ( (today+yesterday)/2 ) );
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

class ScraperSpecific {
    constructor ( web3 ) {
        this.web3 = web3;
        this.UPDATE_PRICE_INTERVAL = process.env.WRITE_TO_DB_SECONDS ; // create a new record for the prices every x seconds
        this.CHAIN_MAIN_TOKEN_PRICE = 0;

        this.ROUTERS = []; // the routers allowed
        for( let router of Object.values(EnumContracts[EnumChainId.BSC].ROUTERS) ) this.ROUTERS.push(router );
        
        this.cache = new Cache();
        this.bulk = new Bulk( this.cache );

        this.tokens = new Token( this.cache, this.web3 );
        this.tokenHistories = new TokenHistory( this.cache );
        this.historyPrices = new HistoryPirce( this.cache );
        this.loopUpdateMainTokenPrice();
    }


    // returns an array [ mainToken, dependantToken ];
    async tokenHierarchy( first_token, latest_token, history ){ 
        // to have consistency in data collection keep using the same mainToken and dependantToken if present in history
        if( history ){ 
            let mainTokenContract = history.mainToken;
            if( first_token.contract == mainTokenContract ) return [ first_token, latest_token ]
            else return [ latest_token, first_token ];
        }
       // compare wich of the tokens is used more frequently to create pairs. This means that the one with more pairs is the more common used
       let pairs_comparison = first_token.pairs_count > latest_token.pairs_count; // here pairs_count
       let main_token = pairs_comparison ? first_token : latest_token;
       let dependant_token = pairs_comparison ? latest_token : first_token;
       return [ main_token, dependant_token ];
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
        
        let mainTokenIsBNB = mainToken.contract == EnumMainTokens[EnumChainId.BSC].WBNB.address;

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

    getTime() { return Math.floor((Date.now()/1000)/this.UPDATE_PRICE_INTERVAL) * this.UPDATE_PRICE_INTERVAL }
    addDecimals( value, decimals ){ return value/10**decimals }
    async updatePrice( router, pair, tokenAddress, mainTokenAddress, latestHistoryPirce, newPrice, reserve0, reserve1 ) {
    
        let time = this.getTime();
        let tokenInfo = this.cache.getToken(tokenAddress);
        if( !newPrice ) return;
        

        let latestHistory = latestHistoryPirce;
        let latestHistoryTime = latestHistory ? latestHistory.time: 0;

        let latestHigh = latestHistory ? latestHistory.high : 0;
        let latestLow = latestHistory ? latestHistory.low : 0 ;

        console.log(`[UPDATING PRICE]`, pair)

        if( ( time - latestHistoryTime ) < this.UPDATE_PRICE_INTERVAL ){ // update latest record
            
            if( newPrice > latestHigh ){
                this.bulk.bulk_time.setTokenBulkSet( pair, EnumBulkTypes.HISTORY_PRICE, time, 'high', newPrice );
            }
            if( newPrice < latestLow ){
                this.bulk.bulk_time.setTokenBulkSet( pair, EnumBulkTypes.HISTORY_PRICE, time, 'low', newPrice );
            }
            // update the value anyway also if it is not higher that the high or lower than the low 
            this.bulk.bulk_time.setTokenBulkSet( pair, EnumBulkTypes.HISTORY_PRICE, time, 'value', newPrice );
            this.bulk.bulk_time.setTokenBulkSet( pair, EnumBulkTypes.HISTORY_PRICE, time, 'reserve0', reserve0 );
            this.bulk.bulk_time.setTokenBulkSet( pair, EnumBulkTypes.HISTORY_PRICE, time, 'reserve1', reserve1 );
            
            
        } else { // create new record  

            
            if( !latestHistoryTime || typeof latestHistoryTime != 'number' ){  // load the time of the last time that this price was updated so that we can change the 'close' parameter
                console.log(`[CLOSE RETRIVE] RETRIVING LAST HISTORY ${pair}. ${latestHistoryTime}`);
                latestHistoryTime = await this.historyPrices.getLastHistoryTime(pair, time);
                console.log(`[CLOSE RETRIVE] RETRIVED ${latestHistoryTime} ${pair}`)
            }
            if( latestHistoryTime ){ // update the close parameter
                console.log(`[CLOSE] UPDATING ${latestHistoryTime} WITH ${newPrice}. ${pair}`)
                this.bulk.bulk_time.setTokenBulkSet( pair, EnumBulkTypes.HISTORY_PRICE, latestHistoryTime, 'close', newPrice );
            } else {
                console.log(`[CLOSE FAIL] CANNOT UPDATE ${latestHistoryTime} WITH ${newPrice}. ${pair}`)
            }
            
            console.log(`[CREATING RECORD] ${pair}. LAST RECORD: ${latestHistoryTime}`);
            this.bulk.bulk_time.setNewDocument( pair, EnumBulkTypes.HISTORY_PRICE, time, {
                time: time, // to have standard intervals, for example the exact minutes on the time. 9:01, 9:02, 9:03
                open: newPrice,
                close: newPrice,
                high: newPrice,
                low: newPrice,
                value: newPrice,
                burned: tokenInfo ? tokenInfo.burned : null,
                mcap: tokenInfo ? (tokenInfo.total_supply - tokenInfo.burned) * newPrice : 0,
      
                pair: pair,
                router: router,
                mainToken: mainTokenAddress,
                dependantToken: tokenAddress
            } );

            if( tokenInfo ) {
                this.bulk.bulk_normal.setTokenBulkSet(pair, EnumBulkTypes.TOKEN_HISTORY, 'burned', tokenInfo.burned )
                this.bulk.bulk_normal.setTokenBulkSet(pair, EnumBulkTypes.TOKEN_HISTORY, 'mcap', (tokenInfo.total_supply - tokenInfo.burned) * newPrice )
            }
                
            this.bulk.bulk_normal.setTokenBulkSet(pair, EnumBulkTypes.TOKEN_HISTORY, 'value', newPrice );
            this.bulk.bulk_normal.setTokenBulkInc(pair, EnumBulkTypes.TOKEN_HISTORY, 'records_price', 1);
        }
    }
    
    async loopUpdateMainTokenPrice(){
        let FACTORY = await new this.web3.eth.Contract( EnumAbi[EnumChainId.BSC].FACTORIES.PANCAKE, EnumContracts[EnumChainId.BSC].FACTORIES.PANCAKE );
        while( true ){
            try {
                let mainTokenPairAddress = await FACTORY.methods.getPair( EnumMainTokens[EnumChainId.BSC].WBNB.address, EnumMainTokens[EnumChainId.BSC].USDT.address ).call();
                let mainTokenPair = await new this.web3.eth.Contract( EnumAbi[EnumChainId.BSC].PAIR.PANCAKE, mainTokenPairAddress );
                let reserves = await mainTokenPair.methods.getReserves().call();
                let WBNB_RESERVE = reserves[1]/10**EnumMainTokens[EnumChainId.BSC].WBNB.decimals;
                let USDT_RESERVE = reserves[0]/10**EnumMainTokens[EnumChainId.BSC].USDT.decimals;
                let WBNB_PRICE = USDT_RESERVE/WBNB_RESERVE;
                this.CHAIN_MAIN_TOKEN_PRICE = WBNB_PRICE;
            } catch (error) {
                console.log(`[ERR UPDATING MAIN PRICE] ${error}`);
            }
            await sleep(5);
        }
    }

}

module.exports = ScraperSpecific;