const express = require("express");
const router = express.Router();

// GET /biens - Liste tous les immeubles
router.get("/", async (req, res) => {
  try {
    const db = req.app.locals.db;
    const [immeubles] = await db.query(`
      SELECT i.id, i.nom, i.adresse, i.ville_id, i.etages, i.monnaie, v.nom AS ville_nom
      FROM immeubles i
      LEFT JOIN villes v ON i.ville_id = v.id
    `);
    console.log("Immeubles renvoyés:", immeubles);
    res.json(immeubles);
  } catch (err) {
    console.error("Erreur dans GET /biens:", err);
    res.status(500).json({ error: "Erreur serveur lors du chargement des immeubles" });
  }
});

// POST /biens - Ajouter un immeuble
router.post("/", async (req, res) => {
  const { nom, adresse, ville_id, etages, monnaie } = req.body;

  // Validation des champs requis
  if (!nom || !adresse || !ville_id || !etages || !monnaie) {
    return res.status(400).json({ error: "Tous les champs (nom, adresse, ville_id, etages, monnaie) sont obligatoires" });
  }

  try {
    const db = req.app.locals.db;

    // Vérifier si la ville existe
    const [villes] = await db.query("SELECT id FROM villes WHERE id = ?", [ville_id]);
    if (villes.length === 0) {
      return res.status(400).json({ error: "Ville invalide" });
    }

    const [result] = await db.query(
      "INSERT INTO immeubles (nom, adresse, ville_id, etages, monnaie) VALUES (?, ?, ?, ?, ?)",
      [nom, adresse, ville_id, etages, monnaie]
    );

    const newImmeuble = {
      id: result.insertId,
      nom,
      adresse,
      ville_id,
      etages,
      monnaie,
    };

    console.log("Immeuble ajouté:", newImmeuble);
    res.status(201).json(newImmeuble);
  } catch (err) {
    console.error("Erreur dans POST /biens:", err);
    res.status(500).json({ error: "Erreur serveur lors de l’ajout de l’immeuble", details: err.message });
  }
});

// PUT /biens/:id - Mettre à jour un immeuble
router.put("/:id", async (req, res) => {
  const { nom, adresse, ville_id, etages, monnaie } = req.body;
  const { id } = req.params;

  // Validation des champs requis
  if (!nom || !adresse || !ville_id || !etages || !monnaie) {
    return res.status(400).json({ error: "Tous les champs (nom, adresse, ville_id, etages, monnaie) sont obligatoires" });
  }

  try {
    const db = req.app.locals.db;

    // Vérifier si la ville existe
    const [villes] = await db.query("SELECT id FROM villes WHERE id = ?", [ville_id]);
    if (villes.length === 0) {
      return res.status(400).json({ error: "Ville invalide" });
    }

    const [result] = await db.query(
      "UPDATE immeubles SET nom = ?, adresse = ?, ville_id = ?, etages = ?, monnaie = ? WHERE id = ?",
      [nom, adresse, ville_id, etages, monnaie, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Immeuble non trouvé" });
    }

    const updatedImmeuble = {
      id: parseInt(id),
      nom,
      adresse,
      ville_id,
      etages,
      monnaie,
    };

    console.log("Immeuble mis à jour:", updatedImmeuble);
    res.json(updatedImmeuble);
  } catch (err) {
    console.error("Erreur dans PUT /biens/:id:", err);
    res.status(500).json({ error: "Erreur serveur lors de la mise à jour de l’immeuble", details: err.message });
  }
});

// DELETE /biens/:id - Supprimer un immeuble
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const db = req.app.locals.db;

  console.log(`Tentative de suppression de l’immeuble ID: ${id}`);

  try {
    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId)) {
      console.log(`ID invalide: ${id}`);
      return res.status(400).json({ error: "ID invalide, doit être un nombre" });
    }

    // Supprimer les contrats liés (via appartements et étages)
    const [contratsResult] = await db.query(`
      DELETE c FROM contrats c
      INNER JOIN appartements a ON c.appartement_id = a.id
      INNER JOIN etages e ON a.etage_id = e.id
      WHERE e.immeuble_id = ?
    `, [parsedId]);
    console.log("Contrats supprimés:", contratsResult.affectedRows);

    // Supprimer les appartements (via étages)
    const [appartementsResult] = await db.query(`
      DELETE a FROM appartements a
      INNER JOIN etages e ON a.etage_id = e.id
      WHERE e.immeuble_id = ?
    `, [parsedId]);
    console.log("Appartements supprimés:", appartementsResult.affectedRows);

    // Supprimer les étages
    const [etagesResult] = await db.query("DELETE FROM etages WHERE immeuble_id = ?", [parsedId]);
    console.log("Étages supprimés:", etagesResult.affectedRows);

    // Supprimer l’immeuble
    const [immeubleResult] = await db.query("DELETE FROM immeubles WHERE id = ?", [parsedId]);
    if (immeubleResult.affectedRows === 0) {
      console.log(`Aucun immeuble trouvé avec l'ID: ${parsedId}`);
      return res.status(404).json({ error: "Immeuble non trouvé" });
    }

    console.log(`Immeuble ID ${parsedId} supprimé avec succès`);
    res.status(204).send();
  } catch (err) {
    console.error("Erreur détaillée dans DELETE /biens/:id:", err);
    res.status(500).json({
      error: "Erreur serveur lors de la suppression de l’immeuble",
      details: err.message,
    });
  }
});

// GET /biens/villes - Liste toutes les villes
router.get("/villes", async (req, res) => {
  try {
    const db = req.app.locals.db;
    const [villes] = await db.query("SELECT id, nom, pays, monnaie FROM villes");
    console.log("Villes renvoyées:", villes);
    res.json(villes);
  } catch (err) {
    console.error("Erreur dans GET /biens/villes:", err);
    res.status(500).json({ error: "Erreur serveur lors du chargement des villes" });
  }
});

// GET /biens/etages - Liste tous les étages
router.get("/etages", async (req, res) => {
  try {
    const db = req.app.locals.db;
    const [etages] = await db.query(`
      SELECT e.id, e.immeuble_id, e.numero, i.nom AS immeuble_nom
      FROM etages e
      LEFT JOIN immeubles i ON e.immeuble_id = i.id
    `);
    console.log("Étages renvoyés:", etages);
    res.json(etages);
  } catch (err) {
    console.error("Erreur dans GET /biens/etages:", err);
    res.status(500).json({ error: "Erreur serveur lors du chargement des étages" });
  }
});

// GET /biens/appartements - Liste tous les appartements
router.get("/appartements", async (req, res) => {
  try {
    const db = req.app.locals.db;
    const [appartements] = await db.query(`
      SELECT a.id, a.etage_id, a.numero, a.chambres, a.salles_de_bain, a.surface, 
             a.balcon, a.cuisine_equipee, a.loyer, e.immeuble_id
      FROM appartements a
      LEFT JOIN etages e ON a.etage_id = e.id
    `);
    console.log("Appartements renvoyés:", appartements);
    res.json(appartements);
  } catch (err) {
    console.error("Erreur dans GET /biens/appartements:", err);
    res.status(500).json({ error: "Erreur serveur lors du chargement des appartements" });
  }
});

module.exports = router;