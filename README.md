# Filament Manager

A smart, automated filament inventory and print tracking system tailored specifically for Bambu Lab 3D printers. 

Filament Manager acts as a local hub to monitor your printer's activity, track how much filament is left on your spools, automatically log your print history, and even analyze your prints for failures using AI.

## 🚀 Features

* **Real-time MQTT Integration:** Connects directly to your Bambu Lab printer via MQTT to monitor active print status, temperatures, and AMS usage in real-time.
* **Automated Print Archiving:** When a print finishes, the server automatically records the print duration, calculates energy costs, deducts the precise filament weight used from your inventory, and calculates filament cost.
* **FTP Media Syncing:** Automatically connects to your printer's FTP server upon print completion to download the final timelapse or print photo.
* **AI Failure Analysis:** Integrates with the **Google Gemini API** to analyze the final print photo and automatically detect if the print was a success or if it failed (e.g., spaghetti, stringing, or warping).
* **Smart Auto-Restock:** A dedicated dashboard that monitors your inventory for low-weight spools. It provides 1-click links to the Bambu Lab store with the exact variant pre-selected so you can instantly restock.
* **AI Variant ID Detection:** Uses the Gemini API to automatically fetch and map the correct Bambu Lab store Variant ID for your filament just by typing the color name!
* **Inventory Management:** Full CRUD interface for adding brands, materials, colors, and tracking the exact physical location of each spool.

## 🛠️ Tech Stack

* **Frontend:** React, Vite
* **Backend:** Node.js, Express
* **Database:** SQLite (Local)
* **Integrations:** MQTT (Bambu Lab), FTP (Bambu Lab), Google Generative AI SDK (Gemini 1.5 Flash)

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
       restart: unless-stopped
   ```
2. Start the container:
   ```bash
   docker-compose up -d
   ```
3. Access the web interface at `http://localhost:3000` (or the port defined in your configuration).
4. Navigate to the **Settings** page (gear icon) to configure:
   * **Printer IP, Access Code, and Serial Number** (for MQTT and FTP access)
   * **Gemini API Key** (for AI print failure analysis and AI Variant ID detection)
   * **Energy Cost** (per kWh) for accurate print cost calculations

## 📁 Project Structure

* `/client` - The Vite + React frontend application.
* `/server` - The Node.js Express backend, SQLite database logic, and MQTT/FTP handlers.
* `/server/data` - The persistent volume where the SQLite database (`inventory.db`) and archived print photos are stored.

## 🤝 Contributing

This project is actively maintained. Feel free to open issues or submit pull requests with improvements!
