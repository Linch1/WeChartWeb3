require("dotenv").config();
var express = require('express');
const EnumChainId = require("../../../enum/chain.id");
const EnumMainTokens = require("../../../enum/mainTokens");
var router = express.Router();
let Services = require('../../service');

let mainTokens = EnumMainTokens[EnumChainId.BSC];
let mainTokensAddresses = [];
for( let tokenSymbol in mainTokens ) {
    mainTokensAddresses.push( mainTokens[tokenSymbol].address );
}

function firstSignificant(n) {
    return Math.ceil(-Math.log10(n));
}
router.get('/info/:contract', 
    async function ( req, res ) {
        let contract = req.params.contract;
        let router = req.query.router;
        let pair = req.query.pair;

        let tokenInfo = await Services.token.findByContract( contract );
        let tokenPrice = await Services.history.findPrice( contract, router, pair );

        if( tokenPrice ) {
            tokenInfo.pricescale = 10**(firstSignificant(tokenPrice)) ;
            tokenInfo.minmov = 1;
        }
        
        if( !tokenInfo ) return res.status(400).send({ error: { msg: "Cannot retrive the token infos", data: {} }});
        return res.status(200).send({ success: { msg: "success", data: tokenInfo }});
    }
)

router.get('/pairs/:contract', 
    async function ( req, res ) {
        let contract = req.params.contract;
        let tokenPairs = await Services.history.findPairs( contract );
        if( !tokenPairs ) return res.status(400).send({ error: { msg: "Cannot retrive the token pairs", data: {} }});
        return res.status(200).send({ success: { msg: "success", data: tokenPairs }});
    }
)

async function getTokenMainPair( contract ){
    let tokenPairs = await Services.history.findPairs( contract );
        
    if( !tokenPairs ) return null;
    if( !Object.keys(tokenPairs).length ) return null;

    let mainPair = "";
    let mainRouter = "";
    for( let router in tokenPairs ){
        let routerPairs = tokenPairs[router];
        for( let pair in routerPairs ){
            let mainTokenInPair = routerPairs[pair];
            if ( mainTokenInPair === EnumMainTokens[EnumChainId.BSC].WBNB.address ) { 
                mainPair = pair; 
                mainRouter = router; 
                break; 
            }
        }
    }
    if(!mainPair){
        for( let router in tokenPairs ){
            let routerPairs = tokenPairs[router];
            for( let pair in routerPairs ){
                let mainTokenInPair = tokenPairs[pair];
                if( [
                    EnumMainTokens[EnumChainId.BSC].BUSD.address,
                    EnumMainTokens[EnumChainId.BSC].USDC.address,
                    EnumMainTokens[EnumChainId.BSC].USDT.address,
                    EnumMainTokens[EnumChainId.BSC].DAI.address
                ].includes( mainTokenInPair ) )  { 
                    mainPair = pair; 
                    mainRouter = router; 
                    break; 
                }
            }
        }
    }
    if(!mainPair){
        mainRouter = Object.keys(tokenPairs)[0];
        mainPair = Object.keys(tokenPairs[mainRouter])[0];
    }

    return { 
        pair: mainPair, 
        router: mainRouter,
        pairToken: tokenPairs[mainRouter][mainPair]
    }
}
router.get('/mainPairs/', 
    async function ( req, res ) {
        let contracts = req.query.contracts;

        if( !contracts ) return res.status(400).send({ error: { msg: "Invalid Parameters" }});
        
        try { contracts = JSON.parse(contracts); } 
        catch (error) { return res.status(400).send({ error: { msg: "Invalid Parameters" }});  }

        let pairsInfo = {}
        for( let contract of contracts ){
            pairsInfo[contract] = await getTokenMainPair( contract );
        }
        
        return res.status(200).send({ success: { msg: "success", data: pairsInfo }});
    }
)
router.get('/mainPair/:contract', 
    async function ( req, res ) {
        let contract = req.params.contract;
        console.log('INSIDE')
        if( !contract ) return res.status(400).send({ error: { msg: "Invalid Parameters" }});
        let pairInfo = await getTokenMainPair( contract );
        if(!pairInfo) res.status(400).send({ error: { msg: "Cannot retrive the token pairs", data: {} }})
        else return res.status(200).send({ success: { msg: "success", data: pairInfo }});
    }
)



module.exports = router;