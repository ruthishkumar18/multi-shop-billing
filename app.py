"""
Multi-Shop Billing Management System
Flask Backend with MySQL integration, secure sessions, role-based access,
transactional billing, invoice generation, WhatsApp/SMS sharing, and profile management.
"""

import sys
import os

# Fix Windows DLL resolution for PyInstaller bundled applications before importing Flask/ctypes
if sys.platform == "win32":
    if getattr(sys, "frozen", False):
        _exe_dir = os.path.dirname(sys.executable)
        for _sub in ["", "_internal"]:
            _p = os.path.join(_exe_dir, _sub) if _sub else _exe_dir
            if os.path.isdir(_p):
                if hasattr(os, "add_dll_directory"):
                    try:
                        os.add_dll_directory(_p)
                    except Exception:
                        pass
                os.environ["PATH"] = _p + os.pathsep + os.environ.get("PATH", "")

import re
import json
import datetime
import urllib.parse
from functools import wraps
from decimal import Decimal, ROUND_HALF_UP

from flask import (
    Flask, render_template, request, redirect,
    url_for, session, flash, jsonify, send_from_directory, abort
)
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import pymysql
from dotenv import load_dotenv

# Detect if running inside a PyInstaller bundled executable
IS_FROZEN = getattr(sys, "frozen", False)
BASE_DIR = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
EXE_DIR = os.path.dirname(sys.executable) if IS_FROZEN else os.path.dirname(os.path.abspath(__file__))

# Local persistent database file (guarantees data persistence on PC storage even if MySQL is offline)
LOCAL_DB_FILE = os.path.join(EXE_DIR, "billing_database.json")

def load_local_db():
    default_data = {
        "users": [
            {
                "id": 1,
                "shop_name": "System Administration",
                "owner_name": "Master Administrator",
                "username": "admin",
                "password_hash": "Admin@2026",
                "role": "admin",
                "mobile": "9876543210",
                "email": "admin@billingsystem.local",
                "status": "active",
                "created_at": datetime.datetime.now().isoformat()
            }
        ],
        "profiles": [],
        "products": [],
        "bills": [],
        "logs": []
    }
    if not os.path.exists(LOCAL_DB_FILE):
        save_local_db(default_data)
        return default_data
    try:
        with open(LOCAL_DB_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default_data

def save_local_db(data):
    try:
        temp_file = LOCAL_DB_FILE + ".tmp"
        with open(temp_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, default=str)
        if os.path.exists(LOCAL_DB_FILE):
            os.remove(LOCAL_DB_FILE)
        os.rename(temp_file, LOCAL_DB_FILE)
    except Exception as e:
        print("[!] Error saving local database file:", e)

# Look for external .env next to the .exe first, then fallback to internal
ext_env = os.path.join(EXE_DIR, ".env")
if os.path.exists(ext_env):
    load_dotenv(ext_env)
else:
    load_dotenv(os.path.join(BASE_DIR, ".env"))

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "super-secret-billing-key-change-in-production-2026")

# MySQL Configuration (Default: localhost, root, no password, billing_db)
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "billing_db")
DB_PORT = int(os.getenv("DB_PORT", "3306"))

# Locate compiled React frontend bundle across all execution & packaging modes
def get_dist_dir():
    """Finds the compiled React frontend dist folder across all deployment and packaging modes."""
    candidates = [
        # 1. PyInstaller runtime temp unpack directory
        os.path.join(getattr(sys, "_MEIPASS", ""), "dist"),
        # 2. PyInstaller 6+ _internal/dist subdirectory
        os.path.join(EXE_DIR, "_internal", "dist"),
        # 3. Direct dist/ folder beside the .exe
        os.path.join(EXE_DIR, "dist"),
        # 4. Parent directory if executable is in dist/MultiShopBilling/
        os.path.dirname(EXE_DIR) if os.path.basename(os.path.dirname(EXE_DIR)).lower() == "dist" else "",
        # 5. Parent project root / dist
        os.path.join(os.path.dirname(os.path.dirname(EXE_DIR)), "dist"),
        # 6. Standard development path relative to app.py
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "dist"),
        # 7. Current working directory dist
        os.path.join(os.getcwd(), "dist"),
        # 8. Current working directory itself
        os.getcwd(),
    ]
    for c in candidates:
        if c and os.path.isdir(c) and os.path.isfile(os.path.join(c, "index.html")):
            return os.path.abspath(c)
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), "dist")

DIST_DIR = get_dist_dir()

# Persist uploaded logos beside the executable on client machine
UPLOAD_FOLDER = os.path.join(EXE_DIR, "static", "uploads")
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = 4 * 1024 * 1024  # 4 MB max logo size

os.makedirs(UPLOAD_FOLDER, exist_ok=True)


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET,PUT,POST,DELETE,OPTIONS"
    return response


# -----------------------------------------------------------------------------
# Single-Port Frontend Assets & Uploads Serving
# -----------------------------------------------------------------------------

@app.route("/assets/<path:path>")
def serve_assets(path):
    """Serve Vite compiled frontend assets in single-port mode."""
    dist_dir = get_dist_dir()
    assets_dir = os.path.join(dist_dir, "assets")
    if os.path.exists(os.path.join(assets_dir, path)):
        return send_from_directory(assets_dir, path)
    # Check alternate locations
    for base in [
        os.path.join(EXE_DIR, "dist", "assets"),
        os.path.join(EXE_DIR, "_internal", "dist", "assets"),
        os.path.join(getattr(sys, "_MEIPASS", ""), "dist", "assets"),
        os.path.join(os.path.dirname(EXE_DIR), "assets"),
        os.path.join(os.path.dirname(os.path.dirname(EXE_DIR)), "dist", "assets"),
    ]:
        if os.path.exists(os.path.join(base, path)):
            return send_from_directory(base, path)
    abort(404)


@app.route("/static/uploads/<path:filename>")
def serve_uploaded_file(filename):
    """Serve uploaded shop logo files."""
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename)


@app.route("/dist.zip")
def serve_dist_zip_file():
    """Serve pre-compiled frontend distribution zip."""
    for candidate_dir in [
        os.path.join(EXE_DIR, "public"),
        os.path.join(ROOT_DIR, "public"),
        EXE_DIR,
        ROOT_DIR,
    ]:
        p = os.path.join(candidate_dir, "dist.zip")
        if os.path.isfile(p):
            return send_from_directory(os.path.dirname(p), "dist.zip", as_attachment=True)
    abort(404)


@app.route("/MultiShopBilling_Portable.zip")
def serve_portable_zip_file():
    """Serve portable zip package."""
    for candidate_dir in [
        os.path.join(EXE_DIR, "public"),
        os.path.join(ROOT_DIR, "public"),
        os.path.join(ROOT_DIR, "dist"),
        EXE_DIR,
        ROOT_DIR,
    ]:
        p = os.path.join(candidate_dir, "MultiShopBilling_Portable.zip")
        if os.path.isfile(p):
            return send_from_directory(os.path.dirname(p), "MultiShopBilling_Portable.zip", as_attachment=True)
    abort(404)


@app.route("/api/health", methods=["GET"])
def api_health():
    """Single-port health check verifying both server and MySQL database connectivity."""
    db_ok = False
    db_msg = "Connected"
    try:
        conn = get_db_connection()
        conn.close()
        db_ok = True
    except Exception as e:
        db_msg = str(e)

    return jsonify({
        "status": "online",
        "mode": "single-port",
        "port": int(os.environ.get("PORT", 5000)),
        "database_connected": db_ok,
        "database_message": db_msg,
        "database_name": DB_NAME,
        "timestamp": datetime.datetime.now().isoformat()
    })


@app.route("/api/public/invoice/<bill_number>", methods=["GET"])
def api_public_invoice(bill_number):
    """Public digital receipt endpoint accessible via customer QR code scan."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM bills WHERE bill_number = %s", (bill_number,))
            bill = cursor.fetchone()
            if not bill:
                return jsonify({"error": "Invoice not found"}), 404

            cursor.execute("SELECT * FROM bill_items WHERE bill_id = %s ORDER BY id ASC", (bill["id"],))
            items = cursor.fetchall()

            cursor.execute("SELECT * FROM shop_profiles WHERE user_id = %s", (bill["user_id"],))
            profile = cursor.fetchone()
            if not profile:
                profile = {
                    "brand_name": "Store Receipt",
                    "owner_name": "",
                    "mobile": "",
                    "email": "",
                    "bill_header": "",
                    "bill_footer": "Thank you for your purchase!",
                    "currency_symbol": "₹"
                }

            # Format decimals for JSON serialization
            bill["subtotal"] = float(bill.get("subtotal") or 0)
            bill["discount"] = float(bill.get("discount") or 0)
            bill["grand_total"] = float(bill.get("grand_total") or 0)
            bill["items"] = []
            for it in items:
                bill["items"].append({
                    "id": it["id"],
                    "bill_id": it["bill_id"],
                    "product_name": it["product_name"],
                    "unit": it.get("unit", "Pieces"),
                    "quantity": float(it.get("quantity") or 0),
                    "unit_price": float(it.get("unit_price") or 0),
                    "amount": float(it.get("amount") or 0)
                })

            return jsonify({"bill": bill, "profile": profile})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


# -----------------------------------------------------------------------------
# REST API Endpoints for React Frontend & MySQL Persistence
# -----------------------------------------------------------------------------

@app.route("/api/network/info", methods=["GET"])
def api_network_info():
    """Returns host IP address for local network multi-device sharing (mobile, tablet, laptop)."""
    import socket
    local_ip = "127.0.0.1"
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
    except Exception:
        pass
    port = int(os.environ.get("PORT", 5000))
    return jsonify({
        "success": True,
        "local_ip": local_ip,
        "port": port,
        "lan_url": f"http://{local_ip}:{port}",
        "local_url": f"http://localhost:{port}"
    })


@app.route("/api/export/save-file", methods=["POST"])
def api_export_save_file():
    """
    Saves exported reports & PDFs directly to the user's Downloads folder on disk.
    Solves WebView2 / PyInstaller desktop app restrictions where synthetic browser <a> downloads are blocked.
    """
    import base64
    import subprocess
    try:
        data = request.get_json(force=True, silent=True) or {}
        filename = secure_filename(data.get("filename", "report_export.txt"))
        if not filename:
            filename = f"export_{int(datetime.datetime.now().timestamp())}.txt"
        
        content = data.get("content", "")
        is_base64 = bool(data.get("is_base64", False))
        open_after = bool(data.get("open_after", False))

        # Target user's OS Downloads folder
        user_home = os.path.expanduser("~")
        downloads_dir = os.path.join(user_home, "Downloads")
        if not os.path.isdir(downloads_dir):
            downloads_dir = os.path.join(EXE_DIR, "downloads")
        os.makedirs(downloads_dir, exist_ok=True)

        target_file = os.path.join(downloads_dir, filename)

        # Write data
        if is_base64:
            # Handle data URL prefix if present (e.g. data:application/pdf;base64,...)
            if "," in content:
                content = content.split(",", 1)[1]
            raw_bytes = base64.b64decode(content)
            with open(target_file, "wb") as f:
                f.write(raw_bytes)
        else:
            with open(target_file, "w", encoding="utf-8-sig") as f:
                f.write(content)

        # Optionally open in default Windows app or highlight in File Explorer
        if open_after and sys.platform == "win32":
            try:
                os.startfile(target_file)
            except Exception:
                try:
                    subprocess.Popen(["explorer", "/select,", target_file])
                except Exception:
                    pass

        return jsonify({
            "success": True,
            "filename": filename,
            "saved_path": target_file,
            "directory": downloads_dir,
            "message": f"Successfully saved to {target_file}"
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/export/open-file", methods=["POST"])
def api_export_open_file():
    """Opens a saved file or highlights it in Windows Explorer."""
    import subprocess
    data = request.get_json(force=True, silent=True) or {}
    filepath = data.get("path", "")
    if not filepath or not os.path.exists(filepath):
        return jsonify({"success": False, "error": "File not found"}), 404

    try:
        if sys.platform == "win32":
            try:
                os.startfile(filepath)
            except Exception:
                subprocess.Popen(["explorer", "/select,", filepath])
        else:
            subprocess.Popen(["xdg-open", filepath])
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/database/status", methods=["GET"])
def api_database_status():
    """Verify MySQL connectivity and return row counts for all application tables, with local disk storage fallback."""
    try:
        conn = get_db_connection()
        counts = {"users": 0, "shop_profiles": 0, "products": 0, "bills": 0, "bill_items": 0}
        with conn.cursor() as cursor:
            for tbl in counts.keys():
                try:
                    cursor.execute(f"SELECT COUNT(*) as cnt FROM `{tbl}`")
                    counts[tbl] = cursor.fetchone()["cnt"]
                except Exception:
                    counts[tbl] = -1
        conn.close()
        return jsonify({
            "connected": True,
            "storage": "MySQL Database",
            "database": DB_NAME,
            "host": f"{DB_HOST}:{DB_PORT}",
            "tables": counts,
            "message": "Connected to MySQL successfully"
        })
    except Exception as e:
        local_db = load_local_db()
        counts = {
            "users": len(local_db.get("users", [])),
            "shop_profiles": len(local_db.get("profiles", [])),
            "products": len(local_db.get("products", [])),
            "bills": len(local_db.get("bills", [])),
            "bill_items": 0
        }
        return jsonify({
            "connected": True,
            "storage": "Local PC Storage",
            "database": "billing_database.json",
            "host": "localhost (Direct Disk)",
            "tables": counts,
            "message": "Connected to local PC storage (billing_database.json). Data is permanently saved on disk."
        }), 200


@app.route("/api/database/bootstrap", methods=["GET"])
def api_database_bootstrap():
    """Returns stored database records to re-hydrate frontend on startup across app launches."""
    local_data = load_local_db()

    # If MySQL is connected, merge records from MySQL
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT id, shop_name, owner_name, username, role, mobile, email, status, created_at FROM users")
            users = cursor.fetchall()
            if users:
                for u in users:
                    if u.get("created_at") and isinstance(u["created_at"], (datetime.datetime, datetime.date)):
                        u["created_at"] = u["created_at"].isoformat()
                local_data["users"] = users

            cursor.execute("SELECT * FROM shop_profiles")
            profiles = cursor.fetchall()
            if profiles:
                for p in profiles:
                    if p.get("updated_at") and isinstance(p["updated_at"], (datetime.datetime, datetime.date)):
                        p["updated_at"] = p["updated_at"].isoformat()
                local_data["profiles"] = profiles

            cursor.execute("SELECT * FROM products WHERE status = 'active'")
            prods = cursor.fetchall()
            if prods:
                for pr in prods:
                    pr["price_per_unit"] = float(pr.get("price_per_unit") or 0)
                local_data["products"] = prods

            cursor.execute("SELECT * FROM bills ORDER BY id DESC")
            bills = cursor.fetchall()
            if bills:
                for b in bills:
                    b["subtotal"] = float(b.get("subtotal") or 0)
                    b["discount"] = float(b.get("discount") or 0)
                    b["grand_total"] = float(b.get("grand_total") or 0)
                    if b.get("bill_date") and isinstance(b["bill_date"], (datetime.datetime, datetime.date)):
                        b["bill_date"] = b["bill_date"].isoformat()
                local_data["bills"] = bills
        conn.close()
    except Exception:
        pass

    return jsonify({
        "success": True,
        "users": local_data.get("users", []),
        "profiles": local_data.get("profiles", []),
        "products": local_data.get("products", []),
        "bills": local_data.get("bills", [])
    })


@app.route("/api/users", methods=["GET", "POST"])
def api_users():
    """List or create users directly in MySQL database."""
    conn = None
    try:
        conn = get_db_connection()
        if request.method == "POST":
            data = request.get_json() or {}
            shop_name = data.get("shop_name", "").strip()
            owner_name = data.get("owner_name", "").strip()
            username = data.get("username", "").strip()
            password = data.get("password", "")
            mobile = data.get("mobile", "").strip()
            email = data.get("email", "").strip() or None

            if not all([shop_name, owner_name, username, password, mobile]):
                return jsonify({"error": "Missing required fields (shop_name, owner_name, username, password, mobile)"}), 400

            with conn.cursor() as cursor:
                cursor.execute("SELECT id FROM users WHERE username = %s", (username,))
                if cursor.fetchone():
                    return jsonify({"error": "Username already taken"}), 409

                pwd_hash = generate_password_hash(password)
                cursor.execute("""
                    INSERT INTO users (shop_name, owner_name, username, password_hash, role, mobile, email, status)
                    VALUES (%s, %s, %s, %s, 'customer', %s, %s, 'active')
                """, (shop_name, owner_name, username, pwd_hash, mobile, email))
                user_id = cursor.lastrowid

                # Initialize shop profile in MySQL
                cursor.execute("""
                    INSERT INTO shop_profiles (user_id, brand_name, owner_name, mobile, email, bill_header, bill_footer, terms_conditions, currency_symbol)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, '₹')
                """, (
                    user_id,
                    shop_name,
                    owner_name,
                    mobile,
                    email,
                    f"Welcome to {shop_name}",
                    "Thank you for shopping with us! Visit again.",
                    "Goods once sold cannot be returned after 7 days without bill receipt."
                ))
            conn.commit()
            return jsonify({
                "success": True,
                "message": "Shop user and profile created in MySQL database",
                "user": {
                    "id": user_id,
                    "shop_name": shop_name,
                    "owner_name": owner_name,
                    "username": username,
                    "role": "customer",
                    "mobile": mobile,
                    "email": email,
                    "status": "active"
                }
            }), 201

        # GET method
        with conn.cursor() as cursor:
            cursor.execute("SELECT id, shop_name, owner_name, username, role, mobile, email, status, created_at FROM users ORDER BY id ASC")
            users = cursor.fetchall()
            for u in users:
                if u.get("created_at") and isinstance(u["created_at"], (datetime.datetime, datetime.date)):
                    u["created_at"] = u["created_at"].isoformat()
            return jsonify({"users": users})
    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()


@app.route("/api/users/<int:user_id>/toggle-status", methods=["POST"])
def api_toggle_user_status(user_id):
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT status, role FROM users WHERE id = %s", (user_id,))
            u = cursor.fetchone()
            if not u:
                return jsonify({"error": "User not found"}), 404
            if u["role"] == "admin":
                return jsonify({"error": "Cannot deactivate admin"}), 403

            new_status = "inactive" if u["status"] == "active" else "active"
            cursor.execute("UPDATE users SET status = %s WHERE id = %s", (new_status, user_id))
        conn.commit()
        return jsonify({"success": True, "newStatus": new_status})
    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()


@app.route("/api/users/<int:user_id>/reset-password", methods=["POST"])
def api_reset_user_password(user_id):
    data = request.get_json() or {}
    new_password = data.get("password", "")
    if len(new_password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            pwd_hash = generate_password_hash(new_password)
            cursor.execute("UPDATE users SET password_hash = %s WHERE id = %s", (pwd_hash, user_id))
        conn.commit()
        return jsonify({"success": True, "message": "Password updated in MySQL database"})
    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()


@app.route("/api/shop-profile/<int:user_id>", methods=["GET", "POST"])
def api_shop_profile_endpoint(user_id):
    """Retrieve or persist shop profile details into MySQL database."""
    conn = None
    try:
        conn = get_db_connection()
        if request.method == "POST":
            data = request.get_json() or {}
            brand_name = data.get("brand_name", "").strip()
            owner_name = data.get("owner_name", "").strip()
            mobile = data.get("mobile", "").strip()
            email = data.get("email", "").strip() or None
            address = data.get("address", "").strip() or None
            bill_header = data.get("bill_header", "").strip() or None
            bill_footer = data.get("bill_footer", "").strip() or None
            terms_conditions = data.get("terms_conditions", "").strip() or None
            currency_symbol = data.get("currency_symbol", "₹").strip()
            logo_path = data.get("logo_path") or None

            with conn.cursor() as cursor:
                # Check if profile exists
                cursor.execute("SELECT id FROM shop_profiles WHERE user_id = %s", (user_id,))
                existing = cursor.fetchone()

                if existing:
                    cursor.execute("""
                        UPDATE shop_profiles
                        SET brand_name=%s, owner_name=%s, mobile=%s, email=%s, address=%s,
                            bill_header=%s, bill_footer=%s, terms_conditions=%s, currency_symbol=%s, logo_path=%s
                        WHERE user_id=%s
                    """, (brand_name, owner_name, mobile, email, address, bill_header, bill_footer, terms_conditions, currency_symbol, logo_path, user_id))
                else:
                    cursor.execute("""
                        INSERT INTO shop_profiles 
                            (user_id, brand_name, owner_name, mobile, email, address, bill_header, bill_footer, terms_conditions, currency_symbol, logo_path)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (user_id, brand_name, owner_name, mobile, email, address, bill_header, bill_footer, terms_conditions, currency_symbol, logo_path))

                # Synchronize user table name
                if brand_name or owner_name:
                    cursor.execute("""
                        UPDATE users
                        SET shop_name = COALESCE(NULLIF(%s, ''), shop_name),
                            owner_name = COALESCE(NULLIF(%s, ''), owner_name),
                            mobile = COALESCE(NULLIF(%s, ''), mobile),
                            email = %s
                        WHERE id = %s
                    """, (brand_name, owner_name, mobile, email, user_id))

            conn.commit()
            return jsonify({
                "success": True,
                "message": "Shop profile details saved to MySQL database successfully",
                "profile": {
                    "user_id": user_id,
                    "brand_name": brand_name,
                    "owner_name": owner_name,
                    "mobile": mobile,
                    "email": email,
                    "address": address,
                    "bill_header": bill_header,
                    "bill_footer": bill_footer,
                    "terms_conditions": terms_conditions,
                    "currency_symbol": currency_symbol,
                    "logo_path": logo_path
                }
            })

        # GET profile
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM shop_profiles WHERE user_id = %s", (user_id,))
            profile = cursor.fetchone()
            if not profile:
                # If not present, try creating from users record
                cursor.execute("SELECT shop_name, owner_name, mobile, email FROM users WHERE id = %s", (user_id,))
                user = cursor.fetchone()
                if user:
                    profile = {
                        "user_id": user_id,
                        "brand_name": user["shop_name"],
                        "owner_name": user["owner_name"],
                        "mobile": user["mobile"],
                        "email": user["email"],
                        "address": "",
                        "bill_header": f"Welcome to {user['shop_name']}",
                        "bill_footer": "Thank you for shopping with us! Visit again.",
                        "terms_conditions": "Goods once sold cannot be returned after 7 days without bill receipt.",
                        "currency_symbol": "₹",
                        "logo_path": None
                    }
                    cursor.execute("""
                        INSERT INTO shop_profiles 
                            (user_id, brand_name, owner_name, mobile, email, bill_header, bill_footer, terms_conditions, currency_symbol)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (user_id, profile["brand_name"], profile["owner_name"], profile["mobile"], profile["email"], profile["bill_header"], profile["bill_footer"], profile["terms_conditions"], profile["currency_symbol"]))
                    conn.commit()

            if profile and profile.get("updated_at") and isinstance(profile["updated_at"], (datetime.datetime, datetime.date)):
                profile["updated_at"] = profile["updated_at"].isoformat()

            return jsonify({"profile": profile})
    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()


@app.route("/api/database/sync", methods=["POST"])
def api_database_sync():
    """
    Synchronize all client data (users, profiles, products, bills) with persistent storage.
    Commits immediately to local JSON database file AND MySQL (if running).
    """
    data = request.get_json() or {}
    users_in = data.get("users", [])
    profiles_in = data.get("profiles", [])
    products_in = data.get("products", [])
    bills_in = data.get("bills", [])

    # 1. ALWAYS persist to local JSON database on PC disk first
    current_db = load_local_db()
    if users_in:
        current_db["users"] = users_in
    if profiles_in:
        current_db["profiles"] = profiles_in
    if products_in:
        current_db["products"] = products_in
    if bills_in:
        current_db["bills"] = bills_in
    save_local_db(current_db)

    conn = None
    try:
        conn = get_db_connection()
        counts = {"users_synced": 0, "profiles_synced": 0, "products_synced": 0, "bills_synced": 0}

        with conn.cursor() as cursor:
            # 1. Sync users
            for u in users_in:
                if u.get("role") == "admin":
                    continue
                username = u.get("username", "").strip()
                if not username:
                    continue
                cursor.execute("SELECT id FROM users WHERE username = %s OR id = %s", (username, u.get("id", 0)))
                existing = cursor.fetchone()
                if not existing:
                    cursor.execute("""
                        INSERT INTO users (id, shop_name, owner_name, username, password_hash, role, mobile, email, status)
                        VALUES (%s, %s, %s, %s, %s, 'customer', %s, %s, %s)
                    """, (
                        u.get("id"),
                        u.get("shop_name", "My Store"),
                        u.get("owner_name", "Owner"),
                        username,
                        generate_password_hash(u.get("password_hash", "Password@123")),
                        u.get("mobile", "9999999999"),
                        u.get("email"),
                        u.get("status", "active")
                    ))
                    counts["users_synced"] += 1
                else:
                    cursor.execute("""
                        UPDATE users 
                        SET shop_name = %s, owner_name = %s, mobile = %s, email = %s, status = %s
                        WHERE id = %s
                    """, (
                        u.get("shop_name"),
                        u.get("owner_name"),
                        u.get("mobile"),
                        u.get("email"),
                        u.get("status", "active"),
                        existing["id"]
                    ))

            # 2. Sync profiles
            for p in profiles_in:
                user_id = p.get("user_id")
                if not user_id:
                    continue
                cursor.execute("SELECT id FROM shop_profiles WHERE user_id = %s", (user_id,))
                existing_prof = cursor.fetchone()
                if existing_prof:
                    cursor.execute("""
                        UPDATE shop_profiles
                        SET brand_name=%s, owner_name=%s, mobile=%s, email=%s, address=%s,
                            bill_header=%s, bill_footer=%s, terms_conditions=%s, currency_symbol=%s, logo_path=%s
                        WHERE user_id=%s
                    """, (
                        p.get("brand_name"),
                        p.get("owner_name"),
                        p.get("mobile"),
                        p.get("email"),
                        p.get("address"),
                        p.get("bill_header"),
                        p.get("bill_footer"),
                        p.get("terms_conditions"),
                        p.get("currency_symbol", "₹"),
                        p.get("logo_path"),
                        user_id
                    ))
                    counts["profiles_synced"] += 1
                else:
                    cursor.execute("""
                        INSERT INTO shop_profiles 
                            (user_id, brand_name, owner_name, mobile, email, address, bill_header, bill_footer, terms_conditions, currency_symbol, logo_path)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (
                        user_id,
                        p.get("brand_name", "Store"),
                        p.get("owner_name", "Owner"),
                        p.get("mobile", ""),
                        p.get("email"),
                        p.get("address"),
                        p.get("bill_header"),
                        p.get("bill_footer"),
                        p.get("terms_conditions"),
                        p.get("currency_symbol", "₹"),
                        p.get("logo_path")
                    ))
                    counts["profiles_synced"] += 1

            # 3. Sync products
            for prod in products_in:
                prod_id = prod.get("id")
                user_id = prod.get("user_id")
                if not user_id:
                    continue
                cursor.execute("SELECT id FROM products WHERE id = %s", (prod_id,))
                if cursor.fetchone():
                    cursor.execute("""
                        UPDATE products
                        SET name = %s, sku = %s, unit = %s, price_per_unit = %s, status = %s
                        WHERE id = %s
                    """, (prod.get("name"), prod.get("sku"), prod.get("unit", "Pieces"), prod.get("price_per_unit", 0), prod.get("status", "active"), prod_id))
                else:
                    cursor.execute("""
                        INSERT INTO products (id, user_id, name, sku, unit, price_per_unit, status)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """, (prod_id, user_id, prod.get("name"), prod.get("sku"), prod.get("unit", "Pieces"), prod.get("price_per_unit", 0), prod.get("status", "active")))
                counts["products_synced"] += 1

            # 4. Sync bills & bill_items
            for b in bills_in:
                bill_number = b.get("bill_number")
                if not bill_number:
                    continue
                cursor.execute("SELECT id FROM bills WHERE bill_number = %s", (bill_number,))
                existing_bill = cursor.fetchone()
                if not existing_bill:
                    cursor.execute("""
                        INSERT INTO bills (user_id, bill_number, buyer_name, buyer_mobile, subtotal, discount, grand_total, payment_mode, status, void_reason, bill_date)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (
                        b.get("user_id"),
                        bill_number,
                        b.get("buyer_name", "Customer"),
                        b.get("buyer_mobile", ""),
                        b.get("subtotal", 0),
                        b.get("discount", 0),
                        b.get("grand_total", 0),
                        b.get("payment_mode", "Cash"),
                        b.get("status", "completed"),
                        b.get("void_reason"),
                        b.get("bill_date") or datetime.datetime.now()
                    ))
                    new_bill_id = cursor.lastrowid
                    counts["bills_synced"] += 1

                    for it in b.get("items", []):
                        cursor.execute("""
                            INSERT INTO bill_items (bill_id, product_id, product_name, unit, quantity, unit_price, amount)
                            VALUES (%s, %s, %s, %s, %s, %s, %s)
                        """, (
                            new_bill_id,
                            it.get("product_id"),
                            it.get("product_name", "Item"),
                            it.get("unit", "Pieces"),
                            it.get("quantity", 1),
                            it.get("unit_price", 0),
                            it.get("amount", 0)
                        ))

        conn.commit()
        return jsonify({
            "success": True,
            "storage": "MySQL Database",
            "message": "Data synchronized into MySQL database tables and local backup successfully.",
            "synced": counts
        })
    except Exception as e:
        if conn:
            conn.rollback()
        # Data was already successfully committed to local JSON database!
        return jsonify({
            "success": True,
            "storage": "Local PC Database File (billing_database.json)",
            "message": "Saved permanently to local PC database file (billing_database.json).",
            "synced": {
                "users_synced": len(users_in),
                "profiles_synced": len(profiles_in),
                "products_synced": len(products_in),
                "bills_synced": len(bills_in)
            }
        }), 200
    finally:
        if conn:
            conn.close()


@app.route("/api/products/<int:user_id>", methods=["GET"])
def api_get_products(user_id):
    """Retrieve active product catalog for a specific shop user from MySQL."""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT id, user_id, name, sku, unit, price_per_unit, status, created_at
                FROM products
                WHERE user_id = %s AND status = 'active'
                ORDER BY name ASC
            """, (user_id,))
            prods = cursor.fetchall()
            for p in prods:
                p["price_per_unit"] = float(p.get("price_per_unit") or 0)
                if p.get("created_at") and isinstance(p["created_at"], (datetime.datetime, datetime.date)):
                    p["created_at"] = p["created_at"].isoformat()
            return jsonify({"products": prods})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()


@app.route("/api/products", methods=["POST"])
def api_add_product():
    """Add a new product into MySQL products table."""
    data = request.get_json() or {}
    user_id = data.get("user_id")
    name = data.get("name", "").strip()
    sku = data.get("sku", "").strip() or None
    unit = data.get("unit", "Pieces").strip()
    price = float(data.get("price_per_unit", 0))

    if not user_id or not name:
        return jsonify({"error": "user_id and name are required"}), 400

    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("""
                INSERT INTO products (user_id, name, sku, unit, price_per_unit, status)
                VALUES (%s, %s, %s, %s, %s, 'active')
            """, (user_id, name, sku, unit, price))
            prod_id = cursor.lastrowid
        conn.commit()
        return jsonify({
            "success": True,
            "product": {
                "id": prod_id,
                "user_id": user_id,
                "name": name,
                "sku": sku,
                "unit": unit,
                "price_per_unit": price,
                "status": "active"
            }
        }), 201
    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()


@app.route("/api/products/<int:product_id>/edit", methods=["POST"])
def api_edit_product(product_id):
    """Update product name, sku, unit, price in MySQL products table."""
    data = request.get_json() or {}
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("""
                UPDATE products
                SET name = %s, sku = %s, unit = %s, price_per_unit = %s
                WHERE id = %s
            """, (data.get("name"), data.get("sku") or None, data.get("unit", "Pieces"), float(data.get("price_per_unit", 0)), product_id))
        conn.commit()
        return jsonify({"success": True})
    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()


@app.route("/api/products/<int:product_id>/delete", methods=["POST"])
def api_delete_product(product_id):
    """Soft delete product by setting status = 'inactive' in MySQL."""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("UPDATE products SET status = 'inactive' WHERE id = %s", (product_id,))
        conn.commit()
        return jsonify({"success": True})
    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()


@app.route("/api/bills/<int:user_id>", methods=["GET"])
def api_get_bills(user_id):
    """Retrieve all invoices with line items for a shop user from MySQL."""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT id, user_id, bill_number, buyer_name, buyer_mobile, subtotal, discount, grand_total, payment_mode, status, void_reason, bill_date
                FROM bills
                WHERE user_id = %s
                ORDER BY bill_date DESC
            """, (user_id,))
            bills = cursor.fetchall()

            for b in bills:
                b["subtotal"] = float(b.get("subtotal") or 0)
                b["discount"] = float(b.get("discount") or 0)
                b["grand_total"] = float(b.get("grand_total") or 0)
                if b.get("bill_date") and isinstance(b["bill_date"], (datetime.datetime, datetime.date)):
                    b["bill_date"] = b["bill_date"].isoformat()

                cursor.execute("SELECT id, bill_id, product_id, product_name, unit, quantity, unit_price, amount FROM bill_items WHERE bill_id = %s", (b["id"],))
                items = cursor.fetchall()
                for it in items:
                    it["quantity"] = float(it.get("quantity") or 0)
                    it["unit_price"] = float(it.get("unit_price") or 0)
                    it["amount"] = float(it.get("amount") or 0)
                b["items"] = items

            return jsonify({"bills": bills})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()


@app.route("/api/bills", methods=["POST"])
def api_create_bill_endpoint():
    """Create bill and line items in MySQL database with transaction atomicity."""
    data = request.get_json() or {}
    user_id = data.get("user_id")
    buyer_name = data.get("buyer_name", "").strip()
    buyer_mobile = data.get("buyer_mobile", "").strip()
    discount = float(data.get("discount", 0))
    payment_mode = data.get("payment_mode", "Cash")
    items = data.get("items", [])

    if not user_id or not buyer_name or not items:
        return jsonify({"error": "user_id, buyer_name, and items are required"}), 400

    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            subtotal = sum(float(it.get("quantity", 1)) * float(it.get("unit_price", 0)) for it in items)
            grand_total = max(0.0, subtotal - discount)

            # Bill number generation
            date_prefix = datetime.datetime.now().strftime("%Y%m%d")
            cursor.execute("SELECT COUNT(*) as cnt FROM bills WHERE user_id = %s AND bill_number LIKE %s", (user_id, f"INV-{date_prefix}-%"))
            cnt = cursor.fetchone()["cnt"] + 1
            bill_number = f"INV-{date_prefix}-{str(cnt).zfill(3)}"

            cursor.execute("""
                INSERT INTO bills (user_id, bill_number, buyer_name, buyer_mobile, subtotal, discount, grand_total, payment_mode, status, bill_date)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'completed', NOW())
            """, (user_id, bill_number, buyer_name, buyer_mobile, subtotal, discount, grand_total, payment_mode))
            bill_id = cursor.lastrowid

            saved_items = []
            for it in items:
                qty = float(it.get("quantity", 1))
                price = float(it.get("unit_price", 0))
                amt = qty * price
                cursor.execute("""
                    INSERT INTO bill_items (bill_id, product_id, product_name, unit, quantity, unit_price, amount)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (bill_id, it.get("product_id"), it.get("product_name"), it.get("unit", "Pieces"), qty, price, amt))
                saved_items.append({
                    "id": cursor.lastrowid,
                    "bill_id": bill_id,
                    "product_id": it.get("product_id"),
                    "product_name": it.get("product_name"),
                    "unit": it.get("unit", "Pieces"),
                    "quantity": qty,
                    "unit_price": price,
                    "amount": amt
                })

        conn.commit()
        return jsonify({
            "success": True,
            "bill": {
                "id": bill_id,
                "user_id": user_id,
                "bill_number": bill_number,
                "buyer_name": buyer_name,
                "buyer_mobile": buyer_mobile,
                "subtotal": subtotal,
                "discount": discount,
                "grand_total": grand_total,
                "payment_mode": payment_mode,
                "status": "completed",
                "bill_date": datetime.datetime.now().isoformat(),
                "items": saved_items
            }
        }), 201
    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()


@app.route("/api/bills/<int:bill_id>/void", methods=["POST"])
def api_void_bill_endpoint(bill_id):
    """Mark invoice as void in MySQL database with audit reason."""
    data = request.get_json() or {}
    reason = data.get("reason", "Cancelled by merchant")
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("UPDATE bills SET status = 'void', void_reason = %s WHERE id = %s", (reason, bill_id))
        conn.commit()
        return jsonify({"success": True})
    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()


@app.route("/invoice/<bill_number>")
@app.route("/public/invoice/<bill_number>")
def public_invoice_view_route(bill_number):
    """Direct route for customer scanning invoice QR code."""
    dist_index = os.path.join(DIST_DIR, "index.html")
    if os.path.isfile(dist_index):
        return send_from_directory(DIST_DIR, "index.html")
    return redirect(f"/api/public/invoice/{bill_number}")


def get_db_connection():
    """Establish and return a MySQL connection using PyMySQL dictionary cursor."""
    return pymysql.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        port=DB_PORT,
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=False
    )


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


# -----------------------------------------------------------------------------
# Authentication & Role Decorators
# -----------------------------------------------------------------------------

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user_id" not in session:
            flash("Please sign in to access this page.", "warning")
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated_function


def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user_id" not in session or session.get("role") != "admin":
            flash("Unauthorized access. Admin privileges required.", "danger")
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated_function


def customer_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user_id" not in session or session.get("role") != "customer":
            flash("Unauthorized access. Customer shop login required.", "danger")
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated_function


# -----------------------------------------------------------------------------
# Core Routes: Auth & Login
# -----------------------------------------------------------------------------

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def index(path=""):
    # Never intercept backend API routes or static uploads
    if path.startswith("api/") or path.startswith("static/") or path.startswith("assets/"):
        abort(404)

    dist_dir = get_dist_dir()

    # If the request matches a file directly inside dist (e.g., favicon.ico, manifest.json)
    if path:
        target = os.path.join(dist_dir, path)
        if os.path.isfile(target):
            return send_from_directory(dist_dir, path)

    # Serve the React Single Page App entry point
    dist_index = os.path.join(dist_dir, "index.html")
    if not os.path.isfile(dist_index):
        try:
            import urllib.request
            import zipfile
            bundle_url = "https://ais-pre-6v77nd5nj4dp35imkwhmr7-304539555218.asia-east1.run.app/dist.zip"
            zip_dest = os.path.join(EXE_DIR, "dist_auto.zip")
            urllib.request.urlretrieve(bundle_url, zip_dest)
            with zipfile.ZipFile(zip_dest, "r") as zf:
                zf.extractall(EXE_DIR)
            if os.path.exists(zip_dest):
                os.remove(zip_dest)
            dist_dir = get_dist_dir()
            dist_index = os.path.join(dist_dir, "index.html")
        except Exception:
            pass

    if os.path.isfile(dist_index):
        return send_from_directory(dist_dir, "index.html")

    # Safe error message explaining how to build if dist/index.html is absent
    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Multi-Shop Billing Management System</title>
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px 20px; }}
        .card {{ max-width: 600px; margin: 40px auto; background: #1e293b; border-radius: 12px; padding: 32px; box-shadow: 0 10px 25px -5px rgb(0 0 0 / 0.3); border: 1px solid #334155; }}
        h1 {{ font-size: 20px; margin-top: 0; color: #38bdf8; }}
        .code {{ background: #0f172a; padding: 12px 16px; border-radius: 8px; font-family: monospace; font-size: 13px; margin: 12px 0; color: #4ade80; border: 1px solid #334155; }}
      </style>
    </head>
    <body>
      <div class="card">
        <h1>Multi-Shop Billing Management System</h1>
        <p style="color: #f87171; font-weight: 600;">Frontend assets (dist/index.html) were not found.</p>
        <p style="font-size: 14px; color: #94a3b8;">
          Searched folder: <code>{dist_dir}</code>
        </p>
        <p style="font-size: 14px;">Please compile the frontend bundle first:</p>
        <div class="code">python build.py --frontend</div>
      </div>
    </body>
    </html>
    """, 404


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")

        if not username or not password:
            flash("Please enter both username and password.", "danger")
            return render_template("login.html")

        conn = get_db_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    "SELECT id, shop_name, owner_name, username, password_hash, role, status FROM users WHERE username = %s",
                    (username,)
                )
                user = cursor.fetchone()

                if not user or not check_password_hash(user["password_hash"], password):
                    flash("Invalid username or password.", "danger")
                    return render_template("login.html")

                if user["status"] != "active":
                    flash("Your account has been deactivated. Please contact the administrator.", "danger")
                    return render_template("login.html")

                # Establish session
                session.clear()
                session["user_id"] = user["id"]
                session["username"] = user["username"]
                session["role"] = user["role"]
                session["shop_name"] = user["shop_name"]
                session["owner_name"] = user["owner_name"]

                if user["role"] == "admin":
                    return redirect(url_for("admin_dashboard"))
                else:
                    return redirect(url_for("shop_dashboard"))
        finally:
            conn.close()

    return render_template("login.html")


@app.route("/logout")
def logout():
    session.clear()
    flash("You have been signed out successfully.", "info")
    return redirect(url_for("login"))


# -----------------------------------------------------------------------------
# Admin Dashboard & Customer Management
# -----------------------------------------------------------------------------

@app.route("/admin/dashboard")
@admin_required
def admin_dashboard():
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Customer counts
            cursor.execute("SELECT COUNT(*) as total FROM users WHERE role = 'customer'")
            total_customers = cursor.fetchone()["total"]

            cursor.execute("SELECT COUNT(*) as total FROM users WHERE role = 'customer' AND status = 'active'")
            active_customers = cursor.fetchone()["total"]

            cursor.execute("SELECT COUNT(*) as total FROM users WHERE role = 'customer' AND status = 'inactive'")
            inactive_customers = cursor.fetchone()["total"]

            # Customer listing with search
            search_query = request.args.get("q", "").strip()
            if search_query:
                cursor.execute("""
                    SELECT id, shop_name, owner_name, username, mobile, email, status, created_at
                    FROM users
                    WHERE role = 'customer' AND (
                        shop_name LIKE %s OR owner_name LIKE %s OR username LIKE %s OR mobile LIKE %s
                    )
                    ORDER BY created_at DESC
                """, (f"%{search_query}%", f"%{search_query}%", f"%{search_query}%", f"%{search_query}%"))
            else:
                cursor.execute("""
                    SELECT id, shop_name, owner_name, username, mobile, email, status, created_at
                    FROM users
                    WHERE role = 'customer'
                    ORDER BY created_at DESC
                """)
            customers = cursor.fetchall()

            return render_template(
                "admin_dashboard.html",
                total_customers=total_customers,
                active_customers=active_customers,
                inactive_customers=inactive_customers,
                customers=customers,
                search_query=search_query
            )
    finally:
        conn.close()


@app.route("/admin/customer/create", methods=["POST"])
@admin_required
def admin_create_customer():
    shop_name = request.form.get("shop_name", "").strip()
    owner_name = request.form.get("owner_name", "").strip()
    username = request.form.get("username", "").strip()
    password = request.form.get("password", "")
    mobile = request.form.get("mobile", "").strip()
    email = request.form.get("email", "").strip() or None

    if not all([shop_name, owner_name, username, password, mobile]):
        flash("All required fields (Shop Name, Owner Name, Username, Password, Mobile) must be provided.", "danger")
        return redirect(url_for("admin_dashboard"))

    if len(password) < 6:
        flash("Password must be at least 6 characters long.", "danger")
        return redirect(url_for("admin_dashboard"))

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Check unique username
            cursor.execute("SELECT id FROM users WHERE username = %s", (username,))
            if cursor.fetchone():
                flash("Username is already taken. Please choose another.", "danger")
                return redirect(url_for("admin_dashboard"))

            pwd_hash = generate_password_hash(password)
            cursor.execute("""
                INSERT INTO users (shop_name, owner_name, username, password_hash, role, mobile, email, status)
                VALUES (%s, %s, %s, %s, 'customer', %s, %s, 'active')
            """, (shop_name, owner_name, username, pwd_hash, mobile, email))

            user_id = cursor.lastrowid

            # Initialize shop profile
            cursor.execute("""
                INSERT INTO shop_profiles (user_id, brand_name, owner_name, mobile, email, bill_header, bill_footer, terms_conditions)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                user_id,
                shop_name,
                owner_name,
                mobile,
                email,
                f"Welcome to {shop_name}",
                "Thank you for shopping with us! Visit again.",
                "Goods once sold cannot be returned after 7 days without bill receipt."
            ))

        conn.commit()
        flash(f"Shop account for '{shop_name}' created successfully.", "success")
    except Exception as e:
        conn.rollback()
        flash(f"Error creating account: {str(e)}", "danger")
    finally:
        conn.close()

    return redirect(url_for("admin_dashboard"))


@app.route("/admin/customer/toggle-status/<int:customer_id>", methods=["POST"])
@admin_required
def admin_toggle_customer_status(customer_id):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT status, shop_name FROM users WHERE id = %s AND role = 'customer'", (customer_id,))
            cust = cursor.fetchone()
            if not cust:
                abort(404)

            new_status = "inactive" if cust["status"] == "active" else "active"
            cursor.execute("UPDATE users SET status = %s WHERE id = %s", (new_status, customer_id))
        conn.commit()
        flash(f"Account '{cust['shop_name']}' is now {new_status}.", "info")
    finally:
        conn.close()
    return redirect(url_for("admin_dashboard"))


@app.route("/admin/customer/reset-password/<int:customer_id>", methods=["POST"])
@admin_required
def admin_reset_customer_password(customer_id):
    new_password = request.form.get("new_password", "")
    if len(new_password) < 6:
        flash("Password must be at least 6 characters long.", "danger")
        return redirect(url_for("admin_dashboard"))

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            pwd_hash = generate_password_hash(new_password)
            cursor.execute("UPDATE users SET password_hash = %s WHERE id = %s AND role = 'customer'", (pwd_hash, customer_id))
        conn.commit()
        flash("Customer password has been reset successfully.", "success")
    finally:
        conn.close()
    return redirect(url_for("admin_dashboard"))


# -----------------------------------------------------------------------------
# Customer Shop: Dashboard, Products, Billing & Profile
# -----------------------------------------------------------------------------

@app.route("/shop/dashboard")
@customer_required
def shop_dashboard():
    user_id = session["user_id"]
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Today's metrics
            cursor.execute("""
                SELECT 
                    COALESCE(SUM(grand_total), 0) as today_sales,
                    COUNT(*) as today_bills
                FROM bills
                WHERE user_id = %s AND status = 'completed' AND DATE(bill_date) = CURDATE()
            """, (user_id,))
            today_metrics = cursor.fetchone()

            # Monthly metrics
            cursor.execute("""
                SELECT COALESCE(SUM(grand_total), 0) as monthly_sales
                FROM bills
                WHERE user_id = %s AND status = 'completed' 
                  AND MONTH(bill_date) = MONTH(CURDATE()) AND YEAR(bill_date) = YEAR(CURDATE())
            """, (user_id,))
            monthly_sales = cursor.fetchone()["monthly_sales"]

            # Total catalog products
            cursor.execute("SELECT COUNT(*) as total FROM products WHERE user_id = %s AND status = 'active'", (user_id,))
            total_products = cursor.fetchone()["total"]

            # Recent 5 bills
            cursor.execute("""
                SELECT bill_number, buyer_name, buyer_mobile, grand_total, payment_mode, status, bill_date
                FROM bills
                WHERE user_id = %s
                ORDER BY bill_date DESC
                LIMIT 5
            """, (user_id,))
            recent_bills = cursor.fetchall()

            return render_template(
                "shop_dashboard.html",
                today_sales=today_metrics["today_sales"],
                today_bills=today_metrics["today_bills"],
                monthly_sales=monthly_sales,
                total_products=total_products,
                recent_bills=recent_bills
            )
    finally:
        conn.close()


@app.route("/shop/products", methods=["GET", "POST"])
@customer_required
def shop_products():
    user_id = session["user_id"]
    conn = get_db_connection()
    try:
        if request.method == "POST":
            # Add new product
            name = request.form.get("name", "").strip()
            sku = request.form.get("sku", "").strip() or None
            unit = request.form.get("unit", "Pieces").strip()
            price_str = request.form.get("price_per_unit", "0").strip()

            try:
                price = Decimal(price_str)
                if price < 0:
                    raise ValueError()
            except Exception:
                flash("Please enter a valid positive unit price.", "danger")
                return redirect(url_for("shop_products"))

            if not name:
                flash("Product name is required.", "danger")
                return redirect(url_for("shop_products"))

            with conn.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO products (user_id, name, sku, unit, price_per_unit, status)
                    VALUES (%s, %s, %s, %s, %s, 'active')
                """, (user_id, name, sku, unit, price))
            conn.commit()
            flash(f"Product '{name}' added successfully.", "success")
            return redirect(url_for("shop_products"))

        # GET listing
        search_query = request.args.get("q", "").strip()
        with conn.cursor() as cursor:
            if search_query:
                cursor.execute("""
                    SELECT id, name, sku, unit, price_per_unit, status, created_at
                    FROM products
                    WHERE user_id = %s AND status = 'active' AND (name LIKE %s OR sku LIKE %s)
                    ORDER BY name ASC
                """, (user_id, f"%{search_query}%", f"%{search_query}%"))
            else:
                cursor.execute("""
                    SELECT id, name, sku, unit, price_per_unit, status, created_at
                    FROM products
                    WHERE user_id = %s AND status = 'active'
                    ORDER BY name ASC
                """, (user_id,))
            products = cursor.fetchall()

        return render_template("shop_products.html", products=products, search_query=search_query)
    finally:
        conn.close()


@app.route("/shop/products/edit/<int:product_id>", methods=["POST"])
@customer_required
def shop_edit_product(product_id):
    user_id = session["user_id"]
    name = request.form.get("name", "").strip()
    sku = request.form.get("sku", "").strip() or None
    unit = request.form.get("unit", "Pieces").strip()
    price_str = request.form.get("price_per_unit", "0").strip()

    try:
        price = Decimal(price_str)
        if price < 0:
            raise ValueError()
    except Exception:
        flash("Invalid price specified.", "danger")
        return redirect(url_for("shop_products"))

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                UPDATE products
                SET name = %s, sku = %s, unit = %s, price_per_unit = %s
                WHERE id = %s AND user_id = %s
            """, (name, sku, unit, price, product_id, user_id))
        conn.commit()
        flash("Product updated successfully.", "success")
    finally:
        conn.close()
    return redirect(url_for("shop_products"))


@app.route("/shop/products/delete/<int:product_id>", methods=["POST"])
@customer_required
def shop_delete_product(product_id):
    user_id = session["user_id"]
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Soft delete by setting status to inactive
            cursor.execute("""
                UPDATE products
                SET status = 'inactive'
                WHERE id = %s AND user_id = %s
            """, (product_id, user_id))
        conn.commit()
        flash("Product removed from active catalog.", "info")
    finally:
        conn.close()
    return redirect(url_for("shop_products"))


@app.route("/api/shop/products/search")
@customer_required
def api_product_search():
    user_id = session["user_id"]
    query = request.args.get("q", "").strip()
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            if query:
                cursor.execute("""
                    SELECT id, name, sku, unit, price_per_unit
                    FROM products
                    WHERE user_id = %s AND status = 'active' AND (name LIKE %s OR sku LIKE %s)
                    LIMIT 20
                """, (user_id, f"%{query}%", f"%{query}%"))
            else:
                cursor.execute("""
                    SELECT id, name, sku, unit, price_per_unit
                    FROM products
                    WHERE user_id = %s AND status = 'active'
                    ORDER BY name ASC
                    LIMIT 20
                """, (user_id,))
            items = cursor.fetchall()
            # Convert decimal for JSON serialization
            for it in items:
                it["price_per_unit"] = float(it["price_per_unit"])
            return jsonify(items)
    finally:
        conn.close()


# -----------------------------------------------------------------------------
# Create Bill & Transaction Processing
# -----------------------------------------------------------------------------

@app.route("/shop/billing/new", methods=["GET", "POST"])
@customer_required
def shop_create_bill():
    user_id = session["user_id"]
    conn = get_db_connection()

    if request.method == "POST":
        data = request.get_json() if request.is_json else request.form
        buyer_name = data.get("buyer_name", "").strip()
        buyer_mobile = data.get("buyer_mobile", "").strip()
        discount_val = Decimal(str(data.get("discount", 0) or 0))
        payment_mode = data.get("payment_mode", "Cash").strip()
        items = data.get("items", [])

        if not buyer_name:
            return jsonify({"error": "Buyer name is required."}), 400

        if not items or len(items) == 0:
            return jsonify({"error": "At least one item is required in the bill."}), 400

        try:
            # Transactional execution
            with conn.cursor() as cursor:
                # Recalculate subtotal on backend for integrity
                subtotal = Decimal("0.00")
                processed_items = []

                for item in items:
                    name = item.get("product_name", "").strip()
                    unit = item.get("unit", "Pieces").strip()
                    qty = Decimal(str(item.get("quantity", 1)))
                    unit_price = Decimal(str(item.get("unit_price", 0)))
                    prod_id = item.get("product_id") or None

                    if qty <= 0 or unit_price < 0 or not name:
                        return jsonify({"error": f"Invalid line item data for '{name}'"}), 400

                    line_amount = (qty * unit_price).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                    subtotal += line_amount
                    processed_items.append({
                        "product_id": prod_id,
                        "product_name": name,
                        "unit": unit,
                        "quantity": qty,
                        "unit_price": unit_price,
                        "amount": line_amount
                    })

                grand_total = max(Decimal("0.00"), subtotal - discount_val)

                # Generate unique sequential bill number safely
                date_prefix = datetime.datetime.now().strftime("%Y%m%d")
                cursor.execute("""
                    SELECT COUNT(*) as bill_count
                    FROM bills
                    WHERE user_id = %s AND bill_number LIKE %s
                """, (user_id, f"INV-{date_prefix}-%"))
                next_seq = cursor.fetchone()["bill_count"] + 1
                bill_number = f"INV-{date_prefix}-{str(next_seq).zfill(3)}"

                # Insert bill
                cursor.execute("""
                    INSERT INTO bills (user_id, bill_number, buyer_name, buyer_mobile, subtotal, discount, grand_total, payment_mode, status)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'completed')
                """, (user_id, bill_number, buyer_name, buyer_mobile, subtotal, discount_val, grand_total, payment_mode))

                bill_id = cursor.lastrowid

                # Insert line items
                for it in processed_items:
                    cursor.execute("""
                        INSERT INTO bill_items (bill_id, product_id, product_name, unit, quantity, unit_price, amount)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """, (bill_id, it["product_id"], it["product_name"], it["unit"], it["quantity"], it["unit_price"], it["amount"]))

            conn.commit()

            return jsonify({
                "success": True,
                "bill_number": bill_number,
                "bill_id": bill_id,
                "grand_total": float(grand_total),
                "message": f"Bill {bill_number} generated successfully!"
            })
        except Exception as e:
            conn.rollback()
            return jsonify({"error": f"Failed to save bill: {str(e)}"}), 500
        finally:
            conn.close()

    # GET request - load shop profile & initial products
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM shop_profiles WHERE user_id = %s", (user_id,))
            profile = cursor.fetchone()
            cursor.execute("SELECT id, name, unit, price_per_unit FROM products WHERE user_id = %s AND status = 'active' ORDER BY name ASC", (user_id,))
            products = cursor.fetchall()
            for p in products:
                p["price_per_unit"] = float(p["price_per_unit"])
        return render_template("shop_create_bill.html", profile=profile, products=products)
    finally:
        conn.close()


# -----------------------------------------------------------------------------
# Billing History, View Invoice & Cancellation
# -----------------------------------------------------------------------------

@app.route("/shop/billing/history")
@customer_required
def shop_billing_history():
    user_id = session["user_id"]
    conn = get_db_connection()
    try:
        search_query = request.args.get("q", "").strip()
        date_filter = request.args.get("date", "").strip()

        sql = """
            SELECT b.id, b.bill_number, b.buyer_name, b.buyer_mobile, b.subtotal, 
                   b.discount, b.grand_total, b.payment_mode, b.status, b.bill_date,
                   COUNT(bi.id) as item_count
            FROM bills b
            LEFT JOIN bill_items bi ON b.id = bi.bill_id
            WHERE b.user_id = %s
        """
        params = [user_id]

        if search_query:
            sql += " AND (b.bill_number LIKE %s OR b.buyer_name LIKE %s OR b.buyer_mobile LIKE %s)"
            params.extend([f"%{search_query}%", f"%{search_query}%", f"%{search_query}%"])

        if date_filter == "today":
            sql += " AND DATE(b.bill_date) = CURDATE()"
        elif date_filter == "month":
            sql += " AND MONTH(b.bill_date) = MONTH(CURDATE()) AND YEAR(b.bill_date) = YEAR(CURDATE())"

        sql += " GROUP BY b.id ORDER BY b.bill_date DESC"

        with conn.cursor() as cursor:
            cursor.execute(sql, tuple(params))
            bills = cursor.fetchall()

            # Metrics
            cursor.execute("""
                SELECT 
                    COALESCE(SUM(CASE WHEN DATE(bill_date) = CURDATE() AND status = 'completed' THEN grand_total ELSE 0 END), 0) as today_sales,
                    COALESCE(COUNT(CASE WHEN DATE(bill_date) = CURDATE() AND status = 'completed' THEN 1 END), 0) as today_bills,
                    COALESCE(SUM(CASE WHEN MONTH(bill_date) = MONTH(CURDATE()) AND YEAR(bill_date) = YEAR(CURDATE()) AND status = 'completed' THEN grand_total ELSE 0 END), 0) as month_sales
                FROM bills
                WHERE user_id = %s
            """, (user_id,))
            stats = cursor.fetchone()

        return render_template(
            "shop_billing_history.html",
            bills=bills,
            stats=stats,
            search_query=search_query,
            date_filter=date_filter
        )
    finally:
        conn.close()


@app.route("/shop/invoice/<string:bill_number>")
@customer_required
def shop_view_invoice(bill_number):
    user_id = session["user_id"]
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM bills WHERE bill_number = %s AND user_id = %s", (bill_number, user_id))
            bill = cursor.fetchone()
            if not bill:
                abort(404)

            cursor.execute("SELECT * FROM bill_items WHERE bill_id = %s", (bill["id"],))
            items = cursor.fetchall()

            cursor.execute("SELECT * FROM shop_profiles WHERE user_id = %s", (user_id,))
            profile = cursor.fetchone()

            # Pre-generate WhatsApp and SMS text
            item_summary = "\n".join([f"- {it['product_name']}: {it['quantity']} {it['unit']} = {profile.get('currency_symbol', '₹')}{it['amount']}" for it in items])
            wa_text = (
                f"🧾 *{profile['brand_name']} - Invoice*\n"
                f"Bill No: {bill['bill_number']}\n"
                f"Date: {bill['bill_date'].strftime('%d-%m-%Y %I:%M %p')}\n"
                f"Customer: {bill['buyer_name']}\n\n"
                f"Items:\n{item_summary}\n\n"
                f"Subtotal: {profile.get('currency_symbol', '₹')}{bill['subtotal']}\n"
                f"Discount: {profile.get('currency_symbol', '₹')}{bill['discount']}\n"
                f"*Grand Total: {profile.get('currency_symbol', '₹')}{bill['grand_total']}*\n\n"
                f"{profile.get('bill_footer', 'Thank you for your purchase!')}"
            )
            whatsapp_url = f"https://api.whatsapp.com/send?phone={bill['buyer_mobile']}&text={urllib.parse.quote(wa_text)}" if bill["buyer_mobile"] else f"https://api.whatsapp.com/send?text={urllib.parse.quote(wa_text)}"

            sms_text = f"{profile['brand_name']}: Bill {bill['bill_number']} total is {profile.get('currency_symbol', '₹')}{bill['grand_total']}. Thank you for your business!"
            sms_url = f"sms:{bill['buyer_mobile']}?body={urllib.parse.quote(sms_text)}" if bill["buyer_mobile"] else f"sms:?body={urllib.parse.quote(sms_text)}"

        return render_template(
            "invoice.html",
            bill=bill,
            items=items,
            profile=profile,
            whatsapp_url=whatsapp_url,
            sms_url=sms_url
        )
    finally:
        conn.close()


@app.route("/shop/billing/void/<int:bill_id>", methods=["POST"])
@customer_required
def shop_void_bill(bill_id):
    user_id = session["user_id"]
    reason = request.form.get("reason", "Cancelled by shop owner").strip()
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT bill_number FROM bills WHERE id = %s AND user_id = %s", (bill_id, user_id))
            bill = cursor.fetchone()
            if not bill:
                abort(404)

            cursor.execute("""
                UPDATE bills
                SET status = 'void', void_reason = %s
                WHERE id = %s AND user_id = %s
            """, (reason, bill_id, user_id))
        conn.commit()
        flash(f"Bill {bill['bill_number']} marked as void.", "info")
    finally:
        conn.close()
    return redirect(url_for("shop_billing_history"))


# -----------------------------------------------------------------------------
# Shop Profile & Account Settings
# -----------------------------------------------------------------------------

@app.route("/shop/profile", methods=["GET", "POST"])
@customer_required
def shop_profile():
    user_id = session["user_id"]
    conn = get_db_connection()
    try:
        if request.method == "POST":
            brand_name = request.form.get("brand_name", "").strip()
            owner_name = request.form.get("owner_name", "").strip()
            mobile = request.form.get("mobile", "").strip()
            email = request.form.get("email", "").strip() or None
            address = request.form.get("address", "").strip()
            bill_header = request.form.get("bill_header", "").strip()
            bill_footer = request.form.get("bill_footer", "").strip()
            terms_conditions = request.form.get("terms_conditions", "").strip()
            currency_symbol = request.form.get("currency_symbol", "₹").strip()

            logo_path = None
            if "logo" in request.files:
                file = request.files["logo"]
                if file and file.filename and allowed_file(file.filename):
                    filename = f"logo_{user_id}_{secure_filename(file.filename)}"
                    save_path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
                    file.save(save_path)
                    logo_path = f"static/uploads/{filename}"

            with conn.cursor() as cursor:
                if logo_path:
                    cursor.execute("""
                        UPDATE shop_profiles
                        SET brand_name=%s, owner_name=%s, mobile=%s, email=%s, address=%s,
                            bill_header=%s, bill_footer=%s, terms_conditions=%s, currency_symbol=%s, logo_path=%s
                        WHERE user_id=%s
                    """, (brand_name, owner_name, mobile, email, address, bill_header, bill_footer, terms_conditions, currency_symbol, logo_path, user_id))
                else:
                    cursor.execute("""
                        UPDATE shop_profiles
                        SET brand_name=%s, owner_name=%s, mobile=%s, email=%s, address=%s,
                            bill_header=%s, bill_footer=%s, terms_conditions=%s, currency_symbol=%s
                        WHERE user_id=%s
                    """, (brand_name, owner_name, mobile, email, address, bill_header, bill_footer, terms_conditions, currency_symbol, user_id))

                # Sync users table names
                cursor.execute("UPDATE users SET shop_name = %s, owner_name = %s WHERE id = %s", (brand_name, owner_name, user_id))
            conn.commit()
            session["shop_name"] = brand_name
            session["owner_name"] = owner_name
            flash("Shop profile and invoice branding updated.", "success")
            return redirect(url_for("shop_profile"))

        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM shop_profiles WHERE user_id = %s", (user_id,))
            profile = cursor.fetchone()
        return render_template("shop_profile.html", profile=profile)
    finally:
        conn.close()


@app.route("/account/settings", methods=["GET", "POST"])
@login_required
def account_settings():
    user_id = session["user_id"]
    conn = get_db_connection()
    try:
        if request.method == "POST":
            current_username = request.form.get("current_username", "").strip()
            new_username = request.form.get("new_username", "").strip()
            current_password = request.form.get("current_password", "")
            new_password = request.form.get("new_password", "")
            confirm_new_password = request.form.get("confirm_new_password", "")

            with conn.cursor() as cursor:
                cursor.execute("SELECT username, password_hash FROM users WHERE id = %s", (user_id,))
                user = cursor.fetchone()

                if not check_password_hash(user["password_hash"], current_password):
                    flash("Incorrect current password.", "danger")
                    return redirect(url_for("account_settings"))

                # Username update if changed
                target_username = user["username"]
                if new_username and new_username != user["username"]:
                    cursor.execute("SELECT id FROM users WHERE username = %s AND id != %s", (new_username, user_id))
                    if cursor.fetchone():
                        flash("Username is already taken by another account.", "danger")
                        return redirect(url_for("account_settings"))
                    target_username = new_username

                # Password update if requested
                target_pwd_hash = user["password_hash"]
                if new_password:
                    if new_password != confirm_new_password:
                        flash("New password and confirmation do not match.", "danger")
                        return redirect(url_for("account_settings"))
                    if len(new_password) < 6:
                        flash("New password must be at least 6 characters long.", "danger")
                        return redirect(url_for("account_settings"))
                    target_pwd_hash = generate_password_hash(new_password)

                cursor.execute("""
                    UPDATE users
                    SET username = %s, password_hash = %s
                    WHERE id = %s
                """, (target_username, target_pwd_hash, user_id))

            conn.commit()
            session["username"] = target_username
            flash("Account credentials updated successfully.", "success")
            return redirect(url_for("account_settings"))

        with conn.cursor() as cursor:
            cursor.execute("SELECT username, shop_name, owner_name, role FROM users WHERE id = %s", (user_id,))
            user = cursor.fetchone()
        return render_template("account_settings.html", user=user)
    finally:
        conn.close()


@app.errorhandler(404)
def handle_spa_fallback(e):
    """
    Single-Port SPA Router:
    Routes client-side navigation paths (e.g. /billing, /history, /products)
    back to dist/index.html so React can render the correct page seamlessly on 1 port.
    """
    if request.method == "GET" and not request.path.startswith("/api/"):
        dist_index = os.path.join(DIST_DIR, "index.html")
        if os.path.isfile(dist_index):
            return send_from_directory(DIST_DIR, "index.html")
    return jsonify({"error": "Resource not found", "path": request.path}), 404


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    dist_index = os.path.join(DIST_DIR, "index.html")
    print("=" * 68)
    print("  MULTI-SHOP BILLING MANAGEMENT SYSTEM (SINGLE-PORT UNIFIED)")
    print(f"  -> Single Port Running At: http://localhost:{port}")
    if os.path.isfile(dist_index):
        print("  -> Frontend UI: Connected & Active (dist/index.html)")
    else:
        print("  -> Frontend UI Notice: Run 'npm run build' to bundle frontend.")
    print(f"  -> MySQL Database Target: {DB_USER}@{DB_HOST}:{DB_PORT}/{DB_NAME}")
    print("=" * 68)
    app.run(host="0.0.0.0", port=port, debug=True)
