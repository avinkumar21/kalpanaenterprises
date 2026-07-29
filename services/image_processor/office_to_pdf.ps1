param(
    [Parameter(Mandatory=$true)][string]$InputPath,
    [Parameter(Mandatory=$true)][string]$OutputPath,
    [Parameter(Mandatory=$true)][string]$FileType
)

$ErrorActionPreference = "Stop"

try {
    $absInput = [System.IO.Path]::GetFullPath($InputPath)
    $absOutput = [System.IO.Path]::GetFullPath($OutputPath)

    if ($FileType -in "DOC", "DOCX") {
        $word = New-Object -ComObject Word.Application
        $word.Visible = $false
        $word.DisplayAlerts = "wdAlertsNone"
        $doc = $word.Documents.Open($absInput, $false, $true) # read-only
        # wdFormatPDF = 17
        $doc.SaveAs([ref]$absOutput, [ref]17)
        $doc.Close($false)
        $word.Quit()
        [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
    }
    elseif ($FileType -in "XLS", "XLSX") {
        $excel = New-Object -ComObject Excel.Application
        $excel.Visible = $false
        $excel.DisplayAlerts = $false
        $workbook = $excel.Workbooks.Open($absInput, 0, $true)
        # Configure each sheet to fit to 1 page wide in landscape if wide
        foreach ($sheet in $workbook.Worksheets) {
            try {
                $sheet.PageSetup.Orientation = 2 # xlLandscape = 2, xlPortrait = 1
                $sheet.PageSetup.Zoom = $false
                $sheet.PageSetup.FitToPagesWide = 1
                $sheet.PageSetup.FitToPagesTall = $false
            } catch {}
        }
        # xlTypePDF = 0
        $workbook.ExportAsFixedFormat(0, $absOutput)
        $workbook.Close($false)
        $excel.Quit()
        [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
    }
    elseif ($FileType -in "PPT", "PPTX") {
        $ppt = New-Object -ComObject PowerPoint.Application
        $presentation = $ppt.Presentations.Open($absInput, $true, $false, $false)
        # ppSaveAsPDF = 32
        $presentation.SaveAs($absOutput, 32)
        $presentation.Close()
        $ppt.Quit()
        [System.Runtime.Interopservices.Marshal]::ReleaseComObject($ppt) | Out-Null
    }

    if (Test-Path $absOutput) {
        Write-Host "SUCCESS: $absOutput"
        exit 0
    } else {
        Write-Error "Output file not found after conversion."
        exit 1
    }
} catch {
    Write-Error "Conversion error: $_"
    exit 1
} finally {
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
}
