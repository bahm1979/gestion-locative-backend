const pool = require("../utils/db");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");
dotenv.config();

const createUser = async (nom, email, password, role = "proprietaire") => {
  const hashedPassword = await bcrypt.hash(password, 10);
  const [result] = await pool.query(
    "INSERT INTO users (nom, email, password, role) VALUES (?, ?, ?, ?)",
    [nom, email, hashedPassword, role]
  );
  return { id: result.insertId, nom, email, role };
};

const getUserByEmail = async (email) => {
  const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
  return rows[0];
};

module.exports = { createUser, getUserByEmail };