const express = require("express");
const router = express.Router();

// GET /etages - Liste tous les étages
router.get("/", async (req, res) => {
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
    console.error("Erreur dans GET /etages:", err);
    res.status(500).json({ error: "Erreur serveur lors du chargement des étages" });
  }
});

// POST /etages - Ajouter un étage
router.post("/", async (req, res) => {
  const { immeuble_id, numero } = req.body;

  // Validation des champs requis
  if (!immeuble_id || numero === undefined) {
    return res.status(400).json({ error: "Immeuble ID et numéro d’étage sont requis" });
  }

  try {
    const db = req.app.locals.db;

    // Vérifier si l’immeuble existe
    const [immeubles] = await db.query("SELECT id, etages FROM immeubles WHERE id = ?", [immeuble_id]);
    if (immeubles.length === 0) {
      return res.status(404).json({ error: "Immeuble non trouvé" });
    }

    // Vérifier que le numéro d’étage est valide
    const immeuble = immeubles[0];
    if (numero >= immeuble.etages) {
      return res.status(400).json({ error: `Le numéro d’étage doit être inférieur à ${immeuble.etages}` });
    }

    // Insérer l’étage
    const [result] = await db.query(
      "INSERT INTO etages (immeuble_id, numero) VALUES (?, ?)",
      [immeuble_id, numero]
    );

    const newEtage = { id: result.insertId, immeuble_id, numero };
    console.log("Étage ajouté:", newEtage);
    res.status(201).json(newEtage);
  } catch (err) {
    console.error("Erreur dans POST /etages:", err);
    res.status(500).json({ error: "Erreur serveur lors de l’ajout de l’étage" });
  }
});

// DELETE /etages/:id - Supprimer un étage
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const db = req.app.locals.db;

    // Supprimer l’étage
    const [result] = await db.query("DELETE FROM etages WHERE id = ?", [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Étage non trouvé" });
    }

    console.log(`Étage ${id} supprimé`);
    res.status(204).send();
  } catch (err) {
    console.error("Erreur dans DELETE /etages/:id:", err);
    res.status(500).json({ error: "Erreur serveur lors de la suppression de l’étage" });
  }
});

module.exports = router;