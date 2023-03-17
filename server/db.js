const Pool = require("pg").Pool;

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'starcadb',
    password: '1234', 
    port: 5432
});

pool.connect(function(err) {
    if (err) throw err;
    console.log("Connected!");
});

module.exports = pool;