### Intro

**How does this work?** The `price scraper` listens for the latest swap made to blockchain, based on the token's liquidity pair reserves you can calculate the tokens prices, the router of the swap and the pair of the tokens.

**Warning** To run this script in a production enviroment you cannot use the free provider that is used inside this repo. You must buy a professional bsc provider, or build your own node. I made an estimation that this script will make at least 350.000.000 +  requests monthly, so consider this when you search for the provider to buy. I'm personally using Getblock fullnode.

**Emprove This** If you know a more efficent way, or any other better than this please let the community know this by opening an issue with infos about your ideas! :heart: . This repo can be used not only with pancakeswap but also with any kind of other exchange platform on any chain that is similar to pancakeswap.

### Setup

- Install mongodb `sudo apt install -y mongodb`
- Install nodejs `sudo apt install nodejs`
- Install npm `sudo apt install npm`
- Download the repo
- Navigate to the repo from the termian `cd /path/to/tokenChartingRepo`
- Install the repo dependencies `npm i`
- Run the scraper `npm run scraper`


### Start the price scraper

- Start the price scraper with `npm run price-scraper`, now the db will start being populated from all the swapped tokens allover the blockchain.

### Query the prices

- Inside the repo you can find a rest api built with `expressjs` that you can use to query the scraped prices  
- Run the server with `npm run server`

###### Endpoints


- GET. `/token/price/:contract` : Retrun the token price
- GET. `/token/history/:contract?from=<>&to=<>`: Return the history of the token in the specified time range ( use **unix** timestaps to specify the time ranges )
- there are more endpoints not documented yet


### ISSUES

- Currently the scraper has a memory leak. After some hours that it runs then it crashes, I'm trying to figure out where is this leak. If anyone can find it then report it or make a pull request.
