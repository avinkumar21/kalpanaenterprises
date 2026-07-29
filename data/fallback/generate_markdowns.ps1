$csvPath = Join-Path -Path $PSScriptRoot -ChildPath "dataset.csv"
$docsPath = Join-Path -Path $PSScriptRoot -ChildPath "docs"
$services = Import-Csv -Path $csvPath

function Write-Directory {
    param (
        [string]$Title,
        [string]$Filename,
        [string]$CategoryFilter
    )
    
    $filePath = Join-Path -Path $docsPath -ChildPath $Filename
    $content = "# $Title`n`n"
    
    foreach ($s in $services) {
        if ($CategoryFilter -ne "" -and $s.service_category -ne $CategoryFilter) {
            continue
        }
        
        $content += "## $($s.service_name)`n"
        $content += "- **Category:** $($s.service_category) > $($s.sub_category)`n"
        $content += "- **Website:** [$($s.official_website)]($($s.official_website))`n"
        $content += "- **Description:** $($s.description)`n"
        $content += "- **Govt Fee:** $($s.government_fee) | **Service Charge:** $($s.recommended_service_charge)`n"
        $content += "- **Required Docs:** $($s.required_documents)`n"
        $content += "- **Authorization:** $($s.authorization_required)`n`n"
    }
    
    Set-Content -Path $filePath -Value $content -Encoding UTF8
    Write-Host "Generated $Filename"
}

Write-Directory -Title "Verified Service Directory" -Filename "service_directory.md" -CategoryFilter ""
Write-Directory -Title "Job Portals Directory" -Filename "job_directory.md" -CategoryFilter "JOB PORTALS"
Write-Directory -Title "Scholarship Portals Directory" -Filename "scholarship_directory.md" -CategoryFilter "SCHOLARSHIPS"
Write-Directory -Title "Travel Services Directory" -Filename "travel_directory.md" -CategoryFilter "TRAVEL SERVICES"
Write-Directory -Title "All Verified Portals" -Filename "verified_portals.md" -CategoryFilter ""

Write-Host "Markdown directories generated successfully."
