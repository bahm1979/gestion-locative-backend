const pool = require("../utils/db");

const getAllPaiements = async () => {
  const [rows] = await pool.query("SELECT * FROM paiements");
  return rows;
};

const addPaiement = async (locataire_id, montant, date_paiement) => {
  const [result] = await pool.query(
    "INSERT INTO paiements (locataire_id, montant, date_paiement) VALUES (?, ?, ?)",
    [locataire_id, montant, date_paiement]
  );
  return { id: result.insertId, locataire_id, montant, date_paiement };
};

const getImpayes = async () => {
  const [rows] = await pool.query(
    "SELECT c.locataire_id, l.nom AS locataire_nom, b.nom AS bien_nom, b.loyer, " +
    "SUM(COALESCE(p.montant, 0)) AS total_paye, " +
    "(b.loyer - SUM(COALESCE(p.montant, 0))) AS impaye " +
    "FROM contrats c " +
    "JOIN locataires l ON c.locataire_id = l.id " +
    "JOIN biens b ON c.bien_id = b.id " +
    "LEFT JOIN paiements p ON p.locataire_id = c.locataire_id " +
    "WHERE c.date_fin IS NULL " +
    "GROUP BY c.locataire_id, l.nom, b.nom, b.loyer " +
    "HAVING impaye > 0"
  );
  return rows;
};

const getMonthlyStats = async () => {
  const [rows] = await pool.query(
    "SELECT DATE_FORMAT(date_paiement, '%Y-%m') AS mois, SUM(montant) AS total " +
    "FROM paiements " +
    "GROUP BY mois " +
    "ORDER BY mois ASC"
  );
  return rows;
};

module.exports = { getAllPaiements, addPaiement, getImpayes, getMonthlyStats };