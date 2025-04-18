const express = require("express");
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const db = req.app.locals.db;
    const [appartements] = await db.query(`
      SELECT a.id, a.etage_id, a.numero, a.chambres, a.salles_de_bain AS sallesDeBain, 
             a.surface, a.balcon, a.cuisine_equipee AS cuisineEquipee, a.loyer, e.immeuble_id
      FROM appartements a
      LEFT JOIN etages e ON a.etage_id = e.id
    `);
    const formattedAppartements = appartements.map((apt) => ({
      ...apt,
      balcon: Boolean(apt.balcon),
      cuisineEquipee: Boolean(apt.cuisineEquipee),
    }));
    console.log("Appartements renvoyés:", formattedAppartements);
    res.json(formattedAppartements);
  } catch (err) {
    console.error("Erreur dans GET /appartements:", err);
    res.status(500).json({ error: "Erreur serveur lors du chargement des appartements" });
  }
});

router.post("/", async (req, res) => {
  const {
    etage_id,
    numero,
    chambres,
    sallesDeBain,
    surface,
    balcon,
    cuisineEquipee,
    loyer,
  } = req.body;

  if (!etage_id || !numero || chambres === undefined || sallesDeBain === undefined || !surface || loyer === undefined) {
    return res.status(400).json({ error: "Tous les champs obligatoires doivent être fournis" });
  }

  try {
    const db = req.app.locals.db;
    const [etages] = await db.query("SELECT id FROM etages WHERE id = ?", [etage_id]);
    if (etages.length === 0) {
      return res.status(404).json({ error: "Étage non trouvé" });
    }

    const [result] = await db.query(
      "INSERT INTO appartements (etage_id, numero, chambres, salles_de_bain, surface, balcon, cuisine_equipee, loyer) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [etage_id, numero, chambres, sallesDeBain, surface, balcon ? 1 : 0, cuisineEquipee ? 1 : 0, loyer]
    );

    const newAppartement = {
      id: result.insertId,
      etage_id,
      numero,
      chambres,
      sallesDeBain,
      surface,
      balcon: Boolean(balcon),
      cuisineEquipee: Boolean(cuisineEquipee),
      loyer,
    };
    console.log("Appartement ajouté:", newAppartement);
    res.status(201).json(newAppartement);
  } catch (err) {
    console.error("Erreur dans POST /appartements:", err);
    res.status(500).json({ error: "Erreur serveur lors de l’ajout de l’appartement" });
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const db = req.app.locals.db;
    const [result] = await db.query("DELETE FROM appartements WHERE id = ?", [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Appartement non trouvé" });
    }
    console.log(`Appartement ${id} supprimé`);
    res.status(204).send();
  } catch (err) {
    console.error("Erreur dans DELETE /appartements/:id:", err);
    res.status(500).json({ error: "Erreur serveur lors de la suppression de l’appartement" });
  }
});

module.exports = router;