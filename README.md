# Filament Manager

A smart, automated filament inventory and print tracking system tailored specifically for Bambu Lab 3D printers. 

Filament Manager acts as a local hub to monitor your printers' activity, track how much filament is left on your spools, automatically log your print history, and even analyze your prints for failures using AI.

## 🚀 Features

* **Multi-Printer Support:** Connect and monitor multiple Bambu Lab printers simultaneously from a single unified dashboard.
* **Real-time MQTT Integration:** Connects directly to your Bambu Lab printers via MQTT to monitor active print status, temperatures, and AMS usage in real-time.
* **Automated Print Archiving:** When a print finishes, the server automatically records the print duration, calculates energy costs, deducts the precise filament weight used from your inventory, and calculates filament cost.
* **FTP Media Syncing:** Automatically connects to your printer's FTP server upon print completion to download the final timelapse or print photo.
* **AI Failure Analysis:** Integrates with the **Google Gemini API** to analyze the final print photo and automatically detect if the print was a success or if it failed (e.g., spaghetti, stringing, or warping).
* **Smart Auto-Restock:** A dedicated dashboard that monitors your inventory for low-weight spools. It provides 1-click links to the Bambu Lab store with the exact variant pre-selected so you can instantly restock.
* **AI Variant ID Detection:** Uses the Gemini API to automatically fetch and map the correct Bambu Lab store Variant ID for your filament just by typing the color name!
* **Inventory Management:** Full CRUD interface for adding brands, materials, colors, and tracking the exact physical location of each spool.
* **SSO Authentication:** Full support for OpenID Connect (OIDC) through providers like Authentik, with secure JWT token issuance and a hardened API.

## 🛠️ Tech Stack

* **Frontend:** React, Vite
* **Backend:** Node.js, Express, Socket.io
* **Database:** SQLite (Local)
* **Integrations:** MQTT (Bambu Lab), FTP (Bambu Lab), Google Generative AI SDK (Gemini 1.5 Flash), OpenID Connect

## ⚙️ Getting Started (Docker)

The application is distributed as a pre-built Docker image via GitHub Container Registry (GHCR) for easy deployment.

1. Create a `docker-compose.yml` file:
   ```yaml
   version: '3.8'
   services:
     filamentmanager:
       image: ghcr.io/sweeneyuk/filamentmanager:latest
       container_name: filamentmanager
       ports:
         - "3000:3000"
       volumes:
         - ./data:/app/server/data
       environment:
         - NODE_ENV=production
         - DOMAIN=fm.example.com # Optional: Locks down CORS to a specific domain
       restart: unless-stopped
   ```
2. Start the container:
   ```bash
   docker-compose up -d
   ```
3. Access the web interface at `http://localhost:3000` (or your reverse proxy domain).
4. **Initial Setup:** You will be prompted to create a local Admin account. 
5. Navigate to the **Settings** page (gear icon) to configure:
   * **Printers:** Add one or multiple printers via IP, Access Code, and Serial Number.
   * **Gemini API Key:** (for AI print failure analysis and AI Variant ID detection)
   * **Energy Cost:** (per kWh) for accurate print cost calculations
   * **SSO Configuration:** Enter your OIDC Issuer URL, Client ID, and Secret to enable Authentik login.

## 🔒 Security

Filament Manager is designed to be safe for reverse-proxy deployment to the internet:
* All endpoints, including Socket.io telemetry and static media, are protected by JWT authentication.
* Rate limiting prevents brute-force attacks on the local admin login.
* Dynamic CORS restrictions and disabled Express headers minimize the server footprint.

## 📁 Project Structure

* `/client` - The Vite + React frontend application.
* `/server` - The Node.js Express backend, SQLite database logic, and MQTT/FTP handlers.
* `/server/data` - The persistent volume where the SQLite database (`inventory.db`) and archived print photos are stored.

## 🤝 Contributing

This project is actively maintained. Feel free to open issues or submit pull requests with improvements!
