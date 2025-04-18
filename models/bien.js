const pool = require("../utils/db");

const getAllBiens = async () => {
  const [rows] = await pool.query("SELECT * FROM biens");
  return rows;
};

const addBien = async (nom, adresse, loyer) => {
  const [result] = await pool.query(
    "INSERT INTO biens (nom, adresse, loyer) VALUES (?, ?, ?)",
    [nom, adresse, loyer]
  );
  return { id: result.insertId, nom, adresse, loyer };
};

const updateBien = async (id, nom, adresse, loyer) => {
  await pool.query(
    "UPDATE biens SET nom = ?, adresse = ?, loyer = ? WHERE id = ?",
    [nom, adresse, loyer, id]
  );
  return { id, nom, adresse, loyer };
};

const deleteBien = async (id) => {
  await pool.query("DELETE FROM biens WHERE id = ?", [id]);
};

module.exports = { getAllBiens, addBien, updateBien, deleteBien };