const express = require("express");
const router = express.Router();

// GET /villes - Liste toutes les villes
router.get("/", async (req, res) => {
  try {
    const db = req.app.locals.db;
    const [villes] = await db.query("SELECT id, nom, pays, monnaie FROM villes");
    console.log("Villes renvoyées:", villes);
    res.json(villes);
  } catch (err) {
    console.error("Erreur dans GET /villes:", err);
    res.status(500).json({ error: "Erreur serveur lors du chargement des villes" });
  }
});

module.exports = router;