"""
Multi-Shop Billing Management System - Desktop Launcher
Packages Flask backend and local web interface into a single Windows Desktop Application (.exe).
Build with:
    pip install pyinstaller pywebview
    pyinstaller --onefile --windowed --name="MultiShopBilling" desktop_launcher.py
"""

import sys
import threading
import time
import os
import webbrowser

# Fix Windows DLL resolution for PyInstaller bundled applications before importing Flask/ctypes
if sys.platform == "win32":
    if getattr(sys, "frozen", False):
        exe_dir = os.path.dirname(sys.executable)
        for sub in ["", "_internal"]:
            p = os.path.join(exe_dir, sub) if sub else exe_dir
            if os.path.isdir(p):
                if hasattr(os, "add_dll_directory"):
                    try:
                        os.add_dll_directory(p)
                    except Exception:
                        pass
                os.environ["PATH"] = p + os.pathsep + os.environ.get("PATH", "")

# Import the existing Flask app
try:
    from app import app
except ImportError:
    # If app.py is in same directory
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    from app import app


import socket

def get_local_ip():
    """Detect LAN IP address to share with phones and tablets on the same Wi-Fi."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def start_flask_server():
    """Runs the Flask billing server on 0.0.0.0 port 5000 for LAN sharing."""
    lan_ip = get_local_ip()
    print("=" * 65)
    print("  MULTI-SHOP BILLING SERVER - NETWORK READY")
    print(f"  -> Local Host URL:      http://localhost:5000")
    print(f"  -> Mobile & Tablet URL: http://{lan_ip}:5000")
    print("     (Any device on the same Wi-Fi can open this link!)")
    print("=" * 65)
    app.run(host="0.0.0.0", port=5000, debug=False, use_reloader=False)


def main():
    # Start backend server in a background daemon thread
    server_thread = threading.Thread(target=start_flask_server, daemon=True)
    server_thread.start()

    # Wait 1.5 seconds for the server to bind to port 5000
    time.sleep(1.5)

    target_url = "http://127.0.0.1:5000"

    # Ensure persistent storage directory exists for browser cache, localStorage, and cookies
    base_data_dir = os.path.dirname(sys.executable if getattr(sys, "frozen", False) else os.path.abspath(__file__))
    storage_dir = os.path.join(base_data_dir, "app_data")
    os.makedirs(storage_dir, exist_ok=True)

    try:
        # Try native desktop window with pywebview if available
        import webview
        webview.create_window(
            "Multi-Shop Billing Management System",
            target_url,
            width=1280,
            height=850,
            min_size=(1024, 700)
        )
        try:
            webview.start(private_mode=False, storage_path=storage_dir)
        except (TypeError, Exception):
            try:
                webview.start(private_mode=False)
            except Exception:
                webview.start()
    except ImportError:
        # Fallback to system default browser (Chrome, Edge, Firefox) in app mode
        webbrowser.open(target_url)
        print("Desktop Billing System is running at:", target_url)
        # Keep process alive
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
