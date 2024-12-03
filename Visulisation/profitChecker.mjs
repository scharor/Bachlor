import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js'
import fetch from "node-fetch";
import fs from "fs"
import yaml from 'js-yaml';
import { start } from 'repl';

const connection = new Connection("api"); 
let useConsolOutput = true;

let alltxes = 0;

let faildtxes = 0;

let successfulltxes = 0;

let successratio = 0;

let cuttxes = 4;

let fullfees = 0;

let starttime = Date.now();

let results = [];

let fiveminprofit = 0;

const feeBrackets = [
    { min: 0, max: 50000, label: "0-50_000" },
    { min: 50000, max: 150000, label: "50_000-150_000" },
    { min: 150000, max: 450000, label: "150_000-450000" },
    { min: 450000, max: 200000000, label: "450000 up" }
  ];

  // Initialize an object to count transactions in each bracket
const feeCounts = {};

// Initialize the counts for each fee bracket
feeBrackets.forEach(bracket => {
  feeCounts[bracket.label] = 0;
});

  let allsolprofits = 0;

  let allusdcprofits = 0;

  let avgsolwinprotx = 0;

  let avgusdcwinprotx = 0;


  let lastProcessedSignature = null; 

  const mintCountssucc = new Map();

  const mintCountsfail = new Map();




async function get_balances(WALLET_PUBKEY, USDC_ACCOUNT, WSOL_ACCOUNT){
    
    let usdc = await connection.getTokenAccountBalance(new PublicKey(USDC_ACCOUNT));

    let wsol = await connection.getTokenAccountBalance(new PublicKey(WSOL_ACCOUNT));
    //;
    return {
        //solBalance: (await connection.getTokenAccountBalance(WALLET_PUBKEY)).value.uiAmount,
        solBalance: await connection.getBalance(new PublicKey(WALLET_PUBKEY)) / 10 ** 9,
        usdcBalance: usdc.value.uiAmount,
        wsolBalance: wsol.value.uiAmount,
    }
}

async function updatemintsfailed(){
    let PATH = './datamintsfailed.json';

    // Convert the Map to an array of objects for JSON  mintCountsfail
    const mintCountArray = Array.from(mintCountsfail)
    .filter(([mint, _]) => mint !== 'So11111111111111111111111111111111111111112')
    .map(([mint, count]) => ({ mint, count }));

fs.writeFile(PATH, JSON.stringify(mintCountArray, null, 2), (err) => {
    if (err) console.log(err);
});

}

async function updatebrackets(){

    let PATH = './datafeebrackets.json';
    
    const dataForD3 = Object.entries(feeCounts).map(([feeBracket, count]) => {
        return { feeBracket, count };
      });

      fs.writeFile(PATH, JSON.stringify(dataForD3, null, 2), 'utf8', (err) => {
        if (err) {
          console.error('Error writing JSON file:', err);
        } else {
          console.log('JSON file has been saved successfully.');
        }
      });
}

async function updatemintssucc(){
    let PATH = './datamintssucc.json';

        // Convert the Map to an array of objects for JSON
        const mintCountArray = Array.from(mintCountssucc)
        .filter(([mint, _]) => mint !== 'So11111111111111111111111111111111111111112')
        .map(([mint, count]) => ({ mint, count }));
      

fs.writeFile(PATH, JSON.stringify(mintCountArray, null, 2), (err) => {
    if (err) console.log(err);
});

}

async function updatefiveminprofit() {
    let PATH = './datafiveminpro.json';

    // Filter out null entries before saving
    const filteredResults = results.filter(entry => entry !== null);

    fs.writeFile(PATH, JSON.stringify(filteredResults, null, 2), 'utf8', (err) => {
        if (err) {
          console.error('Error writing JSON file:', err);
        } else {
          console.log('JSON file has been saved successfully.');
        }
    });
}

function deleteFileIfExists(filePath, callback) {
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (!err) {
            // File exists, so delete it
            fs.unlink(filePath, (err) => {
                if (err) {
                    console.error('Error deleting the file:', err);
                    callback(err);
                } else {
                    console.log('File deleted successfully.');
                    callback(null);
                }
            });
        } else {
            // File does not exist
            console.log('File does not exist, no need to delete.');
            callback(null);
        }
    });
}

function createNewFile(filePath, data, callback) {
    fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8', (err) => {
        if (err) {
            console.error('Error creating the file:', err);
            callback(err);
        } else {
            console.log('New file created successfully.');
            callback(null);
        }
    });
}

function updateFile(filePath, data) {
    deleteFileIfExists(filePath, (err) => {
        if (err) {
            // Handle error if deleting file failed
            console.error('Failed to delete file:', err);
            return;
        }
        createNewFile(filePath, data, (err) => {
            if (err) {
                // Handle error if creating file failed
                console.error('Failed to create file:', err);
                return;
            }
            console.log('File updated successfully.');
        });
    });
}



function updateTxSucc() {
    const PATH = './datatxnumbersnotdiagramm.json';

    // Step 1: Read the existing data from the file
    fs.readFile(PATH, 'utf8', (readError, fileContent) => {
        let existingData = [];

        if (readError) {
            if (readError.code === 'ENOENT') {
                console.log('File does not exist, starting with an empty array.');
                // If the file doesn't exist, continue with an empty array
            } else {
                console.error('Error reading file:', readError);
                return;
            }
        } else {
            try {
                existingData = JSON.parse(fileContent);
            } catch (parseError) {
                console.error('Error parsing JSON data:', parseError);
                return;
            }
        }

        // Step 2: Create the new data object
        const newData = {
            Successfulltxes: successfulltxes,
            Faildtxes: faildtxes,
            Successratio: successratio,
            Fullfees: fullfees,
            Allsolprofits: allsolprofits,
            Allusdcprofits: allusdcprofits,
            Avgsolwinprotx: avgsolwinprotx,
            Avgusdcwinprotx: avgusdcwinprotx, 
        };

        // Step 3: Add the new data to the existing array
        existingData = [];
        existingData.push(newData);

        // Step 4: Write the updated data back to the file
        fs.writeFile(PATH, JSON.stringify(existingData, null, 2), 'utf8', (writeError) => {
            if (writeError) {
                console.error('Error writing to file:', writeError);
            } else {
                console.log('Data successfully written to file');
            }
        });
    });
}

function getDatetime(currentdate) {
    return currentdate.toLocaleString("de-DE", {year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: "2-digit"})
  }
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function processTokenBalances(balances, targetOwner) {
    // Create a set to hold unique mints
    const mintsSet = new Set();
    
    // Create a map to hold mint-to-amount mapping
    const mintAmountMap = new Map();
    
    // Iterate through each token balance
    balances.forEach(balance => {
      if (balance.owner === targetOwner) {
        // Add mint to the set
        mintsSet.add(balance.mint);
        
        // Add mint and uiAmount to the map
        mintAmountMap.set(balance.mint, balance.uiTokenAmount.uiAmount);
      }
    });
  
    // Convert the map to an object for easier use (optional)
    const mintAmountObj = Object.fromEntries(mintAmountMap);
  
    return { mintsSet, mintAmountObj };
  }




  async function processTransactions(transactions) {

    let timetx1 = transactions[0].blockTime;
    const interval = 5 * 60;
    transactions.forEach(tx => {
        let involvedMints = new Set();
        let usdcprofit = 0;
        let failed = false;
        
        let solprofit = 0;
        
        alltxes ++ ;

        if(tx.meta.fee != null){

        fullfees = fullfees +  tx.meta.fee / 10 ** 9 ;

     }


        if(tx.meta.err != null){
            faildtxes ++ ;
            failed = true;
        }else{
            successfulltxes ++ ;
        }
        
        successratio = successfulltxes / alltxes ;

       if( cuttxes < alltxes){
        updateTxSucc();
        updatemintsfailed();
        updatemintssucc();
        updatebrackets();
        updatefiveminprofit();
        cuttxes = cuttxes + 10;

       }

        


       console.log(tx.meta.postTokenBalances);

        // Define the target owner
const targetOwner = 'FaoqbZtEnpfSpbSm86VLcwSKiqgWAPfnkPeaEWvFJ5ec';

const { mintsSet: mintsSetpre, mintAmountObj: mintAmountObjpre } = processTokenBalances(tx.meta.preTokenBalances, targetOwner);
const { mintsSet: mintsSetpost, mintAmountObj: mintAmountObjpost } = processTokenBalances(tx.meta.postTokenBalances, targetOwner);



        if(failed){

            mintsSetpost.forEach(mint => {
                if (mintCountsfail.has(mint)) {
                    mintCountsfail.set(mint, mintCountsfail.get(mint) + 1);
                } else {
                    mintCountsfail.set(mint, 1);
                }
              });
        }else{
            let solpost =mintAmountObjpost["So11111111111111111111111111111111111111112"];

            let solpre = mintAmountObjpre["So11111111111111111111111111111111111111112"];
    
            let usdcpre = mintAmountObjpre["EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"];
    
            let usdcpost = mintAmountObjpost["EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"];
    
            solprofit = solpost - solpre;

            let usdcprofit = usdcpost - usdcpre;

            console.log("usdc-profit"+usdcprofit);
            // Check if either profit is NaN and skip if true
            if(isNaN(solprofit))  solprofit = 0;
            if(isNaN(usdcprofit)) usdcprofit = 0;
//if (isNaN(solprofit) || isNaN(usdcprofit)) {
   // console.log('One of the profits is NaN, skipping this transaction.');
  if (solprofit > 0 || usdcprofit > 0) {
    // Proceed if both profits are valid numbers and positive
    allsolprofits = allsolprofits + solprofit;

    const relativtime = timetx1 - tx.blockTime;

    const intervallindex = Math.floor(relativtime/ interval);

    if (results[intervallindex]) {
        // Add profit to the existing interval
        results[intervallindex].profit += solprofit;
      } else {
        // Start a new interval
        results[intervallindex] = {
          timestamp: new Date((timetx1 - interval * intervallindex) * 1000).toISOString(),
          profit: solprofit
        };
      }

    if(tx.meta.fee != null){
    const fee = tx.meta.fee;
    for (let bracket of feeBrackets) {
      if (fee >= bracket.min && fee <= bracket.max) {
        feeCounts[bracket.label] = feeCounts[bracket.label]+ solprofit;
        break;
         }
          }}
    
            //if(usdcprofit < 0 ) usdcprofit = 0;
           // console.log(allsolprofits);

            allusdcprofits = allusdcprofits + usdcprofit;
    
            avgsolwinprotx = allsolprofits / successfulltxes;
    
            avgusdcwinprotx = allusdcprofits / successfulltxes;
    //console.log('allsolprofits:', allsolprofits);
} else {
    console.log('Profits are not positive.');
}
    
            
    
            
            
        }
      if(!failed){
        mintsSetpost.forEach(mint => {
            if (mintCountssucc.has(mint)) {
                mintCountssucc.set(mint, mintCountssucc.get(mint) + 1);
            } else {
                mintCountssucc.set(mint, 1);
            }
          });}

      

// Output results
//console.log('Pre Mints Set:', mintsSetpre);
//console.log('Pre Mint to Amount Map:', mintAmountObjpre);
//console.log('Post Mints Set:', mintsSetpost);
//console.log('Post Mint to Amount Map:', mintAmountObjpost);
      //  console.dir(tx, { depth: null, colors: true });

        
       
    });
}

async function profitTracker(WALLET_PUB, TOKEN_ACCOUNT_PUB, WSOL_ACCOUNT_PUB, _SLEEP_TIME, PATH){





    while (true) {
        // Fetch the signatures, optionally starting before the last processed signature
        const txes = await connection.getSignaturesForAddress(
            new PublicKey("FaoqbZtEnpfSpbSm86VLcwSKiqgWAPfnkPeaEWvFJ5ec"),
            { until: lastProcessedSignature }
        );

        if (txes.length === 0) {
            // No new transactions, you may want to add a delay here
            await new Promise(resolve => setTimeout(resolve, 5000));
            continue;
        }

        // Extract the signatures
        const signatures = txes.map(tx => tx.signature);

        // Fetch the transaction details
        const transactions = await connection.getParsedTransactions(signatures, { maxSupportedTransactionVersion: 0 });
 // 
 // 
 // 31wWDN2BhDXGQ6eV2MaDNYzmgrQPAjVsK8kCDDhrN4vwQw9jNXRUu1mZyBJVxYpyy9KUA71adERCivRcUnVLn4Pp
 // 
        // Process the transactions
        processTransactions(transactions);

        // Update the last processed signature to the last one in the current batch
        lastProcessedSignature = txes[0].signature;

        const accountvalues = get_balances(WALLET_PUB,TOKEN_ACCOUNT_PUB,WSOL_ACCOUNT_PUB);

        const newRecord = {
            timestamp: new Date().toISOString(),
            sol: (await accountvalues).solBalance,
            usdc: (await accountvalues).usdcBalance,
            wsol: (await accountvalues).wsolBalance
        };
        
        // Define the file path for the JSON file
        const filePath  = './account_history.json';
    
        updateJsonFile(filePath, newRecord);

        // Optionally add a delay before the next iteration
        await new Promise(resolve => setTimeout(resolve, 5000));
    }

   



}

function updateJsonFile(filePath, newRecord) {
    // Check if the file exists
    fs.readFile(filePath, 'utf8', (err, data) => {
        let jsonData = [];

        if (!err) {
            // If the file exists, parse the existing data
            jsonData = JSON.parse(data);
        }

        // Append the new record
        jsonData.push(newRecord);

        // Write the updated data back to the file
        fs.writeFile(filePath, JSON.stringify(jsonData, null, 2), (err) => {
            if (err) {
                console.error('Error writing to file', err);
            } else {
                console.log('Record added successfully');
            }
        });
    });
}


function readYamlFile(file_path) {
  const fileContents = fs.readFileSync(file_path, 'utf8');
  const data = yaml.load(fileContents);
  return data;
}

const yaml_file_path = 'config.yaml';
const yaml_data = readYamlFile(yaml_file_path);
//Settings
const WALLET_PUBKEY = yaml_data['WalletPubkey'];
const USDC_ACCOUNT_PUBKEY = yaml_data['UsdcAccountPubkey'];
const WSOL_ACCOUNT_PUBKEY = yaml_data['wSolAccountPubkey'];
const PATH = yaml_data['Filepath'];
useConsolOutput = yaml_data['useConsolOutput'];

const REFRESH_INTERVAL = 50000;

profitTracker(WALLET_PUBKEY, USDC_ACCOUNT_PUBKEY, WSOL_ACCOUNT_PUBKEY, REFRESH_INTERVAL, PATH);



