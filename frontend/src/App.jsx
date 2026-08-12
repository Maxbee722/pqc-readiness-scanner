// React hooks: useState manages local state
import { useState } from "react";
import "./App.css";
// PDF libraries: jsPDF builds the file, autoTable renders the results table inside it
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Main App component — holds all state, scan/export logic, and the UI
function App() {
  // ---- State: controls which modes, panels, and views are displayed ----
  const [mode, setMode] = useState("single");
  const [batchInputType, setBatchInputType] = useState("manual");
  const [domain, setDomain] = useState("");
  const [domainList, setDomainList] = useState("");
  const [file, setFile] = useState(null);
  // ---- Scan results, progress, and history state ----
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  // Initialize history lazily from localStorage (runs once on first render) —
  // restores past scans without needing a setState-in-effect side effect
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem("pqc_scan_history");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showHistory, setShowHistory] = useState(false);
  // ---- Display toggles: card/table view and the "Learn More" panel ----
  const [viewMode, setViewMode] = useState("cards");
  const [showLearnMore, setShowLearnMore] = useState(false);

  // Save a successful scan result to history (skips errored scans),
  // keeping the newest 100 entries persisted in localStorage
  const addToHistory = (result) => {
    if (result.error) return;

    const entry = {
      domain: result.domain,
      pqc_readiness: result.pqc_readiness,
      timestamp: new Date().toISOString(),
    };

    setHistory((prev) => {
      const updated = [entry, ...prev].slice(0, 100);
      localStorage.setItem("pqc_scan_history", JSON.stringify(updated));
      return updated;
    });
  };

  // Base URL of the deployed Python backend (FastAPI on Render)
  const API_BASE = "https://pqc-readiness-scanner-1.onrender.com";

  // Scan a single domain: POST to /scan, show the result, save it to history
  const scanSingle = async () => {
    if (!domain.trim()) return;
    setLoading(true);
    setResults([]);
    try {
      const res = await fetch(`${API_BASE}/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domain.trim() }),
      });
      const data = await res.json();
      setResults([data]);
      addToHistory(data);
    } catch {
      setResults([
        {
          domain: domain.trim(),
          error:
            "Could not reach the scanner API. Is app.py on render running?",
        },
      ]);
    }
    setLoading(false);
  };

  // Parse manually-typed domains (one per line, trimmed) and run the batch scan
  const scanBatchManual = async () => {
    const domains = domainList
      .split("\n")
      .map((d) => d.trim())
      .filter((d) => d.length > 0);

    if (domains.length === 0) return;
    await runBatch(domains);
  };

  // Read domains from the uploaded .txt file and run the batch scan
  const scanBatchFile = async () => {
    if (!file) return;
    const text = await file.text();
    const domains = text
      .split("\n")
      .map((d) => d.trim())
      .filter((d) => d.length > 0);

    await runBatch(domains);
  };

  // Core batch scanner: loops over domains one-by-one, POSTs each to the API,
  // updates the live progress bar + results as it goes, saving each to history
  const runBatch = async (domains) => {
    setLoading(true);
    setResults([]);
    setProgress({ current: 0, total: domains.length });

    const collected = [];

    for (let i = 0; i < domains.length; i++) {
      let result;
      try {
        const res = await fetch(`${API_BASE}/scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain: domains[i] }),
        });
        result = await res.json();
      } catch {
        result = {
          domain: domains[i],
          error: "Could not reach the scanner API.",
        };
      }

      collected.push(result);
      setProgress({ current: i + 1, total: domains.length });
      setResults([...collected]);
      addToHistory(result);
    }

    setLoading(false);
  };

  // Renders the CERT / HANDSHAKE status badges for a single scan result
  const getBadge = (result) => {
    if (result.error) return <span className="badge error">ERROR</span>;
    return (
      <div className="badge-group">
        <span
          className={
            result.pqc_readiness === "NOT PQC-Ready"
              ? "badge not-ready"
              : "badge ready"
          }
        >
          CERT: {result.pqc_readiness === "NOT PQC-Ready" ? "CLASSICAL" : "PQC"}
        </span>
        <span
          className={result.pqc_handshake ? "badge ready" : "badge not-ready"}
        >
          HANDSHAKE: {result.pqc_handshake ? "PQC" : "CLASSICAL"}
        </span>
      </div>
    );
  };

  // Combines cert + handshake readiness into a single overall verdict banner
  const getOverallStatus = (result) => {
    if (result.error) return null;

    const certReady = result.pqc_readiness !== "NOT PQC-Ready";
    const handshakeReady = result.pqc_handshake;

    if (certReady && handshakeReady) {
      return { text: "PQC Ready", className: "overall-ready" };
    }
    if (certReady || handshakeReady) {
      return { text: "Potentially PQC Ready", className: "overall-partial" };
    }
    return { text: "Not PQC Ready", className: "overall-not-ready" };
  };

  // Wipe all saved history from state and localStorage
  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem("pqc_scan_history");
  };

  // Build a CSV file from the current results and trigger a browser download
  const exportCSV = () => {
    const headers = [
      "Domain",
      "Cert Status",
      "Handshake Status",
      "Signature Algorithm",
      "Expires",
    ];
    const rows = results.map((r) => {
      if (r.error) return [r.domain, "Error", "", "", r.error];
      return [
        r.domain,
        r.pqc_readiness === "NOT PQC-Ready" ? "Classical" : "PQC",
        r.pqc_handshake ? "PQC" : "Classical",
        r.signature_algorithm,
        r.not_valid_after,
      ];
    });

    // Assemble CSV text: quote every cell and escape embedded quotes for safety
    const csvContent = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");

    // Create a downloadable .csv blob and click an anchor to save it
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pqc-scan-results-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Generate a PDF report of the results using jsPDF + autoTable, then download it
  const exportPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("PQC Readiness Scanner — Batch Report", 14, 18);

    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(`Generated ${new Date().toLocaleString()}`, 14, 25);

    const tableRows = results.map((r) => {
      if (r.error) return [r.domain, "Error", "", "", r.error];
      return [
        r.domain,
        r.pqc_readiness === "NOT PQC-Ready" ? "Classical" : "PQC",
        r.pqc_handshake ? "PQC" : "Classical",
        r.signature_algorithm || "",
        r.not_valid_after || "",
      ];
    });

    autoTable(doc, {
      startY: 32,
      head: [["Domain", "Cert", "Handshake", "Signature", "Expires"]],
      body: tableRows,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [124, 111, 240] },
    });

    // Save the finished PDF to the user's downloads
    doc.save(`pqc-scan-results-${new Date().toISOString().split("T")[0]}.pdf`);
  };

  // ---- RENDERED UI ------------------------------------------------------
  return (
    <div className="app">
      {/* Header / hero section: title, tagline, and Q-Day warning */}
      <div className="hero">
        <h1>
          PQC <span>Readiness</span> Scanner
        </h1>
        <p>Check whether a domain's TLS certificate can survive Q-Day</p>
        <div className="qday">
          Est. Q-Day: ~2030–2035 · migrate before harvest-now-decrypt-later
          catches up
        </div>
        <div className="hero-warning">
          ⚠️ No domain will currently show "Cert: PQC" — Certificate Authorities
          haven't yet begun issuing post-quantum-signed certificates
          industry-wide. Handshake results, however, are live and accurate. See
          README for details.
        </div>
      </div>

      {/* "Learn More" toggle button that opens/closes the PQC education panel */}
      <button
        className="learn-more-toggle"
        onClick={() => setShowLearnMore(!showLearnMore)}
      >
        {showLearnMore ? "Hide" : "Learn More"} about PQC
      </button>

      {/* Educational panel explaining post-quantum cryptography (shown when open) */}
      {showLearnMore && (
        <div className="learn-more-panel">
          <h3>What is Post-Quantum Cryptography?</h3>
          <p>
            Quantum computers, once powerful enough, will be able to break the
            classical encryption (RSA, ECC) that secures most of today's
            internet traffic — banking, healthcare, government communications,
            all of it. Post-quantum cryptography (PQC) refers to a new
            generation of encryption algorithms, standardized by NIST in 2024,
            designed to resist attacks from both classical and quantum
            computers.
          </p>

          <h3>
            Why does this matter today, if quantum computers aren't here yet?
          </h3>
          <p>
            Adversaries are already using a strategy called{" "}
            <strong>harvest now, decrypt later</strong> — recording encrypted
            traffic today with the intent to decrypt it once quantum computing
            catches up. Data that needs to stay confidential for years is
            already at risk, even though no quantum computer capable of breaking
            it exists yet.
          </p>

          <h3>What does "certificate" vs "handshake" mean?</h3>
          <p>
            A secure connection has two independent layers: the{" "}
            <strong>certificate</strong> (which proves a site's identity, signed
            by a trusted authority) and the <strong>handshake</strong> (the live
            negotiation that sets up the actual encrypted connection). A site
            can be ready at one layer and not the other — this tool checks both
            separately, rather than giving one blended verdict.
          </p>

          <h3>Why I built this</h3>
          <p>
            I'm a cybersecurity student interested in applied cryptography and
            the practical side of the PQC transition, not just the math, but the
            real-world gap between "the standards exist" and "organizations have
            actually migrated." This tool is my attempt to make that gap visible
            and measurable, one domain at a time.
          </p>
        </div>
      )}

      {/* History toggle button — opens/closes the saved-scans panel */}
      <button
        className="history-toggle"
        onClick={() => setShowHistory(!showHistory)}
      >
        History {history.length > 0 && `(${history.length})`}
      </button>

      {/* Saved scan history panel (rendered only when toggled open) */}
      {showHistory && (
        <div className="history-panel">
          {history.length === 0 ? (
            <div className="history-empty">No scans yet</div>
          ) : (
            <>
              <button className="history-clear" onClick={clearHistory}>
                Clear History
              </button>
              {history.map((entry, i) => (
                <div className="history-item" key={i}>
                  <span className="history-domain">{entry.domain}</span>
                  <span
                    className={
                      entry.pqc_readiness === "NOT PQC-Ready"
                        ? "history-dot not-ready"
                        : "history-dot ready"
                    }
                  ></span>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Mode switcher: toggle between Single Domain and Batch Scan */}
      <div className="mode-toggle">
        <button
          className={mode === "single" ? "active" : ""}
          onClick={() => setMode("single")}
        >
          Single Domain
        </button>
        <button
          className={mode === "batch" ? "active" : ""}
          onClick={() => setMode("batch")}
        >
          Batch Scan
        </button>
      </div>

      {/* Input panel — its contents swap based on the active mode */}
      <div className="input-panel">
        {/* Single mode: one domain textbox + scan button */}
        {mode === "single" && (
          <>
            <input
              type="text"
              placeholder="e.g. google.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            />
            <button
              className="scan-btn"
              onClick={scanSingle}
              disabled={loading}
            >
              {loading ? "Scanning..." : "Scan Domain"}
            </button>
          </>
        )}

        {/* Batch mode: choose between manual typing and file upload */}
        {mode === "batch" && (
          <>
            <div className="batch-sub-toggle">
              <button
                className={batchInputType === "manual" ? "active" : ""}
                onClick={() => setBatchInputType("manual")}
              >
                Type Domains
              </button>
              <button
                className={batchInputType === "file" ? "active" : ""}
                onClick={() => setBatchInputType("file")}
              >
                Upload .txt
              </button>
            </div>

            {/* Manual entry: textarea with one domain per line */}
            {batchInputType === "manual" && (
              <>
                <textarea
                  placeholder={
                    "One domain per line, e.g.\ngoogle.com\ncloudflare.com"
                  }
                  value={domainList}
                  onChange={(e) => setDomainList(e.target.value)}
                />
                <button
                  className="scan-btn"
                  onClick={scanBatchManual}
                  disabled={loading}
                >
                  {loading ? "Scanning..." : "Scan All Domains"}
                </button>
              </>
            )}

            {/* File upload: pick a .txt file containing the domains */}
            {batchInputType === "file" && (
              <>
                <input
                  type="file"
                  accept=".txt"
                  onChange={(e) => setFile(e.target.files[0])}
                  style={{ marginBottom: "0.8rem" }}
                />
                <button
                  className="scan-btn"
                  onClick={scanBatchFile}
                  disabled={loading || !file}
                >
                  {loading ? "Scanning..." : "Scan File"}
                </button>
              </>
            )}
          </>
        )}
      </div>

      {/* Live progress bar and "Scanning X of Y" text shown during a batch run */}
      {loading && progress.total > 0 && (
        <div className="progress-bar-container">
          <div className="progress-text">
            Scanning {progress.current} of {progress.total}...
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Results toolbar: CSV/PDF export on the left, Cards/Table view toggle on the right */}
      {mode === "batch" && results.length > 0 && (
        <div className="view-toggle">
          {mode === "batch" && results.length > 0 && (
            <span className="results-toolbar">
              <button className="export-btn" onClick={exportCSV}>
                Export CSV
              </button>
              <button className="export-btn" onClick={exportPDF}>
                Export PDF
              </button>
            </span>
          )}
          <button
            className={viewMode === "cards" ? "active" : ""}
            onClick={() => setViewMode("cards")}
          >
            Cards
          </button>
          <button
            className={viewMode === "table" ? "active" : ""}
            onClick={() => setViewMode("table")}
          >
            Table
          </button>
        </div>
      )}

      {/* Render results as cards (single mode or card view) or as a comparison table */}
      {viewMode === "cards" || mode === "single" ? (
        results.map((result, i) => (
          <div className="result-card" key={i}>
            <div className="result-header">
              <h3>{result.domain}</h3>
              {getBadge(result)}
            </div>
            {getOverallStatus(result) && (
              <div
                className={`overall-status ${getOverallStatus(result).className}`}
              >
                {getOverallStatus(result).text}
              </div>
            )}
            {result.error ? (
              <div className="result-detail">{result.error}</div>
            ) : (
              <div className="result-detail">
                Signature: <span>{result.signature_algorithm}</span>
                <br />
                Public Key: <span>{result.public_key_type}</span>
                <br />
                Expires: <span>{result.not_valid_after}</span>
                <br />
                {result.pqc_handshake && (
                  <>
                    Negotiated Group: <span>{result.negotiated_group}</span>
                    <br />
                  </>
                )}
              </div>
            )}
          </div>
        ))
      ) : (
        // Table view (batch mode): full-width comparison table that scrolls
        // horizontally on small screens — layout handled in App.css
        <div className="comparison-table-wrapper">
          <table className="comparison-table">
            <thead>
              <tr>
                <th>Domain</th>
                <th>Cert</th>
                <th>Handshake</th>
                <th>Signature</th>
                <th>Expires</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result, i) => (
                <tr key={i}>
                  <td>{result.domain}</td>
                  {result.error ? (
                    <td colSpan="4" className="table-error">
                      {result.error}
                    </td>
                  ) : (
                    <>
                      <td>
                        <span
                          className={
                            result.pqc_readiness === "NOT PQC-Ready"
                              ? "dot not-ready"
                              : "dot ready"
                          }
                        ></span>
                      </td>
                      <td>
                        <span
                          className={
                            result.pqc_handshake ? "dot ready" : "dot not-ready"
                          }
                        ></span>
                      </td>
                      <td className="table-mono">
                        {result.signature_algorithm}
                      </td>
                      <td className="table-mono">
                        {result.not_valid_after?.split(" ")[0]}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Site footer with author links */}
      <footer className="footer">
        <a
          href="https://github.com/Maxbee722"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
        <span className="footer-dot">·</span>
        <a
          href="https://github.com/Maxbee722/pqc-readiness-scanner"
          target="_blank"
          rel="noopener noreferrer"
        >
          View Source
        </a>
        <span className="footer-dot">·</span>
        <a
          href="https://www.linkedin.com/in/maxwell-beyioku-678870301"
          target="_blank"
          rel="noopener noreferrer"
        >
          LinkedIn
        </a>
        <span className="footer-dot">·</span>
        <a href="mailto:beyiokuobaloluwa@gmail.com">Email</a>
      </footer>
    </div>
  );
}

export default App;
