const { getAllBiens, addBien: modelAddBien, updateBien, deleteBien } = require("../models/bien");

const getBiens = async (req, res) => {
  try {
    const biens = await getAllBiens();
    res.json(biens);
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
};

const createBien = async (req, res) => {
  const { nom, adresse, loyer } = req.body;
  try {
    const newBien = await modelAddBien(nom, adresse, loyer);
    res.status(201).json(newBien);
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
};

const updateBienHandler = async (req, res) => {
  const { id } = req.params;
  const { nom, adresse, loyer } = req.body;
  try {
    const updatedBien = await updateBien(id, nom, adresse, loyer);
    res.json(updatedBien);
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
};

const deleteBienHandler = async (req, res) => {
  const { id } = req.params;
  try {
    await deleteBien(id);
    res.json({ message: "Bien supprimé" });
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
};

module.exports = { getBiens, createBien, updateBienHandler, deleteBienHandler };