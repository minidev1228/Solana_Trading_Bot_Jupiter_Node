const axios = require('axios');
const mysql = require('mysql2/promise');
const fs = require('fs');
const {
    Connection,
    Keypair,
    Transaction,
    sendAndConfirmTransaction,
    VersionedTransaction,
} = require('@solana/web3.js');
const bs58 = require('bs58');

require('dotenv').config();

const decodedSecretKey = Uint8Array.from(JSON.parse(process.env.SECRET_KEY));
const wallet = Keypair.fromSecretKey(decodedSecretKey);
const publicKey = wallet.publicKey.toBase58();
// console.log(wallet);
console.log(publicKey);

const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed'); // Change to mainnet or other environments as necessary

var isProcessing = false;
var currentData = {
    txId:"",
    token_id: "",
    input_mint: "",
    output_mint: "",
    action: "",
    quantity: "",
    price: "",
    fees: "",
    trade_status: "",
}
let trades = [
   {
       "token_name": "Act I The AI Prophecy",
       "recommendation": "BUY",
       "output_token": "So11111111111111111111111111111111111111112",
       "input_token": "GJAFwWjJ3vnTsrQVabjBVK2TYB1YtRCQXRDfDgUnpump",
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

const saveData = () =>{
    console.log(currentData);
    isProcessing = false;
}

const getQuote = async(quoteRequest) => {
    isProcessing = true;
    try {
        console.log(`${process.env.JUPITER_API}/quote`);
        const response = await axios.get(`${process.env.JUPITER_API}/quote?inputMint=${quoteRequest.inputMint}&outputMint=${quoteRequest.outputMint}&amount=${quoteRequest.amount}&slippageBps=${quoteRequest.slippage}`, {});
        return response.data; // Adjust as necessary based on your API response
    } catch (error) {
        throw new Error('Error fetching quote from Jupiter API');
    }
}

const excuteSwap = async(quoteRes, fee) => {
        axios.post('https://quote-api.jup.ag/v6/swap',{
            userPublicKey: publicKey,
            wrapAndUnwrapSol: true,
            useSharedAccounts: true,
            prioritizationFeeLamports: fee,
            quoteResponse: quoteRes
        }).then(async(res)=>{
            try {
                const swapTransaction = res.data.swapTransaction;
                const decodedTransaction = Buffer.from(swapTransaction, 'base64');
                const transaction = VersionedTransaction.deserialize(decodedTransaction);
                transaction.feePayer = publicKey;
                const { blockhash } = await connection.getLatestBlockhash();
                transaction.recentBlockhash = blockhash;
                transaction.sign([wallet]);
                const txid = await sendAndConfirmTransaction(connection, transaction,{
                    commitment: 'confirmed',
                    timeout: 60000, // 600 seconds
                });
                console.log("Current Transaction Id : ", txid);
                currentData.txId = txid;
                currentData.trade_status = "confirmed"
                saveData();
                return txid;
            } catch (error) {
                let message = error.message;
                let arr = message.split(" ");
                let txId = arr[17];
                console.log(message);
                currentData.txId = txId;
                currentData.trade_status = "failed";
                saveData();
                return "failed";
            }
        })
}

const run = async() =>{

    // await connectToDatabase();

    setInterval(() => {
        axios.get(`${process.env.URL}`, {})
        .then(function (response) {
            let hereTrades = response.data.trades;
            hereTrades.forEach(trade => {
                if(trade.recommendation !== "HOLD"){
                    trades.push(trade);
                    console.log("+++++++++++++++++++++++++++++++++++++++++++++++++++++");
                    console.log(trades);
                    console.log("++++++++++++++++++++++++++++++++++++++++++++++++++++++");
                }
            });
        })
        .catch(function (error) {
            console.log(error);
        });
    }, 2*60*1000);

    setInterval(async() => {
        if(isProcessing === true || trades.length === 0) return;
        
        currentData.token_id = trades[0].token_name;
        currentData.input_mint = trades[0].input_token;
        currentData.output_mint = trades[0].output_token;
        currentData.action = trades[0].recommendation;
        currentData.fees = trades[0].priority_fee;
        
        const quoteRequest = {
            // Fill with the necessary request parameters
            inputMint: currentData.input_mint, // Example SOL mint address
            outputMint: currentData.output_mint, // Example USDC mint address
            amount: trades[0].route.swapInfo.inAmount,  // Amount (in lamports or appropriate unit)
            slippage: trades[0].slippage,      // Slippage percentage
        };
        let quote = await getQuote(quoteRequest);

        if(currentData.action === "BUY") {
            currentData.quantity = quote.inAmount;
            currentData.price = quote.outAmount;
        } else {
            currentData.quantity = quote.outAmount;
            currentData.price = quote.inAmount;
        }
        trades.shift();
        console.log(currentData);
        await excuteSwap(quote, currentData.fees);
    }, 6000);
}

run();