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

const run = async() =>{

    // await connectToDatabase();

    setInterval(() => {
        axios.get(`${process.env.URL}`, {})
        .then(function (response) {
            let trades = response.data.trades;
            trades.forEach(trade => {
                if(trade.recommendation !== "HOLD"){
                    console.log(trade);
                }
            });
        })
        .catch(function (error) {
            console.log(error);
        });
    }, 2*60*1000);
}

run();