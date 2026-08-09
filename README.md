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

## Current limitation (important)

This tool currently checks **certificate signature strength only** — it does not yet inspect the TLS handshake's key exchange mechanism, which is a separate layer where hybrid post-quantum key exchange (e.g., X25519+Kyber) can already be present even when the certificate itself is classically signed. This means a "NOT READY" result reflects the certificate layer specifically, not the overall security of the connection.

In summary, every website on the internet (even PQC ready ones) would be displayed as "NOT READY".

## Roadmap (v2)

- [ ] Handshake-layer PQC key exchange detection (via 'sslyze')
- [ ] Scan progress indicator
- [ ] Scan history panel
- [ ] Batch comparison view
- [ ] Export results as PDF/CSV
- [ ] "Learn More" section explaining PQC concepts
- [ ] Insight/blog section
- [ ] Mobile responsiveness

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

## Fun fact by author

The name bash (the Bourne-Again SHell) is a double pun on creator Stephen Bourne and spiritual rebirth, built in 1989 to create a free alternative to UNIX's proprietary shell.

## Author

Built by Maxwell Beyioku — second-year cybersecurity student, Koladaisi University Ibadan.
