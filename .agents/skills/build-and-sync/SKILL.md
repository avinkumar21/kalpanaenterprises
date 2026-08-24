---
name: build-and-sync
description: >-
  Validates production builds and safely commits and pushes changes to the git repository.
  Use this skill after completing updates, fixing bugs, or modifying code to ensure zero build errors and sync with remote.
---

# Build and Sync Workflow Skill

This skill defines the mandatory validation and repository synchronization procedure to execute after code changes.

## Prerequisites & Environment
- **OS**: Windows (PowerShell / Command Prompt)
- **Frontend App**: `d:\Arka\frontend` (Vite / React / TypeScript)
- **Backend Service**: `d:\Arka\backend` (Express / Node.js)
- **Primary Remote Branch**: `main`

---

## Step-by-Step Procedure

### Step 1: Validate Frontend Production Build
Before staging or committing any code, verify that TypeScript compilation and Vite bundling succeed with zero errors.

Run in `d:\Arka\frontend`:
```cmd
cmd /c "npm run build"
```
> [!IMPORTANT]
> If any TypeScript compilation or minification errors occur, resolve them immediately before proceeding to git operations.

### Step 2: Validate Backend Integrity & Syntax
Ensure that backend server scripts and drivers parse without syntax or module resolution errors.

Run in `d:\Arka`:
```powershell
node -e "require('./backend/src/routes/print.routes.js'); require('./services/print/drivers/printer_manager.js'); console.log('Backend syntax OK');"
```

### Step 3: Check Git Status & Stage Changes
Inspect modified and newly created files:
```powershell
git status
```
Stage the intended files:
```powershell
git add .
```

### Step 4: Commit with Descriptive Conventional Message
Commit changes using a clear summary of what was added or fixed:
```powershell
git commit -m "feat(prints): add colour printout options and verify dual-printer readiness"
```

### Step 5: Push to Remote Repository
Push commits cleanly to the upstream branch:
```powershell
git push origin main
```

### Step 6: Confirm Upstream Status
Verify the working tree is clean and up to date:
```powershell
git status
```
