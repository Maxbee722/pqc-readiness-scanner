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

## Handshake-layer detection

This tool checks two independent layers of PQC readiness: the certificate's signature algorithm, and the TLS handshake's key exchange mechanism (via direct OpenSSL calls checking for X25519MLKEM768 and related hybrid groups).

Handshake-layer detection requires OpenSSL 3.5+ (released April 2025, the first version with native ML-KEM support). This app is deployed via Docker on Render specifically to guarantee this — the base image (`python:3.12-slim-trixie`) ships OpenSSL 3.5.6, since Render's native Python buildpack only provides OpenSSL 3.0.20. As of this deployment, handshake detection is fully accurate in production.

## Why every domain shows "Cert: Classical" today

As of 2026, essentially no Certificate Authority issues PQC-signed certificates yet — a 2026 measurement study found 0% adoption of post-quantum certificates across the scanned internet. This means every domain this tool scans will currently show "Cert: Classical," regardless of how PQC-ready that organization actually is at the handshake layer. This is expected, accurate behavior, not a bug — it reflects a real, current gap in CA infrastructure, not a limitation of this tool.

## v3 (complete)

- [x] Migrated hosting to Docker on Render with OpenSSL 3.5+ for accurate handshake-layer detection in production

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
