const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("Aucun token fourni dans l’en-tête:", req.headers);
    return res.status(401).json({ error: "Aucun token fourni" });
  }

  const token = authHeader.split(" ")[1];
  console.log("Token reçu:", token);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Token décodé:", decoded);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("Erreur vérification token:", err);
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expiré" });
    }
    return res.status(401).json({ error: "Token invalide" });
  }
};

module.exports = { authMiddleware };