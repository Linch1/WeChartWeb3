require("dotenv").config();
var express = require('express');
var router = express.Router();
let Services = require('../../service');

router.get('/:pair', 
    async function ( req, res ) {
        let pair = req.params.pair;
        let price = await Services.price.findPrice( pair );
        if( !price ) return res.status(400).send({ error: { msg: "Cannot retrive the price", data: 0 }});
        return res.status(200).send({ success: { msg: "success", data: price }});
    }
)
module.exports = router;