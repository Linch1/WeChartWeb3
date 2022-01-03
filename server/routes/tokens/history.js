require("dotenv").config();
var express = require('express');
var router = express.Router();
let Services = require('../../service');

router.get('/:contract', 
    async function ( req, res ) {
        let from = req.query.from; 
        let to = req.query.to;
        let router = req.query.router;
        let pair = req.query.pair;
        
        if(!router || !pair) return res.status(400).send({ error: { msg: "Invalid query params", data: [] }});
 
        let records = req.query.countBack;
        let contract = req.params.contract;
        if( !from || !to || !records || !contract ) return res.status(400).send({ error: { msg: "Invalid params", data: [] }});

        let price_history = await Services.history.findHistory( contract, router, pair, from, to, records  );

        if(!price_history || !price_history.length ) {
            let last_history = await Services.history.findLastHistory( contract, router, pair, from, to );
            if(!last_history) return res.status(200).send({ success: { msg: "success", data: [] }});
            return res.status(200).send({ success: { msg: "success", data: [], nextTime: last_history.time }});
        }
        return res.status(200).send({ success: { msg: "success", data: price_history }});
    }
)
router.get('/last/:contract', 
    async function ( req, res ) {
        let from = req.query.from; 
        let to = req.query.to;
        let router = req.query.router;
        let pair = req.query.pair;
        
        if(!router || !pair) return res.status(400).send({ error: { msg: "Invalid query params", data: [] }});

        let records = req.query.countBack;
        let contract = req.params.contract;
        if( !from || !to || !records || !contract ) return res.status(400).send({ error: { msg: "Invalid params", data: [] }});

        let last_history = await Services.history.findLastHistory( contract, router, pair, from, to );
        if(!last_history) return res.status(200).send({ success: { msg: "success", data: [], nextTime: 0 }});
        return res.status(200).send({ success: { msg: "success", data: [], nextTime: last_history.time }});
    }
)
module.exports = router;