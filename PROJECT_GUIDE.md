# Project Guide: Kalpana Enterprises Dashboard

This guide provides a comprehensive overview of the workspace architecture, folder structures, and key features of the Kalpana Enterprises citizen services dashboard project.

---

## 1. Workspace Folder Structure

After cleaning up unused boilerplate directories and temporary files, the workspace contains a clean, organized layout:

```text
d:\Arka\
├── .gitignore                # Global version control exclusions for GitHub
├── run_server.bat            # Main interactive launcher menu (Frontend & Backend)
├── PROJECT_GUIDE.md          # System architecture and workflow documentation
├── SKILLS.md                 # Technical skills and competencies
│
├── gravity_web_ui\           # Main React, Vite, and Tailwind Web Frontend (Port 80)
│   ├── public\               # Static public assets (images, logos, fonts)
│   │   ├── images\           # High-resolution category images (dashboard_bg, central_gov, etc.)
│   │   └── logo.jpg          # Kalpana Enterprise Logo
│   ├── scripts\              # Node.js validation, migration, and maintenance scripts
│   │   ├── check_urls.cjs    # URL health check utility
│   │   ├── migrate_registry.mjs # Registry data structure migrator
│   │   └── validate_registry.mjs # Master registry validator & delta crawler
│   ├── src\                  # React Application Source Code
│   │   ├── components\       # Reusable components (Sidebar, Layout, AIChat, ServiceGrid)
│   │   ├── data\             # Frontend static files & list of services
│   │   ├── locales\          # i18next translation json files (en, kn, hi, ta)
│   │   ├── pages\            # Core pages (Home, CategoryView, Admin)
│   │   ├── store\            # State management (useServices)
│   │   ├── App.tsx           # Router and App Root
│   │   ├── index.css         # Tailwind directives and custom animation styles
│   │   └── main.tsx          # Client entry point
│   ├── vite.config.ts        # Vite build & proxy settings
│   └── package.json          # Node dependencies & script aliases
│
├── kalpan_data\              # Fallback Backend Database & Data-processing files (Port 8080)
│   ├── docs\                 # Legacy/raw documents & compiled directories
│   ├── web\                  # Fallback vanilla HTML/JS/CSS client
│   │   ├── index.html        # Fallback template
│   │   ├── app.js            # Vanilla UI Logic
│   │   └── styles.css        # Fallback styles
│   ├── server.ps1            # Portable PowerShell HTTP listener (uses $PSScriptRoot)
│   ├── database.sql          # Core raw SQL tables definition
│   ├── dataset.json          # Formatted JSON dataset
│   ├── dataset.csv           # Raw CSV dataset
│   ├── generate_directory.py # Python automation builder
│   ├── generate_markdowns.ps1# Portable PowerShell markdown compiler
│   └── build_data.ps1        # PowerShell script to run compiler
│
└── tools\                    # Workspace administrative & operational scripts
    ├── install_tools.ps1     # Environment diagnostic & installer tool
    └── set_custom_domain.bat # Custom domain hosts file mapping tool
```

---

## 2. Core Architecture

The system consists of two primary layers running side-by-side:

### A. The Modern Web Application (`gravity_web_ui`)
- **Framework:** React 19 + TypeScript + Vite.
- **Styling:** Tailwind CSS with custom Vanilla CSS overlays.
- **Port:** Configured to run on **Port 80** locally for direct web accessibility.
- **Key Characteristics:** Fully responsive client-side routing, glassmorphism design tokens, state management via Zustand (`useServices.ts`), and localization via `react-i18next`.

### B. The Fallback Database & Client (`kalpan_data`)
- **Framework:** Vanilla HTML5, CSS3, and JavaScript.
- **Server:** A custom PowerShell-based HttpListener (`server.ps1`) serving static files and datasets.
- **Port:** Serves files on **Port 8080** locally.
- **Purpose:** Acts as a data compiler repository (generating JSON datasets from CSV tables) and hosts a legacy static fallback interface.

---

## 3. Key Implemented Features

### 💎 Premium Glassmorphism Design
- **Dashboard Background:** A high-fidelity, customized mesh gradient (`dashboard_bg.png`) featuring organic waves of deep royal blue, indigo, and violet.
- **Ambient Blur Blobs:** Multi-colored decorative layout blobs float behind the dashboard cards, moving smoothly with custom animations (`animate-float-slow` and `animate-float-reverse`).
- **Dynamic Scroll Overlay:** On initial dashboard load, the background has maximum visibility with a light overlay. When scrolling down, the overlay dynamically becomes blurrier (`backdrop-blur-[6px]`) and darker to maximize text contrast.
- **Glass Cards:** Dashboard cards are styled with `backdrop-blur-lg` and thin semi-transparent outlines (`border-white/40`) that dynamically reflect mouse spotlight positions (`radial-gradient` tracking coordinates).

### 📱 Collapsible Sidebar & Mobile Access
- **Logo Container:** The official `logo.jpg` fits perfectly inside a sleek, glassmorphic card with full transparency inside the navigation header.
- **Vibrant Header:** The sidebar header features an interactive gradient of blue-to-purple with glowing text.
- **Collapsible Toggle:** A smooth sidebar chevron collapses the navigation to an icon-only mode to increase main dashboard space.
- **QR Sharing:** A dedicated button generates a mobile-ready QR code pointing to the server IP (`http://192.168.31.112`) so users can scan and access the site immediately on mobile.

### 🌐 Multi-lingual Translation
- Supported languages: **Kannada (ಕನ್ನಡ), English, Hindi (हिन्दी), and Tamil (தமிழ்)**.
- Localized via `i18next` with structured keys inside `src/locales/`.

---

## 4. Run Workflows

### Running the Modern React UI
1. Navigate to the `gravity_web_ui` folder.
2. Run `npm install` to install dependencies.
3. Start the dev server using:
   ```cmd
   npm run dev
   ```
4. Access via [http://localhost](http://localhost) (or via custom mapping `http://KalpanaEnterprise`).

### Running the Data Backend Fallback
1. Navigate to the `kalpan_data` folder.
2. Launch the backend listener using:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\server.ps1
   ```
3. Access fallback files via [http://localhost:8080](http://localhost:8080).

---

## 5. Always-Available Resilient Background Service (24/7 Uptime)

To ensure `http://KalpanaEnterprise` never goes offline due to closed terminal windows or unexpected process terminations, the workspace features an **Always-On Background Watchdog** powered by Windows Task Scheduler.

### Key Characteristics of the Service:
- **Zero-Dependency Startup**: Registered as `KalpanaEnterprise-AlwaysOn` inside Windows Task Scheduler, launching automatically on system boot or user log on.
- **Self-Healing Watchdog**: A persistent background monitor ([`tools/kalpana_watchdog.ps1`](file:///d:/Arka/tools/kalpana_watchdog.ps1)) polls TCP Port 80 (React UI) and Port 8080 (Data Backend) every 15 seconds. If either service stops responding or crashes, the watchdog automatically relaunches the process in the background within seconds.
- **Unified Command-Line Interface**: Manage the background service effortlessly from the project root using [`service.bat`](file:///d:/Arka/service.bat):
  ```cmd
  service.bat start     # Install and immediately start the always-on background watchdog
  service.bat status    # Inspect live TCP port uptime and scheduled task status
  service.bat stop      # Stop and uninstall all background monitors and servers
  ```
- You can also trigger these service controls directly from option `[5]`, `[6]`, or `[7]` inside `run_server.bat`.

