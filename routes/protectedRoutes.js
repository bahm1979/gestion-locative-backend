// backend/routes/protectedRoutes.js (protection des routes sensibles)
const express = require("express");
const { authMiddleware, roleMiddleware } = require("../middleware/authMiddleware");
const router = express.Router();

router.use(authMiddleware);

router.get("/admin-only", roleMiddleware("admin"), (req, res) => {
  res.json({ message: "Accès admin autorisé" });
});

module.exports = router;