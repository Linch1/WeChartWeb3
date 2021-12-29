require("dotenv").config();
var express = require('express');
var router = express.Router();
let Services = require('../../service');

function firstSignificant(n) {
    return Math.ceil(-Math.log10(n));
}
router.get('/:contract', 
    async function ( req, res ) {
        let contract = req.params.contract;
        let tokenInfo = await Services.token.findByContract( contract );
        let tokenPrice = await Services.history.findPrice( contract );
        if( tokenPrice ) {
            tokenInfo.pricescale = 10**(firstSignificant(tokenPrice)+3) ;
            tokenInfo.minmov = 1;
        }
        if( !tokenInfo ) return res.status(400).send({ error: { msg: "Cannot retrive the token infos", data: {} }});
        return res.status(200).send({ success: { msg: "success", data: tokenInfo }});
    }
)
module.exports = router;