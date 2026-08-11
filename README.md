# PQC Readiness Scanner

A tool that scans a domain's TLS certificate and reports whether it's ready for the post-quantum cryptography transition.

## Why this matters

Quantum computers, once sufficiently powerful, will be able to break the classical encryption (RSA, ECC) that secures most of today's internet traffic. This isn't a distant hypothetical: adversaries are already using a strategy called **"harvest now, decrypt later"** — recording encrypted traffic today with the intent to decrypt it once quantum computing catches up. Data that needs to stay confidential for years (health records, government communications, financial data and many more forms of personal information) are already at risk.

In June 2026, the White House ordered accelerated federal PQC migration, with firm deadlines: post-quantum key establishment by December 2030, post-quantum signatures by December 2031. Despite this urgency, adoption remains extremely low — a 2026 measurement study found 0% adoption of post-quantum-signed certificates across the scanned internet, even as roughly half of domains have begun supporting post-quantum key exchange at the handshake layer.

Most organizations don't know where they currently stand. This tool measures that gap.

## What it does

- Connects to any domain and inspects its TLS certificate
- Identifies the certificate's signature algorithm and public key type
- Flags whether that certificate relies on classical (quantum-vulnerable) cryptography
- Supports single-domain scans, manual batch scans, and batch scans via `.txt` file upload
- Returns results through a Flask API, displayed on a React dashboard

## Known limitation: handshake-layer detection on Render

This tool includes handshake-layer PQC detection (checking whether a server negotiates a post-quantum key exchange group like X25519MLKEM768) via direct OpenSSL calls. This works correctly in local development, where a modern OpenSSL (3.5+) is available.

However, Render's current Python runtime ships OpenSSL 3.0.20, which predates ML-KEM support (added in OpenSSL 3.5, April 2025). As a result, handshake detection currently returns inaccurate results in production on Render specifically — this is a hosting environment limitation, not a code issue.

In practice, a domain's certificate and handshake results are independent — a site can pass one check and fail the other. Because Render's OpenSSL predates PQC support, a site's handshake may show as "not ready" here even if it's actually already PQC-capable in reality.

## Roadmap

**v2 (in progress)**

- [ ] Comparison view for batch mode
- [ ] Export results as PDF/CSV
- [ ] "Learn More" section explaining PQC concepts

**v3 (later)**

- [ ] Migrate hosting to an environment with OpenSSL 3.5+ (either a custom Docker deployment on Render, or an alternative host with a newer default OpenSSL) to enable accurate handshake-layer detection in production

## Tech stack

- **Backend:** Python, Flask, `cryptography`
- **Frontend:** React (Vite)

## Running it locally

**Backend:**

```bash
py -m pip install -r requirements.txt
py app.py
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

## Fun fact from author

The name bash (the Bourne-Again SHell) is a double pun on creator Stephen Bourne and spiritual rebirth, built in 1989 to create a free alternative to UNIX's proprietary shell.

## Author

Built by Maxwell Beyioku — second-year cybersecurity student, Koladaisi University.
