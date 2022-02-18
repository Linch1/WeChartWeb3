const EnumAbi = require('../../../enum/abi');
const EnumChainId = require('../../../enum/chain.id');
const TokenBasic = require('../../../server/models/token_basic');

class Token {
    constructor( cache, web3 ){
        this.cache = cache;
        this.web3 = web3;
    }
    async getToken( token ){
        
        let tokenInfo = this.cache.getToken(token);
    
        let searchOnDb = true;
        if( tokenInfo && tokenInfo.notFound )
            if( ( Date.now() - tokenInfo.date ) < 1000 * 60 ) // scrape a not found token only after one minute
                searchOnDb = false
        
        
        if( searchOnDb && (!tokenInfo || tokenInfo.notFound) ) {
            tokenInfo = await TokenBasic
            .findOne({ contract: token })
            .select({ contract: 1, decimals: 1, pairs_count: 1, total_supply: 1, name: 1 })
            .lean()
            .exec();
            console.log(`[LOADED TOKEN] ${token} `);
            if(!tokenInfo) {
                let token_contract = await new this.web3.eth.Contract( EnumAbi[EnumChainId.BSC].TOKEN, token );
                let token_decimals;
                let name;
                let supply;
                try {
                    token_decimals = parseInt( await token_contract.methods.decimals().call() );
                    name = await token_contract.methods.name().call();
                    supply = parseInt( await token_contract.methods.totalSupply().call() )/(10**token_decimals);

                    tokenInfo = {
                        contract: token,
                        pairs_count: 0,
                        decimals: token_decimals,
                        name: name,
                        total_supply: supply,
                    }
                } catch (error) {
                    console.log('[ERROR] Cannot retrive token informations', error);
                }
            }
            this.cache.setToken( token, tokenInfo );
        } 

        if(tokenInfo && !tokenInfo.burned) tokenInfo.burned = (await this.getBurned(token))/10**tokenInfo.decimals;

        return tokenInfo;
    }
    async getBurned( token ){
        try {
            let tokenContract = await new this.web3.eth.Contract( EnumAbi[EnumChainId.BSC].PAIR.PANCAKE, token );
            let zeroAddAmount = await tokenContract.methods.balanceOf("0x0000000000000000000000000000000000000000").call();
            let burnAddAmount = await tokenContract.methods.balanceOf("0x000000000000000000000000000000000000dEaD").call();
            return zeroAddAmount + burnAddAmount;
        } catch (error) {
            console.log(`[ERR RETRIVING TOKEN BURNED] ${error} `);
        }
        return 0;
    }
}

module.exports = Token;