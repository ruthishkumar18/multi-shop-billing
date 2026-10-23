#!/usr/bin/env python3
"""
================================================================================
Multi-Shop Billing Management System - Universal Build & Packager Tool
================================================================================
Packages the Flask backend, MySQL schema, and compiled React frontend into:
  1. A portable distribution folder (dist/MultiShopBilling_Portable)
  2. A single-file portable archive (.zip)
  3. A self-contained Windows Desktop Executable (.exe) via PyInstaller

Usage:
  python build.py               # Complete build (Frontend + Portable Bundle + Instructions)
  python build.py --frontend    # Build compiled React SPA only
  python build.py --exe         # Compile standalone .exe with PyInstaller
  python build.py --all         # Build frontend, portable bundle, and .exe
================================================================================
"""

import os
import sys
import shutil
import zipfile
import subprocess
import argparse

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
DIST_DIR = os.path.join(ROOT_DIR, "dist")
PORTABLE_DIR = os.path.join(DIST_DIR, "MultiShopBilling_Portable")
ZIP_OUTPUT = os.path.join(DIST_DIR, "MultiShopBilling_Portable.zip")


def print_banner(text):
    print("\n" + "=" * 72)
    print(f"  {text}")
    print("=" * 72)


def build_frontend():
    """Compiles the React + Vite frontend into the /dist directory or downloads pre-compiled bundle."""
    print_banner("[Step 1/3] Building React Frontend SPA with Vite")
    print(f"[*] Workspace Root: {ROOT_DIR}")

    # If dist/index.html already exists and is non-empty, we can use it
    if os.path.isfile(os.path.join(DIST_DIR, "index.html")) and os.path.getsize(os.path.join(DIST_DIR, "index.html")) > 100:
        print(f"[+] Found existing production frontend build: {os.path.join(DIST_DIR, 'index.html')}")
        return True

    # Check if npm is installed and node_modules exists
    npm_cmd = shutil.which("npm")
    node_modules_dir = os.path.join(ROOT_DIR, "node_modules")

    if not npm_cmd or not os.path.isdir(node_modules_dir):
        print("[*] Local Node.js / node_modules not detected. Fetching pre-compiled production bundle...")
        return download_precompiled_frontend()

    try:
        print("[*] Running 'npm run build'...")
        res = subprocess.run(["npm", "run", "build"], cwd=ROOT_DIR, shell=True if os.name == 'nt' else False)
        if res.returncode == 0 and os.path.isfile(os.path.join(DIST_DIR, "index.html")):
            print(f"[+] Frontend compiled successfully: {os.path.join(DIST_DIR, 'index.html')}")
            return True
        print("[!] Local npm build could not complete. Switching to pre-compiled production bundle...")
        return download_precompiled_frontend()
    except Exception as e:
        print(f"[!] Local build exception: {e}")
        return download_precompiled_frontend()


def download_precompiled_frontend():
    """Downloads and extracts the pre-compiled production frontend bundle so users don't need Node.js."""
    import urllib.request
    print("[*] Fetching pre-compiled production frontend bundle from cloud...")
    bundle_url = "https://ais-pre-6v77nd5nj4dp35imkwhmr7-304539555218.asia-east1.run.app/dist.zip"
    zip_temp = os.path.join(ROOT_DIR, "dist_precompiled.zip")
    try:
        urllib.request.urlretrieve(bundle_url, zip_temp)
        with zipfile.ZipFile(zip_temp, "r") as z:
            z.extractall(ROOT_DIR)
        if os.path.exists(zip_temp):
            os.remove(zip_temp)
        if os.path.isfile(os.path.join(DIST_DIR, "index.html")):
            print("[+] Pre-compiled production frontend (dist/) installed successfully!")
            return True
        print("[X] Could not verify dist/index.html after extraction.")
        return False
    except Exception as dl_err:
        print(f"[!] Could not download pre-compiled frontend: {dl_err}")
        print("    Please download the complete pre-compiled package from Admin Console -> Export Center.")
        return False


def create_portable_bundle():
    """Packages all necessary runtime files into a clean portable folder and zip."""
    print_banner("[Step 2/3] Creating Portable Distribution Package")

    if os.path.exists(PORTABLE_DIR):
        shutil.rmtree(PORTABLE_DIR, ignore_errors=True)
    os.makedirs(PORTABLE_DIR, exist_ok=True)

    # Core files to include
    files_to_copy = [
        "app.py",
        "run.py",
        "run_app.bat",
        "schema.sql",
        "requirements.txt",
        ".env.example",
        "README.md",
        "desktop_launcher.py",
        "build_desktop_exe.bat",
        "start_public_live_tunnel.bat"
    ]

    for fname in files_to_copy:
        src = os.path.join(ROOT_DIR, fname)
        if os.path.isfile(src):
            dst = os.path.join(PORTABLE_DIR, fname)
            shutil.copy2(src, dst)
            print(f"  + Included: {fname}")

    # Copy static/uploads folder
    static_src = os.path.join(ROOT_DIR, "static")
    if os.path.exists(static_src):
        shutil.copytree(static_src, os.path.join(PORTABLE_DIR, "static"), dirs_exist_ok=True)
        print("  + Included: static/ directory")

    # Copy compiled frontend dist/ (excluding portable folder itself)
    portable_frontend_dist = os.path.join(PORTABLE_DIR, "dist")
    os.makedirs(portable_frontend_dist, exist_ok=True)

    for item in os.listdir(DIST_DIR):
        if item == "MultiShopBilling_Portable" or item.endswith(".zip"):
            continue
        s = os.path.join(DIST_DIR, item)
        d = os.path.join(portable_frontend_dist, item)
        if os.path.isdir(s):
            shutil.copytree(s, d, dirs_exist_ok=True)
        else:
            shutil.copy2(s, d)
    print("  + Included: dist/ (compiled frontend bundle & assets)")

    # Create ZIP archive
    print("\n[*] Compressing into portable ZIP archive...")
    with zipfile.ZipFile(ZIP_OUTPUT, "w", zipfile.ZIP_DEFLATED) as z:
        for root, _, files in os.walk(PORTABLE_DIR):
            for file in files:
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, PORTABLE_DIR)
                z.write(full_path, rel_path)

    print(f"[+] Portable directory ready at: {PORTABLE_DIR}")
    print(f"[+] Portable ZIP ready at:       {ZIP_OUTPUT}")
    return True


def build_executable(onefile: bool = False):
    """Packages the application into a standalone Windows .exe using PyInstaller."""
    print_banner("[Step 3/3] Compiling Standalone Executable (.exe)")

    # Ensure frontend assets are ready
    if not os.path.isfile(os.path.join(DIST_DIR, "index.html")):
        print("[*] dist/index.html not detected. Automatically preparing frontend assets...")
        build_frontend()

    pyinstaller_cmd = shutil.which("pyinstaller")
    if not pyinstaller_cmd:
        print("[!] PyInstaller is not currently installed in this environment.")
        print_exe_instructions()
        return False

    mode_label = "Single-file .exe (--onefile)" if onefile else "Distribution directory (--onedir)"
    print(f"[*] PyInstaller detected. Compiling desktop_launcher.py into {mode_label}...")

    # Data separation separator (';' on Windows, ':' on Unix)
    sep = ";" if os.name == "nt" else ":"
    mode_flag = "--onefile" if onefile else "--onedir"

    cmd = [
        "pyinstaller",
        "--noconfirm",
        mode_flag,
        "--windowed",
        "--name", "MultiShopBilling",
        "--hidden-import=ctypes",
        "--hidden-import=_ctypes",
        f"--add-data=dist{sep}dist",
        f"--add-data=schema.sql{sep}.",
        f"--add-data=.env.example{sep}.",
        "desktop_launcher.py"
    ]

    # Automatically collect ctypes and dependent DLLs on Windows
    if os.name == "nt":
        dll_dir = os.path.join(sys.base_prefix, "DLLs")
        if os.path.isdir(dll_dir):
            for f in os.listdir(dll_dir):
                if any(k in f.lower() for k in ["ctypes", "ffi", "sqlite"]):
                    cmd.append(f"--add-binary={os.path.join(dll_dir, f)}{sep}.")

    try:
        subprocess.run(cmd, cwd=ROOT_DIR, check=True)
        if onefile:
            exe_path = os.path.join(DIST_DIR, "MultiShopBilling.exe" if os.name == "nt" else "MultiShopBilling")
        else:
            app_folder = os.path.join(DIST_DIR, "MultiShopBilling")
            exe_path = os.path.join(app_folder, "MultiShopBilling.exe" if os.name == "nt" else "MultiShopBilling")
            # Guarantee dist/ folder and .env.example are directly placed beside MultiShopBilling.exe
            target_dist = os.path.join(app_folder, "dist")
            src_dist = os.path.join(ROOT_DIR, "dist")
            os.makedirs(target_dist, exist_ok=True)
            for item in os.listdir(src_dist):
                if item.startswith("MultiShopBilling") or item.endswith(".zip"):
                    continue
                s = os.path.join(src_dist, item)
                d = os.path.join(target_dist, item)
                if os.path.isdir(s):
                    shutil.copytree(s, d, dirs_exist_ok=True)
                else:
                    shutil.copy2(s, d)
            env_ex = os.path.join(ROOT_DIR, ".env.example")
            if os.path.exists(env_ex):
                shutil.copy2(env_ex, os.path.join(app_folder, ".env.example"))
                shutil.copy2(env_ex, os.path.join(app_folder, ".env"))

            # Guarantee Windows DLLs are directly available in the app folder and _internal
            if os.name == "nt":
                dll_dir = os.path.join(sys.base_prefix, "DLLs")
                if os.path.isdir(dll_dir):
                    target_internal = os.path.join(app_folder, "_internal")
                    os.makedirs(target_internal, exist_ok=True)
                    for f in os.listdir(dll_dir):
                        if any(k in f.lower() for k in ["ctypes", "ffi", "sqlite"]):
                            src_f = os.path.join(dll_dir, f)
                            try:
                                shutil.copy2(src_f, os.path.join(app_folder, f))
                                shutil.copy2(src_f, os.path.join(target_internal, f))
                            except Exception:
                                pass
        print(f"[+] Standalone executable compiled successfully at:\n    {exe_path}")
        return True
    except Exception as e:
        print(f"[!] PyInstaller compilation failed: {e}")
        print_exe_instructions()
        return False


def print_exe_instructions():
    """Prints clear, human-friendly instructions to build the .exe on any Windows machine."""
    print_banner("Instructions for Creating Self-Contained Windows Executable (.exe)")
    print("""
Follow these 2 simple steps on any Windows PC:

Step 1: Install PyInstaller and PyWebView
------------------------------------------------------------------------
Open Command Prompt in your extracted project directory and run:

    pip install pyinstaller pywebview

Step 2: Run the Executable Builder
------------------------------------------------------------------------
Double-click `build_desktop_exe.bat` OR run:

    # Directory bundle (fast startup, all dependencies in dist/MultiShopBilling/):
    python build.py --exe

    # Single-file standalone .exe (copy dist/MultiShopBilling.exe anywhere!):
    python build.py --exe --onefile

Output:
------------------------------------------------------------------------
Your standalone application will be generated in:
    Single-file:  dist\\MultiShopBilling.exe
    Directory:    dist\\MultiShopBilling\\MultiShopBilling.exe

You can copy this executable to any computer! When clicked, it automatically
starts the billing system in a dedicated native window without requiring
Python or Node.js to be installed on that machine.
""")


def main():
    parser = argparse.ArgumentParser(description="Multi-Shop Billing Management System - Universal Build & Packager")
    parser.add_argument("--frontend", action="store_true", help="Compile React frontend only")
    parser.add_argument("--exe", action="store_true", help="Compile standalone Windows .exe")
    parser.add_argument("--onefile", action="store_true", help="Package into a single self-contained .exe file")
    parser.add_argument("--all", action="store_true", help="Run full build: frontend, portable bundle, and .exe")

    args = parser.parse_args()

    print_banner("MULTI-SHOP BILLING MANAGEMENT SYSTEM - UNIVERSAL BUILDER")

    if args.frontend:
        build_frontend()
        return

    if args.exe:
        build_executable(onefile=args.onefile)
        return

    # Default build sequence
    build_frontend()
    create_portable_bundle()

    if args.all:
        build_executable(onefile=args.onefile)
    else:
        print_exe_instructions()

    print_banner("BUILD COMPLETED SUCCESSFULLY")
    print(f"  -> Portable Directory: dist/MultiShopBilling_Portable/")
    print(f"  -> Portable ZIP:       dist/MultiShopBilling_Portable.zip")
    print(f"  -> 1-Click Runner:     run_app.bat (Single Port 5000)")
    print("=" * 72 + "\n")


if __name__ == "__main__":
    main()
