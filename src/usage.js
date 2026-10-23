const number = new Intl.NumberFormat("fr-FR");

/** Entier lisible (1 234) ; « — » quand la valeur manque. */
export function formatCount(value) {
  return Number.isFinite(value) ? number.format(value) : "—";
}

const ZERO = { today: 0, last7Days: 0, last30Days: 0, total: 0, lastAt: null };
export const usageOf = (org) => org.aiResponses ?? ZERO;

export const SORTS = {
  recent: { label: "Plus récentes", compare: () => 0 },
  today: { label: "Plus de réponses aujourd'hui", compare: (a, b) => usageOf(b).today - usageOf(a).today },
  month: { label: "Plus de réponses (30 jours)", compare: (a, b) => usageOf(b).last30Days - usageOf(a).last30Days },
  total: { label: "Plus de réponses (total)", compare: (a, b) => usageOf(b).total - usageOf(a).total },
  quiet: { label: "Moins actives (30 jours)", compare: (a, b) => usageOf(a).last30Days - usageOf(b).last30Days },
};

/** Tri stable : à égalité, l'ordre d'origine (les plus récentes d'abord) est conservé. */
export function sortOrganizations(organizations, key) {
  const { compare } = SORTS[key] ?? SORTS.recent;
  return organizations.map((org, index) => ({ org, index })).sort((a, b) => compare(a.org, b.org) || a.index - b.index).map(({ org }) => org);
}

const csvCell = (value) => {
  const text = String(value ?? "");
  // Neutralise les formules (=, +, -, @) qu'un tableur exécuterait en ouvrant le fichier.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",;\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** Export tableur (séparateur « ; » pour Excel en français) : une ligne par entreprise. */
export function buildCsv(organizations) {
  const header = ["Entreprise", "Propriétaire", "Email", "Créée le", "Réponses IA aujourd'hui", "Réponses IA 7 jours", "Réponses IA 30 jours", "Réponses IA total", "Dernière réponse IA", "Forfait", "Messages utilisés", "Messages inclus", "WhatsApp", "Statut plateforme"];
  const rows = organizations.map((org) => {
    const usage = usageOf(org);
    return [
      org.name, org.owner?.name ?? "", org.owner?.email ?? "", org.createdAt ?? "",
      usage.today, usage.last7Days, usage.last30Days, usage.total, usage.lastAt ?? "",
      org.billing?.planName ?? "", org.billing?.messagesUsed ?? "", org.billing?.messageLimit ?? "",
      org.whatsapp?.status ?? "", org.platformSuspended ? "Suspendue" : "Autorisée",
    ];
  });
  return `﻿${[header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
}

/** Hauteur (0 à 100) d'une barre du graphique par rapport au plus grand jour. */
export function barPercent(count, max) {
  if (!max || count <= 0) return 0;
  return Math.max(4, Math.round((count / max) * 100));
}
