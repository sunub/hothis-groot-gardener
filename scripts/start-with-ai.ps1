<#
.SYNOPSIS
Start Space Garden Simulator with the language model on this computer (Windows).

.DESCRIPTION
Checks Node.js, installs Ollama if it is missing (winget), makes sure the
Ollama server is running, downloads the model (about 10 GB, once), installs
the npm packages, writes apps\web\.env.local, then builds and starts the app
at http://localhost:3000. Without the model the game still runs and shows the
pre-made crisis text; delete apps\web\.env.local to go back to that.

Run from the repository folder:
  powershell -ExecutionPolicy Bypass -File scripts\start-with-ai.ps1
  powershell -ExecutionPolicy Bypass -File scripts\start-with-ai.ps1 -Yes   # no questions
  powershell -ExecutionPolicy Bypass -File scripts\start-with-ai.ps1 -Dev   # development server

On macOS or Linux, use scripts/start-with-ai.sh.
#>
param(
  [string]$Model = 'gemma4:e4b',
  [int]$Port = 3000,
  [switch]$Yes,
  [switch]$Dev
)

$ErrorActionPreference = 'Stop'
# Works in Windows PowerShell 5.1 (the one Windows ships with) and PowerShell 7.

$Root = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $Root 'apps\web\.env.local'
$OllamaUrl = 'http://127.0.0.1:11434'

function Say([string]$Message) { Write-Host ''; Write-Host "==> $Message" -ForegroundColor Cyan }
function Fail([string]$Message) { Write-Host ''; Write-Host "Error: $Message" -ForegroundColor Red; exit 1 }
function Confirm-Step([string]$Question) {
  if ($Yes) { return $true }
  $answer = Read-Host "$Question [Y/n]"
  return ($answer -eq '' -or $answer -match '^(y|yes)$')
}
function Test-Command([string]$Name) { return [bool](Get-Command $Name -ErrorAction SilentlyContinue) }
function Update-SessionPath {
  # Programs installed by winget are not on this window's PATH until it is reloaded.
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}
function Test-Ollama {
  try { Invoke-RestMethod -Uri "$OllamaUrl/api/tags" -TimeoutSec 3 | Out-Null; return $true } catch { return $false }
}
function Install-WithWinget([string]$Id, [string]$Name, [string]$Url) {
  if (-not (Test-Command 'winget')) { Fail "$Name is not installed. Install it from $Url, then run this again." }
  if (-not (Confirm-Step "$Name is not installed. Install it with winget?")) { Fail "Install $Name from $Url, then run this again." }
  & winget install --id $Id -e --accept-source-agreements --accept-package-agreements
  if ($LASTEXITCODE -ne 0) { Fail "winget could not install $Name. Install it from $Url, then run this again." }
  Update-SessionPath
}

Set-Location $Root

# 1. Node.js 20.9 or later
Say 'Checking Node.js'
if (-not (Test-Command 'node')) { Install-WithWinget 'OpenJS.NodeJS.LTS' 'Node.js' 'https://nodejs.org' }
if (-not (Test-Command 'node')) { Fail 'Node.js was installed but this window cannot find it yet. Open a new PowerShell window and run this again.' }
$nodeVersion = [version]((& node -v).TrimStart('v'))
if ($nodeVersion -lt [version]'20.9.0') { Fail "Node.js $nodeVersion is too old; 20.9 or later is needed. Install the LTS version from https://nodejs.org." }
Write-Host "Node.js $nodeVersion"

# 2. Ollama
Say 'Checking Ollama'
if (-not (Test-Command 'ollama')) { Install-WithWinget 'Ollama.Ollama' 'Ollama' 'https://ollama.com/download' }
if (-not (Test-Command 'ollama')) { Fail 'Ollama was installed but this window cannot find it yet. Open a new PowerShell window and run this again.' }
# No 2> redirection on native commands: Windows PowerShell 5.1 turns redirected
# stderr into errors, and with ErrorActionPreference Stop that ends the script.
& ollama --version

# 3. Ollama server (the Ollama app usually runs it in the background)
if (Test-Ollama) {
  Write-Host "Ollama server is running at $OllamaUrl."
} else {
  Say 'Starting the Ollama server'
  Start-Process -FilePath 'ollama' -ArgumentList 'serve' -WindowStyle Hidden
  for ($i = 0; $i -lt 30; $i++) { if (Test-Ollama) { break }; Start-Sleep -Seconds 1 }
  if (-not (Test-Ollama)) { Fail 'The Ollama server did not start. Start the Ollama app from the Start menu, then run this again.' }
  Write-Host 'Started.'
}

# 4. The model
Say "Checking the model $Model"
$names = @(& ollama list | Select-Object -Skip 1 | ForEach-Object { ($_ -split '\s+')[0] })
if ($names -contains $Model) {
  Write-Host "$Model is already downloaded."
} else {
  Write-Host "$Model is not downloaded yet. The download is about 10 GB and happens once."
  if (-not (Confirm-Step 'Download it now?')) { Fail 'The model is needed to run with the language model. Without it, run: npm install; npm run dev' }
  & ollama pull $Model
  if ($LASTEXITCODE -ne 0) { Fail "Could not download $Model." }
}

# 5. npm packages (npm.cmd: npm.ps1 can be blocked by the execution policy)
Say 'Installing npm packages'
if (Test-Path (Join-Path $Root 'node_modules')) {
  Write-Host 'Already installed.'
} else {
  & npm.cmd ci --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { Fail 'npm could not install the packages.' }
}

# 6. Settings (UTF-8 without a byte order mark, so the first line reads correctly)
Say 'Writing settings'
$hasModel = (Test-Path $EnvFile) -and (Select-String -Path $EnvFile -Pattern '^\s*LLM_MODEL=' -Quiet)
if ($hasModel) {
  Write-Host "Keeping the existing $EnvFile (it already sets LLM_MODEL)."
} else {
  $lines = @(
    '# Written by scripts/start-with-ai.ps1. Delete these lines to run without the model.',
    'LLM_PROVIDER=ollama',
    "LLM_BASE_URL=$OllamaUrl",
    "LLM_MODEL=$Model",
    'LLM_THINK=false',
    'LLM_NUM_CTX=8192',
    'LLM_KEEP_ALIVE=30m',
    'LLM_TIMEOUT_MS=30000'
  )
  $text = ($lines -join "`n") + "`n"
  if (Test-Path $EnvFile) {
    Write-Host "Adding the model settings to the existing $EnvFile."
    $text = (Get-Content -Path $EnvFile -Raw) + "`n" + $text
  }
  [System.IO.File]::WriteAllText($EnvFile, $text, (New-Object System.Text.UTF8Encoding $false))
  Write-Host "Wrote $EnvFile."
}

# 7. Build and start
$env:PORT = "$Port"
if ($Dev) {
  Say 'Starting the development server'
} else {
  Say 'Building the app (about a minute)'
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { Fail 'The build failed. See the messages above.' }
  Say 'Starting the app'
}
Write-Host ''
Write-Host "  Open http://localhost:$Port" -ForegroundColor Green
Write-Host "  The window shows '[llm] $Model is loaded' when the model is ready."
Write-Host '  Crisis text written by the model is labelled on the crisis screen.'
Write-Host '  Press Ctrl+C to stop.'
Write-Host ''
if ($Dev) { & npm.cmd run dev } else { & npm.cmd run start }
