const axios = require('axios');
const mysql = require('mysql2/promise');

require('dotenv').config();

const connectToDatabase = async() => {
    try {
        
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_DATABASE
        });
        
        connection.connect((err) => {
            if (err) {
                console.error('Error connecting to MySQL:', err);
                return;
            }
            console.log('Connected to MySQL database');
        });
        
        return connection;
    } catch (error) {
        console.error("Failed to connect to database:", error);
        process.exit(1);
    }
}

const getQuote = async(quoteRequest) => {
    try {
        console.log(`${process.env.JUPITER_API}/quote`);
        const response = await axios.get(`${process.env.JUPITER_API}/quote?inputMint=${quoteRequest.inputMint}&outputMint=${quoteRequest.outputMint}&amount=${quoteRequest.amount}&slippageBps=${quoteRequest.slippage}`, {});
        return response.data; // Adjust as necessary based on your API response
    } catch (error) {
        throw new Error('Error fetching quote from Jupiter API');
    }
}

const run = async() =>{

    // await connectToDatabase();

    // setInterval(() => {
    //     axios.get(`${process.env.URL}`, {})
    //     .then(function (response) {
    //         let trades = response.data.trades;
    //         trades.forEach(trade => {
    //             if(trade.recommendation !== "HOLD"){
    //                 console.log(trade);
    //             }
    //         });
    //     })
    //     .catch(function (error) {
    //         console.log(error);
    //     });
    // }, 2*60*1000);
    let trades = [
        {
           "token_name": "Shark Cat",
           "recommendation": "HOLD"
       },
       {
           "token_name": "Act I The AI Prophecy",
           "recommendation": "BUY",
           "input_token": "So11111111111111111111111111111111111111112",
           "output_token": "GJAFwWjJ3vnTsrQVabjBVK2TYB1YtRCQXRDfDgUnpump",
           "slippage": 50,
           "priority_fee": 5,
           "route": {
               "swapInfo": {
                   "inputMint": "So11111111111111111111111111111111111111112",
                   "outputMint": "GJAFwWjJ3vnTsrQVabjBVK2TYB1YtRCQXRDfDgUnpump",
                   "inAmount": 54635850,
                   "outAmount": 0,
                   "feeAmount": 50
               },
               "percent": 100
           },
           "userPublicKey": "FLN3VVpcMmc3uSbyzBJ59LqSF2XegkaEFxS7hnr1FJKv"
       }
   ]
   
//    trades.forEach(trade=>{
    
//    })
    const quoteRequest = {
        // Fill with the necessary request parameters
        inputMint: 'So11111111111111111111111111111111111111112', // Example SOL mint address
        outputMint: 'GJAFwWjJ3vnTsrQVabjBVK2TYB1YtRCQXRDfDgUnpump', // Example USDC mint address
        amount: 1000000,  // Amount (in lamports or appropriate unit)
        slippage: 1,      // Slippage percentage
    };
    let quote = await getQuote(quoteRequest);
   console.log(quote);
}

run();