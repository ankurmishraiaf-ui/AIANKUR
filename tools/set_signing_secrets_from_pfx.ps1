param(
  [Parameter(Mandatory = $true)]
  [string]$PfxPath,

  [Parameter(Mandatory = $true)]
  [string]$PfxPassword,

  [Parameter(Mandatory = $false)]
  [string]$RepoOwner = "ankurmishraiaf-ui",

  [Parameter(Mandatory = $false)]
  [string]$RepoName = "AIANKUR"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $PfxPath)) {
  throw "PFX file not found: $PfxPath"
}

$req = "protocol=https`nhost=github.com`npath=$RepoOwner/$RepoName`n`n"
$resp = $req | git credential fill
$tokenLine = ($resp -split "`n" | Where-Object { $_ -like "password=*" } | Select-Object -First 1)
if (-not $tokenLine) {
  throw "No GitHub credential found in git credential manager for $RepoOwner/$RepoName."
}
$token = $tokenLine.Substring("password=".Length)

$tokenFile = Join-Path $env:TEMP "aiankur-secret-token.txt"
$cscLinkFile = Join-Path $env:TEMP "aiankur-secret-csc-link.txt"
$cscPwdFile = Join-Path $env:TEMP "aiankur-secret-csc-pwd.txt"

try {
  $cscLink = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path $PfxPath)))
  Set-Content -Path $tokenFile -Value $token -NoNewline
  Set-Content -Path $cscLinkFile -Value $cscLink -NoNewline
  Set-Content -Path $cscPwdFile -Value $PfxPassword -NoNewline

  $env:AIANKUR_REPO_OWNER = $RepoOwner
  $env:AIANKUR_REPO_NAME = $RepoName
  $env:AIANKUR_TOKEN_FILE = $tokenFile
  $env:AIANKUR_CSC_LINK_FILE = $cscLinkFile
  $env:AIANKUR_CSC_PWD_FILE = $cscPwdFile

  node tools/set_github_secrets.js
} finally {
  foreach ($f in @($tokenFile, $cscLinkFile, $cscPwdFile)) {
    if (Test-Path $f) {
      Remove-Item $f -Force
    }
  }
  Remove-Item Env:AIANKUR_REPO_OWNER -ErrorAction SilentlyContinue
  Remove-Item Env:AIANKUR_REPO_NAME -ErrorAction SilentlyContinue
  Remove-Item Env:AIANKUR_TOKEN_FILE -ErrorAction SilentlyContinue
  Remove-Item Env:AIANKUR_CSC_LINK_FILE -ErrorAction SilentlyContinue
  Remove-Item Env:AIANKUR_CSC_PWD_FILE -ErrorAction SilentlyContinue
}
