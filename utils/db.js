const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "", // Remplace par ton mot de passe si nécessaire
  database: "gestion_locative_v3",
});

module.exports = pool;