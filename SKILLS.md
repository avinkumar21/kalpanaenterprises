# Developer Skills & Operational Guidelines

This document details the development workflows, codebase rules, and troubleshooting procedures for maintaining the Kalpana Enterprises digital services platform.

---

## 1. Codebase Rules & Standards

When adding features, modifying code, or extending services, adhere to these strict development rules:

### A. Localization & Kannada Translation
- **Rule:** Every new service category, portal title, description, or form button MUST have localized counterparts in all translation files located in `gravity_web_ui/src/locales/` (`en.json`, `kn.json`, `hi.json`, `ta.json`).
- **Translation Keys:** Maintain consistent key names. If a service category has ID `ca`, there must be key-value pairs for `ca` (name) and `ca_desc` (description) in all JSON locale files.
- **Verification:** Always toggle the language picker in the UI after editing JSON translations to check that no card falls back to raw keys or English templates.

### B. UI Aesthetics & Glassmorphism
- **Premium Design First:** Avoid generic/solid colors for primary containers. Keep layouts glassmorphic using backdrop blurs (`backdrop-blur-md` or `backdrop-blur-lg`) combined with translucent background opacities (e.g. `bg-white/60` or `dark:bg-slate-900/50`).
- **Harmonious Accents:** Active hover effects should use radial gradient spotlight tracking overlays (`rgba(var(--glow-color), 0.2)`) and linear gradient glow lines rather than plain borders.
- **Theme Support:** Double-check every UI tweak in both Light theme and Dark theme to confirm text remains highly readable.

### C. Image Asset Sourcing
- **No External URL Hotlinking:** Avoid using raw URLs from external sites (like Wikipedia) for permanent category images, as hotlinked domains often throw 400/403/429 request errors.
- **Local Images:** Always generate high-quality images locally using image tools (such as Midjourney, DALL-E, or Gemini image generators) and save them inside `gravity_web_ui/public/images/`. Reference them using root-relative paths like `/images/your_image.png`.

---

## 2. Server Management Workflows

### Command Cheat-sheet

| Task | Location | Command |
| :--- | :--- | :--- |
| **Start Front-end Web App (Vite)** | `d:\Arka\gravity_web_ui` | `npm run dev` |
| **Start Backend Fallback Server** | `d:\Arka\kalpan_data` | `powershell -ExecutionPolicy Bypass -File .\server.ps1` |
| **Rebuild JSON/CSV Datasets** | `d:\Arka\kalpan_data` | `powershell -ExecutionPolicy Bypass -File .\build_data.ps1` |
| **Verify Local IP Access** | Any | `ipconfig` (Look for IPv4 address) |

---

## 3. Maintenance & Troubleshooting Skills

### Scenario A: The UI Server Crashes or Throw HMR Errors
- **Symptom:** The console outputs `Failed to reload module...` or the website displays a white page with script execution errors.
- **Fix:**
  1. Inspect the terminal tasks to identify the server task.
  2. Terminate the server task using `manage_task` with a `kill` signal.
  3. Restart the server with `npm run dev` to force a clean build cache.

### Scenario B: Custom Domain `http://KalpanaEnterprise` is Unresolved
- **Symptom:** Opening the browser to the custom domain throws `DNS_PROBE_FINISHED_NXDOMAIN`.
- **Fix:**
  1. Ensure the custom domain mapping is present in `C:\Windows\System32\drivers\etc\hosts`.
  2. Run the provided helper script `d:\Arka\set_custom_domain.bat` as an **Administrator** to automatically write `127.0.0.1 KalpanaEnterprise` and the local LAN IP to the hosts file.

### Scenario C: Port 80 Conflict
- **Symptom:** Starting the Vite server fails with `Error: listen EADDRINUSE: address already in use :::80`.
- **Fix:**
  - Find the application occupying Port 80 using:
    ```cmd
    netstat -ano | findstr :80
    ```
  - Kill the task using its PID:
    ```cmd
    taskkill /PID <PID_NUMBER> /F
    ```
  - Alternatively, edit `gravity_web_ui/vite.config.ts` to map Vite to a different development port.

---

## 4. Build Verification & Repository Sync Skill

### Automated Post-Update Workflow
Always execute after modifying or extending features in the codebase to guarantee zero build errors and push up to date code:

1. **Skill Definition**: [`.agents/skills/build-and-sync/SKILL.md`](file:///d:/Arka/.agents/skills/build-and-sync/SKILL.md)
2. **One-Click Automation**: Run [`.agents/skills/build-and-sync/scripts/build_and_push.bat`](file:///d:/Arka/.agents/skills/build-and-sync/scripts/build_and_push.bat)
3. **Manual Execution Steps**:
   - `cd frontend && cmd /c "npm run build"`
   - `node -e "require('./backend/src/routes/print.routes.js'); require('./services/print/drivers/printer_manager.js');"`
   - `git add . && git commit -m "<descriptive message>" && git push origin main`

