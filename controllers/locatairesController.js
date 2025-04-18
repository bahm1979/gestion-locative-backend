const { getAllLocataires, addLocataire: modelAddLocataire, updateLocataire, deleteLocataire } = require("../models/locataire");

const getLocataires = async (req, res) => {
  try {
    const locataires = await getAllLocataires();
    res.json(locataires);
  } catch (error) {
    console.error("Erreur lors de la récupération des locataires:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

const createLocataire = async (req, res) => {
  const { nom, email, telephone, date_naissance, lieu_naissance } = req.body;
  try {
    // Validation des champs requis
    if (!nom || !email || !telephone) {
      return res.status(400).json({ error: "Nom, email et téléphone sont requis" });
    }
    // Validation email simple
    if (!/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ error: "Email invalide" });
    }
    // Validation téléphone (optionnel, peut être affiné)
    if (telephone.length < 10) {
      return res.status(400).json({ error: "Téléphone invalide (minimum 10 chiffres)" });
    }

    const newLocataire = await modelAddLocataire(nom, email, telephone, date_naissance, lieu_naissance);
    res.status(201).json(newLocataire);
  } catch (error) {
    console.error("Erreur lors de l’ajout du locataire:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ error: "Cet email est déjà utilisé" });
    }
    res.status(500).json({ error: "Erreur serveur" });
  }
};

const updateLocataireHandler = async (req, res) => {
  const { id } = req.params;
  const { nom, email, telephone, date_naissance, lieu_naissance } = req.body;
  try {
    // Validation des champs requis
    if (!nom || !email || !telephone) {
      return res.status(400).json({ error: "Nom, email et téléphone sont requis" });
    }
    // Validation email
    if (!/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ error: "Email invalide" });
    }
    // Validation téléphone
    if (telephone.length < 10) {
      return res.status(400).json({ error: "Téléphone invalide (minimum 10 chiffres)" });
    }

    const updatedLocataire = await updateLocataire(id, nom, email, telephone, date_naissance, lieu_naissance);
    res.json(updatedLocataire);
  } catch (error) {
    console.error("Erreur lors de la mise à jour du locataire:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ error: "Cet email est déjà utilisé" });
    }
    res.status(500).json({ error: "Erreur serveur" });
  }
};

const deleteLocataireHandler = async (req, res) => {
  const { id } = req.params;
  try {
    await deleteLocataire(id);
    res.json({ message: "Locataire supprimé" });
  } catch (error) {
    console.error("Erreur lors de la suppression du locataire:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

module.exports = { getLocataires, createLocataire, updateLocataireHandler, deleteLocataireHandler };