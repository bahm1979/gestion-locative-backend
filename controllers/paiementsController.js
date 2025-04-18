const { getAllPaiements, addPaiement, getImpayes, getMonthlyStats } = require("../models/paiement");

const getPaiements = async (req, res) => {
  try {
    const paiements = await getAllPaiements();
    res.json(paiements);
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
};

const createPaiement = async (req, res) => {
  const { locataire_id, montant, date_paiement } = req.body;
  try {
    const newPaiement = await addPaiement(locataire_id, montant, date_paiement);
    res.status(201).json(newPaiement);
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
};

const getImpayesHandler = async (req, res) => {
  try {
    const impayes = await getImpayes();
    res.json(impayes);
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
};

const getMonthlyStatsHandler = async (req, res) => {
  try {
    const stats = await getMonthlyStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
};

module.exports = { getPaiements, createPaiement, getImpayesHandler, getMonthlyStatsHandler };