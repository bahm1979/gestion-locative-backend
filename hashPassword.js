const bcrypt = require("bcrypt");

const password = "admin123"; // Mot de passe en clair
const saltRounds = 10;

bcrypt.hash(password, saltRounds, (err, hash) => {
  if (err) {
    console.error("Erreur:", err);
  } else {
    console.log("Mot de passe hashé:", hash);
  }
});