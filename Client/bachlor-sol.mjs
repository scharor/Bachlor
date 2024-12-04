import dotenv from "dotenv";
import bs58 from "bs58";
import { promises as fs } from 'fs';
import {
  Connection,
  Keypair,
  Transaction,
  PublicKey,
  SystemProgram,
  VersionedTransaction,
  TransactionMessage,
  ComputeBudgetProgram,
 // Transaction
} from "@solana/web3.js";
import got from "got";
import { Wallet } from "@project-serum/anchor";
import promiseRetry from "promise-retry";
import axios from "axios";
import Agent from 'agentkeepalive';



const keepaliveAgent = new Agent({
    timeout: 4000,
    freeSocketTimeout: 4000,
    maxSockets: 2048,
});


import {
  SearcherClient,
  searcherClient as jitoSearcherClient, 
  } from 'jito-ts/dist/sdk/block-engine/searcher.js';

  import {simulateAndSendBundle} from "./bundlesender.mjs";
import { JitoRpcConnection } from "jito-ts";

const url = "ny.mainnet.block-engine.jito.wtf"

const searcherClient = jitoSearcherClient(url,undefined, {
    'grpc.keepalive_timeout_ms': 4000,
});


searcherClient.onBundleResult(
  result => {
      console.log(result);
  },
  err => {
      console.log(err);
  }
);

const tipKey = new PublicKey("ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49");


const connectionval2 = new Connection('http://127.0.0.1:8899','confirmed'); // http://127.0.0.1:8899

const multisend = new Connection('http://127.0.0.1:4040','finalized'); // http://127.0.0.1:8899

const connection = new JitoRpcConnection("http://127.0.0.1:8899", {
    commitment: 'processed',
    disableRetryOnRateLimit: true,
    httpAgent: keepaliveAgent
});

//const conjito = new Connection("ny.mainnet.block-engine.jito.wtf",'processed');



const helios = new Connection("https://mainnet.helius-rpc.com/?api-key=key",'finalized');


const rift = new Connection("rift",'confirmed');

const wallet = new Wallet(
  Keypair.fromSecretKey(bs58.decode("Privatekey")) 
);


const extralamparts = 8_250_000;

const higherlamparts = 15_000_000;

const evenhigher =     150_000_000;


const SOL_MINT = "So11111111111111111111111111111111111111112";         
const USDC_MINT =  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";        

const USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";        // 1200_000_000, 200_000_000, 400_000_000, 800_000_000, 1600_000_000, 100_000_000,8000_000_000,5000_000_000 aktuelle werte  // 1400_000_000, 230_000_000, 320_000_000, 720_000_000, 3200_000_000, 520_000_000,8000_000_000,5200_000_000

const amounts = [102_000_000, 2_002_000_000, 502_000_000, 5_002_000_000, 52_000_000, 1_002_000_000, 12_000_000_000,702_000_000,18_000_000_000];  // usdc values 20_000_000, 200_000_000, 400_000_000, 800_000_000, 1600_000_000, 100_000_000 // 2800_000_000, 1200_000_000, 1400_000_000, 4000_000_000, 6000_000_000, 1000_000_000


/*const usdcamountGetter = {
    get: function() {
      const randomIndex = Math.floor(Math.random() * amounts.length);
      return amounts[randomIndex];
    }
  };*/

  let currentIndex = 0;

  const usdcamountGetter = {
    get: function() {
        const currentValue = amounts[currentIndex];
        currentIndex = (currentIndex + 1) % amounts.length; // Increment index and loop back to 0 when it reaches the end
        return currentValue;
    }
};
  
  // Define the getter for usdcamount
  Object.defineProperty(global, 'usdcamount', usdcamountGetter);

 
  let lastJitoTimestamp = 0; 
  const MIN_JITO_TIME = 250;

/**
 * Calculate the number of slots it took for a transaction to land on chain.
 * 
 * @param {string} txid - The transaction ID (signature).
 * @param {number} preSubmitSlot - The slot number before the transaction was submitted.
 * @returns {Promise<void>} - Logs the slot difference to a file.
 */
// Global variables to track total slot differences and number of transactions
let totalSlotDifference = 0;
let transactionCount = 0;

// Function to log messages to a file (ensure you implement this function)
function logToFile(message) {
    //const fs = require('fs');
    const logFilePath = '/app/logs/slot_difference_log.txt'; // Specify your log file path
    fs.appendFile(logFilePath, message + '\n', (err) => {
        if (err) {
            console.error('Error writing to log file:', err);
        }
    });
}

async function getTransactionSlotDifference(txid, preSubmitSlot) {
    try {

        await connectionval2.confirmTransaction(txid);
        // Fetch transaction details using the txid
        const transaction = await connectionval2.getTransaction(txid, { maxSupportedTransactionVersion: 0 });

        if (!transaction || !transaction.slot) {
            throw new Error(`Transaction not found or missing slot information for txid: ${txid}`);
        }

        const confirmSlot = transaction.slot;

        // Calculate slot difference (confirmSlot - preSubmitSlot)
        const slotDifference = confirmSlot - preSubmitSlot;

        // Update the total slot difference and transaction count
        totalSlotDifference += slotDifference;
        transactionCount++;

        // Calculate the average slot difference
        const averageSlotDifference = totalSlotDifference / transactionCount;

        // Log individual transaction info
        const logMessage = `Transaction ${txid} took ${slotDifference} slots to confirm.`;
        console.log(logMessage);

        // Log overall stats
        const summaryMessage = `Average slot difference after ${transactionCount} transactions: ${averageSlotDifference.toFixed(2)}`;
        console.log(summaryMessage);

        // Log both messages to the log file
        logToFile(logMessage);
        logToFile(summaryMessage);

    } catch (error) {
        console.error(`Error fetching transaction slot difference: ${error.message}`);
        logToFile(`Error fetching transaction slot difference for ${txid}: ${error.message}`);
    }
}


const getCoinQuote = (inputMint, outputMint, amount, dexes) => 

  got
  .get(
    `http://127.0.0.1:8080/quote?outputMint=${outputMint}&inputMint=${inputMint}&amount=${amount}&slippageBps=0&dexes=${Array.from(dexes).join(',')}&maxAccounts=32&onlyDirectRoutes=true` // &onlyDirectRoutes=true http://quote-api.jup.ag/v6/ &restrictIntermediateTokens=true &asLegacyTransaction=true  // dexes=Whirlpool%2CLifinity%20V2%2COrca%20V1%2CMeteora%2CLifinity%20V2%2CPerps%2COpenbook%2CPhoenix%2COpenBook%20V2%2CMeteora%20DLMM%2COrca%20V2%2CInvariant%2CLifinity%20V1%2CRaydium%2CRaydium%20CLMM
  )
    .json();

    const getCoinQuote2 = (inputMint, outputMint, amount) => 

  got
  .get(
    `http://127.0.0.1:8080/quote?outputMint=${outputMint}&inputMint=${inputMint}&amount=${amount}&slippageBps=0&maxAccounts=32&onlyDirectRoutes=true` // &onlyDirectRoutes=true http://quote-api.jup.ag/v6/ &restrictIntermediateTokens=true &asLegacyTransaction=true
  )
    .json();


    const getCoinQuote21 = (inputMint, outputMint, amount) => 

    got
    .get(
      `http://127.0.0.1:8080/quote?outputMint=${outputMint}&inputMint=${inputMint}&amount=${amount}&slippageBps=0&maxAccounts=27` // &onlyDirectRoutes=true http://quote-api.jup.ag/v6/ &restrictIntermediateTokens=true &asLegacyTransaction=true
    )
      .json();




        async function fetchQuotes16(inputMint, outputMint, amount) {
          //const url = `http://127.0.0.1:8080/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=0`;
          const url = `http://127.0.0.1:8080/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=0&maxAccounts=10&onlyDirectRoutes=true`;
        
          try {
            const start = Date.now();
            const response = await axios.get(url);
            if (response.status === 200) {
                return response.data
            } else {
            }
          } catch (error) {
          }
        }

        async function fetchQuotes32(inputMint, outputMint, amount) {
          //const url = `http://127.0.0.1:8080/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=0`;
          const url = `http://127.0.0.1:8080/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=0&onlyDirectRoutes=true`;
        
          try {
            const start = Date.now();
            const response = await axios.get(url);
            if (response.status === 200) {
                return response.data
            } else {
            }
          } catch (error) {
          }
        }

        async function fetchQuotes42(inputMint, outputMint, amount) {
          //const url = `http://127.0.0.1:8080/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=0`;
          const url = `http://127.0.0.1:8080/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=0&onlyDirectRoutes=true&maxAccounts=21`;
        
          try {
            const start = Date.now();
            const response = await axios.get(url);
            if (response.status === 200) {
                return response.data
            } else {
            }
          } catch (error) {
          }
        }
        async function fetchQuotesindirect(inputMint, outputMint, amount) {
          //const url = `http://127.0.0.1:8080/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=0`;
          const url = `http://127.0.0.1:8080/quote?outputMint=${outputMint}&inputMint=${inputMint}&amount=${amount}&slippageBps=0&maxAccounts=42`;
        
          try {
            const start = Date.now();
            const response = await axios.get(url);
            if (response.status === 200) {
                return response.data
            } else {
            }
          } catch (error) {
          }
        }



      function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
      }

  async function fetchWithRetrymin0(route, key, maxRetries = 1) {
    console.log(route);
    let response;
  
    for (let retries = 0; retries <= maxRetries; retries++) {  
      try {
        response = await fetch('http://127.0.0.1:8080/swap', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            // route from /quote api
            quoteResponse: route,
            // user public key to be used for the swap
            userPublicKey: key,
            // auto wrap and unwrap SOL. default is true process.env.LAMP
            wrapAndUnwrapSol: false,

            useSharedAccounts: false,

            dynamicComputeUnitLimit: true,


            skipUserAccountsRpcCalls: true,

  
           computeUnitPriceMicroLamports: 50000,
           
          })
        });
  
        if (response.status !== 500) {
          break; // Exit the loop if the status code is not 500
        }

        if (response.status == 429) {
          break; // Exit the loop if the status code is not 500
          console.log("toomuch");
        }
  
        console.warn(`Retrying fetch (${maxRetries - retries} retries left)...`);
      } catch (err) {
        //console.error(`Fetch error: ${err.message}`);
        if (retries < maxRetries) {
          console.warn(`Retrying fetch (${maxRetries - retries} retries left)...`);
        } else {
          throw err;
        }
      }
    }
  
    return response.json();
  }

  async function fetchWithRetrymin1(route, key, maxRetries = 1) {
    console.log(route);
    let response;
  
    for (let retries = 0; retries <= maxRetries; retries++) {  
      try {
        response = await fetch('http://127.0.0.1:8080/swap', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            // route from /quote api
            quoteResponse: route,
            // user public key to be used for the swap
            userPublicKey: key,
            // auto wrap and unwrap SOL. default is true process.env.LAMP
            wrapAndUnwrapSol: false,

            useSharedAccounts: false,

            dynamicComputeUnitLimit: true,


            //skipUserAccountsRpcCalls: true,

            //prioritizationFeeLamports: "auto",

            // prioritizationFeeLamports: {
            //  autoMultiplier: 2,
            //},

           // asLegacyTransaction: true,

           prioritizationFeeLamports: "auto",

           prioritizationFeeLamports: {
            autoMultiplier: 1,
          },
  
          // computeUnitPriceMicroLamports: 300000,
            // feeAccount is optional. Use if you want to charge a fee.  feeBps must have been passed in /quote API.
            // This is the ATA account for the output token where the fee will be sent to. If you are swapping from SOL->USDC then this would be the USDC ATA you want to collect the fee.
            // feeAccount: "fee_account_public_key"  
          })
        });
  
        if (response.status !== 500) {
          break; // Exit the loop if the status code is not 500
        }

        if (response.status == 429) {
          break; // Exit the loop if the status code is not 500
          console.log("toomuch");
        }
  
        console.warn(`Retrying fetch (${maxRetries - retries} retries left)...`);
      } catch (err) {
        //console.error(`Fetch error: ${err.message}`);
        if (retries < maxRetries) {
          console.warn(`Retrying fetch (${maxRetries - retries} retries left)...`);
        } else {
          throw err;
        }
      }
    }
  
    return response.json();
  }


  async function fetchWithRetrymin2(route, key, maxRetries = 1) {
    console.log(route);
    let response;
  
    for (let retries = 0; retries <= maxRetries; retries++) {  
      try {
        response = await fetch('http://127.0.0.1:8080/swap', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            // route from /quote api
            quoteResponse: route,
            // user public key to be used for the swap
            userPublicKey: key,
            // auto wrap and unwrap SOL. default is true process.env.LAMP
            wrapAndUnwrapSol: false,

            useSharedAccounts: false,

            dynamicComputeUnitLimit: true,


            //skipUserAccountsRpcCalls: true,

            prioritizationFeeLamports: "auto",

             prioritizationFeeLamports: {
              autoMultiplier: 2,
            },

           // asLegacyTransaction: true,
  
          // computeUnitPriceMicroLamports: 300000,
            // feeAccount is optional. Use if you want to charge a fee.  feeBps must have been passed in /quote API.
            // This is the ATA account for the output token where the fee will be sent to. If you are swapping from SOL->USDC then this would be the USDC ATA you want to collect the fee.
            // feeAccount: "fee_account_public_key"  
          })
        });
  
        if (response.status !== 500) {
          break; // Exit the loop if the status code is not 500
        }

        if (response.status == 429) {
          break; // Exit the loop if the status code is not 500
          console.log("toomuch");
        }
  
        console.warn(`Retrying fetch (${maxRetries - retries} retries left)...`);
      } catch (err) {
        //console.error(`Fetch error: ${err.message}`);
        if (retries < maxRetries) {
          console.warn(`Retrying fetch (${maxRetries - retries} retries left)...`);
        } else {
          throw err;
        }
      }
    }
  
    return response.json();
  }










async function fetchData() {
    const config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: 'https://public-api.birdeye.so/defi/tokenlist',
        headers: { 
          'Accept': 'application/json',
          'X-API-KEY': 'birdeyekey' 
        }, 
        params: {
          sort_by: 'v24hUSD',
          sort_type: 'desc',
          limit: 50
        },
       //timeout: 10000000, // Timeout in milliseconds (100 seconds)
      };
      
      try {
        const response = await axios.request(config);
        const tokens = response.data?.data?.tokens; // Accessing the tokens array
        if (tokens) {
            const addresses = tokens
            .map(token => token.address)
            .filter(address => address !== 'So11111111111111111111111111111111111111112');
          return addresses ;
        } else {
          console.log('Tokens array not found in the response.');
        }
      } catch (error) {
        console.error('Error:', error);
      }
  }


  async function main(){

    let test = await rift.getLatestBlockhash();

    console.log(test);

    

    let cachedData = null;
    let lastFetchTime = 0;

    let addressesArray = [USDC_MINT,"WENWENvqqNya429ubCdR81ZmD69brwQaaBYY6p3LCpk","Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB","JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN","J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn","bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1","mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So","27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4","3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh","HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3","jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL","EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm","7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs","SHDWyBxihqiCj6YekG2GUr7wqKLeLAMK1gHZck9pL6y","DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263","4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R","85VBFQZC9TZkfaptBWjvUw7YbZjy52A6mjtPGjstQAmQ","ZEUS1aR7aX8DFFJf5QjWj2ftDDdNTroMNGo8YoQm3Gq","LSTxxxnJzKDFSLr4dUkPcmCf5VyryEqzPLz5j4bpxFp","TNSRxcUxoT9xBG3de7PiJyTDYu7kskLqcpddxnEJAS6"];


    while(true){
     try{
      // Request another quote with `excludeDexes`.
     
        const currentTime = Date.now();
        
        if (currentTime - lastFetchTime >= 50 * 60 * 1000 || cachedData === null) {
            // Fetch new data
           cachedData = await fetchData();
            lastFetchTime = currentTime;
        }
        // Proceed with your logic using cachedData
       addressesArray = Array.isArray(cachedData) ? cachedData : Array.from(cachedData);
       console.log(addressesArray.length);
      
      }catch(e){
        console.log(e);
      }
        try {
          await Promise.all([
            buyTokens3(addressesArray),
            buyTokens30(addressesArray),
            buyTokens32(addressesArray)
          ]);
          console.log("All functions completed successfully.");
      } catch (error) {
          console.error("An error occurred:", error);
      }

    }

  }

async function buyTokens3(newEntries) {
  try{
    for (let i = 0; i < newEntries.length; i++) {
      const routeWithProfit = [];
      let start = Date.now();

      try{
    
                let newMint = newEntries[i];
                console.log(newMint);
    
                let usdca = usdcamount;
    
                let start = Date.now();
    
                let usdcQuote = await fetchQuotes32(SOL_MINT,newMint,usdca);
    
                let usdcback = await fetchQuotes32(newMint,SOL_MINT,usdcQuote.outAmount);

              
    
                const routetest = [].concat(usdcQuote.routePlan, usdcback.routePlan);
    
                usdcQuote.routePlan = routetest;
                usdcQuote.outAmount = usdca.toString();
    
                usdcQuote.outputMint ='So11111111111111111111111111111111111111112';
    
    
                let profit = usdcback.outAmount - usdca;

                console.log(profit);
  
                if(profit >  evenhigher){
                  sendtx3(usdcQuote,start,profit);
                  //sendtx(usdcQuote,start,profit);
                  }else if(profit > higherlamparts){
                  sendtx2(usdcQuote,start,profit);
                  }else if(profit> extralamparts ){
                  sendtx(usdcQuote,start,profit);
                  }
              }
              catch(e){
                  console.log(e);
              }
 
    }
}
catch(e){
  console.log(e);
}
}





async function buyTokens30(newEntries) {
  try{
  for (let i = 0; i < newEntries.length; i++) {
    const routeWithProfit = [];
    let start = Date.now();
      
        for(let u = 0;u < amounts.length; u++){
          try{
      let newMint = newEntries[i];
      console.log(newMint);

      let usdca = usdcamount;

      
    let usdcQuote = await fetchQuotesindirect(SOL_MINT,newMint,usdca);

    let usdcback = await fetchQuotes42(newMint,SOL_MINT,usdcQuote.outAmount);

    const routetest = [].concat(usdcQuote.routePlan, usdcback.routePlan);

    usdcQuote.routePlan = routetest;
    usdcQuote.outAmount = usdca.toString();
  
    usdcQuote.outputMint ='So11111111111111111111111111111111111111112';
    

    let profit = usdcback.outAmount - usdca;
  
    if(profit >  evenhigher){
      sendtx3(usdcQuote,start,profit);
      //sendtx(usdcQuote,start,profit);
      }else if(profit > higherlamparts){
      sendtx2(usdcQuote,start,profit);
      }else if(profit> extralamparts ){
      sendtx(usdcQuote,start,profit);
      }
;


  }catch(e){
    console.log(e)
}
    
    
  }

  }
}catch(e){

}
}

async function buyTokens32(newEntries) {
  try{
  for (let i = 0; i < newEntries.length; i++) {
    const routeWithProfit = [];
    let start = Date.now();
      
        for(let u = 0;u < amounts.length; u++){
    try{
      let newMint = newEntries[i];
      console.log(newMint);

      let usdca = usdcamount;

    let usdcQuote = await fetchQuotes42(SOL_MINT,newMint,usdca);

    let usdcback = await fetchQuotesindirect(newMint,SOL_MINT,usdcQuote.outAmount);

    const routetest = [].concat(usdcQuote.routePlan, usdcback.routePlan);

    usdcQuote.routePlan = routetest;
    usdcQuote.outAmount = usdca.toString();
  
    usdcQuote.outputMint ='So11111111111111111111111111111111111111112';
    

    let profit = usdcback.outAmount - usdca;

  
    if(profit >  evenhigher){
      sendtx3(usdcQuote,start,profit);
      //sendtx(usdcQuote,start,profit);
      }else if(profit > higherlamparts){
      sendtx2(usdcQuote,start,profit);
      }else if(profit> extralamparts ){
      sendtx(usdcQuote,start,profit);
      }


  }catch(e){
    console.log(e)
}}}
}catch(e){

}
}

async function sendtx(quotes,starttime,profit){



      try{
const transactions = 
await fetchWithRetrymin0(quotes,wallet.publicKey.toString());



//console.log(transactions);
//console.log("process.env.LAMP");
  const now = Date.now();

  console.log("time"+(now - starttime));
 // if(now - starttime  > 600) return;

const { swapTransaction } = transactions; 

const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');


const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

transaction.sign([wallet.payer]);



const rawTransaction = transaction.serialize();

//const txId = await sendConnection.sendTransaction(transaction,false);


// sign the transaction


// Execute the transaction

let slot = await connectionval2.getSlot({commitment:'confirmed'});


const txid0 = await rift.sendRawTransaction(rawTransaction, {
  //replaceRecentBlockhash: true,
skipPreflight: true,
 maxRetries: 0,
 preflightCommitment: 'processed'
});



await getTransactionSlotDifference(txid0,slot);

const txid = await connectionval2.sendRawTransaction(rawTransaction, {
    replaceRecentBlockhash: true,
    skipPreflight: true,
    maxRetries: 0,
    preflightCommitment: 'processed'
    });
    

    


console.log("archty"+`   https://solscan.io/tx/${txid2}`, 'color: blue;');
console.log(`https://solscan.io/tx/${txid}`);

      }catch(e){
        console.log(e)
      }

}

async function sendtx2(quotes,starttime,profit){



  // get serialized transactions for the swap

  try{
const transactions = 
await fetchWithRetrymin1(quotes,wallet.publicKey.toString());

//console.log(transactions);
//console.log("process.env.LAMP");
const now = Date.now();

console.log("time"+(now - starttime));
if(now - starttime  > 600) return;

const { swapTransaction } = transactions; 
//console.log(swapTransaction);                             1

// deserialize the transaction



//const transaction = VersionedTransaction.deserialize(swapTransactionBuf );


const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');



// Deserialize the resized buffer
const transaction = VersionedTransaction.deserialize(swapTransactionBuf);


transaction.sign([wallet.payer]);



const rawTransaction = transaction.serialize();




let slot = await connectionval2.getSlot({commitment:'confirmed'});


const txid0 = await rift.sendRawTransaction(rawTransaction, {
  //replaceRecentBlockhash: true,
skipPreflight: true,
 maxRetries: 0,
 preflightCommitment: 'processed'
});



await getTransactionSlotDifference(txid0,slot);

const txid = await connectionval2.sendRawTransaction(rawTransaction, {
    replaceRecentBlockhash: true,
    skipPreflight: true,
    maxRetries: 0,
    preflightCommitment: 'processed'
    });

//await getTransactionSlotDifference(txid,slot);
//console.log(`https://solscan.io/tx/${txid}`);



  }catch(e){
    console.log(e)
  }

}


async function sendtx3(quotes,starttime,profit){



  // get serialized transactions for the swap

  try{
const transactions = 
await fetchWithRetrymin2(quotes,wallet.publicKey.toString());

//console.log(transactions);
//console.log("process.env.LAMP");
const now = Date.now();

console.log("time"+(now - starttime));
if(now - starttime  > 600) return;

const { swapTransaction } = transactions; 
//console.log(swapTransaction);                             1

// deserialize the transaction



//const transaction = VersionedTransaction.deserialize(swapTransactionBuf );


const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');



// Deserialize the resized buffer
const transaction = VersionedTransaction.deserialize(swapTransactionBuf);


transaction.sign([wallet.payer]);



const rawTransaction = transaction.serialize();




let slot = await connectionval2.getSlot({commitment:'confirmed'});


const txid0 = await rift.sendRawTransaction(rawTransaction, {
  //replaceRecentBlockhash: true,
skipPreflight: true,
 maxRetries: 0,
 preflightCommitment: 'processed'
});



await getTransactionSlotDifference(txid0,slot);

const txid = await connectionval2.sendRawTransaction(rawTransaction, {
    replaceRecentBlockhash: true,
    skipPreflight: true,
    maxRetries: 0,
    preflightCommitment: 'processed'
    });

//await getTransactionSlotDifference(txid,slot);
//console.log(`https://solscan.io/tx/${txid}`);



  }catch(e){
    console.log(e)
  }

}

try{

main();
//setInterval(fetchData, 3 * 60 * 1000);



}catch(e){

}