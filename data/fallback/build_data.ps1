$jsonStr = Get-Content -Raw "dataset.json"
$data = $jsonStr | ConvertFrom-Json

# Generate CSV
$data | Export-Csv -Path "dataset.csv" -NoTypeInformation -Encoding UTF8

# Generate SQL
$sqlFile = "database.sql"
"CREATE TABLE IF NOT EXISTS portals (" | Out-File $sqlFile -Encoding UTF8
"    id INT AUTO_INCREMENT PRIMARY KEY," | Out-File $sqlFile -Encoding UTF8 -Append
"    service_name VARCHAR(255)," | Out-File $sqlFile -Encoding UTF8 -Append
"    service_category VARCHAR(100)," | Out-File $sqlFile -Encoding UTF8 -Append
"    sub_category VARCHAR(100)," | Out-File $sqlFile -Encoding UTF8 -Append
"    official_website VARCHAR(255)," | Out-File $sqlFile -Encoding UTF8 -Append
"    description TEXT," | Out-File $sqlFile -Encoding UTF8 -Append
"    government_fee VARCHAR(100)," | Out-File $sqlFile -Encoding UTF8 -Append
"    recommended_service_charge VARCHAR(100)," | Out-File $sqlFile -Encoding UTF8 -Append
"    eligibility TEXT," | Out-File $sqlFile -Encoding UTF8 -Append
"    application_process TEXT," | Out-File $sqlFile -Encoding UTF8 -Append
"    required_documents TEXT," | Out-File $sqlFile -Encoding UTF8 -Append
"    authorization_required VARCHAR(100)," | Out-File $sqlFile -Encoding UTF8 -Append
"    csc_required BOOLEAN," | Out-File $sqlFile -Encoding UTF8 -Append
"    grama_one_required BOOLEAN," | Out-File $sqlFile -Encoding UTF8 -Append
"    aadhaar_operator_required BOOLEAN," | Out-File $sqlFile -Encoding UTF8 -Append
"    last_verified_date DATE," | Out-File $sqlFile -Encoding UTF8 -Append
"    portal_status VARCHAR(50)" | Out-File $sqlFile -Encoding UTF8 -Append
");`n" | Out-File $sqlFile -Encoding UTF8 -Append

foreach ($item in $data) {
    $desc = $item.description -replace "'","''"
    $req = $item.required_documents -replace "'","''"
    $sql = "INSERT INTO portals (service_name, service_category, sub_category, official_website, description, government_fee, recommended_service_charge, eligibility, application_process, required_documents, authorization_required, csc_required, grama_one_required, aadhaar_operator_required, last_verified_date, portal_status) VALUES ('$($item.service_name)', '$($item.service_category)', '$($item.sub_category)', '$($item.official_website)', '$desc', '$($item.government_fee)', '$($item.recommended_service_charge)', '$($item.eligibility)', '$($item.application_process)', '$req', '$($item.authorization_required)', $($item.csc_required.ToString().ToLower()), $($item.grama_one_required.ToString().ToLower()), $($item.aadhaar_operator_required.ToString().ToLower()), '$($item.last_verified_date)', '$($item.portal_status)');"
    $sql | Out-File $sqlFile -Encoding UTF8 -Append
}
