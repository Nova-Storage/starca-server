const Pool = require("pg").Pool;
require('dotenv').config();

const pool = new Pool({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD, 
    port: process.env.PGPORT
});

pool.connect(function(err) {
    if (err) throw err;
    console.log("Connected!");
});

module.exports = pool;