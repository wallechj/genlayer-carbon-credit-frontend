"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CarbonCreditAudit,
  type Challenge,
  type Project,
} from "@/lib/carbonCreditAudit";

const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";
const EXPLORER = "https://explorer-studio.genlayer.com/address/";
const TX_EXPLORER = "https://explorer-studio.genlayer.com/tx/";
const STUDIO_CHAIN_ID = 61999;
const STUDIO_CHAIN_ID_HEX = "0xf22f";
const STUDIO_RPC = "https://studio.genlayer.com/api";

const REPO = "https://github.com/wallechj/genlayer-carbon-credit-audit";
const FIXTURE_BASE =
  "https://raw.githubusercontent.com/wallechj/genlayer-carbon-credit-audit/main/examples/";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "8px 10px",
  margin: "6px 0 12px",
  borderRadius: 8,
  border: "1px solid #2a3140",
  background: "#12161f",
  color: "#e6e9f0",
  boxSizing: "border-box",
};

const buttonStyle: React.CSSProperties = {
  padding: "9px 16px",
  borderRadius: 8,
  border: "none",
  background: "#4f7cff",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 600,
};

const cardStyle: React.CSSProperties = {
  border: "1px solid #232a38",
  borderRadius: 12,
  padding: 16,
  margin: "12px 0",
  background: "#10141d",
};

const linkStyle: React.CSSProperties = { color: "#7ea4ff" };

function shortAddr(a: string) {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

function verdictLabel(c: Challenge): string {
  if (c.status === "submitted") return "submitted — not yet assessed";
  if (c.status === "valid") return `valid · ruled ${c.ruled_severity || "?"}`;
  if (c.status === "invalid") return "invalid · ruled none";
  return c.status;
}

export default function Home() {
  const [address, setAddress] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [lastRead, setLastRead] = useState<Date | null>(null);
  const [readError, setReadError] = useState("");

  const contract = useMemo(() => new CarbonCreditAudit(address), [address]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setReadError("");
    try {
      const [p, c] = await Promise.all([
        contract.getProjects(),
        contract.getChallenges(),
      ]);
      setProjects(p);
      setChallenges(c);
      setLastRead(new Date());
    } catch (e) {
      setReadError(
        `Could not read the contract state: ${e instanceof Error ? e.message : String(e)}`
      );
    } finally {
      setLoading(false);
    }
  }, [contract]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function connect() {
    if (!window.ethereum) {
      setNotice(
        "No MetaMask found. Install MetaMask, then add the GenLayer Studio network (chain ID 61999, RPC https://studio.genlayer.com/api) and retry."
      );
      return;
    }
    try {
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];
      // Make sure MetaMask is on GenLayer Studio (chain 61999); add it if missing.
      const chainId = (await window.ethereum.request({
        method: "eth_chainId",
      })) as string;
      if (chainId.toLowerCase() !== STUDIO_CHAIN_ID_HEX) {
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: STUDIO_CHAIN_ID_HEX }],
          });
        } catch (switchErr) {
          const code = (switchErr as { code?: number })?.code;
          if (code === 4902) {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: STUDIO_CHAIN_ID_HEX,
                  chainName: "GenLayer Studio",
                  rpcUrls: [STUDIO_RPC],
                  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
                  blockExplorerUrls: ["https://explorer-studio.genlayer.com"],
                },
              ],
            });
          } else {
            throw switchErr;
          }
        }
      }
      setAddress(accounts[0] ?? null);
      setNotice("Wallet connected on GenLayer Studio (chain 61999).");
    } catch (e) {
      setNotice(
        `Wallet connection failed: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  async function runWrite(label: string, fn: () => Promise<string>) {
    if (!address) {
      setNotice("Connect your wallet first.");
      return;
    }
    setBusy(label);
    try {
      const hash = await fn();
      setNotice(
        `${label} submitted. Tx hash: ${hash} — waiting for FINALIZED. Consensus can take a few minutes; keep this tab open.`
      );
      await contract.waitFinalized(hash as `0x${string}`);
      setNotice(
        `${label} FINALIZED (tx ${hash}). The state below was re-read from the chain.`
      );
      await refresh();
    } catch (e) {
      setNotice(
        `${label} failed: ${e instanceof Error ? e.message : String(e)}`
      );
    } finally {
      setBusy("");
    }
  }

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "32px 20px 64px" }}>
      {/* ---- Header ---- */}
      <h1 style={{ fontSize: 30, marginBottom: 4 }}>CarbonCreditAudit</h1>
      <p style={{ color: "#9aa4b8", marginTop: 0 }}>
        On-chain verification for carbon offset credits: validators check the
        registry entry and the auditor monitoring report themselves, and the
        verified credit count is a deterministic on-chain subtraction of upheld
        challenges.
      </p>
      <p style={{ fontSize: 13, color: "#9aa4b8" }}>
        Contract:{" "}
        <a href={`${EXPLORER}${CONTRACT}`} style={linkStyle}>
          {CONTRACT}
        </a>{" "}
        · GenLayer Studio (chain {STUDIO_CHAIN_ID}), test environment, not mainnet.
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", margin: "16px 0", flexWrap: "wrap" }}>
        <button style={buttonStyle} onClick={connect}>
          {address ? shortAddr(address) : "Connect MetaMask"}
        </button>
        <button
          style={{ ...buttonStyle, background: "#2a3140" }}
          onClick={refresh}
          disabled={loading}
        >
          {loading ? "Reading from chain…" : "Refresh from chain"}
        </button>
        <span style={{ fontSize: 13, color: lastRead ? "#59d98c" : "#9aa4b8" }}>
          {loading
            ? "Reading live from the contract…"
            : lastRead
              ? `Live from chain · last read ${lastRead.toLocaleTimeString()}`
              : "Not read yet"}
        </span>
      </div>

      {notice && (
        <p style={{ ...cardStyle, borderColor: "#3b4a6b", color: "#cdd8ff", wordBreak: "break-word" }}>
          {notice}
        </p>
      )}

      {readError && (
        <p style={{ ...cardStyle, borderColor: "#8c3a3a", color: "#ffb3b3" }}>
          {readError} The data below may be stale or empty. Check the Studio
          RPC and press “Refresh from chain”.
        </p>
      )}

      {/* ---- Overview ---- */}
      <h2 style={{ marginTop: 28 }}>Why this exists</h2>
      <div style={cardStyle}>
        <p style={{ marginTop: 0 }}>
          A carbon credit is worth something only if the tonne it represents
          is real, counted once, and additional — and buyers cannot check that
          from a project&apos;s own marketing page. The evidence that settles
          it lives in two public places: the carbon registry entry (what was
          issued, which serials, which vintage) and the auditor&apos;s
          monitoring report (what was actually measured).
        </p>
        <p>
          The project owner declares both sources at creation, so validators
          fetch exactly those documents. Anyone except the owner can challenge
          claimed credits. Validators rule on each challenge, and the verified
          count follows deterministic math:
        </p>
        <p style={{ fontFamily: "monospace", fontSize: 14 }}>
          verified = claimed − upheld verified deductions, floored at zero
        </p>
        <p style={{ marginBottom: 0 }}>
          No LLM ever touches the credit math. The model only decides whether
          a challenge is grounded in the fetched registry or report; the
          subtraction itself is plain contract code.
        </p>
      </div>

      {/* ---- Verify (no wallet) ---- */}
      <h2 style={{ marginTop: 28 }}>Verify — read live from the contract</h2>
      <p style={{ color: "#9aa4b8", fontSize: 14 }}>
        Everything below is read from the deployed contract on every load. No
        wallet is needed. The verified cases are the contract&apos;s own
        state: 3 projects, 8 challenges.
      </p>

      <h3>Projects ({projects.length})</h3>
      {projects.length === 0 && !loading && (
        <p style={{ color: "#9aa4b8" }}>No projects read yet.</p>
      )}
      {projects.map((p, i) => {
        const claimed = Number(p.claimed_credits);
        const verified = Number(p.verified_credits);
        const upheld = claimed - verified;
        return (
          <div key={i} style={cardStyle}>
            <strong>
              #{i} {p.project_name}
            </strong>{" "}
            <span style={{ color: p.status === "open" ? "#59d98c" : "#9aa4b8" }}>
              [{p.status}]
            </span>
            <div style={{ fontSize: 14, marginTop: 8 }}>
              claimed: <strong>{claimed.toLocaleString()}</strong> · verified:{" "}
              <strong>{verified.toLocaleString()}</strong>
              {upheld > 0
                ? ` · ${upheld.toLocaleString()} upheld against the project`
                : " · nothing upheld"}
            </div>
            <div style={{ fontSize: 13, color: "#9aa4b8", marginTop: 6 }}>
              vintage: {String(p.vintage_year)} · methodology: {p.methodology}
              <br />
              owner: {p.owner}
              <br />
              registry:{" "}
              <a href={p.registry_url} style={linkStyle}>
                {p.registry_url}
              </a>
              <br />
              monitoring report:{" "}
              <a href={p.monitoring_report_url} style={linkStyle}>
                {p.monitoring_report_url}
              </a>
            </div>
            <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
              {p.status === "open" ? (
                <button
                  style={{ ...buttonStyle, background: "#2a3140" }}
                  disabled={!!busy}
                  onClick={() =>
                    runWrite(`Closing project #${i}`, () => contract.closeProject(i))
                  }
                >
                  Close project (owner only)
                </button>
              ) : (
                <button
                  style={{ ...buttonStyle, background: "#2a3140" }}
                  disabled={!!busy}
                  onClick={() =>
                    runWrite(`Reopening project #${i}`, () => contract.reopenProject(i))
                  }
                >
                  Reopen project (owner only)
                </button>
              )}
            </div>
          </div>
        );
      })}

      <h3>Challenges ({challenges.length})</h3>
      {challenges.length === 0 && !loading && (
        <p style={{ color: "#9aa4b8" }}>No challenges read yet.</p>
      )}
      {challenges.map((c, i) => (
        <div key={i} style={cardStyle}>
          <strong>
            #{i} {c.title}
          </strong>{" "}
          <span
            style={{
              color:
                c.status === "valid"
                  ? "#ff9d5c"
                  : c.status === "invalid"
                    ? "#9aa4b8"
                    : "#e8c85a",
            }}
          >
            [project #{String(c.project_id)} · {verdictLabel(c)}]
          </span>
          <div style={{ fontSize: 13, color: "#9aa4b8", marginTop: 6 }}>
            {c.statement}
            <br />
            credits affected: {Number(c.credits_affected).toLocaleString()} ·
            verified affected:{" "}
            {Number(c.verified_credits_affected ?? 0).toLocaleString()} ·
            claimed severity: {c.claimed_severity} · challenger:{" "}
            {shortAddr(c.challenger)}
            {c.triage_summary ? (
              <>
                <br />
                ruling: {c.triage_summary}
              </>
            ) : null}
            {c.evidence ? (
              <>
                <br />
                on-chain evidence note: {c.evidence}
              </>
            ) : null}
            <br />
            challenger evidence:{" "}
            <a href={c.evidence_url} style={linkStyle}>
              {c.evidence_url}
            </a>
          </div>
          {c.status === "submitted" && (
            <div style={{ marginTop: 10 }}>
              <button
                style={buttonStyle}
                disabled={!!busy}
                onClick={() =>
                  runWrite(`Assessing challenge #${i}`, () =>
                    contract.assessChallenge(i)
                  )
                }
              >
                Assess challenge #{i}
              </button>
            </div>
          )}
        </div>
      ))}

      {/* ---- Rules ---- */}
      <h2 style={{ marginTop: 28 }}>Assessment rules</h2>
      <div style={cardStyle}>
        <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
          <li>
            <strong>Valid only if corroborated.</strong> A challenge is valid
            only if the fetched registry entry or monitoring report
            corroborates the problem — the named credits are double-counted,
            lack monitoring data, fail additionality, or fall outside the
            stated vintage or methodology. Never valid on the
            challenger&apos;s word alone, and never valid on the
            challenger&apos;s evidence page alone: the registry or the report
            must corroborate it.
          </li>
          <li>
            <strong>Unretrievable registry means invalid.</strong> If the
            registry could not be retrieved, the challenge is invalid — and
            the project itself is not silently docked: an unassessable
            project keeps its verified credits as claimed.
          </li>
          <li>
            <strong>Duplicate vs repeat of a rejected challenge.</strong> A
            challenge matching a prior <em>accepted</em> (valid) finding is
            invalid as a duplicate. A match against a <em>rejected</em>{" "}
            (invalid) prior challenge does not count — it is judged on its own
            grounding.
          </li>
          <li>
            <strong>Severity invariant.</strong> A valid challenge always
            carries a real severity bucket (critical, high, medium, or low);
            an invalid challenge always carries &quot;none&quot;. A valid
            verdict with no usable severity is rejected.
          </li>
          <li>
            <strong>Deterministic credit math.</strong> Each upheld challenge
            subtracts exactly its credits from the verified total, floored at
            zero. The verified count never comes from free-form text.
          </li>
          <li>
            <strong>Close and reopen.</strong> Only the project owner can close
            or reopen a project. No challenges or assessments are possible
            while a project is closed.
          </li>
          <li>
            <strong>Auditable verdicts.</strong> Every verdict carries a
            one-sentence evidence note stored on-chain, naming the fetched
            material that decided it.
          </li>
        </ol>
      </div>

      {/* ---- Act (wallet) ---- */}
      <h2 style={{ marginTop: 28 }}>Act — write to the contract</h2>
      <p style={{ color: "#9aa4b8", fontSize: 14 }}>
        Requires MetaMask on GenLayer Studio (chain 61999). After each write
        the page shows the transaction hash, waits for FINALIZED, then re-reads
        the state. ACCEPTED is never presented as final.
      </p>

      <h3>Create a project</h3>
      <CreateProjectForm contract={contract} runWrite={runWrite} busy={!!busy} />

      <h3>Submit a challenge</h3>
      <SubmitChallengeForm
        contract={contract}
        runWrite={runWrite}
        busy={!!busy}
        projects={projects}
      />

      <h3>Assess a challenge</h3>
      <AssessForm contract={contract} runWrite={runWrite} busy={!!busy} />

      <h3>Close or reopen a project</h3>
      <CloseReopenForm contract={contract} runWrite={runWrite} busy={!!busy} />

      {/* ---- Evidence ---- */}
      <h2 style={{ marginTop: 28 }}>Evidence</h2>
      <div style={cardStyle}>
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9 }}>
          <li>
            Contract source and verification record:{" "}
            <a href={REPO} style={linkStyle}>
              {REPO}
            </a>
          </li>
          <li>
            Contract on the Studio explorer:{" "}
            <a href={`${EXPLORER}${CONTRACT}`} style={linkStyle}>
              {EXPLORER}
              {CONTRACT}
            </a>
          </li>
          <li>
            Verification walkthrough (test_flow.md):{" "}
            <a href={`${REPO}/blob/main/test_flow.md`} style={linkStyle}>
              test_flow.md
            </a>
          </li>
          <li>
            Contract README:{" "}
            <a href={`${REPO}/blob/main/README.md`} style={linkStyle}>
              README.md
            </a>
          </li>
          <li>
            Registry fixture (Delta Mangrove Restoration, CM-2024-118):{" "}
            <a href={`${FIXTURE_BASE}registry.md`} style={linkStyle}>
              registry.md
            </a>
          </li>
          <li>
            Auditor monitoring report (vintage 2024):{" "}
            <a href={`${FIXTURE_BASE}monitoring_report.md`} style={linkStyle}>
              monitoring_report.md
            </a>
          </li>
          <li>
            Second registry entry (double-count evidence, CM-2023-077):{" "}
            <a href={`${FIXTURE_BASE}double_count.md`} style={linkStyle}>
              double_count.md
            </a>
          </li>
          <li>
            News article (additionality claim, different site):{" "}
            <a href={`${FIXTURE_BASE}news_article.md`} style={linkStyle}>
              news_article.md
            </a>
          </li>
          <li>
            Partial-overlap registry (Kelp, CM-2024-205, overlap 400):{" "}
            <a href={`${FIXTURE_BASE}registry_partial.md`} style={linkStyle}>
              registry_partial.md
            </a>
          </li>
          <li>
            Partial-overlap second entry (CM-2023-091):{" "}
            <a href={`${FIXTURE_BASE}double_count_partial.md`} style={linkStyle}>
              double_count_partial.md
            </a>
          </li>
          <li>
            Partial-overlap monitoring report (Kelp):{" "}
            <a href={`${FIXTURE_BASE}monitoring_report_partial.md`} style={linkStyle}>
              monitoring_report_partial.md
            </a>
          </li>
        </ul>
        <p style={{ color: "#9aa4b8", fontSize: 13, marginBottom: 0 }}>
          Verified on-chain state, read back 2026-11-21: 3 projects, 8
          challenges. Project 0 claimed 10,000, verified 9,000 (challenge 0
          valid/critical, 1,000 double-counted credits). Project 1 claimed
          5,000, verified 5,000 (dead registry, not silently docked). Project
          2 claimed 2,000, verified 1,600 (challenge 6 claimed 1,000
          double-counted but the registry proved only 400, so only 400 were
          deducted). Challenges 1–5 and 7 invalid, severity none.
        </p>
      </div>
    </main>
  );
}

function CreateProjectForm({
  contract,
  runWrite,
  busy,
}: {
  contract: CarbonCreditAudit;
  runWrite: (label: string, fn: () => Promise<string>) => Promise<void>;
  busy: boolean;
}) {
  const [f, setF] = useState({
    projectName: "",
    registryUrl: "",
    monitoringReportUrl: "",
    claimedCredits: "",
    vintageYear: "2024",
    methodology: "VM0047",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: e.target.value });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        runWrite("Creating project", () =>
          contract.createProject({
            projectName: f.projectName,
            registryUrl: f.registryUrl,
            monitoringReportUrl: f.monitoringReportUrl,
            claimedCredits: Number(f.claimedCredits),
            vintageYear: Number(f.vintageYear),
            methodology: f.methodology,
          })
        );
      }}
    >
      <label>
        Project name
        <input style={inputStyle} value={f.projectName} onChange={set("projectName")} placeholder="Delta Mangrove Restoration" required />
      </label>
      <label>
        Registry URL
        <input style={inputStyle} value={f.registryUrl} onChange={set("registryUrl")} placeholder="https://raw.githubusercontent.com/.../examples/registry.md" required />
      </label>
      <label>
        Monitoring report URL
        <input style={inputStyle} value={f.monitoringReportUrl} onChange={set("monitoringReportUrl")} placeholder="https://raw.githubusercontent.com/.../examples/monitoring_report.md" required />
      </label>
      <label>
        Claimed credits
        <input style={inputStyle} value={f.claimedCredits} onChange={set("claimedCredits")} placeholder="10000" inputMode="numeric" required />
      </label>
      <label>
        Vintage year
        <input style={inputStyle} value={f.vintageYear} onChange={set("vintageYear")} inputMode="numeric" required />
      </label>
      <label>
        Methodology
        <input style={inputStyle} value={f.methodology} onChange={set("methodology")} placeholder="VM0047" required />
      </label>
      <button style={buttonStyle} type="submit" disabled={busy}>
        Create project
      </button>
    </form>
  );
}

function SubmitChallengeForm({
  contract,
  runWrite,
  busy,
  projects,
}: {
  contract: CarbonCreditAudit;
  runWrite: (label: string, fn: () => Promise<string>) => Promise<void>;
  busy: boolean;
  projects: Project[];
}) {
  const [projectId, setProjectId] = useState("0");
  const [title, setTitle] = useState("");
  const [statement, setStatement] = useState("");
  const [creditsAffected, setCreditsAffected] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [severity, setSeverity] = useState("high");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        runWrite("Submitting challenge", () =>
          contract.submitChallenge({
            projectId: Number(projectId),
            title,
            statement,
            creditsAffected: Number(creditsAffected),
            evidenceUrl,
            claimedSeverity: severity,
          })
        );
      }}
    >
      <label>
        Project ID
        <input style={inputStyle} value={projectId} onChange={(e) => setProjectId(e.target.value)} inputMode="numeric" required />
      </label>
      <label>
        Title
        <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="1,000 credits double-counted under a second project" required />
      </label>
      <label>
        Statement
        <textarea
          style={{ ...inputStyle, minHeight: 90 }}
          value={statement}
          onChange={(e) => setStatement(e.target.value)}
          placeholder="What is wrong with the claimed credits, and which serials or figures are affected?"
          required
        />
      </label>
      <label>
        Credits affected
        <input style={inputStyle} value={creditsAffected} onChange={(e) => setCreditsAffected(e.target.value)} placeholder="1000" inputMode="numeric" required />
      </label>
      <label>
        Evidence URL
        <input style={inputStyle} value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)} placeholder="https://raw.githubusercontent.com/.../examples/double_count.md" required />
      </label>
      <label>
        Claimed severity
        <select style={inputStyle} value={severity} onChange={(e) => setSeverity(e.target.value)}>
          <option value="critical">critical</option>
          <option value="high">high</option>
          <option value="medium">medium</option>
          <option value="low">low</option>
        </select>
      </label>
      <button
        style={buttonStyle}
        type="submit"
        disabled={busy || projects.length === 0}
      >
        Submit challenge (not the project owner)
      </button>
    </form>
  );
}

function AssessForm({
  contract,
  runWrite,
  busy,
}: {
  contract: CarbonCreditAudit;
  runWrite: (label: string, fn: () => Promise<string>) => Promise<void>;
  busy: boolean;
}) {
  const [challengeId, setChallengeId] = useState("0");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        runWrite(`Assessing challenge #${challengeId}`, () =>
          contract.assessChallenge(Number(challengeId))
        );
      }}
    >
      <label>
        Challenge ID
        <input
          style={inputStyle}
          value={challengeId}
          onChange={(e) => setChallengeId(e.target.value)}
          inputMode="numeric"
          required
        />
      </label>
      <button style={buttonStyle} type="submit" disabled={busy}>
        Assess challenge
      </button>
    </form>
  );
}

function CloseReopenForm({
  contract,
  runWrite,
  busy,
}: {
  contract: CarbonCreditAudit;
  runWrite: (label: string, fn: () => Promise<string>) => Promise<void>;
  busy: boolean;
}) {
  const [projectId, setProjectId] = useState("0");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
      }}
    >
      <label>
        Project ID
        <input
          style={inputStyle}
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          inputMode="numeric"
          required
        />
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          style={{ ...buttonStyle, background: "#2a3140" }}
          type="button"
          disabled={busy}
          onClick={() =>
            runWrite(`Closing project #${projectId}`, () =>
              contract.closeProject(Number(projectId))
            )
          }
        >
          Close project (owner only)
        </button>
        <button
          style={{ ...buttonStyle, background: "#2a3140" }}
          type="button"
          disabled={busy}
          onClick={() =>
            runWrite(`Reopening project #${projectId}`, () =>
              contract.reopenProject(Number(projectId))
            )
          }
        >
          Reopen project (owner only)
        </button>
      </div>
    </form>
  );
}
