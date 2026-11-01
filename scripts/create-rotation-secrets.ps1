[CmdletBinding()]
param(
  [string]$Destination = "$env:USERPROFILE\Documents\Somiti-Vercel-Migration\new-rotation-secrets.env"
)

$ErrorActionPreference = 'Stop'

function Get-RandomBytes([int]$Length) {
  $bytes = [byte[]]::new($Length)
  $rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
  try {
    $rng.GetBytes($bytes)
  } finally {
    $rng.Dispose()
  }
  return $bytes
}

function To-Hex([byte[]]$Bytes) {
  return ([BitConverter]::ToString($Bytes) -replace '-', '').ToLowerInvariant()
}

$directory = Split-Path -Parent $Destination
New-Item -ItemType Directory -Force -Path $directory | Out-Null

# This output intentionally stays outside the repository. It is used only to
# populate Vercel after the database re-encryption transaction has succeeded.
$lines = @(
  '# Private: add these exact values to the replacement Vercel project only.',
  '# Do not commit or upload this file.',
  ('AUTH_SECRET={0}' -f [Convert]::ToBase64String((Get-RandomBytes 48))),
  ('API_KEY_ENCRYPTION_SECRET={0}' -f (To-Hex (Get-RandomBytes 32))),
  ('CRON_SECRET={0}' -f [Convert]::ToBase64String((Get-RandomBytes 48)))
)
[System.IO.File]::WriteAllLines($Destination, $lines, [System.Text.UTF8Encoding]::new($false))

$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
try {
  $acl = Get-Acl -LiteralPath $Destination
  $acl.SetAccessRuleProtection($true, $false)
  $acl.SetAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule($identity, 'FullControl', 'Allow')))
  Set-Acl -LiteralPath $Destination -AclObject $acl
} catch {
  Write-Warning 'Windows kept the inherited private Documents-folder permissions.'
}

Write-Host "Created $Destination. Secret values were not printed."
