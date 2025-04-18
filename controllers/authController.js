const { createUser, getUserByEmail } = require("../models/user");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
dotenv.config();

const authController = {
  register: async (req, res) => {
    const { nom, email, password } = req.body; // Plus de role ici
    try {
      // Vérifie si l'email existe déjà
      const existingUser = await getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "Cet email est déjà utilisé" });
      }

      // Validation des champs
      if (!nom || !email || !password) {
        return res.status(400).json({ error: "Tous les champs sont requis" });
      }
      if (!/\S+@\S+\.\S+/.test(email)) {
        return res.status(400).json({ error: "Email invalide" });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: "Le mot de passe doit avoir au moins 6 caractères" });
      }

      // Crée l'utilisateur avec role "proprietaire" par défaut
      const newUser = await createUser(nom, email, password, "proprietaire");
      console.log("Utilisateur créé:", newUser); // Log pour debug
      res.status(201).json({ message: "Utilisateur créé avec succès", user: newUser });
    } catch (error) {
      console.error("Erreur lors de l’inscription:", error);
      res.status(500).json({ error: "Erreur serveur lors de l’inscription" });
    }
  },

  login: async (req, res) => {
    const { email, password } = req.body;
    try {
      console.log("Tentative de connexion:", { email }); // Log avant recherche
      const user = await getUserByEmail(email);
      if (!user) {
        console.log("Utilisateur non trouvé pour:", email);
        return res.status(401).json({ error: "Utilisateur non trouvé" });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        console.log("Mot de passe incorrect pour:", email);
        return res.status(401).json({ error: "Mot de passe incorrect" });
      }

      // Génère un token JWT
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "2h" }
      );

      const response = {
        message: "Connexion réussie",
        token,
        user: { id: user.id, nom: user.nom, email: user.email, role: user.role },
      };

      console.log("Connexion réussie:", { email, token }); // Log succès
      res.json(response);
    } catch (error) {
      console.error("Erreur lors de la connexion:", error);
      res.status(500).json({ error: "Erreur serveur lors de la connexion" });
    }
  },
};

module.exports = authController;