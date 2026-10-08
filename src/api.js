export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function normalizeBaseUrl(value) {
  return String(value ?? "").trim().replace(/\/+$/, "");
}

/** Client de l'API /admin du backend. Le token n'est jamais écrit dans le build. */
export function createAdminApi({ baseUrl, token, fetchImpl = (...args) => fetch(...args) }) {
  const root = normalizeBaseUrl(baseUrl);

  async function request(path, options = {}) {
    let response;
    try {
      response = await fetchImpl(`${root}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(options.body ? { "Content-Type": "application/json" } : {}),
        },
      });
    } catch {
      throw new ApiError("Impossible de joindre le serveur. Vérifiez l'URL de l'API et CORS_ALLOWED_ORIGINS.", 0);
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const fallback = {
        401: "Token administrateur invalide.",
        503: "L'administration est désactivée : PLATFORM_ADMIN_TOKEN n'est pas configuré sur le serveur.",
      }[response.status] ?? "Une erreur est survenue.";
      throw new ApiError(payload.message || fallback, response.status);
    }
    return payload;
  }

  return {
    async listOrganizations() {
      const { organizations } = await request("/admin/organizations");
      return organizations;
    },
    suspend(organizationId, reason) {
      return request(`/admin/organizations/${encodeURIComponent(organizationId)}/suspend`, {
        method: "POST",
        body: JSON.stringify(reason ? { reason } : {}),
      });
    },
    unsuspend(organizationId) {
      return request(`/admin/organizations/${encodeURIComponent(organizationId)}/unsuspend`, { method: "POST" });
    },
  };
}
