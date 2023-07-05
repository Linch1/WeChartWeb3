
<h1 align="center">WeChart</h1>
<p align="center" ><img src="https://i.ibb.co/Sw11zNr/We-Chart-Logo.png" alt="We-Chart-Logo" border="0"></p>


<p align="center" >
	<strong>WeChart</strong> is a tool aiming to provide a software  capable to <i>detect whenever a token change it's prices</i> on the most common dexes alive ( pancakeswap/biswap/uniswap/etc.. ), based on the chain where the scraper is running, in the most efficient way possibile and track it as a record on a database (mongodb) 
</p>

> :warning: To run this tool you will need a commercial full-node provider. 
> :heavy_check_mark: I'm personally using  https://github.com/self-node-official since you won't have any monthly fee, but a one-time fee for the full-node setup (compared to 400$ - 600$ per month of the other services around). 
> Or you can follow their guides and setup a node by yourself.

#### How does this work?
The `price scraper` listens for the latest swap made to blockchain, based on the token's liquidity pair reserves you can calculate the tokens prices, the router of the swap and the pair of the tokens.

### Setup

- Install mongodb `sudo apt install -y mongodb`
- Install nodejs `sudo apt install nodejs`
- Install npm `sudo apt install npm`
- Download the repo
- Navigate to the repo from the termian `cd /path/to/tokenChartingRepo`
- Install the repo dependencies `npm i`
- Create a `.env` and a `config.js` file based on the provided examples
- Start the scraper

	- If you want it to **restart on crash** follow this commands:
		- Install pm2 `sudo npm install pm2 -g`
		- Make pm2 restart the scraper if the server crash `pm2 startup`
		- Run the scraper `pm2 start npm --name "charting-bot-restarter" -- run restarter`
		- Save the pm2 running processes `pm2 save`
		- For see the current active pm2 processes `pm2 status`
		- For see the scraper logs `pm2 logs charting-bot`

	- If you **don't** want it to **restart on crash**
		- `npm run scraper`



### Emprove This
If you know a more efficent way, or any other better than this please let the community know this by opening an issue with infos about your ideas! :heart: . This repo can be used not only with pancakeswap but also with any kind of other exchange platform on any chain that is similar to pancakeswap.

  


### To Do
- multi chain scraping ( almost done ) [ currently bsc only ] 🟡
- multi chain server querying [ currently bsc only ] 🔴


### Query the prices

- Inside the repo you can find a rest api built with `expressjs` that you can use to query the scraped prices
- Run the server with `npm run server`
 

### Endpoints

- GET. `/token/price/:contract` : Retrun the token price
- GET. `/token/history/:contract?from=<>&to=<>`: Return the history of the token in the specified time range ( use **unix** timestaps to specify the time ranges )
- there are more endpoints not documented yet

  
### ISSUES
For anyu bug or issue please report it, i'll try to reply as soon as i can :thumbsup:
