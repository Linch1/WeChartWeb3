require("dotenv").config();
var express = require('express');
var router = express.Router();
let Services = require('../../service');

router.get('/single/:contract', 
    async function ( req, res ) {
        let contract = req.params.contract;
        let pair = await Services.token.getMainPair( contract );
        let price = await Services.price.findPrice( pair );
        if( !price ) return res.status(400).send({ error: { msg: "Cannot retrive the price", data: 0 }});
        return res.status(200).send({ success: { msg: "success", data: price }});
    }
)
router.get('/multiple/', 
    async function ( req, res ) {

        let contracts = req.query.contracts;
        if( !contracts ) return res.status(400).send({ error: { msg: "Invalid Parameters" }});
        try { contracts = JSON.parse(contracts); } 
        catch (error) { console.log(error); return res.status(400).send({ error: { msg: "Invalid Parameters" }});  }
        
        let mainPairs = await Services.token.getMainPairMultiple( contracts );
        let pairs = {};
        for( let token in mainPairs ){
            let tokenMainPair = mainPairs[token].mainPair;
            if( !tokenMainPair ) continue;
            pairs[tokenMainPair] = token
        }

        let prices = {}
        let retrivedPrices = await Services.price.findPriceMultiple( Object.keys(pairs) );
        
        for( let price of retrivedPrices ){
            let tokenContract = pairs[price.record.pair];
            prices[ tokenContract ] = price.record.value;
        }

        console.log('RETRIVED PRICES: ', retrivedPrices )

        return res.status(200).send({ success: { msg: "success", data: prices }});
    }
)
module.exports = router;