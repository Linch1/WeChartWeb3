require('dotenv').config();
var TokenBasic = require('../models/token_basic');

async function findByContract( contract ){
    let tokenInfos = await TokenBasic.findOne({ contract: contract }).lean().exec();
    if( !tokenInfos || tokenInfos.name == "$NULL" ) { return null }
    return tokenInfos;
}
module.exports = {
    findByContract
}