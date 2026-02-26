param(
  [Parameter(Mandatory = $false)]
  [string]$RepoOwner = "ankurmishraiaf-ui",

  [Parameter(Mandatory = $false)]
  [string]$RepoName = "AIANKUR",

  [Parameter(Mandatory = $false)]
  [string]$CertSubject = "CN=AIANKUR Local Build Signer",

  [Parameter(Mandatory = $false)]
  [string]$PfxPassword
)

$ErrorActionPreference = "Stop"

function Ensure-CertDrive {
  if (-not (Get-PSDrive -Name Cert -ErrorAction SilentlyContinue)) {
    New-PSDrive -Name Cert -PSProvider Certificate -Root "\" | Out-Null
  }
}

function Find-CertBySubject {
  param([string]$SubjectName)

  $store = New-Object System.Security.Cryptography.X509Certificates.X509Store(
    [System.Security.Cryptography.X509Certificates.StoreName]::My,
    [System.Security.Cryptography.X509Certificates.StoreLocation]::CurrentUser
  )

  try {
    $store.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadOnly)
    return ($store.Certificates |
      Where-Object { $_.Subject -eq $SubjectName } |
      Sort-Object NotBefore -Descending |
      Select-Object -First 1)
  } finally {
    $store.Close()
  }
}

function Get-OrCreateCodeSigningCert {
  param([string]$SubjectName)

  $existing = Find-CertBySubject -SubjectName $SubjectName

  if ($existing) {
    return $existing
  }

  Ensure-CertDrive
  $created = New-SelfSignedCertificate `
    -Type CodeSigningCert `
    -Subject $SubjectName `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -NotAfter (Get-Date).AddYears(2)

  if ($created) {
    return $created
  }

  $retry = Find-CertBySubject -SubjectName $SubjectName
  if ($retry) {
    return $retry
  }

  throw "Unable to find or create code-signing certificate: $SubjectName"
}

function Get-GitHubTokenFromCredentialManager {
  param(
    [string]$Owner,
    [string]$Name
  )

  $request = "protocol=https`nhost=github.com`npath=$Owner/$Name`n`n"
  $response = $request | git credential fill
  $tokenLine = ($response -split "`n" |
      Where-Object { $_ -like "password=*" } |
      Select-Object -First 1)

  if (-not $tokenLine) {
    throw "No GitHub credential found in git credential manager for $Owner/$Name."
  }

  return $tokenLine.Substring("password=".Length)
}

if (-not $PfxPassword) {
$pool = (48..57) + (65..90) + (97..122)
  $PfxPassword = -join ($pool | Get-Random -Count 32 | ForEach-Object { [char]$_ })
}

$cert = Get-OrCreateCodeSigningCert -SubjectName $CertSubject
$pfxPath = Join-Path $env:TEMP "aiankur-local-signing.pfx"

try {
  $pfxBytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pfx, $PfxPassword)
  [System.IO.File]::WriteAllBytes($pfxPath, $pfxBytes)

  $token = Get-GitHubTokenFromCredentialManager -Owner $RepoOwner -Name $RepoName
  $env:GH_TOKEN = $token
  $env:CSC_LINK = [Convert]::ToBase64String([IO.File]::ReadAllBytes($pfxPath))
  $env:CSC_KEY_PASSWORD = $PfxPassword
  $env:CSC_IDENTITY_AUTO_DISCOVERY = "false"

  npm run publish:github:signed
  exit $LASTEXITCODE
} finally {
  if (Test-Path $pfxPath) {
    Remove-Item $pfxPath -Force
  }
}
