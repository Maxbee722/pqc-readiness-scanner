import { useState, useEffect } from "react";
import "./App.css";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function App() {
  const [mode, setMode] = useState("single");
  const [batchInputType, setBatchInputType] = useState("manual");
  const [domain, setDomain] = useState("");
  const [domainList, setDomainList] = useState("");
  const [file, setFile] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [viewMode, setViewMode] = useState("cards");
  const [showLearnMore, setShowLearnMore] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("pqc_scan_history");
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (err) {
        console.error("Could not load scan history");
      }
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("pqc_scan_history");
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (err) {
        console.error("Could not load scan history");
      }
    }
  }, []);

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

  const API_BASE = "https://pqc-readiness-scanner.onrender.com";

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
    } catch (err) {
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

  const scanBatchManual = async () => {
    const domains = domainList
      .split("\n")
      .map((d) => d.trim())
      .filter((d) => d.length > 0);

    if (domains.length === 0) return;
    await runBatch(domains);
  };

  const scanBatchFile = async () => {
    if (!file) return;
    const text = await file.text();
    const domains = text
      .split("\n")
      .map((d) => d.trim())
      .filter((d) => d.length > 0);

    await runBatch(domains);
  };

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
      } catch (err) {
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

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem("pqc_scan_history");
  };

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

    const csvContent = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pqc-scan-results-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

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

    doc.save(`pqc-scan-results-${new Date().toISOString().split("T")[0]}.pdf`);
  };

  return (
    <div className="app">
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
          ⚠️ Certificate and handshake results are checked independently — a
          domain can pass one and fail the other. Handshake detection is fully
          accurate locally; on the current Render deployment it may under-report
          due to a hosting-side OpenSSL version limit (see README).
        </div>
      </div>

      <button
        className="learn-more-toggle"
        onClick={() => setShowLearnMore(!showLearnMore)}
      >
        {showLearnMore ? "Hide" : "Learn More"} about PQC
      </button>

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

      <button
        className="history-toggle"
        onClick={() => setShowHistory(!showHistory)}
      >
        History {history.length > 0 && `(${history.length})`}
      </button>

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

      <div className="input-panel">
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

      {viewMode === "cards" || mode === "single" ? (
        results.map((result, i) => (
          <div className="result-card" key={i}>
            <div className="result-header">
              <h3>{result.domain}</h3>
              {getBadge(result)}
            </div>
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
