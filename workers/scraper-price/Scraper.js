
const EnumChainId = require("../../enum/chain.id");
const EnumContracts = require("../../enum/contracts");
const Bulk = require("./bulk/Bulk");
const Cache = require("./Cache");
const Token = require("./entity/Token");
const Pair = require('./Pair');

const abiDecoder = require('abi-decoder');
const EnumAbi = require("../../enum/abi");
const EnumMainTokens = require("../../enum/mainTokens");
const EnumBulkTypes = require("../../enum/bulk.records.type");
const TokenHistory = require("./entity/TokenHistory");
const HistoryPirce = require("./entity/HistoryPirce");
abiDecoder.addABI(EnumAbi[EnumChainId.BSC].TOKEN);
abiDecoder.addABI(EnumAbi[EnumChainId.BSC].ROUTERS.PANCAKE);

function relDiff( today, yesterday ) {
    return  100 * ( ( today - yesterday ) / ( (today+yesterday)/2 ) );
}

class Scraper {
    constructor ( web3, CHAIN_MAIN_TOKEN_PRICE ) {
        this.web3 = web3;
        this.UPDATE_PRICE_INTERVAL = 60 ; // push the new prices to the db every 60 seconds
        this.CHAIN_MAIN_TOKEN_PRICE = CHAIN_MAIN_TOKEN_PRICE;

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
        
        this.cache = new Cache();
        this.bulk = new Bulk( this.cache );

        this.tokens = new Token( this.cache, this.web3 );
        this.tokenHistories = new TokenHistory( this.cache );
        this.historyPrices = new HistoryPirce( this.cache );
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
        
        // in developend to test things out just consider usdt token
        // if( 
        //     firstToken0Add.toLowerCase() != '0x55d398326f99059ff775485246999027b3197955'.toLowerCase() &&
        //     firstToken1Add.toLowerCase() != '0x55d398326f99059ff775485246999027b3197955'.toLowerCase()
        // ) return;

        await this.updatePairPriceWithReserves(tx, tx.to, firstToken0Add.toLowerCase(), firstToken1Add.toLowerCase(), [ path[0], path[1] ]);    
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
    async updatePairPriceWithReserves( tx, router, token0, token1, tokenOriginalOrder ){

        let pair_contract = this.pairs.getPair(router, token0, token1);
    
        let first_pair =  await new this.web3.eth.Contract( EnumAbi[EnumChainId.BSC].PAIR.PANCAKE, pair_contract );
        let first_reserves = await first_pair.methods.getReserves().call();

        let tokenHistory = await this.tokenHistories.getTokenHistory( pair_contract );
        if(! this.bulk.bulk_normal.getHistory( pair_contract, EnumBulkTypes.TOKEN_HISTORY ) ) 
            this.bulk.bulk_normal.intializeBulkForContract( pair_contract, EnumBulkTypes.TOKEN_HISTORY );
        
        let token0Infos = await this.tokens.getToken( token0 );
        let token1Infos = await this.tokens.getToken( token1 );
        if( !token0Infos || !token0Infos.contract || !token1Infos || !token1Infos.contract ) return;

        let [ mainToken, dependantToken ] = await this.tokenHierarchy(token0Infos, token1Infos, tokenHistory); // get who is the main token in the pair
        
        

        let dependantTokenPrice = null; // calculate the dependant token price
        if( mainToken.contract == token0 ) dependantTokenPrice = (first_reserves[0]/10**mainToken.decimals)/(first_reserves[1]/10**dependantToken.decimals); // here decimals
        else dependantTokenPrice = (first_reserves[1]/10**mainToken.decimals)/(first_reserves[0]/10**dependantToken.decimals); 
        
    
        if( mainToken.contract == EnumMainTokens[EnumChainId.BSC].WBNB.address ){ // if the main token was BNB then multiply for get the token usd value
            console.log('[MAIN PRICE]', this.CHAIN_MAIN_TOKEN_PRICE[0])
            if(this.CHAIN_MAIN_TOKEN_PRICE[0]){
                dependantTokenPrice = dependantTokenPrice * this.CHAIN_MAIN_TOKEN_PRICE[0];
            }
        } 
    
        if( !tokenHistory ){
            tokenHistory = {
                records_transactions: 0,
                records_price: 0,
                chain: EnumChainId.BSC,
                token0: {
                    contract: token0Infos.contract,
                    name: token0Infos.name
                },
                token1: {
                    contract: token1Infos.contract,
                    name: token1Infos.name
                },
                router: router,
                pair: pair_contract,
                mainToken: mainToken.contract,
                dependantToken: dependantToken.contract
            };
            
            console.log(`[BULK ADD CREATE] ${Object.keys(this.bulk.bulk_normal.getHistories(EnumBulkTypes.TOKEN_HISTORY)).length} ${dependantToken.contract}`);
            this.bulk.bulk_normal.setNewDocument( pair_contract, EnumBulkTypes.TOKEN_HISTORY, tokenHistory );
            this.cache.setHistory(pair_contract, tokenHistory);
        }
    
        console.log(`[INFO] MAIN: ${mainToken.contract} | DEPENDANT: ${dependantToken.contract}`); 
        console.log(`[INFO] DEPENDANT PRICE: ${dependantTokenPrice}$`);
        
        let reserve0 = first_reserves[0]/10**token0Infos.decimals;
        let reserve1 = first_reserves[1]/10**token1Infos.decimals;

        let pairHistory = await this.historyPrices.getHistory(pair_contract);

        await this.updatePrice( pair_contract, dependantToken.contract, pairHistory.latest, dependantTokenPrice, reserve0, reserve1 );

        // update transactions object
        let time = this.getTime();
        this.bulk.bulk_time.setNewDocument( pair_contract, EnumBulkTypes.HISOTRY_TRANSACTION, time, {
            time: time, // unix timestamp
            type: dependantToken.contract == tokenOriginalOrder[0] ? 1 : 0, // buy = 0. sell = 1
            hash: tx.hash,
            from: tx.from,
            pair: pair_contract
        });

        this.bulk.bulk_normal.setTokenBulkInc( pair_contract, EnumBulkTypes.TOKEN_HISTORY ,`records_transactions`, 1 );
        this.bulk.bulk_normal.setTokenBulkSet( pair_contract, EnumBulkTypes.TOKEN_HISTORY ,'reserve0', reserve0);
        this.bulk.bulk_normal.setTokenBulkSet( pair_contract, EnumBulkTypes.TOKEN_HISTORY ,'reserve1', reserve1);
        this.bulk.bulk_normal.setTokenBulkSet( pair_contract, EnumBulkTypes.TOKEN_HISTORY ,'price', dependantTokenPrice);

        let dayAgoHistoryPrice = pairHistory.day;
        if( dayAgoHistoryPrice ){ // update daily variation percentage
            let dailyVariation = relDiff(dependantTokenPrice, dayAgoHistoryPrice.value).toFixed(2);
            this.bulk.bulk_normal.setTokenBulkSet( pair_contract, EnumBulkTypes.TOKEN_HISTORY, 'variation.day', dailyVariation );
            console.log(`[UPDATING PERCENTAGE DAILY] ${pair_contract} ${dailyVariation}`)
        }

        let mainReserveValue;
        if( mainToken.contract == token0 )  mainReserveValue = reserve0;
        else mainReserveValue = reserve1
        if( mainToken.contract  == EnumMainTokens[EnumChainId.BSC].MAIN ) mainReserveValue = mainReserveValue * this.CHAIN_MAIN_TOKEN_PRICE[0];
        this.bulk.bulk_normal.setTokenBulkSet( pair_contract, EnumBulkTypes.TOKEN_HISTORY, 'mainReserveValue', mainReserveValue);
    }

    getTime() { return Math.floor((Date.now()/1000)/this.UPDATE_PRICE_INTERVAL) * this.UPDATE_PRICE_INTERVAL }
    
    async updatePrice( pair, tokenAddress, latestHistoryPirce, newPrice, reserve0, reserve1 ) {
    
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
      
                pair: pair
            } );

            if( tokenInfo ) {
                this.bulk.bulk_normal.setTokenBulkSet(pair, EnumBulkTypes.TOKEN_HISTORY, 'burned', tokenInfo.burned )
                this.bulk.bulk_normal.setTokenBulkSet(pair, EnumBulkTypes.TOKEN_HISTORY, 'mcap', (tokenInfo.total_supply - tokenInfo.burned) * newPrice )
            }
                
            this.bulk.bulk_normal.setTokenBulkSet(pair, EnumBulkTypes.TOKEN_HISTORY, 'value', newPrice );
            this.bulk.bulk_normal.setTokenBulkInc(pair, EnumBulkTypes.TOKEN_HISTORY, 'records_price', 1);
        }
    }
    
}

module.exports = Scraper;