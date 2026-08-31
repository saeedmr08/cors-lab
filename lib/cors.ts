/**
 * CORS Lab — synthetic browser CORS decision engine.
 * Models Fetch CORS checks for education; not a live network client.
 */

export type HttpMethod =
  | "GET"
  | "HEAD"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "OPTIONS";

export interface CorsBrowserRequest {
  /** Page origin making the request, e.g. https://app.example */
  origin: string;
  method: HttpMethod;
  /** Corresponds to fetch credentials: "include" when true */
  credentials: boolean;
  /** Non-simple request headers the page wants to send */
  extraHeaders: string[];
}

/** What the resource (server) claims it will allow */
export interface CorsServerPolicy {
  /** Access-Control-Allow-Origin value, or null if the header is absent */
  allowOrigin: string | null;
  /** Access-Control-Allow-Credentials: true */
  allowCredentials: boolean;
  /** Access-Control-Allow-Methods (used for preflight) */
  allowMethods: HttpMethod[];
  /** Access-Control-Allow-Headers (used for preflight) */
  allowHeaders: string[];
}

export type CorsVerdict = "allow" | "deny";

export interface PreflightStep {
  performed: boolean;
  method: "OPTIONS";
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  verdict: CorsVerdict;
  notes: string[];
}

export interface ActualRequestStep {
  method: HttpMethod;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  verdict: CorsVerdict;
  notes: string[];
}

export interface CorsEvaluation {
  verdict: CorsVerdict;
  requiresPreflight: boolean;
  preflight: PreflightStep;
  actual: ActualRequestStep;
  /** Short machine-friendly reason codes */
  reasons: string[];
  /** Human explanations tied to real CORS rules */
  explanations: string[];
}

const SIMPLE_METHODS = new Set<HttpMethod>(["GET", "HEAD", "POST"]);

/** CORS-safelisted request headers (name only; Content-Type value not modeled here) */
const SAFELISTED_HEADER_NAMES = new Set([
  "accept",
  "accept-language",
  "content-language",
  "content-type",
]);

function normalizeHeader(name: string): string {
  return name.trim().toLowerCase();
}

function uniqueNormalized(headers: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const h of headers) {
    const n = normalizeHeader(h);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

/**
 * A request is "non-simple" (and needs a CORS preflight) when the method is
 * outside the simple set or when any header is not CORS-safelisted.
 */
export function requiresPreflight(request: CorsBrowserRequest): boolean {
  if (!SIMPLE_METHODS.has(request.method)) {
    return true;
  }
  for (const header of uniqueNormalized(request.extraHeaders)) {
    if (!SAFELISTED_HEADER_NAMES.has(header)) {
      return true;
    }
  }
  return false;
}

function originMatches(
  requestOrigin: string,
  allowOrigin: string | null,
): { ok: boolean; code: string; text: string } {
  if (allowOrigin === null || allowOrigin === "") {
    return {
      ok: false,
      code: "missing-allow-origin",
      text: "Access-Control-Allow-Origin is missing. The browser blocks the response from JS.",
    };
  }
  if (allowOrigin === "*") {
    return {
      ok: true,
      code: "wildcard-origin",
      text: "Access-Control-Allow-Origin is *. Allowed only when credentials are not included.",
    };
  }
  if (allowOrigin === requestOrigin) {
    return {
      ok: true,
      code: "exact-origin",
      text: `Access-Control-Allow-Origin exactly mirrors the request Origin (${requestOrigin}).`,
    };
  }
  return {
    ok: false,
    code: "origin-mismatch",
    text: `Access-Control-Allow-Origin (${allowOrigin}) does not match Origin (${requestOrigin}).`,
  };
}

function evaluateCredentials(
  credentials: boolean,
  allowOrigin: string | null,
  allowCredentials: boolean,
): { ok: boolean; codes: string[]; texts: string[] } {
  const codes: string[] = [];
  const texts: string[] = [];

  if (!credentials) {
    codes.push("no-credentials");
    texts.push(
      "credentials mode is omit/same-origin — Access-Control-Allow-Credentials is not required.",
    );
    return { ok: true, codes, texts };
  }

  if (allowOrigin === "*") {
    codes.push("wildcard-with-credentials");
    texts.push(
      "Invalid: browsers reject Access-Control-Allow-Origin: * when the request uses credentials. The server must echo a specific origin.",
    );
    return { ok: false, codes, texts };
  }

  if (!allowCredentials) {
    codes.push("credentials-not-allowed");
    texts.push(
      "Credentialed requests require Access-Control-Allow-Credentials: true.",
    );
    return { ok: false, codes, texts };
  }

  codes.push("credentials-ok");
  texts.push(
    "Credentialed request with a concrete Allow-Origin and Allow-Credentials: true.",
  );
  return { ok: true, codes, texts };
}

function methodAllowed(
  method: HttpMethod,
  allowMethods: HttpMethod[],
): { ok: boolean; code: string; text: string } {
  if (allowMethods.map((m) => m.toUpperCase()).includes(method)) {
    return {
      ok: true,
      code: "method-allowed",
      text: `Method ${method} appears in Access-Control-Allow-Methods.`,
    };
  }
  return {
    ok: false,
    code: "method-not-allowed",
    text: `Method ${method} is not listed in Access-Control-Allow-Methods (${allowMethods.join(", ") || "∅"}).`,
  };
}

function headersAllowed(
  requested: string[],
  allowHeaders: string[],
): { ok: boolean; code: string; text: string; blocked: string[] } {
  const allowed = new Set(allowHeaders.map(normalizeHeader));
  const blocked = requested.filter((h) => !allowed.has(h));
  if (blocked.length === 0) {
    return {
      ok: true,
      code: "headers-allowed",
      text:
        requested.length === 0
          ? "No non-safelisted headers on the preflight."
          : `All requested headers are covered by Access-Control-Allow-Headers.`,
      blocked: [],
    };
  }
  return {
    ok: false,
    code: "headers-not-allowed",
    text: `Preflight failed: header(s) not allowed — ${blocked.join(", ")}.`,
    blocked,
  };
}

function buildAcaoMap(policy: CorsServerPolicy): Record<string, string> {
  const headers: Record<string, string> = {};
  if (policy.allowOrigin !== null && policy.allowOrigin !== "") {
    headers["Access-Control-Allow-Origin"] = policy.allowOrigin;
  }
  if (policy.allowCredentials) {
    headers["Access-Control-Allow-Credentials"] = "true";
  }
  return headers;
}

/**
 * Evaluate a synthetic CORS exchange: optional OPTIONS preflight, then the
 * actual request, applying the same Allow/Deny rules browsers enforce.
 */
export function evaluateCors(
  request: CorsBrowserRequest,
  policy: CorsServerPolicy,
): CorsEvaluation {
  const extra = uniqueNormalized(request.extraHeaders);
  const needsPreflight = requiresPreflight(request);
  const reasons: string[] = [];
  const explanations: string[] = [];

  const preflightRequestHeaders: Record<string, string> = {
    Origin: request.origin,
    "Access-Control-Request-Method": request.method,
  };
  if (extra.length > 0) {
    preflightRequestHeaders["Access-Control-Request-Headers"] = extra.join(", ");
  }

  const preflightResponseHeaders: Record<string, string> = {
    ...buildAcaoMap(policy),
    "Access-Control-Allow-Methods": policy.allowMethods.join(", "),
    "Access-Control-Allow-Headers":
      policy.allowHeaders.length > 0
        ? policy.allowHeaders.join(", ")
        : "(none)",
  };

  let preflightVerdict: CorsVerdict = "allow";
  const preflightNotes: string[] = [];

  if (needsPreflight) {
    explanations.push(
      "Non-simple request → browser sends OPTIONS preflight before the real call.",
    );

    const originCheck = originMatches(request.origin, policy.allowOrigin);
    reasons.push(originCheck.code);
    explanations.push(originCheck.text);
    preflightNotes.push(originCheck.text);
    if (!originCheck.ok) preflightVerdict = "deny";

    const credCheck = evaluateCredentials(
      request.credentials,
      policy.allowOrigin,
      policy.allowCredentials,
    );
    reasons.push(...credCheck.codes);
    explanations.push(...credCheck.texts);
    preflightNotes.push(...credCheck.texts);
    if (!credCheck.ok) preflightVerdict = "deny";

    const methodCheck = methodAllowed(request.method, policy.allowMethods);
    reasons.push(methodCheck.code);
    explanations.push(methodCheck.text);
    preflightNotes.push(methodCheck.text);
    if (!methodCheck.ok) preflightVerdict = "deny";

    const headerCheck = headersAllowed(extra, policy.allowHeaders);
    reasons.push(headerCheck.code);
    explanations.push(headerCheck.text);
    preflightNotes.push(headerCheck.text);
    if (!headerCheck.ok) preflightVerdict = "deny";
  } else {
    explanations.push(
      "Simple request (GET/HEAD/POST + safelisted headers) — no OPTIONS preflight.",
    );
    preflightNotes.push("Preflight skipped for a simple request.");
  }

  const actualResponseHeaders = buildAcaoMap(policy);
  const actualNotes: string[] = [];
  let actualVerdict: CorsVerdict = "allow";

  // Actual request CORS checks (also apply when preflight was skipped)
  if (needsPreflight && preflightVerdict === "deny") {
    actualVerdict = "deny";
    reasons.push("actual-skipped");
    explanations.push(
      "Actual request is not sent (or its response is not exposed) because preflight failed.",
    );
    actualNotes.push("Blocked by failed preflight — browser never exposes the response.");
  } else {
    const originCheck = originMatches(request.origin, policy.allowOrigin);
    if (!reasons.includes(originCheck.code)) {
      reasons.push(originCheck.code);
      explanations.push(originCheck.text);
    }
    actualNotes.push(originCheck.text);
    if (!originCheck.ok) actualVerdict = "deny";

    const credCheck = evaluateCredentials(
      request.credentials,
      policy.allowOrigin,
      policy.allowCredentials,
    );
    for (const c of credCheck.codes) {
      if (!reasons.includes(c)) {
        reasons.push(c);
        const idx = credCheck.codes.indexOf(c);
        explanations.push(credCheck.texts[idx]!);
      }
    }
    actualNotes.push(...credCheck.texts);
    if (!credCheck.ok) actualVerdict = "deny";
  }

  const overall: CorsVerdict =
    needsPreflight && preflightVerdict === "deny"
      ? "deny"
      : actualVerdict;

  if (overall === "allow") {
    reasons.push("cors-pass");
    explanations.push(
      "Browser allows the calling script to read the cross-origin response under these headers.",
    );
  } else {
    reasons.push("cors-fail");
    explanations.push(
      "Browser denies script access to the response (network may still complete; JS sees a CORS error).",
    );
  }

  return {
    verdict: overall,
    requiresPreflight: needsPreflight,
    preflight: {
      performed: needsPreflight,
      method: "OPTIONS",
      requestHeaders: needsPreflight ? preflightRequestHeaders : {},
      responseHeaders: needsPreflight ? preflightResponseHeaders : {},
      verdict: needsPreflight ? preflightVerdict : "allow",
      notes: preflightNotes,
    },
    actual: {
      method: request.method,
      requestHeaders: {
        Origin: request.origin,
        ...(request.credentials ? { Cookie: "(credentials included)" } : {}),
        ...Object.fromEntries(extra.map((h) => [h, "(value)"])),
      },
      responseHeaders: actualResponseHeaders,
      verdict: actualVerdict,
      notes: actualNotes,
    },
    reasons: [...new Set(reasons)],
    explanations,
  };
}

/** Named lab scenarios for the UI */
export type ScenarioId =
  | "simple-get"
  | "credentialed"
  | "wildcard-credentials"
  | "missing-allow-origin"
  | "method-not-allowed";

export interface LabScenario {
  id: ScenarioId;
  title: string;
  summary: string;
  request: CorsBrowserRequest;
  policy: CorsServerPolicy;
}

export const LAB_SCENARIOS: LabScenario[] = [
  {
    id: "simple-get",
    title: "Simple GET",
    summary: "Safelisted GET with a matching Allow-Origin — no preflight.",
    request: {
      origin: "https://notebook.lab",
      method: "GET",
      credentials: false,
      extraHeaders: [],
    },
    policy: {
      allowOrigin: "https://notebook.lab",
      allowCredentials: false,
      allowMethods: ["GET", "POST"],
      allowHeaders: [],
    },
  },
  {
    id: "credentialed",
    title: "Credentialed request",
    summary: "Cookies included; server echoes origin + Allow-Credentials.",
    request: {
      origin: "https://notebook.lab",
      method: "GET",
      credentials: true,
      extraHeaders: [],
    },
    policy: {
      allowOrigin: "https://notebook.lab",
      allowCredentials: true,
      allowMethods: ["GET"],
      allowHeaders: [],
    },
  },
  {
    id: "wildcard-credentials",
    title: "Wildcard + credentials",
    summary: "Invalid combo: * cannot pair with credentialed fetches.",
    request: {
      origin: "https://notebook.lab",
      method: "GET",
      credentials: true,
      extraHeaders: [],
    },
    policy: {
      allowOrigin: "*",
      allowCredentials: true,
      allowMethods: ["GET"],
      allowHeaders: [],
    },
  },
  {
    id: "missing-allow-origin",
    title: "Missing Allow-Origin",
    summary: "Server omits ACAO — browser treats the response as opaque to JS.",
    request: {
      origin: "https://notebook.lab",
      method: "GET",
      credentials: false,
      extraHeaders: [],
    },
    policy: {
      allowOrigin: null,
      allowCredentials: false,
      allowMethods: ["GET"],
      allowHeaders: [],
    },
  },
  {
    id: "method-not-allowed",
    title: "Method not allowed",
    summary: "PUT triggers preflight; Allow-Methods lacks PUT.",
    request: {
      origin: "https://notebook.lab",
      method: "PUT",
      credentials: false,
      extraHeaders: ["content-type"],
    },
    policy: {
      allowOrigin: "https://notebook.lab",
      allowCredentials: false,
      allowMethods: ["GET", "POST"],
      allowHeaders: ["content-type"],
    },
  },
];

export function getScenario(id: ScenarioId): LabScenario {
  const found = LAB_SCENARIOS.find((s) => s.id === id);
  if (!found) throw new Error(`Unknown scenario: ${id}`);
  return found;
}
