import ssl
import socket
from cryptography import x509
from cryptography.hazmat.backends import default_backend

def classify_pqc_readiness(sig_algo, pubkey_type):
    vulnerable_sigs = ["sha256WithRSAEncryption", "sha384WithRSAEncryption", "ecdsa-with-SHA256", "ecdsa-with-SHA384"]
    if sig_algo in vulnerable_sigs:
        return "NOT PQC-Ready"
    else:
        return "Potentially PQC-Ready"

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

    return result

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

def get_domains_from_file():
    filepath = input("Enter the path to your .txt file: ").strip()
    try:
        with open(filepath, "r") as f:
            domains = [line.strip() for line in f if line.strip()]
        return domains
    except Exception as e:
        print(f"Could not read file: {e}")
        return []

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
