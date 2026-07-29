$port = 8080
$root = $PSScriptRoot

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

try {
    $listener.Start()
    Write-Host "Server listening on port $port"
    Write-Host "Serving files from $root"
    Write-Host "Press Ctrl+C to stop..."
    
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        $path = $request.Url.LocalPath
        if ($path -eq "/") { $path = "/web/index.html" }
        
        $fullPath = Join-Path $root $path.Replace('/', '\')
        
        try {
            if (Test-Path $fullPath -PathType Leaf) {
                $ext = [System.IO.Path]::GetExtension($fullPath).ToLower()
                $mime = "application/octet-stream"
                switch ($ext) {
                    ".html" { $mime = "text/html" }
                    ".css"  { $mime = "text/css" }
                    ".js"   { $mime = "application/javascript" }
                    ".json" { $mime = "application/json" }
                    ".png"  { $mime = "image/png" }
                    ".jpg"  { $mime = "image/jpeg" }
                    ".ico"  { $mime = "image/x-icon" }
                }
                
                $response.ContentType = $mime
                
                $content = [System.IO.File]::ReadAllBytes($fullPath)
                $response.ContentLength64 = $content.Length
                $response.OutputStream.Write($content, 0, $content.Length)
                Write-Host "200 OK - $path"
            } else {
                $response.StatusCode = 404
                Write-Host "404 Not Found - $path"
            }
        } catch {
            $response.StatusCode = 500
            Write-Host "500 Error - $path - $($_.Exception.Message)"
        } finally {
            $response.Close()
        }
    }
} catch {
    Write-Host "Failed to start server: $($_.Exception.Message)"
    Write-Host "`nIf you got an Access Denied error, try running this script as Administrator, OR change the prefix to 'http://localhost:$port/'"
} finally {
    if ($listener.IsListening) {
        $listener.Stop()
    }
}
