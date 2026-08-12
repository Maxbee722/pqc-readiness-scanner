#Importing requirements
import ssl
import subprocess
import socket
import shutil
import os
from cryptography import x509
from cryptography.hazmat.backends import default_backend

#Classifies a certificate's signature as PQC-ready or not
def classify_pqc_readiness(sig_algo, pubkey_type):
    vulnerable_sigs = ["sha256WithRSAEncryption", "sha384WithRSAEncryption", "ecdsa-with-SHA256", "ecdsa-with-SHA384"]
    if sig_algo in vulnerable_sigs:
        return "NOT PQC-Ready"
    else:
        return "Potentially PQC-Ready"

#Connects to a domain, extracts certificate info, and merges in handshake results
def get_cert_info(domain, port=443):
    result = {"domain": domain}
    try:
        ctx = ssl.create_default_context()
        with socket.create_connection((domain, port), timeout=5) as sock:
            with ctx.wrap_socket(sock, server_hostname=domain) as ssock:
                der_cert = ssock.getpeercert(binary_form=True)
                cert = x509.load_der_x509_certificate(der_cert, default_backend())

                sig_algo = cert.signature_algorithm_oid._name
                pubkey_type = type(cert.public_key()).__name__

                result["issuer"] = str(cert.issuer)
                result["signature_algorithm"] = sig_algo
                result["public_key_type"] = pubkey_type
                result["not_valid_after"] = str(cert.not_valid_after_utc)
                result["pqc_readiness"] = classify_pqc_readiness(sig_algo, pubkey_type)
                result["error"] = None

    except Exception as e:
        result["error"] = str(e)

    handshake_result = check_pqc_handshake(domain, port)
    result.update(handshake_result)

    return result

#Adding feature to scan multiple domains at once
def scan_multiple(domains):
    results = []
    for domain in domains:
        print(f"Scanning {domain}...")
        results.append(get_cert_info(domain))
    return results

def print_results(results):
    print("\n--- SCAN RESULTS ---")
    for r in results:
        print(f"\nDomain: {r['domain']}")
        if r["error"]:
            print(f"  ERROR: {r['error']}")
        else:
            print(f"  Issuer: {r['issuer']}")
            print(f"  Signature Algorithm: {r['signature_algorithm']}")
            print(f"  Public Key Type: {r['public_key_type']}")
            print(f"  Not Valid After: {r['not_valid_after']}")
            print(f"  PQC Readiness: {r['pqc_readiness']}")

#Manual domain input for batch mode
def get_domains_manually():
    domains = []
    print("Enter domains one at a time. Type 'done' when finished.")
    while True:
        entry = input("Domain: ").strip()
        if entry.lower() == "done":
            break
        if entry:
            domains.append(entry)
    return domains

#File upload with line by line domains for Batch mode
def get_domains_from_file():
    filepath = input("Enter the path to your .txt file: ").strip()
    try:
        with open(filepath, "r") as f:
            domains = [line.strip() for line in f if line.strip()]
        return domains
    except Exception as e:
        print(f"Could not read file: {e}")
        return []

#Selecting scan mode
def main():
    print("1: Scan a single domain")
    print("2: Scan multiple domains")
    mode = input("Choose an option: ").strip()

    if mode == "1":
        domain = input("Enter domain name: ").strip()
        result = get_cert_info(domain)
        print_results([result])

    elif mode == "2":
        print("1: Enter domains manually")
        print("2: Upload a .txt file")
        sub_mode = input("Choose an option: ").strip()

        if sub_mode == "1":
            domains = get_domains_manually()
        elif sub_mode == "2":
            domains = get_domains_from_file()
        else:
            print("Invalid option.")
            return

        if domains:
            results = scan_multiple(domains)
            print_results(results)
        else:
            print("No domains to scan.")

    else:
        print("Invalid option.")

if __name__ == "__main__":
    main()

# Captured: Negotiated TLS Post-Quantum Cryptography (PQC) Hybrid Named Groups.
#These represent hybrid key encapsulation mechanisms (KEM) combining classical
#elliptic curves (like X25519) with quantum-resistant algorithms (like ML-KEM).

PQC_GROUPS = [
    "X25519MLKEM768",
    "SecP256r1MLKEM768",
    "SecP384r1MLKEM1024",
]

#Determining PQC readiness using openssl 3.5+
def check_pqc_handshake(domain, port=443):
    groups_string = ":".join(PQC_GROUPS)
    try:
        result = subprocess.run(
            [get_openssl_path(), "s_client", "-connect", f"{domain}:{port}",
 "-groups", groups_string],
            input="",
            capture_output=True,
            text=True,
            timeout=10
        )
        output = result.stdout + result.stderr

        for group in PQC_GROUPS:
            if f"Negotiated TLS1.3 group: {group}" in output:
                return {"pqc_handshake": True, "negotiated_group": group}

        return {"pqc_handshake": False, "negotiated_group": None}

    except subprocess.TimeoutExpired:
        return {"pqc_handshake": False, "negotiated_group": None, "handshake_error": "Timed out"}
    except FileNotFoundError:
        return {"pqc_handshake": False, "negotiated_group": None, "handshake_error": "OpenSSL not found on this system"}
    except Exception as e:
        return {"pqc_handshake": False, "negotiated_group": None, "handshake_error": str(e)}

def get_openssl_path():
    found = shutil.which("openssl")
    if found:
        return found

    windows_fallback = r"C:\Program Files\Git\mingw64\bin\openssl.exe"
    if os.path.exists(windows_fallback):
        return windows_fallback

    return "openssl" 
