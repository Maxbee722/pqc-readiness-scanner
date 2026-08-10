import { useState } from "react";
import "./App.css";

function App() {
  const [mode, setMode] = useState("single");
  const [batchInputType, setBatchInputType] = useState("manual");
  const [domain, setDomain] = useState("");
  const [domainList, setDomainList] = useState("");
  const [file, setFile] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

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
      try {
        const res = await fetch(`${API_BASE}/scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain: domains[i] }),
        });
        const data = await res.json();
        collected.push(data);
      } catch (err) {
        collected.push({
          domain: domains[i],
          error: "Could not reach the scanner API.",
        });
      }

      setProgress({ current: i + 1, total: domains.length });
      setResults([...collected]);
    }

    setLoading(false);
  };

  const getBadge = (result) => {
    if (result.error) return <span className="badge error">ERROR</span>;
    if (result.pqc_readiness === "NOT PQC-Ready")
      return <span className="badge not-ready">NOT READY</span>;
    return <span className="badge ready">READY</span>;
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
          ⚠️ Results reflect certificate signature strength only — not full TLS
          handshake security. A "NOT READY" cert doesn't mean the site is
          insecure today.
        </div>
      </div>

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

      {results.map((result, i) => (
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
            </div>
          )}
        </div>
      ))}
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
