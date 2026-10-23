import { describe, expect, it } from "vitest";
import { barPercent, buildCsv, formatCount, sortOrganizations } from "./usage.js";

const org = (name, last30Days, today = 0, total = last30Days) => ({ id: name, name, aiResponses: { today, last7Days: last30Days, last30Days, total, lastAt: null } });

describe("usage par entreprise", () => {
  it("formate les nombres à la française", () => {
    expect(formatCount(1234567).replace(/\s/g, " ")).toBe("1 234 567");
    expect(formatCount(undefined)).toBe("—");
  });

  it("trie par réponses de l'IA sans casser l'ordre d'origine à égalité", () => {
    const list = [org("A", 5), org("B", 50), org("C", 5), { id: "D", name: "D" }];
    expect(sortOrganizations(list, "month").map((o) => o.name)).toEqual(["B", "A", "C", "D"]);
    expect(sortOrganizations(list, "quiet").map((o) => o.name)).toEqual(["D", "A", "C", "B"]);
    expect(sortOrganizations(list, "recent").map((o) => o.name)).toEqual(["A", "B", "C", "D"]);
    expect(sortOrganizations(list, "inconnu").map((o) => o.name)).toEqual(["A", "B", "C", "D"]);
  });

  it("exporte un CSV sûr pour un tableur", () => {
    const csv = buildCsv([{ ...org("=cmd|'/c calc'!A1", 3, 1, 9), owner: { name: 'Awa "la" patronne', email: "awa@example.com" }, platformSuspended: true }]);
    const [header, line] = csv.replace("﻿", "").split("\r\n");
    expect(header.split(";")).toHaveLength(14);
    expect(line).toContain("'=cmd|'/c calc'!A1"); // formule neutralisée
    expect(line).toContain('"Awa ""la"" patronne"');
    expect(line).toContain(";1;3;3;9;");
    expect(line.endsWith("Suspendue")).toBe(true);
  });

  it("calcule la hauteur des barres du graphique", () => {
    expect(barPercent(0, 10)).toBe(0);
    expect(barPercent(10, 10)).toBe(100);
    expect(barPercent(1, 100)).toBe(4);
    expect(barPercent(5, 0)).toBe(0);
  });
});
