Write-Host "Installing Git..."
winget install -e --id Git.Git --accept-package-agreements --accept-source-agreements
Write-Host "Installing Node.js..."
winget install -e --id OpenJS.NodeJS --accept-package-agreements --accept-source-agreements
Write-Host "Installation commands completed. You may need to restart your terminal or click YES on any UAC prompts."
