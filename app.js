const express = require("express");
const cors = require("cors");
const biensRoutes = require("./routes/biensRoutes");
const locatairesRoutes = require("./routes/locatairesRoutes");
const paiementsRoutes = require("./routes/paiementsRoutes");
const contratsRoutes = require("./routes/contratsRoutes");

const app = express();

app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:5174"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type"],
}));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] Requête : ${req.method} ${req.url} depuis ${req.headers.origin}`);
  next();
});

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Bienvenue sur l'API de Gestion Locative ! Endpoints : /biens, /locataires, /paiements, /contrats");
});

app.use("/", biensRoutes);
app.use("/", locatairesRoutes);
app.use("/", paiementsRoutes);
app.use("/", contratsRoutes);

module.exports = app;


// backend/server.js (Ajout des routes d'authentification et sécurisées)
const authRoutes = require("./routes/authRoutes");
const protectedRoutes = require("./routes/protectedRoutes");
app.use("/auth", authRoutes);
app.use("/protected", protectedRoutes);
