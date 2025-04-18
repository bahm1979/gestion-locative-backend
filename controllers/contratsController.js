const { getAllContrats, addContrat, deleteContrat } = require("../models/contrat");

const getContrats = async (req, res) => {
  try {
    const contrats = await getAllContrats();
    res.json(contrats);
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
};

const createContrat = async (req, res) => {
  const { bien_id, locataire_id, date_debut, date_fin } = req.body;
  try {
    const newContrat = await addContrat(bien_id, locataire_id, date_debut, date_fin);
    res.status(201).json(newContrat);
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
};

const deleteContratHandler = async (req, res) => {
  const { id } = req.params;
  try {
    await deleteContrat(id);
    res.json({ message: "Contrat supprimé" });
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
};

module.exports = { getContrats, createContrat, deleteContratHandler };