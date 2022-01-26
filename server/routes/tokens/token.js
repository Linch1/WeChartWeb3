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
        let tokenInfo = {};

        let tokenRetrived = await Services.token.findByContract( contract );
        if( tokenRetrived ) tokenInfo = tokenRetrived;

        let pair = await Services.token.getMainPair( contract );
        let tokenPrice = await Services.price.findPrice( pair.mainPair );

        if( tokenPrice ) {
            tokenInfo.pricescale = 10**(firstSignificant(tokenPrice) + 3 ) ;
            tokenInfo.minmov = 1;
        }
        
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
router.get('/mainPairMultiple/', 
    async function ( req, res ) {
        
        let contracts = req.query.contracts;
        if( !contracts ) return res.status(400).send({ error: { msg: "Invalid Parameters" }});
        
        try { contracts = JSON.parse(contracts); } 
        catch (error) { return res.status(400).send({ error: { msg: "Invalid Parameters" }});  }

        let pairsInfo = await Services.token.getMainPairMultiple( contracts ); 
        
        return res.status(200).send({ success: { msg: "success", data: pairsInfo }});
    }
)
router.get('/mainPairs/:contract', 
    async function ( req, res ) {
        let contract = req.params.contract;
        if( !contract ) return res.status(400).send({ error: { msg: "Invalid Parameters" }});
        let pairs = await Services.token.getPairs( contract );
        return res.status(200).send({ success: { msg: "success", data: pairs }});
    }
)
router.get('/mainPair/:contract', 
    async function ( req, res ) {
        let contract = req.params.contract;
        if( !contract ) return res.status(400).send({ error: { msg: "Invalid Parameters" }});
        let pair = await Services.token.getMainPair( contract );
        if(!pair) res.status(400).send({ error: { msg: "Cannot retrive the token pairs", data: {} }})
        else return res.status(200).send({ success: { msg: "success", data: pair }});
    }
)



module.exports = router;