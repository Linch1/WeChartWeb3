const ethers = require('ethers');

let signatures = {
    swap: {
        common: "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822"
    },
    sync: {
        uint112: "0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1",
        uint112TotalSupply: "0x17be3acebd510daa18778e1ee1fbaf88237b124dc0803c3be2fd4f99f3e69d33",
        uint256: "0xcf2aa50876cdfbb541206f89af0ee78d44a2abf8d328e37fa4917f982149848a"
    }
}
let syncSignatures = Object.values(signatures.sync);
let swapSignatures = Object.values(signatures.swap);


// extract swap informations from the log
function getSwapDatas( log ){
    let router = '0x' + log.topics[1].substr(26);
    let sender = '0x' + log.topics[2].substr(26);
    let decodedParams = ethers.utils.defaultAbiCoder.decode(['uint256','uint256','uint256','uint256'], log.data);
    let params = [];
    for( let param of decodedParams ) params.push(param.toString());
    let pair = log.address;
    return {
        router: ethers.utils.getAddress(router),
        sender: ethers.utils.getAddress(sender),
        pair: ethers.utils.getAddress(pair),
        params: {
            amount0In: params[0],
            amount1In: params[1],
            amount0Out: params[2],
            amount1Out: params[3]
        }
    }
}
function decodedParams112(data){
    return ethers.utils.defaultAbiCoder.decode(['uint112','uint112'], data);
}
function decodedParams112TotSupply(data){
    return ethers.utils.defaultAbiCoder.decode(['uint112','uint112','uint256'], data);
}
function decodedParams256(data){
    return ethers.utils.defaultAbiCoder.decode(['uint256','uint256'], data);
}
// extract sync informations from the log
function getSyncDatas( log, topic ){
    let pair = log.address;
    let decodedParams;
    if( topic == signatures.sync.uint112 ){
        decodedParams = decodedParams112(log.data)
    }
    if( topic == signatures.sync.uint112TotalSupply ) {
        //console.log(`[NON TOPIC tot supply] ${pair}`)
        decodedParams = decodedParams112TotSupply(log.data)
    }
    if( topic == signatures.sync.uint256 ){
        //console.log(`[NON TOPIC 256] ${pair}`)
        decodedParams = decodedParams256(log.data)
    }
    let params = [];
    for( let param of decodedParams ) params.push(param.toString());
    return {
        pair: ethers.utils.getAddress(pair),
        reserve0: params[0],
        reserve1: params[1]
    }
}
function getDataFromLog( log ){
    if(!log.topics){
        console.log( '[NO TOPICS]', log );
        return null;
    }
    let containSync = log.topics.filter( e => syncSignatures.includes(e) );
    let containSwap = log.topics.filter( e => swapSignatures.includes(e) );
    if( containSync.length ){
        return {
            name: 'sync',
            ...getSyncDatas(log, containSync[0])
        }
    } else if ( containSwap.length ){
        return {
            name: 'swap',
            ...getSwapDatas(log, containSwap[0])
        }
    }
}

module.exports = getDataFromLog;