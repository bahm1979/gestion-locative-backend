const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");
require("dotenv").config();

// Configurer Nodemailer
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Formatage des nombres (ex. 5 000 000 GNF)
const formatNumber = (value) => {
  return value.toLocaleString("fr-FR") + " GNF";
};

// Formatage des dates (ex. 30 avril 2025)
const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

// GET /contrats - Liste tous les contrats
router.get("/", async (req, res) => {
  try {
    const db = req.app.locals.db;
    const [contrats] = await db.query(`
      SELECT c.id, c.appartement_id, c.locataire_id, c.date_debut, c.date_fin, c.loyer_mensuel, c.caution, c.statut,
             a.numero AS appartement_numero, l.nom AS locataire_nom
      FROM contrats c
      LEFT JOIN appartements a ON c.appartement_id = a.id
      LEFT JOIN locataires l ON c.locataire_id = l.id
    `);
    const formattedContrats = contrats.map(contrat => ({
      ...contrat,
      loyer_mensuel: Number(contrat.loyer_mensuel),
      caution: Number(contrat.caution),
    }));
    console.log("Contrats renvoyés:", formattedContrats);
    res.json(formattedContrats);
  } catch (err) {
    console.error("Erreur dans GET /contrats:", err);
    res.status(500).json({ error: "Erreur serveur lors du chargement des contrats" });
  }
});

// POST /contrats - Ajouter un contrat
router.post("/", async (req, res) => {
  const { appartement_id, locataire_id, date_debut, date_fin, loyer_mensuel, caution } = req.body;

  if (!appartement_id || !locataire_id || !date_debut || !loyer_mensuel || caution === undefined) {
    return res.status(400).json({ error: "appartement_id, locataire_id, date_debut, loyer_mensuel et caution sont obligatoires" });
  }

  const parsedLoyer = parseFloat(loyer_mensuel);
  const parsedCaution = parseFloat(caution);
  if (isNaN(parsedLoyer) || parsedLoyer < 0) {
    return res.status(400).json({ error: "Le loyer_mensuel doit être un nombre positif" });
  }
  if (isNaN(parsedCaution) || parsedCaution < 0) {
    return res.status(400).json({ error: "La caution doit être un nombre positif ou zéro" });
  }

  try {
    const db = req.app.locals.db;

    const [appartements] = await db.query("SELECT id, numero FROM appartements WHERE id = ?", [appartement_id]);
    if (appartements.length === 0) {
      return res.status(400).json({ error: "Appartement invalide" });
    }

    const [locataires] = await db.query("SELECT id, nom, email FROM locataires WHERE id = ?", [locataire_id]);
    if (locataires.length === 0) {
      return res.status(400).json({ error: "Locataire invalide" });
    }

    const [existingContrats] = await db.query(
      "SELECT id FROM contrats WHERE appartement_id = ? AND (date_fin IS NULL OR statut = 'actif')",
      [appartement_id]
    );
    if (existingContrats.length > 0) {
      return res.status(409).json({ error: "Un contrat actif existe déjà pour cet appartement" });
    }

    const [result] = await db.query(
      "INSERT INTO contrats (appartement_id, locataire_id, date_debut, date_fin, loyer_mensuel, caution, statut) VALUES (?, ?, ?, ?, ?, ?, 'actif')",
      [appartement_id, locataire_id, date_debut, date_fin || null, parsedLoyer, parsedCaution]
    );

    const newContrat = {
      id: result.insertId,
      appartement_id,
      locataire_id,
      date_debut,
      date_fin,
      loyer_mensuel: parsedLoyer,
      caution: parsedCaution,
      statut: 'actif',
    };

    // Envoyer l'email
    try {
      const mailOptions = {
        from: '"Gestion Locative" <' + process.env.EMAIL_USER + '>',
        to: locataires[0].email,
        subject: `Nouveau contrat signé - Appartement ${appartements[0].numero}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2e7d32;">Nouveau contrat</h2>
            <p>Bonjour ${locataires[0].nom},</p>
            <p>Nous vous confirmons la signature de votre contrat pour l'appartement <strong>${appartements[0].numero}</strong>.</p>
            <p><strong>Date de début :</strong> ${formatDate(date_debut)}</p>
            ${date_fin ? `<p><strong>Date de fin :</strong> ${formatDate(date_fin)}</p>` : ""}
            <p><strong>Loyer mensuel :</strong> ${formatNumber(parsedLoyer)}</p>
            <p><strong>Caution :</strong> ${formatNumber(parsedCaution)}</p>
            <p>Bienvenue ! Pour toute question, contactez-nous.</p>
            <p style="margin-top: 20px;">Cordialement,<br>L'équipe de gestion locative</p>
            <p><a href="mailto:bahmmouctar@gmail.com">bahmmouctar@gmail.com</a> | +32 492 18 39 44</p>
          </div>
        `,
      };
      await transporter.sendMail(mailOptions);
      console.log(`Email envoyé à ${locataires[0].email}`);
    } catch (emailErr) {
      console.error("Erreur lors de l'envoi de l'email:", emailErr);
      // Ne pas bloquer si l'email échoue
    }

    console.log("Contrat ajouté:", newContrat);
    res.status(201).json(newContrat);
  } catch (err) {
    console.error("Erreur dans POST /contrats:", err);
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Un contrat actif existe déjà pour cet appartement" });
    }
    res.status(500).json({ error: "Erreur serveur lors de l’ajout du contrat", details: err.message });
  }
});

// PUT /contrats/:id - Mettre à jour un contrat
router.put("/:id", async (req, res) => {
  const { appartement_id, locataire_id, date_debut, date_fin, loyer_mensuel, caution, statut } = req.body;
  const { id } = req.params;

  if (!appartement_id || !locataire_id || !date_debut || !loyer_mensuel || caution === undefined) {
    return res.status(400).json({ error: "appartement_id, locataire_id, date_debut, loyer_mensuel et caution sont obligatoires" });
  }

  const parsedLoyer = parseFloat(loyer_mensuel);
  const parsedCaution = parseFloat(caution);
  if (isNaN(parsedLoyer) || parsedLoyer < 0) {
    return res.status(400).json({ error: "Le loyer_mensuel doit être un nombre positif" });
  }
  if (isNaN(parsedCaution) || parsedCaution < 0) {
    return res.status(400).json({ error: "La caution doit être un nombre positif ou zéro" });
  }

  try {
    const db = req.app.locals.db;

    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId)) {
      return res.status(400).json({ error: "ID invalide, doit être un nombre" });
    }

    const [appartements] = await db.query("SELECT id, numero FROM appartements WHERE id = ?", [appartement_id]);
    if (appartements.length === 0) {
      return res.status(400).json({ error: "Appartement invalide" });
    }

    const [locataires] = await db.query("SELECT id, nom, email FROM locataires WHERE id = ?", [locataire_id]);
    if (locataires.length === 0) {
      return res.status(400).json({ error: "Locataire invalide" });
    }

    const [existingContrats] = await db.query(
      "SELECT id FROM contrats WHERE appartement_id = ? AND (date_fin IS NULL OR statut = 'actif') AND id != ?",
      [appartement_id, parsedId]
    );
    if (existingContrats.length > 0) {
      return res.status(409).json({ error: "Un autre contrat actif existe déjà pour cet appartement" });
    }

    const [result] = await db.query(
      "UPDATE contrats SET appartement_id = ?, locataire_id = ?, date_debut = ?, date_fin = ?, loyer_mensuel = ?, caution = ?, statut = ? WHERE id = ?",
      [appartement_id, locataire_id, date_debut, date_fin || null, parsedLoyer, parsedCaution, statut || 'actif', parsedId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Contrat non trouvé" });
    }

    const updatedContrat = {
      id: parsedId,
      appartement_id,
      locataire_id,
      date_debut,
      date_fin,
      loyer_mensuel: parsedLoyer,
      caution: parsedCaution,
      statut: statut || 'actif',
    };

    // Envoyer l'email
    try {
      const mailOptions = {
        from: '"Gestion Locative" <' + process.env.EMAIL_USER + '>',
        to: locataires[0].email,
        subject: `Mise à jour du contrat - Appartement ${appartements[0].numero}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2e7d32;">Mise à jour de contrat</h2>
            <p>Bonjour ${locataires[0].nom},</p>
            <p>Votre contrat pour l'appartement <strong>${appartements[0].numero}</strong> a été mis à jour :</p>
            <p><strong>Date de début :</strong> ${formatDate(date_debut)}</p>
            ${date_fin ? `<p><strong>Date de fin :</strong> ${formatDate(date_fin)}</p>` : ""}
            <p><strong>Loyer mensuel :</strong> ${formatNumber(parsedLoyer)}</p>
            <p><strong>Caution :</strong> ${formatNumber(parsedCaution)}</p>
            <p><strong>Statut :</strong> ${statut || 'actif'}</p>
            <p>Pour toute question, contactez-nous.</p>
            <p style="margin-top: 20px;">Cordialement,<br>L'équipe de gestion locative</p>
            <p><a href="mailto:bahmmouctar@gmail.com">bahmmouctar@gmail.com</a> | +32 492 18 39 44</p>
          </div>
        `,
      };
      await transporter.sendMail(mailOptions);
      console.log(`Email envoyé à ${locataires[0].email}`);
    } catch (emailErr) {
      console.error("Erreur lors de l'envoi de l'email:", emailErr);
      // Ne pas bloquer si l'email échoue
    }

    console.log("Contrat mis à jour:", updatedContrat);
    res.json(updatedContrat);
  } catch (err) {
    console.error("Erreur dans PUT /contrats/:id:", err);
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Un contrat actif existe déjà pour cet appartement" });
    }
    res.status(500).json({ error: "Erreur serveur lors de la mise à jour du contrat", details: err.message });
  }
});

// DELETE /contrats/:id - Supprimer un contrat
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const db = req.app.locals.db;

  try {
    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId)) {
      return res.status(400).json({ error: "ID invalide, doit être un nombre" });
    }

    const [result] = await db.query("DELETE FROM contrats WHERE id = ?", [parsedId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Contrat non trouvé" });
    }

    console.log(`Contrat ID ${parsedId} supprimé avec succès`);
    res.status(204).send();
  } catch (err) {
    console.error("Erreur dans DELETE /contrats/:id:", err);
    res.status(500).json({ error: "Erreur serveur lors de la suppression du contrat", details: err.message });
  }
});

// POST /contrats/:id/sortie - Gérer la sortie d’un locataire
router.post("/:id/sortie", async (req, res) => {
  const { id } = req.params;
  const { dateSortie, motif, commentaireEtatLieux, montantRestitue, commentaireRestitution } = req.body;
  const db = req.app.locals.db;

  // Validation des entrées
  if (!motif || !["fin_contrat", "resiliation"].includes(motif)) {
    return res.status(400).json({ error: "Le motif doit être 'fin_contrat' ou 'resiliation'" });
  }
  const parsedId = parseInt(id, 10);
  if (isNaN(parsedId)) {
    return res.status(400).json({ error: "ID invalide, doit être un nombre" });
  }
  if (montantRestitue !== undefined && (isNaN(montantRestitue) || montantRestitue < 0)) {
    return res.status(400).json({ error: "Le montant restitué doit être un nombre positif ou zéro" });
  }

  try {
    // Vérifier si le contrat existe
    const [contrats] = await db.query(`
      SELECT c.*, a.numero AS appartement_numero, i.monnaie
      FROM contrats c
      LEFT JOIN appartements a ON c.appartement_id = a.id
      LEFT JOIN etages e ON a.etage_id = e.id
      LEFT JOIN immeubles i ON e.immeuble_id = i.id
      WHERE c.id = ?
    `, [parsedId]);
    if (contrats.length === 0) {
      return res.status(404).json({ error: "Contrat non trouvé" });
    }
    const contrat = contrats[0];

    // Vérifier si le contrat est déjà terminé
    if (contrat.statut === "termine" || contrat.statut === "resilie") {
      return res.status(400).json({ error: "Le contrat est déjà terminé ou résilié" });
    }

    // Vérifier les impayés (avertissement, pas de blocage)
    const [impayes] = await db.query(
      "SELECT SUM(montant) as total FROM paiements WHERE contrat_id = ? AND est_paye = FALSE",
      [parsedId]
    );
    const totalImpayes = Number(impayes[0].total) || 0;
    let avertissementImpayes = null;
    if (totalImpayes > 0) {
      avertissementImpayes = `Attention : ${totalImpayes.toLocaleString("fr-FR")} GNF d'impayés détectés`;
      console.warn(avertissementImpayes);
    }

    // Calculer la date de sortie
    let finalDateSortie;
    console.log("dateSortie reçue:", dateSortie);
    if (motif === "resiliation") {
      const dateDemande = new Date();
      const minDateSortie = new Date(dateDemande.setMonth(dateDemande.getMonth() + 1));
      if (dateSortie) {
        const providedDate = new Date(dateSortie);
        if (providedDate < minDateSortie) {
          return res.status(400).json({ error: "La date de résiliation doit être après le préavis d'un mois" });
        }
        finalDateSortie = providedDate.toISOString().split("T")[0];
      } else {
        finalDateSortie = minDateSortie.toISOString().split("T")[0];
      }
    } else {
      // fin_contrat
      finalDateSortie = dateSortie || contrat.date_fin || new Date().toISOString().split("T")[0];
      if (dateSortie) {
        const providedDate = new Date(dateSortie);
        if (providedDate < new Date()) {
          return res.status(400).json({ error: "La date de fin de contrat ne peut pas être antérieure à aujourd'hui" });
        }
      }
    }
    console.log("finalDateSortie calculée:", finalDateSortie);

    // Gérer la caution
    const caution = Number(contrat.caution);
    let restitutionId = null;
    if (caution > 0 && montantRestitue !== undefined) {
      const montant = parseFloat(montantRestitue);
      if (montant > caution) {
        return res.status(400).json({ error: "Le montant restitué ne peut pas dépasser la caution" });
      }
      const [restitutionResult] = await db.query(
        "INSERT INTO restitutions (contrat_id, montant_restitue, date_restitution, commentaire) VALUES (?, ?, ?, ?)",
        [parsedId, montant, finalDateSortie, commentaireRestitution || null]
      );
      restitutionId = restitutionResult.insertId;
      console.log(`Caution restituée : ${montant} pour contrat ${parsedId}`);
    }

    // Gérer l’état des lieux
    let etatLieuxId = null;
    if (commentaireEtatLieux) {
      const [etatLieuxResult] = await db.query(
        "INSERT INTO etats_lieux (contrat_id, type, date, commentaire) VALUES (?, 'sortie', ?, ?)",
        [parsedId, finalDateSortie, commentaireEtatLieux]
      );
      etatLieuxId = etatLieuxResult.insertId;
      console.log(`État des lieux de sortie enregistré pour contrat ${parsedId}`);
    }

    // Mettre à jour le contrat
    const newStatut = motif === "resiliation" ? "resilie" : "termine";
    const [result] = await db.query(
      "UPDATE contrats SET date_fin = ?, statut = ? WHERE id = ?",
      [finalDateSortie, newStatut, parsedId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Échec de la mise à jour du contrat" });
    }

    // Envoyer un email au locataire
    const [locataire] = await db.query("SELECT email, nom FROM locataires WHERE id = ?", [contrat.locataire_id]);
    if (locataire.length > 0) {
      try {
        const formattedDate = new Date(finalDateSortie).toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
        const formattedMontant = montantRestitue
          ? `${Number(montantRestitue).toLocaleString("fr-FR")} GNF`
          : "";
        await transporter.sendMail({
          from: '"Gestion Locative" <' + process.env.EMAIL_USER + '>',
          to: locataire[0].email,
          subject: `Confirmation de fin de contrat - Appartement ${contrat.appartement_numero}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #2e7d32;">Fin de contrat</h2>
              <p>Bonjour ${locataire[0].nom},</p>
              <p>Nous vous confirmons que votre contrat pour l'appartement <strong>${contrat.appartement_numero}</strong> prend fin le <strong>${formattedDate}</strong>.</p>
              ${
                restitutionId
                  ? `<p>Une restitution de caution de <strong>${formattedMontant}</strong> a été enregistrée.</p>`
                  : "<p>Aucune restitution de caution n'a été enregistrée.</p>"
              }
              ${
                totalImpayes > 0
                  ? `<p><strong>Attention :</strong> un montant de <strong>${totalImpayes.toLocaleString("fr-FR")} GNF</strong> d'impayés reste à régler. Veuillez nous contacter pour régulariser la situation.</p>`
                  : "<p>Aucun impayé n'est enregistré.</p>"
              }
              <p>Nous vous remercions pour votre séjour et restons à votre disposition pour toute question.</p>
              <p style="margin-top: 20px;">Cordialement,<br>L'équipe de gestion locative</p>
              <p><a href="mailto:bahmmouctar@gmail.com">bahmmouctar@gmail.com</a> | +32 492 18 39 44</p>
            </div>
          `,
        });
        console.log(`Email envoyé à ${locataire[0].email}`);
      } catch (emailErr) {
        console.error("Erreur lors de l'envoi de l'email:", emailErr);
        // Ne pas bloquer la réponse si l'email échoue
      }
    }

    // Construire la réponse
    const updatedContrat = {
      id: parsedId,
      appartement_id: contrat.appartement_id,
      locataire_id: contrat.locataire_id,
      date_debut: contrat.date_debut,
      date_fin: finalDateSortie,
      loyer_mensuel: Number(contrat.loyer_mensuel),
      caution: Number(contrat.caution),
      statut: newStatut,
    };

    console.log("Sortie locataire enregistrée:", updatedContrat);
    res.status(200).json({
      message: "Sortie du locataire enregistrée",
      contrat: updatedContrat,
      avertissementImpayes,
      restitutionId,
      etatLieuxId,
    });
  } catch (err) {
    console.error("Erreur dans POST /contrats/:id/sortie:", err);
    res.status(500).json({ error: "Erreur serveur lors de la gestion de la sortie", details: err.message });
  }
});

module.exports = router;