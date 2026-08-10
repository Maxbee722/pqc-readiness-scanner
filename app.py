from flask import Flask, request, jsonify
from flask_cors import CORS
from scanner import get_cert_info, scan_multiple
import subprocess

app = Flask(__name__)
CORS(app)

@app.route("/scan", methods=["POST"])
def scan_single():
    data = request.get_json()
    domain = data.get("domain")

    if not domain:
        return jsonify({"error": "No domain provided"}), 400

    result = get_cert_info(domain)
    return jsonify(result)

@app.route("/scan-batch", methods=["POST"])
def scan_batch():
    data = request.get_json()
    domains = data.get("domains")

    if not domains or not isinstance(domains, list):
        return jsonify({"error": "No domain list provided"}), 400

    results = scan_multiple(domains)
    return jsonify(results)

if __name__ == "__main__":
    app.run(debug=True, port=5000)

    
@app.route("/ping", methods=["GET"])
def ping():
    return jsonify({"status": "alive"})
