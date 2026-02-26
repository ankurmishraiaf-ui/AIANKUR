param(
  [Parameter(Mandatory = $false)]
  [string]$CertThumbprint = "",

  [Parameter(Mandatory = $false)]
  [string]$CertFilePath,

  [Parameter(Mandatory = $false)]
  [string]$InstallerPath
)

$ErrorActionPreference = "Stop"

if (-not $CertFilePath) {
  $CertFilePath = Join-Path -Path $PSScriptRoot -ChildPath "aiankur-codesign.cer"
}
if (-not $InstallerPath) {
  $InstallerPath = Join-Path -Path $env:TEMP -ChildPath "AIANKUR-Setup-1.0.3.exe"
}

function Get-CertByThumbprint {
  param([string]$Thumbprint)
  $store = New-Object System.Security.Cryptography.X509Certificates.X509Store(
    [System.Security.Cryptography.X509Certificates.StoreName]::My,
    [System.Security.Cryptography.X509Certificates.StoreLocation]::CurrentUser
  )
  try {
    $store.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadOnly)
    foreach ($cert in $store.Certificates) {
      if ($cert.Thumbprint -eq $Thumbprint) {
        return $cert
      }
    }
    return $null
  } finally {
    $store.Close()
  }
}

function Ensure-CertFile {
  param(
    [string]$Thumbprint,
    [string]$OutputPath,
    [string]$SignedInstallerPath
  )

  $normalizedOutputPath = [System.IO.Path]::GetFullPath($OutputPath)
  $outputDir = Split-Path -Parent $normalizedOutputPath
  if ($outputDir -and -not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
  }

  if (Test-Path $normalizedOutputPath) {
    $existingCert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($normalizedOutputPath)
    if (-not $Thumbprint -or $existingCert.Thumbprint -eq $Thumbprint) {
      return (Resolve-Path $normalizedOutputPath).Path
    }
  }

  $cert = Get-CertByThumbprint -Thumbprint $Thumbprint
  if (-not $cert) {
    throw "Certificate not found at $normalizedOutputPath and thumbprint not found in CurrentUser\\My. Provide -CertFilePath."
  }

  $bytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
  [System.IO.File]::WriteAllBytes($normalizedOutputPath, $bytes)
  return (Resolve-Path $normalizedOutputPath).Path
}

function Import-IfMissing {
  param(
    [System.Security.Cryptography.X509Certificates.StoreName]$StoreName,
    [System.Security.Cryptography.X509Certificates.X509Certificate2]$Cert,
    [string]$Thumbprint
  )

  $store = New-Object System.Security.Cryptography.X509Certificates.X509Store(
    $StoreName,
    [System.Security.Cryptography.X509Certificates.StoreLocation]::CurrentUser
  )
  try {
    $store.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
    foreach ($existing in $store.Certificates) {
      if ($existing.Thumbprint -eq $Thumbprint) {
        return $false
      }
    }
    $store.Add($Cert)
    return $true
  } finally {
    $store.Close()
  }
}

$resolvedCertPath = Ensure-CertFile -Thumbprint $CertThumbprint -OutputPath $CertFilePath -SignedInstallerPath $InstallerPath
$resolvedCert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($resolvedCertPath)
$resolvedThumbprint = $resolvedCert.Thumbprint

$rootAdded = Import-IfMissing -StoreName ([System.Security.Cryptography.X509Certificates.StoreName]::Root) -Cert $resolvedCert -Thumbprint $resolvedThumbprint
$publisherAdded = Import-IfMissing -StoreName ([System.Security.Cryptography.X509Certificates.StoreName]::TrustedPublisher) -Cert $resolvedCert -Thumbprint $resolvedThumbprint

Write-Output "CERT_FILE=$resolvedCertPath"
Write-Output "CERT_THUMBPRINT=$resolvedThumbprint"
Write-Output "ROOT_ADDED=$rootAdded"
Write-Output "TRUSTED_PUBLISHER_ADDED=$publisherAdded"
