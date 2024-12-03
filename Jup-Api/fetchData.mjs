import axios from 'axios';

async function fetchData() {
    const config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: 'https://public-api.birdeye.so/defi/tokenlist',
        headers: { 
          'Accept': 'application/json',
          'X-API-KEY': 'Api-key'
        },
        params: {
          sort_by: 'v24hUSD',
          sort_type: 'desc',
          limit: 50,
          min_liquidity: 100
        }
      };
      
      try {
        const response = await axios.request(config);
        const tokens = response.data?.data?.tokens; // Accessing the tokens array
        if (tokens) {
            const addresses = tokens
            .map(token => token.address);
            
            //addresses.push("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
            //addresses.push("So11111111111111111111111111111111111111112");
            addresses.push("CLoUDKc4Ane7HeQcPpE3YHnznRxhMimJ4MyaUqyHFzAu");
            addresses.push("ZEXy1pqteRu3n13kdyh4LwPQknkFk3GzmMYMuNadWPo");
            
            console.log(addresses.join(' ')); // Output the addresses separated by a space
        } else {
          console.log('Tokens array not found in the response.');
        }
      } catch (error) {
        console.error('Error:', error);
      }
}

fetchData();
