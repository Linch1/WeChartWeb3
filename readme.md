### Intro

**How does this work?** The `price scraper` listens for the latest transactions made to pancakeswap, if the transactions are some swap transactions, based on the token's liquidity pair reserves you can calculate the tokens prices.

**Database** Inside this repo you can see that there is a zipped file, that file represents a mongo database that cointains all the tokens listed on pancakeswap and all the liquidity pairs on pancakeswap.Import this database to your machine in order to make the price scraper work. Also you need to scrape the latest pairs from pancakeswap becouse they are not going to be inside that db since each seconds new pairs appear on pancakeswap, to scrape the lastest keep reading below.

**Warning** To run this script in a production enviroment you cannot use the free provider that is used inside this repo. You must buy a professional bsc provider, or build your own node. I made an estimation that this script will make at least 350.000.000 requests monthly, so consider this when you search for the provider to buy. I'm personally using Getblock fullnode.


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

### Query the prices

- Inside the repo you can find a rest api built with `expressjs` that you can use to query the scraped prices  
- Run the server with `npm run server`

###### Endpoints

- GET. `/token/price/:contract` : Retrun the token price
- GET. `/token/history/:contract?from=<>&to=<>`: Return the history of the token in the specified time range ( use **unix** timestaps to specify the time ranges )


### ISSUES

- Currently the scraper has a memory leak. After some hours that it runs then it crashes, I'm trying to figure out where is this leak. If anyone can find it then report it or make a pull request. :heart:
