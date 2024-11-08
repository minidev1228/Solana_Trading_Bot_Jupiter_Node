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
// Constant values
const decodedSecretKey = Uint8Array.from(JSON.parse(process.env.SECRET_KEY));
const wallet = Keypair.fromSecretKey(decodedSecretKey);
const publicKey = wallet.publicKey.toBase58();
const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed'); // Change to mainnet or other environments as necessary
const sql = "INSERT INTO trade_history (signature, token_id, input_mint, output_mint, action, quantity, price, fees, trade_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";

// Global values
var dbconnection;
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
    // {
    //     "token_name": "Act I The AI Prophecy",
    //     "recommendation": "BUY",
    //     "input_token": "So11111111111111111111111111111111111111112",
    //     "output_token": "GJAFwWjJ3vnTsrQVabjBVK2TYB1YtRCQXRDfDgUnpump",
    //     "slippage": 50,
    //     "priority_fee": 20,
    //     "route": {
    //         "swapInfo": {
    //             "inputMint": "GJAFwWjJ3vnTsrQVabjBVK2TYB1YtRCQXRDfDgUnpump",
    //             "outputMint": "So11111111111111111111111111111111111111112",
    //             "inAmount": 5463585,
    //             "outAmount": 0,
    //             "feeAmount": 50
    //         },
    //         "percent": 100
    //     },
    //     "userPublicKey": "FLN3VVpcMmc3uSbyzBJ59LqSF2XegkaEFxS7hnr1FJKv",
    //     "inAmount": 546358
    // },
    // {
    //     "token_name": "Act I The AI Prophecy",
    //     "recommendation": "SELL",
    //     "input_token": "GJAFwWjJ3vnTsrQVabjBVK2TYB1YtRCQXRDfDgUnpump",
    //     "output_token": "So11111111111111111111111111111111111111112",
    //     "slippage": 50,
    //     "priority_fee": 5,
    //     "route": {
    //         "swapInfo": {
    //             "inputMint": "GJAFwWjJ3vnTsrQVabjBVK2TYB1YtRCQXRDfDgUnpump",
    //             "outputMint": "So11111111111111111111111111111111111111112",
    //             "inAmount": 5463585,
    //             "outAmount": 0,
    //             "feeAmount": 50
    //         },
    //         "percent": 100
    //     },
    //     "userPublicKey": "FLN3VVpcMmc3uSbyzBJ59LqSF2XegkaEFxS7hnr1FJKv",
    //     "inAmount": 546358
    // }
]

const connectToDatabase = async() => {
    try {
        
        dbconnection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_DATABASE,
            port: process.env.DB_PORT
        });
        
        console.log("Connected successfully !");
        return connection;
    } catch (error) {
        console.error("Failed to connect to database:", error);
        process.exit(1);
    }
}

const saveData = async() =>{
    console.log(currentData);
    const [result] = await dbconnection.execute(sql, [currentData.txId, currentData.token_id, currentData.input_mint, currentData.output_mint, currentData.action, currentData.quantity, currentData.price, currentData.fees, currentData.trade_status]);
    console.log(`${result.affectedRows} record inserted`);
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

const confirmTransaction = async (
    signature,
    desiredConfirmationStatus = 'confirmed',
    timeout = 60000,
    pollInterval = 1000,
    searchTransactionHistory = false
) => {
    const start = Date.now();

    while (Date.now() - start < timeout) {
        const stat = await connection.getSignatureStatuses([signature], { searchTransactionHistory });

        const statuses = stat.value;

        console.log(statuses);

        if (!statuses || statuses.length === 0) {
            // throw new Error('Failed to get signature status');
            return {err: "failed"};
        }

        const status = statuses[0];

        console.log(stat);

        if (status === null) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            continue;
        }

        if (status.err) {
            // throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
            return {err: "failed"};
        }

        if (status.confirmationStatus && status.confirmationStatus === desiredConfirmationStatus) {
            return status;
        }

        if (status.confirmationStatus === 'finalized') {
            return status;
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    return {err:"timeout"};
    // throw new Error(`Transaction confirmation timeout after ${timeout}ms`);
};

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

            // const rawTransaction = transaction.serialize();
            // const txid = await connection.sendRawTransaction(rawTransaction, {
            //     skipPreflight: true,
            //     maxRetries: 5
            // });

            // console.log(txid);

            // if (confirmation.err) {
            //     throw new Error('Transaction failed');
            // }
            
            const txid = await sendAndConfirmTransaction(connection, transaction);
            // console.log("Current Transaction Id : ", txid);
            currentData.txId = txid;
            currentData.trade_status = "confirmed"
            
            saveData();
            
            return txid;
        } catch (error) {
            let message = error.message;
            console.log(message);
            let arr = message.split(" ");
            let txId = arr[17];

            if(txId[0]==="p" && txId[1]==="r" && txId[2]==="o" && txId[3]==="g" ){
                currentData.txId = "Not enough balance"
                currentData.trade_status = "failed";
                saveData();
            } else{
                currentData.txId = txId;
                const confirmation = await confirmTransaction(txId);
                if (confirmation.err) {
                    currentData.trade_status = "failed";            
                } else {
                    currentData.trade_status = "confirmed";
                }
                saveData()
            }
        }
    })
}

const run = async() =>{

    await connectToDatabase();

    setInterval(() => {
        axios.get(`${process.env.URL}`, {})
        .then(function (response) {
            let hereTrades = response.data.trades;
            hereTrades.forEach(trade => {
                if(trade.recommendation !== "HOLD"){
                    let inAmount = trade.route.swapInfo.inAmount;
                    trade["inAmount"] = inAmount;
                    trades.push(trade);
                }
            });
            console.log("+++++++++++++++++++++++++++++++++++++++++++++++++++++");
            console.log(trades);
            console.log("++++++++++++++++++++++++++++++++++++++++++++++++++++++");
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
        currentData.txId = "";
        currentData.trade_status = "";
        
        const quoteRequest = {
            // Fill with the necessary request parameters
            inputMint: currentData.input_mint, // Example SOL mint address
            outputMint: currentData.output_mint, // Example USDC mint address
            amount: trades[0].inAmount,  // Amount (in lamports or appropriate unit)
            slippage: trades[0].slippage,      // Slippage percentage
        };
        // console.log(quoteRequest);
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