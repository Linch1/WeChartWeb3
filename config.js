const { toCheckSum } = require("./utils/addresses");

let scraperConfig = {
    "whitelist_enabled": false,
    "whitelist": [
        toCheckSum("0xc748673057861a797275CD8A068AbB95A902e8de")
    ] // whitelisted tokens
}
module.exports = scraperConfig;