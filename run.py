"""
Multi-Shop Billing Management System - Single-Port Cross-Platform Launcher
Run with:
    python run.py
"""

import os
import sys
import subprocess
import webbrowser
import time

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
DIST_INDEX = os.path.join(ROOT_DIR, "dist", "index.html")

print("=" * 68)
print("  MULTI-SHOP BILLING MANAGEMENT SYSTEM (SINGLE-PORT UNIFIED LAUNCHER)")
print("=" * 68)

# Check if dist/index.html is built
if not os.path.exists(DIST_INDEX):
    print("\n[*] Frontend production bundle not found. Building with npm...")
    try:
        subprocess.run(["npm", "run", "build"], cwd=ROOT_DIR, check=True)
        print("[+] Frontend build completed successfully.")
    except Exception as e:
        print(f"[!] Warning: npm build failed or node not in PATH ({e}).")
        print("    If frontend doesn't load, run 'npm install && npm run build'.")

port = int(os.environ.get("PORT", 5000))
target_url = f"http://localhost:{port}"

print(f"\n[*] Launching browser at {target_url}...")
try:
    # Open browser slightly after server start
    def open_browser():
        time.sleep(1.2)
        webbrowser.open(target_url)

    import threading
    threading.Thread(target=open_browser, daemon=True).start()
except Exception:
    pass

print(f"[*] Starting Flask backend on single port {port}...")
print(f"[*] Serving Frontend UI and Flask Backend together!\n")

# Execute app.py
from app import app
app.run(host="0.0.0.0", port=port, debug=True)
