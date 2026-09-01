[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
    throw 'LOCALAPPDATA is unavailable.'
}

$stateRoot = Join-Path $env:LOCALAPPDATA 'Zoe-System\ZTO-Cookie-Sync'
$configPath = Join-Path $stateRoot 'config.json'
$tokenPath = Join-Path $stateRoot 'netlify-token.dpapi'

Write-Host ''
Write-Host 'Netlify Site ID រកបាននៅ Project configuration > General > Project details។'

$siteId = ''
while ($siteId -notmatch '^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$') {
    $siteId = (Read-Host 'បញ្ចូល ZoeW Netlify Site ID').Trim()
    if ($siteId -notmatch '^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$') {
        Write-Host 'Site ID ខូចទម្រង់។ សូមចម្លង Site ID មិនមែន URL។' -ForegroundColor Yellow
    }
}

Write-Host ''
Write-Host 'បង្កើត Personal Access Token នៅ Netlify > User settings > Applications។'
Write-Host 'តម្លៃដែលវាយខាងក្រោមមិនបង្ហាញលើអេក្រង់ទេ។'
$secureToken = Read-Host 'បញ្ចូល Netlify Personal Access Token' -AsSecureString

try {
    if ($secureToken.Length -lt 16 -or $secureToken.Length -gt 4096) {
        throw 'Netlify token has an invalid length.'
    }

    New-Item -ItemType Directory -Force -Path $stateRoot | Out-Null

    # គ្មាន custom encryption key ➜ Windows DPAPI / CurrentUser។
    $encryptedToken = ConvertFrom-SecureString -SecureString $secureToken
    [System.IO.File]::WriteAllText(
        $tokenPath,
        $encryptedToken,
        [System.Text.Encoding]::ASCII
    )

    $configJson = @{ version = 1; siteId = $siteId } | ConvertTo-Json -Compress
    $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::WriteAllText($configPath, $configJson, $utf8NoBom)

    Write-Host ''
    Write-Host ('បានរក្សា config ក្នុង ' + $stateRoot)
    Write-Host 'Token ត្រូវបានអ៊ិនគ្រីបដោយ Windows user នេះ មិនមែន plain text ទេ។'
} finally {
    if ($null -ne $secureToken) {
        $secureToken.Dispose()
    }
}
