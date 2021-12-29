### Intro

**How does this work?** The `price scraper` listens for the latest transactions made to pancakeswap, if the transactions are some swap transactions, based on the tx parameters ( there are some paramenters in the tx that describe the amount of transferred tokens ) you can calculate the tokens prices.
> **update** : Now the script works using token's pair reserves instead of transaction parameters to have a more accurate price

**Database** Inside this repo you can see that there is a zipped file, that file represents a mongo database that you should import to make the price scraper work. Also you need to scrape the latest pairs from pancakeswap becouse they are not going to be inside that db since each seconds new pairs appear on pancakeswap

**Warning** To run this script in a production enviroment you cannot use the free provider that is used inside this repo. You must buy a professional bsc provider, or build your own node. I made an estimation that this script will make at least 350.000.000 requests monthly, so consider this when you search for the provider to buy.


**Emprove This** If you know a more efficent way, or any other better than this please let the community know this by opening an issue with infos about your ideas! :heart:

### Setup

- Install mongodb `sudo apt install -y mongodb`
- Install nodejs `sudo apt install nodejs`
- Install npm `sudo apt install npm`
- Download the repo
- Navigate to the repo from the termian `cd /path/to/PancakeSwapTokenCharting`
- Install the repo dependencies `npm i`
- Unzip and clone the `charting-db` provided into the repo on your local mongo instance. [follow this command](https://stackoverflow.com/questions/7232461/how-can-i-transfer-a-mongodb-database-to-another-machine-that-cannot-see-the-fir) .
`mongorestore --db charting /path/to/unzipped-charting-db `


### Scrape the newset pairs

> Inside the provided db there are 470K pancakeswap pairs. Probably at the time that you are downloading this repo many new pairs was created on pancakeswap. You must scrape all the news one ( and keep listening for when new pairs are created ) to make the price scraper work smoothly

- Open two terminals
- Navigate inside the repo with both of them
- In the first one run `npm run update-pairs`
- In the second one run `npm run listen-pairs`

### Start the price scraper

- Wait that the `update-pairs` end and than you can start the `price-scraper`
- Start the price scraper with `npm run price-scraper`

