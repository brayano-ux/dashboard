const WHY = {
  smtp_not_configured: "le SMTP n'est pas configuré sur le serveur (SMTP_HOST, SMTP_USER, SMTP_PASSWORD, SMTP_FROM)",
  no_admin: "aucun compte administrateur n'est rattaché à cette entreprise",
  failed: "le serveur d'emails a refusé l'envoi (vérifiez les identifiants SMTP dans les journaux Render)",
  pending: "l'envoi est encore en cours, vérifiez dans quelques instants",
};

/** Transforme la réponse de l'API en message lisible. `ok` vaut false quand l'email n'est pas parti. */
export function describeNotification(kind, notification) {
  const action = kind === "suspend" ? "IA suspendue" : "IA réactivée";
  if (!notification) {
    return { ok: true, message: `${action}. Aucun email envoyé : l'entreprise était déjà dans cet état.` };
  }
  if (notification.status === "sent") {
    const n = notification.sent;
    return { ok: true, message: `${action}. Email envoyé à ${n} administrateur${n > 1 ? "s" : ""} de l'entreprise.` };
  }
  if (notification.status === "partial") {
    return { ok: false, message: `${action}. Email envoyé à ${notification.sent} administrateur(s) sur ${notification.total} seulement.` };
  }
  return { ok: false, message: `${action}, mais aucun email n'est parti : ${WHY[notification.status] ?? "raison inconnue"}.` };
}
