const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { authMiddleware } = require("../middleware/authMiddleware");

// Configuration de multer pour gérer les uploads d’avatar
const upload = multer({
  dest: "uploads/",
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Seules les images sont acceptées"), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

// POST /auth/register - Enregistrer un nouvel utilisateur
router.post("/register", async (req, res) => {
  const { nom, email, password, role } = req.body;

  if (!nom || !email || !password) {
    return res.status(400).json({ error: "Nom, email et mot de passe sont requis" });
  }

  try {
    const db = req.app.locals.db;

    const [existingUsers] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existingUsers.length > 0) {
      return res.status(409).json({ error: "Cet email est déjà utilisé" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      "INSERT INTO users (nom, email, password, role) VALUES (?, ?, ?, ?)",
      [nom, email, hashedPassword, role || "proprietaire"]
    );

    const user = {
      id: result.insertId,
      nom,
      email,
      role: role || "proprietaire",
    };

    console.log("Utilisateur enregistré:", user);
    res.status(201).json({ message: "Utilisateur créé avec succès", user });
  } catch (err) {
    console.error("Erreur dans /auth/register:", err);
    res.status(500).json({ error: "Erreur serveur lors de l’enregistrement" });
  }
});

// POST /auth/login - Connexion utilisateur
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email et mot de passe sont requis" });
  }

  try {
    const db = req.app.locals.db;

    const [users] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    if (users.length === 0) {
      return res.status(401).json({ error: "Email ou mot de passe incorrect" });
    }

    const user = users[0];

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Email ou mot de passe incorrect" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || "default_secret", // Ajout d'une valeur par défaut si .env manque
      { expiresIn: "2h" }
    );

    console.log("Utilisateur connecté:", { id: user.id, email, role: user.role });
    res.json({
      token,
      user: {
        id: user.id,
        nom: user.nom,
        email: user.email,
        role: user.role,
        avatar: user.avatar || null,
      },
    });
  } catch (err) {
    console.error("Erreur dans /auth/login:", err);
    res.status(500).json({ error: "Erreur serveur lors de la connexion" });
  }
});

// GET /auth/me - Vérifier l’utilisateur connecté
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.id;

    const [users] = await db.query(
      "SELECT id, nom, email, role, avatar FROM users WHERE id = ?",
      [userId]
    );
    if (users.length === 0) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    const user = users[0];
    console.log("Utilisateur vérifié via /me:", user);
    res.json(user);
  } catch (err) {
    console.error("Erreur dans /auth/me:", err);
    res.status(500).json({ error: "Erreur serveur lors de la vérification" });
  }
});

// PUT /auth/update-profile - Mettre à jour le profil utilisateur
router.put("/update-profile", authMiddleware, upload.single("avatar"), async (req, res) => {
  const { nom, email } = req.body;
  const avatarFile = req.file;
  const userId = req.user.id;
  const db = req.app.locals.db;

  console.log("Reçu dans PUT /auth/update-profile:", { nom, email, avatarFile });

  if (!nom || !email) {
    if (avatarFile && fs.existsSync(avatarFile.path)) fs.unlinkSync(avatarFile.path); // Nettoyage
    return res.status(400).json({ error: "Nom et email sont requis" });
  }

  try {
    // Vérifier si l’email est déjà utilisé par un autre utilisateur
    const [emailCheck] = await db.query(
      "SELECT id FROM users WHERE email = ? AND id != ?",
      [email, userId]
    );
    if (emailCheck.length > 0) {
      if (avatarFile && fs.existsSync(avatarFile.path)) fs.unlinkSync(avatarFile.path);
      return res.status(409).json({ error: "Cet email est déjà utilisé par un autre utilisateur" });
    }

    // Récupérer l’utilisateur actuel pour l’avatar existant
    const [currentUsers] = await db.query("SELECT avatar FROM users WHERE id = ?", [userId]);
    if (currentUsers.length === 0) {
      if (avatarFile && fs.existsSync(avatarFile.path)) fs.unlinkSync(avatarFile.path);
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    let avatarPath = currentUsers[0].avatar;

    // Gérer l’upload de l’avatar
    if (avatarFile) {
      const newAvatarPath = `/uploads/${Date.now()}-${avatarFile.originalname}`;
      fs.renameSync(avatarFile.path, path.join(__dirname, "../", newAvatarPath));

      // Supprimer l’ancien avatar s’il existe
      if (avatarPath && fs.existsSync(path.join(__dirname, "../", avatarPath))) {
        fs.unlinkSync(path.join(__dirname, "../", avatarPath));
      }
      avatarPath = newAvatarPath;
    }

    // Mettre à jour les données dans la base
    await db.query(
      "UPDATE users SET nom = ?, email = ?, avatar = ? WHERE id = ?",
      [nom.trim(), email.trim(), avatarPath, userId]
    );

    const updatedUser = {
      id: userId,
      nom: nom.trim(),
      email: email.trim(),
      role: req.user.role,
      avatar: avatarPath || null,
    };

    console.log("Utilisateur mis à jour:", updatedUser);
    res.status(200).json(updatedUser);
  } catch (err) {
    console.error("Erreur dans PUT /auth/update-profile:", err);
    if (avatarFile && fs.existsSync(avatarFile.path)) fs.unlinkSync(avatarFile.path);
    res.status(500).json({ error: "Erreur serveur lors de la mise à jour" });
  }
});

module.exports = router;