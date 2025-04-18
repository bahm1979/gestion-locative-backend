const pool = require("../utils/db");

const getAllLocataires = async () => {
  const [rows] = await pool.query("SELECT * FROM locataires");
  return rows;
};

const addLocataire = async (nom, email, telephone, date_naissance, lieu_naissance) => {
  const [result] = await pool.query(
    "INSERT INTO locataires (nom, email, telephone, date_naissance, lieu_naissance) VALUES (?, ?, ?, ?, ?)",
    [nom, email, telephone, date_naissance || null, lieu_naissance || null]
  );
  return { id: result.insertId, nom, email, telephone, date_naissance, lieu_naissance };
};

const updateLocataire = async (id, nom, email, telephone, date_naissance, lieu_naissance) => {
  await pool.query(
    "UPDATE locataires SET nom = ?, email = ?, telephone = ?, date_naissance = ?, lieu_naissance = ? WHERE id = ?",
    [nom, email, telephone, date_naissance || null, lieu_naissance || null, id]
  );
  return { id, nom, email, telephone, date_naissance, lieu_naissance };
};

const deleteLocataire = async (id) => {
  await pool.query("DELETE FROM locataires WHERE id = ?", [id]);
};

module.exports = { getAllLocataires, addLocataire, updateLocataire, deleteLocataire };