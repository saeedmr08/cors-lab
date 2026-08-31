"use client";

import { useEffect, useMemo, useState } from "react";
import {
  evaluateCors,
  LAB_SCENARIOS,
  type CorsBrowserRequest,
  type CorsServerPolicy,
  type HttpMethod,
  type ScenarioId,
} from "@/lib/cors";

const STORAGE_KEY = "cors-lab:last-scenario";

const METHODS: HttpMethod[] = [
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
];

function formatHeaders(headers: Record<string, string>): string {
  const entries = Object.entries(headers);
  if (entries.length === 0) return "(none)";
  return entries.map(([k, v]) => `${k}: ${v}`).join("\n");
}

function parseHeaderList(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseMethods(raw: string): HttpMethod[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim().toUpperCase())
    .filter((s): s is HttpMethod =>
      (METHODS as string[]).includes(s),
    );
}

type PersistedScenario = {
  activeScenario: ScenarioId | "custom";
  origin: string;
  method: HttpMethod;
  credentials: boolean;
  extraHeadersRaw: string;
  allowOrigin: string;
  allowCredentials: boolean;
  allowMethodsRaw: string;
  allowHeadersRaw: string;
};

function readStored(): PersistedScenario | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedScenario;
  } catch {
    return null;
  }
}

export default function HomePage() {
  const initial = LAB_SCENARIOS[0]!;
  const [activeScenario, setActiveScenario] = useState<ScenarioId | "custom">(
    initial.id,
  );
  const [origin, setOrigin] = useState(initial.request.origin);
  const [method, setMethod] = useState<HttpMethod>(initial.request.method);
  const [credentials, setCredentials] = useState(initial.request.credentials);
  const [extraHeadersRaw, setExtraHeadersRaw] = useState(
    initial.request.extraHeaders.join(", "),
  );
  const [allowOrigin, setAllowOrigin] = useState(
    initial.policy.allowOrigin ?? "",
  );
  const [allowCredentials, setAllowCredentials] = useState(
    initial.policy.allowCredentials,
  );
  const [allowMethodsRaw, setAllowMethodsRaw] = useState(
    initial.policy.allowMethods.join(", "),
  );
  const [allowHeadersRaw, setAllowHeadersRaw] = useState(
    initial.policy.allowHeaders.join(", "),
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readStored();
    if (stored) {
      if (stored.activeScenario === "custom") {
        setActiveScenario("custom");
        setOrigin(stored.origin);
        setMethod(stored.method);
        setCredentials(stored.credentials);
        setExtraHeadersRaw(stored.extraHeadersRaw);
        setAllowOrigin(stored.allowOrigin);
        setAllowCredentials(stored.allowCredentials);
        setAllowMethodsRaw(stored.allowMethodsRaw);
        setAllowHeadersRaw(stored.allowHeadersRaw);
      } else if (LAB_SCENARIOS.some((s) => s.id === stored.activeScenario)) {
        loadScenario(stored.activeScenario as ScenarioId);
      }
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const payload: PersistedScenario = {
      activeScenario,
      origin,
      method,
      credentials,
      extraHeadersRaw,
      allowOrigin,
      allowCredentials,
      allowMethodsRaw,
      allowHeadersRaw,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }, [
    hydrated,
    activeScenario,
    origin,
    method,
    credentials,
    extraHeadersRaw,
    allowOrigin,
    allowCredentials,
    allowMethodsRaw,
    allowHeadersRaw,
  ]);

  function loadScenario(id: ScenarioId) {
    const s = LAB_SCENARIOS.find((x) => x.id === id)!;
    setActiveScenario(id);
    setOrigin(s.request.origin);
    setMethod(s.request.method);
    setCredentials(s.request.credentials);
    setExtraHeadersRaw(s.request.extraHeaders.join(", "));
    setAllowOrigin(s.policy.allowOrigin ?? "");
    setAllowCredentials(s.policy.allowCredentials);
    setAllowMethodsRaw(s.policy.allowMethods.join(", "));
    setAllowHeadersRaw(s.policy.allowHeaders.join(", "));
  }

  function markCustom() {
    setActiveScenario("custom");
  }

  const evaluation = useMemo(() => {
    const request: CorsBrowserRequest = {
      origin: origin.trim() || "https://notebook.lab",
      method,
      credentials,
      extraHeaders: parseHeaderList(extraHeadersRaw),
    };
    const policy: CorsServerPolicy = {
      allowOrigin: allowOrigin.trim() === "" ? null : allowOrigin.trim(),
      allowCredentials,
      allowMethods: parseMethods(allowMethodsRaw),
      allowHeaders: parseHeaderList(allowHeadersRaw),
    };
    return evaluateCors(request, policy);
  }, [
    origin,
    method,
    credentials,
    extraHeadersRaw,
    allowOrigin,
    allowCredentials,
    allowMethodsRaw,
    allowHeadersRaw,
  ]);

  return (
    <main className="app-shell">
      <header className="masthead">
        <p className="byline">Saeed Rumaneh · Portfolio lab</p>
        <h1 className="brand">
          CORS <span>Lab</span>
        </h1>
        <p className="tagline">
          Notebook for browser CORS: watch OPTIONS preflight vs the actual
          request, then see Allow or Deny from the real header rules — synthetic
          only.
        </p>
      </header>

      <div className="layout">
        <section className="glass panel">
          <h2>Request &amp; server policy</h2>

          <div className="scenarios" role="list">
            {LAB_SCENARIOS.map((s) => (
              <button
                key={s.id}
                type="button"
                className="chip"
                data-active={activeScenario === s.id}
                onClick={() => loadScenario(s.id)}
                title={s.summary}
              >
                {s.title}
              </button>
            ))}
          </div>

          {activeScenario !== "custom" && (
            <p className="tagline" style={{ marginBottom: "1rem", fontSize: "0.92rem" }}>
              {
                LAB_SCENARIOS.find((s) => s.id === activeScenario)
                  ?.summary
              }
            </p>
          )}

          <div className="field-grid">
            <div className="field">
              <label htmlFor="origin">Page Origin</label>
              <input
                id="origin"
                value={origin}
                onChange={(e) => {
                  markCustom();
                  setOrigin(e.target.value);
                }}
              />
            </div>

            <div className="row-2">
              <div className="field">
                <label htmlFor="method">Method</label>
                <select
                  id="method"
                  value={method}
                  onChange={(e) => {
                    markCustom();
                    setMethod(e.target.value as HttpMethod);
                  }}
                >
                  {METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Credentials</label>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={credentials}
                    onChange={(e) => {
                      markCustom();
                      setCredentials(e.target.checked);
                    }}
                  />
                  Include cookies / auth
                </label>
              </div>
            </div>

            <div className="field">
              <label htmlFor="extra">Extra request headers</label>
              <textarea
                id="extra"
                value={extraHeadersRaw}
                placeholder="e.g. X-Lab-Token, Authorization"
                onChange={(e) => {
                  markCustom();
                  setExtraHeadersRaw(e.target.value);
                }}
              />
            </div>
          </div>

          <div className="policy-block field-grid">
            <div className="field">
              <label htmlFor="acao">Access-Control-Allow-Origin</label>
              <input
                id="acao"
                value={allowOrigin}
                placeholder="empty = missing header"
                onChange={(e) => {
                  markCustom();
                  setAllowOrigin(e.target.value);
                }}
              />
            </div>

            <div className="field">
              <label>Access-Control-Allow-Credentials</label>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={allowCredentials}
                  onChange={(e) => {
                    markCustom();
                    setAllowCredentials(e.target.checked);
                  }}
                />
                true
              </label>
            </div>

            <div className="row-2">
              <div className="field">
                <label htmlFor="acam">Allow-Methods</label>
                <input
                  id="acam"
                  value={allowMethodsRaw}
                  onChange={(e) => {
                    markCustom();
                    setAllowMethodsRaw(e.target.value);
                  }}
                />
              </div>
              <div className="field">
                <label htmlFor="acah">Allow-Headers</label>
                <input
                  id="acah"
                  value={allowHeadersRaw}
                  onChange={(e) => {
                    markCustom();
                    setAllowHeadersRaw(e.target.value);
                  }}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="glass panel">
          <h2>Browser evaluation</h2>

          <div
            className="verdict"
            data-kind={evaluation.verdict}
            aria-live="polite"
          >
            {evaluation.verdict === "allow" ? "Allow" : "Deny"}
          </div>

          <div className="steps">
            <div className="step">
              <h3>
                1 · Preflight (OPTIONS)
                {evaluation.requiresPreflight ? (
                  <span
                    className="badge"
                    data-kind={evaluation.preflight.verdict}
                  >
                    {evaluation.preflight.verdict}
                  </span>
                ) : (
                  <span className="badge" data-kind="skip">
                    skipped
                  </span>
                )}
              </h3>
              {evaluation.requiresPreflight ? (
                <>
                  <pre className="headers">
                    {`→ request\n${formatHeaders(evaluation.preflight.requestHeaders)}\n\n← response\n${formatHeaders(evaluation.preflight.responseHeaders)}`}
                  </pre>
                  <ul className="notes">
                    {evaluation.preflight.notes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="notes" style={{ listStyle: "none", paddingLeft: 0 }}>
                  Simple request — no OPTIONS round-trip.
                </p>
              )}
            </div>

            <div className="step">
              <h3>
                2 · Actual request ({evaluation.actual.method})
                <span className="badge" data-kind={evaluation.actual.verdict}>
                  {evaluation.actual.verdict}
                </span>
              </h3>
              <pre className="headers">
                {`→ request\n${formatHeaders(evaluation.actual.requestHeaders)}\n\n← CORS response headers\n${formatHeaders(evaluation.actual.responseHeaders)}`}
              </pre>
              <ul className="notes">
                {evaluation.actual.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="explanations">
            <h2 style={{ fontSize: "1.05rem" }}>Rule walkthrough</h2>
            <ol>
              {evaluation.explanations.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ol>
          </div>
        </section>
      </div>

      <p className="footer-note">
        Educational simulator · MIT 2026 Saeed Rumaneh · last scenario in
        localStorage · see SECURITY.md
      </p>
    </main>
  );
}
