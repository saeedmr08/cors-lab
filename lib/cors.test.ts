import { describe, expect, it } from "vitest";
import {
  evaluateCors,
  getScenario,
  requiresPreflight,
  type CorsBrowserRequest,
  type CorsServerPolicy,
} from "./cors";

const baseRequest = (
  overrides: Partial<CorsBrowserRequest> = {},
): CorsBrowserRequest => ({
  origin: "https://notebook.lab",
  method: "GET",
  credentials: false,
  extraHeaders: [],
  ...overrides,
});

const basePolicy = (
  overrides: Partial<CorsServerPolicy> = {},
): CorsServerPolicy => ({
  allowOrigin: "https://notebook.lab",
  allowCredentials: false,
  allowMethods: ["GET", "POST", "PUT"],
  allowHeaders: ["x-lab-token", "content-type"],
  ...overrides,
});

describe("requiresPreflight", () => {
  it("skips preflight for simple GET", () => {
    expect(requiresPreflight(baseRequest())).toBe(false);
  });

  it("requires preflight for PUT", () => {
    expect(requiresPreflight(baseRequest({ method: "PUT" }))).toBe(true);
  });

  it("requires preflight for custom headers", () => {
    expect(
      requiresPreflight(baseRequest({ extraHeaders: ["X-Lab-Token"] })),
    ).toBe(true);
  });
});

describe("evaluateCors allow cases", () => {
  it("allows simple GET with matching origin", () => {
    const result = evaluateCors(baseRequest(), basePolicy());
    expect(result.verdict).toBe("allow");
    expect(result.requiresPreflight).toBe(false);
    expect(result.reasons).toContain("exact-origin");
    expect(result.reasons).toContain("cors-pass");
  });

  it("allows credentialed request with echoed origin + Allow-Credentials", () => {
    const result = evaluateCors(
      baseRequest({ credentials: true }),
      basePolicy({ allowCredentials: true }),
    );
    expect(result.verdict).toBe("allow");
    expect(result.reasons).toContain("credentials-ok");
  });

  it("allows non-simple method when preflight lists method and headers", () => {
    const result = evaluateCors(
      baseRequest({ method: "PUT", extraHeaders: ["X-Lab-Token"] }),
      basePolicy(),
    );
    expect(result.requiresPreflight).toBe(true);
    expect(result.preflight.verdict).toBe("allow");
    expect(result.verdict).toBe("allow");
    expect(result.reasons).toContain("method-allowed");
  });

  it("allows wildcard origin without credentials", () => {
    const result = evaluateCors(
      baseRequest(),
      basePolicy({ allowOrigin: "*" }),
    );
    expect(result.verdict).toBe("allow");
    expect(result.reasons).toContain("wildcard-origin");
  });
});

describe("evaluateCors deny cases", () => {
  it("denies missing Access-Control-Allow-Origin", () => {
    const result = evaluateCors(
      baseRequest(),
      basePolicy({ allowOrigin: null }),
    );
    expect(result.verdict).toBe("deny");
    expect(result.reasons).toContain("missing-allow-origin");
  });

  it("denies origin mismatch", () => {
    const result = evaluateCors(
      baseRequest({ origin: "https://other.lab" }),
      basePolicy({ allowOrigin: "https://notebook.lab" }),
    );
    expect(result.verdict).toBe("deny");
    expect(result.reasons).toContain("origin-mismatch");
  });

  it("denies wildcard + credentials (invalid)", () => {
    const result = evaluateCors(
      baseRequest({ credentials: true }),
      basePolicy({ allowOrigin: "*", allowCredentials: true }),
    );
    expect(result.verdict).toBe("deny");
    expect(result.reasons).toContain("wildcard-with-credentials");
  });

  it("denies credentials without Allow-Credentials", () => {
    const result = evaluateCors(
      baseRequest({ credentials: true }),
      basePolicy({ allowCredentials: false }),
    );
    expect(result.verdict).toBe("deny");
    expect(result.reasons).toContain("credentials-not-allowed");
  });

  it("denies when method is not in Allow-Methods", () => {
    const result = evaluateCors(
      baseRequest({ method: "DELETE" }),
      basePolicy({ allowMethods: ["GET", "POST"] }),
    );
    expect(result.requiresPreflight).toBe(true);
    expect(result.preflight.verdict).toBe("deny");
    expect(result.verdict).toBe("deny");
    expect(result.reasons).toContain("method-not-allowed");
  });

  it("denies when a requested header is not allowed", () => {
    const result = evaluateCors(
      baseRequest({ method: "POST", extraHeaders: ["X-Secret"] }),
      basePolicy({ allowHeaders: ["content-type"] }),
    );
    expect(result.preflight.verdict).toBe("deny");
    expect(result.verdict).toBe("deny");
    expect(result.reasons).toContain("headers-not-allowed");
  });
});

describe("lab scenarios", () => {
  it("simple-get allows", () => {
    const s = getScenario("simple-get");
    expect(evaluateCors(s.request, s.policy).verdict).toBe("allow");
  });

  it("credentialed allows", () => {
    const s = getScenario("credentialed");
    expect(evaluateCors(s.request, s.policy).verdict).toBe("allow");
  });

  it("wildcard-credentials denies", () => {
    const s = getScenario("wildcard-credentials");
    const r = evaluateCors(s.request, s.policy);
    expect(r.verdict).toBe("deny");
    expect(r.reasons).toContain("wildcard-with-credentials");
  });

  it("missing-allow-origin denies", () => {
    const s = getScenario("missing-allow-origin");
    expect(evaluateCors(s.request, s.policy).verdict).toBe("deny");
  });

  it("method-not-allowed denies", () => {
    const s = getScenario("method-not-allowed");
    const r = evaluateCors(s.request, s.policy);
    expect(r.verdict).toBe("deny");
    expect(r.reasons).toContain("method-not-allowed");
  });
});
