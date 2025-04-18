const express = require("express");
const router = express.Router();

// GET /locataires - Liste tous les locataires
router.get("/", async (req, res) => {
  try {
    const db = req.app.locals.db;
    const [locataires] = await db.query("SELECT id, nom, email, telephone, date_naissance, lieu_naissance FROM locataires");
    console.log("Locataires renvoyés:", locataires);
    res.json(locataires);
  } catch (err) {
    console.error("Erreur dans GET /locataires:", err);
    res.status(500).json({ error: "Erreur serveur lors du chargement des locataires" });
  }
});

// POST /locataires - Ajouter un locataire
router.post("/", async (req, res) => {
  const { nom, email, telephone, date_naissance, lieu_naissance } = req.body;

  // Validation des champs requis
  if (!nom || !email || !telephone) {
    return res.status(400).json({ error: "Nom, email et téléphone sont obligatoires" });
  }
  // Validation email
  if (!/\S+@\S+\.\S+/.test(email)) {
    return res.status(400).json({ error: "Email invalide" });
  }
  // Validation téléphone
  if (telephone.length < 10) {
    return res.status(400).json({ error: "Téléphone invalide (minimum 10 chiffres)" });
  }

  try {
    const db = req.app.locals.db;

    // Vérifier si l’email est déjà utilisé
    const [existing] = await db.query("SELECT id FROM locataires WHERE email = ?", [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: "Cet email est déjà utilisé" });
    }

    const [result] = await db.query(
      "INSERT INTO locataires (nom, email, telephone, date_naissance, lieu_naissance) VALUES (?, ?, ?, ?, ?)",
      [nom, email, telephone, date_naissance || null, lieu_naissance || null]
    );

    const newLocataire = { id: result.insertId, nom, email, telephone, date_naissance, lieu_naissance };
    console.log("Locataire ajouté:", newLocataire);
    res.status(201).json(newLocataire);
  } catch (err) {
    console.error("Erreur dans POST /locataires:", err);
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Cet email est déjà utilisé" });
    }
    res.status(500).json({ error: "Erreur serveur lors de l’ajout du locataire", details: err.message });
  }
});

// PUT /locataires/:id - Mettre à jour un locataire
router.put("/:id", async (req, res) => {
  const { nom, email, telephone, date_naissance, lieu_naissance } = req.body;
  const { id } = req.params;

  // Validation des champs requis
  if (!nom || !email || !telephone) {
    return res.status(400).json({ error: "Nom, email et téléphone sont obligatoires" });
  }
  // Validation email
  if (!/\S+@\S+\.\S+/.test(email)) {
    return res.status(400).json({ error: "Email invalide" });
  }
  // Validation téléphone
  if (telephone.length < 10) {
    return res.status(400).json({ error: "Téléphone invalide (minimum 10 chiffres)" });
  }

  try {
    const db = req.app.locals.db;

    // Vérifier si l’email est déjà utilisé par un autre locataire
    const [existing] = await db.query(
      "SELECT id FROM locataires WHERE email = ? AND id != ?",
      [email, id]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: "Cet email est déjà utilisé par un autre locataire" });
    }

    const [result] = await db.query(
      "UPDATE locataires SET nom = ?, email = ?, telephone = ?, date_naissance = ?, lieu_naissance = ? WHERE id = ?",
      [nom, email, telephone, date_naissance || null, lieu_naissance || null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Locataire non trouvé" });
    }

    const updatedLocataire = { id: parseInt(id), nom, email, telephone, date_naissance, lieu_naissance };
    console.log("Locataire mis à jour:", updatedLocataire);
    res.json(updatedLocataire);
  } catch (err) {
    console.error("Erreur dans PUT /locataires/:id:", err);
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Cet email est déjà utilisé" });
    }
    res.status(500).json({ error: "Erreur serveur lors de la mise à jour du locataire", details: err.message });
  }
});

// DELETE /locataires/:id - Supprimer un locataire
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const db = req.app.locals.db;

  console.log(`Tentative de suppression du locataire ID: ${id}`);

  try {
    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId)) {
      console.log(`ID invalide: ${id}`);
      return res.status(400).json({ error: "ID invalide, doit être un nombre" });
    }

    // Étape 1 : Supprimer les paiements liés via les contrats
    const [paiementsResult] = await db.query(`
      DELETE p FROM paiements p
      INNER JOIN contrats c ON p.contrat_id = c.id
      WHERE c.locataire_id = ?
    `, [parsedId]);
    console.log("Paiements supprimés:", paiementsResult.affectedRows);

    // Étape 2 : Supprimer les contrats liés
    const [contratsResult] = await db.query("DELETE FROM contrats WHERE locataire_id = ?", [parsedId]);
    console.log("Contrats supprimés:", contratsResult.affectedRows);

    // Étape 3 : Supprimer le locataire
    const [locataireResult] = await db.query("DELETE FROM locataires WHERE id = ?", [parsedId]);
    if (locataireResult.affectedRows === 0) {
      console.log(`Aucun locataire trouvé avec l'ID: ${parsedId}`);
      return res.status(404).json({ error: "Locataire non trouvé" });
    }

    console.log(`Locataire ID ${parsedId} supprimé avec succès`);
    res.status(204).send();
  } catch (err) {
    console.error("Erreur dans DELETE /locataires/:id:", err);
    res.status(500).json({
      error: "Erreur serveur lors de la suppression du locataire",
      details: err.message,
    });
  }
});

module.exports = router;