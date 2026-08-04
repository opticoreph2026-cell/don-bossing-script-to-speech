# Don Bossing - Local Server Launcher
# Serves the app on http://localhost:8787 (no Node/Python needed).
# localhost counts as a "secure context" so the .wav Record & Download feature works.

$port = 8787
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

Write-Host "Don Bossing app running at http://localhost:$port/"
Write-Host "Press Ctrl+C to stop."

Start-Process "http://localhost:$port/"

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    try {
      $req = $ctx.Request
      $res = $ctx.Response

      $rel = $req.Url.AbsolutePath.TrimStart("/")
      if ([string]::IsNullOrWhiteSpace($rel)) { $rel = "index.html" }

      $file = Join-Path $root $rel
      if (-not (Test-Path -LiteralPath $file)) { $file = Join-Path $root "index.html" }

      $bytes = [System.IO.File]::ReadAllBytes($file)
      $ext = [System.IO.Path]::GetExtension($file).ToLower()
      switch ($ext) {
        ".html" { $res.ContentType = "text/html; charset=utf-8" }
        ".css"  { $res.ContentType = "text/css; charset=utf-8" }
        ".js"   { $res.ContentType = "text/javascript; charset=utf-8" }
        ".png"  { $res.ContentType = "image/png" }
        ".jpg"  { $res.ContentType = "image/jpeg" }
        ".svg"  { $res.ContentType = "image/svg+xml" }
        ".json" { $res.ContentType = "application/json" }
        ".wav"  { $res.ContentType = "audio/wav" }
        ".mp3"  { $res.ContentType = "audio/mpeg" }
        default { $res.ContentType = "application/octet-stream" }
      }
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } finally {
      $ctx.Response.Close()
    }
  }
} finally {
  $listener.Stop()
}
