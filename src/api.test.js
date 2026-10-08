import { describe, expect, it, vi } from "vitest";
import { ApiError, createAdminApi, normalizeBaseUrl } from "./api.js";

const json = (status, body) => ({ ok: status < 400, status, json: async () => body });

describe("admin api", () => {
  it("normalizes the base url", () => {
    expect(normalizeBaseUrl(" https://api.example.com/// ")).toBe("https://api.example.com");
  });

  it("sends the bearer token and returns organizations", async () => {
    const fetchImpl = vi.fn(async () => json(200, { organizations: [{ id: "o1" }] }));
    const api = createAdminApi({ baseUrl: "https://api.example.com/", token: "secret", fetchImpl });
    await expect(api.listOrganizations()).resolves.toEqual([{ id: "o1" }]);
    expect(fetchImpl).toHaveBeenCalledWith("https://api.example.com/admin/organizations", {
      headers: { Authorization: "Bearer secret" },
    });
  });

  it("posts the suspension reason", async () => {
    const fetchImpl = vi.fn(async () => json(200, {}));
    const api = createAdminApi({ baseUrl: "https://api.example.com", token: "secret", fetchImpl });
    await api.suspend("o 1", "Impayé");
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.example.com/admin/organizations/o%201/suspend");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({ reason: "Impayé" });
  });

  it("maps 401 and 503 to clear messages", async () => {
    const api401 = createAdminApi({ baseUrl: "x", token: "t", fetchImpl: async () => json(401, { message: "Non autorisé." }) });
    await expect(api401.listOrganizations()).rejects.toMatchObject({ status: 401 });
    const api503 = createAdminApi({ baseUrl: "x", token: "t", fetchImpl: async () => json(503, {}) });
    await expect(api503.listOrganizations()).rejects.toThrow(/PLATFORM_ADMIN_TOKEN/);
  });

  it("reports network failures", async () => {
    const api = createAdminApi({ baseUrl: "x", token: "t", fetchImpl: async () => { throw new TypeError("fail"); } });
    await expect(api.listOrganizations()).rejects.toBeInstanceOf(ApiError);
  });
});
