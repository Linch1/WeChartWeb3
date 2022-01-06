require("dotenv").config();
var express = require('express');
var router = express.Router();
let Services = require('../../service');

router.get('/:token', 
    async function ( req, res ) {
        let token = req.params.token;
        let from = req.query.from; 
        let to = req.query.to;
        let records = req.query.countBack;
        let pair = await Services.token.getMainPair(token);

        if( !from || !to || !records || !pair ) return res.status(400).send({ error: { msg: "Invalid params", data: [] }});

        let priceRecords = await Services.price.findPrices( pair, from, to, records  );

        if( !priceRecords || !priceRecords.length ) {
            let last_history = await Services.price.findLastPrice( pair, from, to );
            if(!last_history) return res.status(200).send({ success: { msg: "success", data: [] }});
            return res.status(200).send({ success: { msg: "success", data: [], nextTime: last_history.time }});
        }
        return res.status(200).send({ success: { msg: "success", data: priceRecords }});
    }
)
router.get('/last/:token', 
    async function ( req, res ) {
        let from = req.query.from; 
        let to = req.query.to;
    
        let records = req.query.countBack;
        let pair = req.params.pair;
        if( !from || !to || !records || !contract ) return res.status(400).send({ error: { msg: "Invalid params", data: [] }});

        let lastPrice = await Services.price.findLastPrice( pair, from );
        if(!lastPrice) return res.status(200).send({ success: { msg: "success", data: [], nextTime: 0 }});
        return res.status(200).send({ success: { msg: "success", data: [], nextTime: lastPrice.time }});
    }
)
module.exports = router;