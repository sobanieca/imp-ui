$ErrorActionPreference = 'Stop'

$Repo = 'sobanieca/imp-ui'
$InstallDir = if ($env:INSTALL_DIR) { $env:INSTALL_DIR } else { Join-Path $env:LOCALAPPDATA 'Programs\imp' }

Write-Host 'Installing imp...'
Write-Host ''

$Architecture = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture
$ArchitectureName = switch ($Architecture) {
  ([System.Runtime.InteropServices.Architecture]::X64) { 'x64' }
  ([System.Runtime.InteropServices.Architecture]::Arm64) { 'arm64' }
  default { throw "Unsupported architecture: $Architecture - imp supports x64 and arm64 on Windows" }
}

$BinaryFile = "imp-windows-$ArchitectureName.exe"

Write-Host 'Resolving the latest release...'
$Release = Invoke-RestMethod -UseBasicParsing -Uri "https://api.github.com/repos/$Repo/releases/latest" -Headers @{ Accept = 'application/vnd.github+json' }
$Tag = $Release.tag_name
if (-not $Tag) {
  throw 'Could not resolve the latest imp release - the GitHub response has no tag_name'
}
$DownloadUrl = "https://github.com/$Repo/releases/download/$Tag/$BinaryFile"

Write-Host "Detected system: windows-$ArchitectureName"
Write-Host "Release: $Tag"
Write-Host "Download URL: $DownloadUrl"
Write-Host ''

$TempDir = Join-Path ([System.IO.Path]::GetTempPath()) ([System.Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $TempDir | Out-Null
try {
  $Binary = Join-Path $TempDir 'imp.exe'
  $Checksum = Join-Path $TempDir 'imp.exe.sha256'

  Write-Host 'Downloading imp...'
  $PreviousProgressPreference = $ProgressPreference
  $ProgressPreference = 'SilentlyContinue'
  try {
    Invoke-WebRequest -UseBasicParsing -Uri $DownloadUrl -OutFile $Binary
    Invoke-WebRequest -UseBasicParsing -Uri "$DownloadUrl.sha256" -OutFile $Checksum
  } finally {
    $ProgressPreference = $PreviousProgressPreference
  }

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

function Send-EnvironmentChange {
  if (-not ('Win32.EnvironmentBroadcast' -as [Type])) {
    Add-Type -Namespace Win32 -Name EnvironmentBroadcast -MemberDefinition @'
[DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
public static extern IntPtr SendMessageTimeout(
  IntPtr hWnd, uint Msg, UIntPtr wParam, string lParam, uint fuFlags, uint uTimeout, out UIntPtr lpdwResult);
'@
  }
  $BroadcastToAllWindows = [IntPtr] 0xffff
  $SettingChange = 0x1a
  $AbortIfHung = 0x2
  $Result = [UIntPtr]::Zero
  [Win32.EnvironmentBroadcast]::SendMessageTimeout(
    $BroadcastToAllWindows, $SettingChange, [UIntPtr]::Zero, 'Environment', $AbortIfHung, 5000, [ref] $Result
  ) | Out-Null
}

$EnvironmentKey = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey('Environment')
try {
  $UserPath = $EnvironmentKey.GetValue(
    'Path', '', [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames
  )
  $Entries = @($UserPath -split ';' | Where-Object { $_ })
  if ($Entries -notcontains $InstallDir) {
    $NewPath = (@($Entries) + $InstallDir) -join ';'
    $EnvironmentKey.SetValue('Path', $NewPath, [Microsoft.Win32.RegistryValueKind]::ExpandString)
    Send-EnvironmentChange
    Write-Host "Added $InstallDir to your user PATH. Open a new terminal to use it." -ForegroundColor Yellow
  }
} finally {
  $EnvironmentKey.Close()
}

Write-Host ''
Write-Host 'imp has been installed successfully' -ForegroundColor Green
Write-Host ''
Write-Host "Run 'imp help' to get started"
