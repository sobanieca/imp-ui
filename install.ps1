$ErrorActionPreference = 'Stop'

$Repo = 'sobanieca/imp-ui'
$InstallDir = if ($env:INSTALL_DIR) { $env:INSTALL_DIR } else { Join-Path $env:LOCALAPPDATA 'Programs\imp' }

Write-Host 'Installing imp...'
Write-Host ''

$Architecture = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture
if ($Architecture -ne [System.Runtime.InteropServices.Architecture]::X64) {
  throw "Unsupported architecture: $Architecture - imp supports x64 on Windows"
}

$BinaryFile = 'imp-windows-x64.exe'
$DownloadUrl = "https://github.com/$Repo/releases/latest/download/$BinaryFile"

Write-Host 'Detected system: windows-x64'
Write-Host "Download URL: $DownloadUrl"
Write-Host ''

$TempDir = Join-Path ([System.IO.Path]::GetTempPath()) ([System.Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $TempDir | Out-Null
try {
  $Binary = Join-Path $TempDir 'imp.exe'
  $Checksum = Join-Path $TempDir 'imp.exe.sha256'

  Write-Host 'Downloading imp...'
  Invoke-WebRequest -UseBasicParsing -Uri $DownloadUrl -OutFile $Binary
  Invoke-WebRequest -UseBasicParsing -Uri "$DownloadUrl.sha256" -OutFile $Checksum

  Write-Host 'Verifying the checksum...'
  $Expected = ((Get-Content -Raw $Checksum).Trim() -split '\s+')[0].ToLower()
  $Actual = (Get-FileHash -Algorithm SHA256 $Binary).Hash.ToLower()
  if ($Expected -ne $Actual) {
    throw "The checksum of the download does not match the published one - expected $Expected, got $Actual"
  }

  New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
  Write-Host "Installing to $InstallDir\imp.exe..."
  Move-Item -Force $Binary (Join-Path $InstallDir 'imp.exe')
} finally {
  Remove-Item -Recurse -Force $TempDir -ErrorAction SilentlyContinue
}

$UserPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$Entries = if ($UserPath) { $UserPath -split ';' } else { @() }
if ($Entries -notcontains $InstallDir) {
  $NewPath = (@($Entries | Where-Object { $_ }) + $InstallDir) -join ';'
  [Environment]::SetEnvironmentVariable('Path', $NewPath, 'User')
  Write-Host "Added $InstallDir to your user PATH. Open a new terminal to use it." -ForegroundColor Yellow
}

Write-Host ''
Write-Host 'imp has been installed successfully' -ForegroundColor Green
Write-Host ''
Write-Host "Run 'imp help' to get started"
