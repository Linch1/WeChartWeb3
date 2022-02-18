const axios = require('axios');
const EnumCommonAddresses = require('../../enum/address.common');

    
async function getTokenInfos( contract ){
    if( !process.env.SERVER_VOTING ) return { error: { msg: "no endpoint provided "}};
    // query token infos only if the contract is not ZERO address, is not hidden, is not prelaunch
    if( contract == EnumCommonAddresses.ZERO ) return null
    let infos = await axios.default.get(`${process.env.SERVER_VOTING}/token/basic/${contract}`)
    .catch( err => { return err.response })
    .then( res => { 
        if(res) return res.data
        else return { error: "cannot retrive" } 
    });
    return infos;
}

let ApiVoting = {
    getTokenInfos
}
module.exports = ApiVoting;