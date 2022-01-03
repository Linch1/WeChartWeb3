
const EnumChainId = require("../../enum/chain.id");
const EnumContracts = require("../../enum/contracts");
const Bulk = require("./Bulk");
const Cache = require("./Cache");
const Token = require("./entity/Token");
const Pair = require('./Pair');

const abiDecoder = require('abi-decoder');
const EnumAbi = require("../../enum/abi");
const EnumMainTokens = require("../../enum/mainTokens");
abiDecoder.addABI(EnumAbi[EnumChainId.BSC].TOKEN);
abiDecoder.addABI(EnumAbi[EnumChainId.BSC].ROUTERS.PANCAKE);



class Scraper {
    constructor ( web3 ) {
        this.web3 = web3;
        this.UPDATE_PRICE_INTERVAL = 60 ; // push the new prices to the db every 60 seconds

        this.METHODS = [ // methods used for swap the tokens
            "swapETHForExactTokens",
            "swapExactETHForTokens",
            "swapExactETHForTokensSupportingFeeOnTransferTokens",
            "swapExactTokensForETH",
            "swapExactTokensForETHSupportingFeeOnTransferTokens",
            "swapExactTokensForTokens",
            "swapExactTokensForTokensSupportingFeeOnTransferTokens",
            "swapTokensForExactETH",
            "swapTokensForExactTokens"
        ];

        this.ROUTERS = []; // the routers allowed
        for( let router of Object.values(EnumContracts[EnumChainId.BSC].ROUTERS) ) this.ROUTERS.push(router.toLowerCase() );

        this.pairs = new Pair( this.web3 );
        this.bulk = new Bulk();
        this.cache = new Cache();
        this.tokens = new Token( this.cache, this.web3 );
    }

    async calculatePriceFromReserves( tx ) {

        if(!tx.to)return;
        tx.to = tx.to.toLowerCase();
        
        // if the transaction didn't interacted with an untracked router then return
        if( !this.ROUTERS.includes( tx.to.toLowerCase() ) ) return;
        
        // get the transaction reciept
        let tx_data = tx.data; // get the swap parameters
        if( !tx_data ) tx_data = tx.input; // the .data property sometime is in the .input field
        if( !tx_data ) { return; }
    
        let decoded_data = abiDecoder.decodeMethod(tx_data); // decode the parameters of the transaction
        if( !decoded_data ) return; // return if wasn't able to decode the datas of the transaction
        if( !this.METHODS.includes(decoded_data.name) ) return; // return if is not a tracked method
    
        let params = decoded_data.params; // decoded parameters
        let path = [];
        for(let i in params){  // loop to print parameters without unnecessary info
            if( params[i].name == 'path' ) path = params[i].value;
        }
    
        if( !path[0] ) return; // return if the path has no values
    
        let [ firstToken0Add, firstToken1Add ] = path[0] < path[1] ? [path[0], path[1]] : [path[1], path[0]]; // get the sold token
        //let [ secondToken0Add, secondToken1Add ] =  path[path.length-2] < path[path.length-1] ? [path[path.length-2], path[path.length-1]] : [path[path.length-1], path[path.length-2]]; // get the bought token
        
        await this.updatePairPriceWithReserves(tx, tx.to, firstToken0Add.toLowerCase(), firstToken1Add.toLowerCase());    
    }

    async tokenHierarchy( tokenA, tokenB ){
        // get the tokens from the db
        let first_token = await this.tokens.getToken( tokenA );
        let latest_token = await this.tokens.getToken( tokenB );
        
        if( !first_token || !latest_token ){
            if(!first_token) console.log("[ERR] MISSING: ", tokenA)
            if(!latest_token) console.log("[ERR] MISSING: ", tokenB)
            return [null, null];
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
    async updatePairPriceWithReserves( tx, router, token0, token1 ){

    
        let pair_contract = this.pairs.getPair(router, token0, token1);
    
        let first_pair =  await new this.web3.eth.Contract( EnumAbi[EnumChainId.BSC].PAIR.PANCAKE, pair_contract );
        let first_reserves = await first_pair.methods.getReserves().call();
        
        let [ mainToken, dependantToken ] = await this.tokenHierarchy(token0, token1); // get who is the main token in the pair

        if( !mainToken || !mainToken.contract || !dependantToken || !dependantToken.contract ) return;
        
        let token0Infos = mainToken.contract == token0 ? mainToken : dependantToken;
        let token1Infos = mainToken.contract == token1 ? mainToken : dependantToken;
    
        let dependantTokenPrice = null; // calculate the dependant token price
        if( mainToken.contract == token0 ) dependantTokenPrice = (first_reserves[0]/10**mainToken.decimals)/(first_reserves[1]/10**dependantToken.decimals); // here decimals
        else dependantTokenPrice = (first_reserves[1]/10**mainToken.decimals)/(first_reserves[0]/10**dependantToken.decimals); 
        
    
        if( mainToken.contract == EnumMainTokens[EnumChainId.BSC].WBNB.address ) // if the main token was BNB then multiply for get the token usd value
            dependantTokenPrice = dependantTokenPrice * MAIN_TOKEN_PRICE;
    
        let pairHistory = await this.cache.getTokenHistory( dependantToken.contract, router, pair_contract );

        if(! this.bulk.getHistory(dependantToken.contract) ) 
            this.bulk.intializeBulkForContract(dependantToken.contract)
    
        if( !pairHistory ){
            pairHistory = { history: [], records: 0  }
            let tokenHistory = {
                transactions: {
                    [router]: {
                        [pair_contract]: {
                            history: [],
                            records: 0
                        }
                    }
                },
                price: {
                    [router]: {
                        [pair_contract]: pairHistory
                    }
                    
                },
                chain: EnumChainId.BSC,
                name: dependantToken.name,
                contract: dependantToken.contract
            };
            
            console.log(`[BULK ADD CREATE] ${Object.keys(this.bulk.getHistories()).length} ${dependantToken.contract}`);
            this.bulk.setNewHistory( dependantToken.contract, tokenHistory );
            this.cache.setHistory( dependantToken.contract, router, pair_contract, pairHistory );
        }
    
        console.log(`[INFO] MAIN: ${mainToken.contract} | DEPENDANT: ${dependantToken.contract}`); 
        console.log(`[INFO] DEPENDANT PRICE: ${dependantTokenPrice}$`);
        
        await this.updatePrice( dependantToken.contract, router, pair_contract, pairHistory, dependantTokenPrice, first_reserves[0]/10**token0Infos.decimals, first_reserves[1]/10**token1Infos.decimals );

        // update transactions object
        this.bulk.setTokenBulkPush( dependantToken.contract, `transactions.${router}.${pair_contract}.history`, { hash: tx.hash, from: tx.from } );
        this.bulk.setTokenBulkInc( dependantToken.contract, `transactions.${router}.${pair_contract}.records`, 1 );

        // update router pairs
        this.bulk.setTokenBulkSet( dependantToken.contract, `pairs.${router}.${pair_contract}`, mainToken.contract );
    }
    
    async updatePrice( tokenAddress, router, pair_contract, pairHistory, newPrice, reserve0, reserve1 ) {
    
        let now = Date.now()/1000;
        let tokenInfo = this.cache.getToken(tokenAddress);
        if( !newPrice ) return;
        
        let latestHistory = pairHistory.history[ pairHistory.history.length - 1 ];
        let historiesNotPushed = this.bulk.getTokenBulkPush(tokenAddress,  `price.${router}.${pair_contract}.history` )['$each'];
        if( historiesNotPushed.length ) latestHistory = historiesNotPushed[historiesNotPushed.length-1];

        let recordIndexToUpdate = (pairHistory.records + historiesNotPushed.length - 1) > 0 ? pairHistory.records + historiesNotPushed.length - 1 : 0;
        
        let latestHistoryTime = latestHistory ? latestHistory.time: 0;
        let latestHigh = this.bulk.getTokenBulkSet( tokenAddress, `price.${router}.${pair_contract}.history.${recordIndexToUpdate}.high` );
        let latestLow = this.bulk.getTokenBulkSet( tokenAddress, `price.${router}.${pair_contract}.history.${recordIndexToUpdate}.low` );
       
        if(!latestHigh) latestHigh = latestHistory ? latestHistory.high : 0;
        if(!latestLow) latestLow = latestHistory ? latestHistory.low : 0 ;

        if( ( now - latestHistoryTime ) < this.UPDATE_PRICE_INTERVAL ){ // update latest record
            
            if( newPrice > latestHigh ){
                this.bulk.setTokenBulkSet( tokenAddress, `price.${router}.${pair_contract}.history.${recordIndexToUpdate}.high`, newPrice );
            }
            if( newPrice < latestLow ){
                this.bulk.setTokenBulkSet( tokenAddress, `price.${router}.${pair_contract}.history.${recordIndexToUpdate}.low`, newPrice );
            }
            // update the value anyway also if it is not higher that the high or lower than the low 
            this.bulk.setTokenBulkSet( tokenAddress, `price.${router}.${pair_contract}.history.${recordIndexToUpdate}.value`, newPrice );
            this.bulk.setTokenBulkSet( tokenAddress, `price.${router}.${pair_contract}.history.${recordIndexToUpdate}.reserve0`, reserve0 );
            this.bulk.setTokenBulkSet( tokenAddress, `price.${router}.${pair_contract}.history.${recordIndexToUpdate}.reserve1`, reserve1 );
        } else { // create new record

            if( latestHistory ) // update close price of latest record
                this.bulk.setTokenBulkSet( tokenAddress, `price.${router}.${pair_contract}.history.${recordIndexToUpdate}.close`, newPrice );
            
            let newObj = {
                time: Math.floor(now/this.UPDATE_PRICE_INTERVAL) * this.UPDATE_PRICE_INTERVAL, // to have standard intervals, for example the exact minutes on the time. 9:01, 9:02, 9:03
                open: newPrice,
                close: newPrice,
                high: newPrice,
                low: newPrice,
                value: newPrice,
                burned: tokenInfo ? tokenInfo.burned : null,
                mcap: tokenInfo ? (tokenInfo.total_supply - tokenInfo.burned) * newPrice : null,
                reserve0: reserve0,
                reserve1: reserve1
            };
            this.bulk.setTokenBulkPush(tokenAddress, `price.${router}.${pair_contract}.history`, newObj);
            this.bulk.setTokenBulkInc(tokenAddress, `price.${router}.${pair_contract}.records`, 1);
        }
    }
    
}

module.exports = Scraper;