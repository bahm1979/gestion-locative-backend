const pool = require("../utils/db");

const getAllContrats = async () => {
  const [rows] = await pool.query(
    "SELECT c.id, c.bien_id, c.locataire_id, c.date_debut, c.date_fin, b.nom AS bien_nom, l.nom AS locataire_nom " +
    "FROM contrats c " +
    "JOIN biens b ON c.bien_id = b.id " +
    "JOIN locataires l ON c.locataire_id = l.id"
  );
  return rows;
};

const addContrat = async (bien_id, locataire_id, date_debut, date_fin) => {
  const [result] = await pool.query(
    "INSERT INTO contrats (bien_id, locataire_id, date_debut, date_fin) VALUES (?, ?, ?, ?)",
    [bien_id, locataire_id, date_debut, date_fin]
  );
  return { id: result.insertId, bien_id, locataire_id, date_debut, date_fin };
};

const deleteContrat = async (id) => {
  await pool.query("DELETE FROM contrats WHERE id = ?", [id]);
};

module.exports = { getAllContrats, addContrat, deleteContrat };