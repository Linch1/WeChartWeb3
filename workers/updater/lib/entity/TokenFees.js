let abi = [ { "inputs": [ { "internalType": "address", "name": "_router", "type": "address" } ], "stateMutability": "nonpayable", "type": "constructor" }, { "inputs": [ { "internalType": "address", "name": "spender", "type": "address" }, { "internalType": "address", "name": "tokenAddress", "type": "address" } ], "name": "approve", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [ { "internalType": "address", "name": "tokenAddress", "type": "address" }, { "internalType": "address", "name": "pairAdd", "type": "address" }, { "internalType": "uint256", "name": "fee", "type": "uint256" }, { "internalType": "uint256", "name": "bnbIn", "type": "uint256" } ], "name": "checkFeesOnBuy", "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" }, { "internalType": "uint256", "name": "", "type": "uint256" } ], "stateMutability": "payable", "type": "function" }, { "inputs": [ { "internalType": "address", "name": "customToken", "type": "address" }, { "internalType": "address", "name": "pairAdd1", "type": "address" }, { "internalType": "uint256", "name": "fee1", "type": "uint256" }, { "internalType": "address", "name": "tokenAddress", "type": "address" }, { "internalType": "address", "name": "pairAdd2", "type": "address" }, { "internalType": "uint256", "name": "fee2", "type": "uint256" }, { "internalType": "uint256", "name": "bnbIn", "type": "uint256" } ], "name": "checkFeesOnBuyCustomToken", "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" }, { "internalType": "uint256", "name": "", "type": "uint256" } ], "stateMutability": "payable", "type": "function" }, { "inputs": [ { "internalType": "address", "name": "tokenAddress", "type": "address" }, { "internalType": "address", "name": "pairAdd1", "type": "address" }, { "internalType": "uint256", "name": "fee1", "type": "uint256" } ], "name": "checkFeesOnSell", "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" }, { "internalType": "uint256", "name": "", "type": "uint256" } ], "stateMutability": "payable", "type": "function" }, { "inputs": [ { "internalType": "address", "name": "customToken", "type": "address" }, { "internalType": "address", "name": "pairAdd1", "type": "address" }, { "internalType": "uint256", "name": "fee1", "type": "uint256" }, { "internalType": "address", "name": "tokenAddress", "type": "address" }, { "internalType": "address", "name": "pairAdd2", "type": "address" }, { "internalType": "uint256", "name": "fee2", "type": "uint256" } ], "name": "checkFeesOnSellCustomToken", "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" }, { "internalType": "uint256", "name": "", "type": "uint256" } ], "stateMutability": "payable", "type": "function" }, { "inputs": [ { "internalType": "address", "name": "tokenAddress", "type": "address" }, { "internalType": "address", "name": "pairAddress", "type": "address" }, { "internalType": "uint256", "name": "fee", "type": "uint256" }, { "internalType": "uint256", "name": "tokenAmount", "type": "uint256" } ], "name": "sellSomeTokens", "outputs": [ { "internalType": "uint256", "name": "idealBnbOut", "type": "uint256" }, { "internalType": "uint256", "name": "bnbOut", "type": "uint256" } ], "stateMutability": "payable", "type": "function" }, { "inputs": [ { "internalType": "address", "name": "_tokenIn", "type": "address" }, { "internalType": "address", "name": "_tokenOut", "type": "address" }, { "internalType": "address", "name": "pairAdd", "type": "address" }, { "internalType": "uint256", "name": "fee", "type": "uint256" }, { "internalType": "uint256", "name": "tokenAmount", "type": "uint256" } ], "name": "sellSomeTokensForCustom", "outputs": [ { "internalType": "uint256", "name": "idealBnbOut", "type": "uint256" }, { "internalType": "uint256", "name": "bnbOut", "type": "uint256" } ], "stateMutability": "payable", "type": "function" }, { "inputs": [], "name": "withdraw", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [ { "internalType": "address", "name": "tokenAddress", "type": "address" }, { "internalType": "address", "name": "to", "type": "address" } ], "name": "withdrawToken", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "stateMutability": "payable", "type": "receive" } ] 

class TokenFees {
    constructor( web3 ){
        this.web3 = web3;
        this.contract = null;
    }
    async initalize(){
        if( !this.contract )
            this.contract = await new this.web3.eth.Contract( abi, "0x8bE2F598BF34502F153197157eab37fc213afC1e" );
    }
    async sellFees( tokenAddress, pairAdd1, fee, bnbIn ){
        await this.initalize();
        try {
            let res = await this.contract.methods.checkFeesOnSell(tokenAddress, pairAdd1, fee)
            .call({ from: this.web3.eth.defaultAccount, value: bnbIn });
            return res[1]/res[0] * 100;
        } catch (error) {
            console.log('\t\t[ERROR SELL FEES]', error, tokenAddress);
            //console.log('\t\tsellFees', tokenAddress, pairAdd1, fee, bnbIn);
            //process.exit();
        }
    }
    async sellFeesCustom( customToken, pairAdd1, fee1, tokenAddress, pairAdd2, fee2, bnbIn ){
        await this.initalize();
        try {
            let res = await this.contract.methods.checkFeesOnSellCustomToken(customToken, pairAdd1, fee1, tokenAddress, pairAdd2, fee2)
            .call({ from: this.web3.eth.defaultAccount, value: bnbIn });
            return res[1]/res[0] * 100;
        } catch (error) {
            console.log('\t\t[ERROR SELL FEES CUSTOM]', error, tokenAddress);
            //console.log('\t\tsellFeesCustom', customToken, pairAdd1, fee1, tokenAddress, pairAdd2, fee2, bnbIn);
            //process.exit();
        }
    }

    async buyFees( tokenAddress, pairAdd, fee, bnbIn ){
        await this.initalize();
        try {
            let res = await this.contract.methods.checkFeesOnBuy(tokenAddress, pairAdd, fee, bnbIn)
            .call({ from: this.web3.eth.defaultAccount, value: bnbIn });
            return res[1]/res[0] * 100;
        } catch (error) {
            //console.log('\t\t[ERROR BUY FEES]', error);
            //console.log('\t\tbuyFees', tokenAddress, pairAdd, fee, bnbIn);
            //process.exit();
        }
    }
    /**
     * 
     * @param {*} customToken a token that wil be used to buy the 'tokenAddress'
     * @param {*} pairAdd1 the pair where to buy 'customToken' with bnb
     * @param {*} fee1 the fee of the the swap bnb -> customToken
     * @param {*} tokenAddress the token to calculate the fee on
     * @param {*} pairAdd2 the pair customToken -> tokenAddress
     * @param {*} fee2 the fee of the the swap customToken -> tokenAddress
     * @param {*} bnbIn amount of bnb to use to buy 'customToken'
     * @returns 
     */
    async buyFeesCustom( customToken, pairAdd1, fee1, tokenAddress, pairAdd2, fee2, bnbIn ){
        await this.initalize();
        try {
            let res = await this.contract.methods.checkFeesOnBuyCustomToken(customToken, pairAdd1, fee1, tokenAddress, pairAdd2, fee2, bnbIn)
            .call({ from: this.web3.eth.defaultAccount, value: bnbIn });
            return res[1]/res[0] * 100;
        } catch (error) {
            //console.log('\t\t[ERROR BUY FEES CUSTOM]', error);
            //console.log('\t\tbuyFeesCustom', customToken, pairAdd1, fee1, tokenAddress, pairAdd2, fee2, bnbIn);
            //process.exit();
        }
    }
}

module.exports = TokenFees;