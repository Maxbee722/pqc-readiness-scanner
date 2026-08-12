from flask import Flask, request, jsonify
from flask_cors import CORS
from scanner import get_cert_info, scan_multiple
import subprocess

app = Flask(__name__)
CORS(app)

# API layer: exposes the scanner's functions as HTTP endpoints for the frontend
@app.route("/scan", methods=["POST"])
def scan_single():
    # Scans a single domain, expects {"domain": "example.com"} in the request body
    data = request.get_json()
    domain = data.get("domain")

    if not domain:
        return jsonify({"error": "No domain provided"}), 400

    result = get_cert_info(domain)
    return jsonify(result)

@app.route("/scan-batch", methods=["POST"])
def scan_batch():
    # Scans multiple domains, expects {"domains": [...]} in the request body
    data = request.get_json()
    domains = data.get("domains")

    if not domains or not isinstance(domains, list):
        return jsonify({"error": "No domain list provided"}), 400

    results = scan_multiple(domains)
    return jsonify(results)

@app.route("/ping", methods=["GET"])
def ping():
    # Lightweight health-check endpoint, used by the keep-alive cron job to prevent Render's free tier from spinning down
    return jsonify({"status": "alive"})

if __name__ == "__main__":
    app.run(debug=True, port=5000)
