import { describe, expect, it } from "vitest";
import { describeNotification } from "./notification.js";

describe("describeNotification", () => {
  it("confirms a delivered email", () => {
    expect(describeNotification("suspend", { status: "sent", sent: 2, total: 2 })).toEqual({ ok: true, message: "IA suspendue. Email envoyé à 2 administrateurs de l'entreprise." });
    expect(describeNotification("unsuspend", { status: "sent", sent: 1, total: 1 }).message).toBe("IA réactivée. Email envoyé à 1 administrateur de l'entreprise.");
  });

  it("explains why no email left", () => {
    const smtp = describeNotification("suspend", { status: "smtp_not_configured", sent: 0, total: 0 });
    expect(smtp.ok).toBe(false);
    expect(smtp.message).toContain("SMTP n'est pas configuré");
    expect(describeNotification("suspend", { status: "no_admin", sent: 0, total: 0 }).message).toContain("aucun compte administrateur");
    expect(describeNotification("suspend", { status: "failed", sent: 0, total: 2 }).message).toContain("a refusé l'envoi");
    expect(describeNotification("suspend", { status: "pending", sent: 0, total: 0 }).message).toContain("encore en cours");
  });

  it("reports a partial delivery as a warning", () => {
    expect(describeNotification("suspend", { status: "partial", sent: 1, total: 3 })).toEqual({ ok: false, message: "IA suspendue. Email envoyé à 1 administrateur(s) sur 3 seulement." });
  });

  it("handles an unchanged state", () => {
    expect(describeNotification("suspend", null)).toEqual({ ok: true, message: "IA suspendue. Aucun email envoyé : l'entreprise était déjà dans cet état." });
  });
});
