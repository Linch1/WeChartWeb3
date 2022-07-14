require('dotenv').config();
let Web3 = require('web3');
const TokenFees = require('./entity/TokenFees');

( async () => {
    let tokenFees = new TokenFees(web3_https);
    await tokenFees.initalize();

    let customToken = '0x55d398326f99059fF775485246999027B3197955';
    let customRouter = '0xDF1A1b60f2D438842916C0aDc43748768353EC25';
    let bnbIn = Web3.utils.toWei('0.1', 'ether');

    console.log(
        await tokenFees.buyFeesCustom(
            '0x55d398326f99059fF775485246999027B3197955',
            '0x16b9a82891338f9bA80E2D6970FddA79D1eb0daE',
            25,
            '0xc748673057861a797275cd8a068abb95a902e8de',
            '0xBF7cd39D07aDAa953E1E0bE47F97315955c9381B',
            25,
            Web3.utils.toWei('0.01', 'ether')
        )
    )
    // await tokenFees.sellFeesCustom(
    //     '0x55d398326f99059fF775485246999027B3197955',
    //     '0x16b9a82891338f9bA80E2D6970FddA79D1eb0daE',
    //     25,
    //     '0xc748673057861a797275cd8a068abb95a902e8de',
    //     '0xBF7cd39D07aDAa953E1E0bE47F97315955c9381B',
    //     25,
    //     Web3.utils.toWei('0.01', 'ether')
    // );
    await tokenFees.buyFees(
        "0x3a0d9d7764FAE860A659eb96A500F1323b411e68",
        "0x627F27705c8C283194ee9A85709f7BD9E38A1663",
        26,
        Web3.utils.toWei('0.01', 'ether')
    );
    
    await tokenFees.sellFees(
        "0x3a0d9d7764FAE860A659eb96A500F1323b411e68",
        "0x627F27705c8C283194ee9A85709f7BD9E38A1663",
        26,
        Web3.utils.toWei('0.01', 'ether')
    );
})();