# 🌐 How to Make Your Billing System Live for Free Using Your PC Storage for Database

This guide explains how to make your **Multi-Shop Billing Management System** accessible to anyone across the world via a public **HTTPS website**, **100% free of cost**, while **keeping your MySQL database and all data stored entirely on your PC's local hard drive**.

---

## 💡 How It Works

```
[Customer on Phone / Tablet / Internet]
                 │
                 ▼  (Secure Public HTTPS URL)
     [Cloudflare Global Edge Network]
                 │
                 ▼  (Encrypted Tunnel)
    [Your Windows PC / Laptop]
      ├── Flask & Frontend Server (Port 5000)
      └── Local MySQL Database (Port 3306)
          └── Storage: Your Local PC Hard Drive!
```

- **Everyone accesses the same live database**: Any bill created on a mobile phone or by another counter immediately writes to your local MySQL database.
- **Your Data Remains Private**: All data stays on your PC's storage. No expensive cloud database fees.
- **No Router Port Forwarding Required**: Safe from hackers and port scanners.

---

## 🚀 Method 1: Cloudflare Tunnel (Recommended - 100% Free Forever)

Cloudflare Tunnel (`cloudflared`) connects your local application on `http://localhost:5000` to a secure public HTTPS URL. It is completely free, has unlimited bandwidth, and provides automatic SSL certificates.

### Step 1: Download Cloudflare Tunnel (`cloudflared`)
1. Download the standalone Windows executable from Cloudflare:
   - Direct link: [https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe](https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe)
   - Or install via Windows Terminal (winget):
     ```cmd
     winget install --id Cloudflare.cloudflared
     ```
2. Place `cloudflared.exe` inside your project folder (or rename to `cloudflared.exe` and keep in `C:\Windows\System32`).

### Step 2: Start Your Local Billing System (Port 5000)
Make sure your application is running locally:
```cmd
run_app.bat
```
*(Verify you can open `http://localhost:5000` on your PC).*

### Step 3: Launch the Public Tunnel
Run the included batch script:
```cmd
start_public_live_tunnel.bat
```
*(Or run directly in Command Prompt):*
```cmd
cloudflared tunnel --url http://localhost:5000
```

Cloudflare will instantly display a live public HTTPS address:
```
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at:                                          |
|  https://random-words-1234.trycloudflare.com                                               |
+--------------------------------------------------------------------------------------------+
```

### Step 4: Share with Customers & Staff!
- Open the generated `https://*.trycloudflare.com` URL on your smartphone, tablet, or send it to your staff.
- Customers can scan invoice QR codes and view digital receipts from anywhere in the world!
- All orders, bills, and products update live in your local MySQL database!

---

## ⚡ Method 2: ngrok (Alternative Instant 1-Click Live URL)

If you prefer ngrok:

1. Download **ngrok** from [ngrok.com/download](https://ngrok.com/download).
2. Extract `ngrok.exe` into your project directory.
3. In a terminal, run:
   ```cmd
   ngrok http 5000
   ```
4. ngrok displays your public link:
   ```
   Forwarding   https://abc-123.ngrok-free.app -> http://localhost:5000
   ```
5. Share this link — everyone can now access your billing system online!

---

## 🏷️ Optional: Use Your Own Free Custom Domain (e.g., `billing.yourstore.com`)

If you own a domain name (or get a free domain):
1. Sign up for a free Cloudflare account at [dash.cloudflare.com](https://dash.cloudflare.com/).
2. Go to **Zero Trust > Networks > Tunnels**.
3. Click **Create a Tunnel** and select your domain name (e.g., `billing.yourstore.com`).
4. Set the service to:
   - Type: `HTTP`
   - URL: `localhost:5000`
5. Now your billing system is permanently live at `https://billing.yourstore.com` — completely free, running off your own PC!

---

## 🔒 Important Tips for Running a PC-Hosted Server

1. **Keep Your PC Awake**:
   - In Windows **Settings > System > Power & Sleep**, set *Sleep* to **Never** while your store is operating so the server stays online.
2. **Back Up Your MySQL Database**:
   - In **MySQL Workbench**, click **Server > Data Export**, select `billing_db`, and export to a `.sql` file regularly.
3. **Static Local IP (Optional)**:
   - Set a static internal IP for your PC (e.g. `192.168.1.100`) so other devices on the same store Wi-Fi can also access `http://192.168.1.100:5000` directly without internet.
