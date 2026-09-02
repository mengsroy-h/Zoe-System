[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
    throw 'LOCALAPPDATA is unavailable.'
}

$stateRoot = Join-Path $env:LOCALAPPDATA 'Zoe-System\ZTO-Cookie-Sync'
$configPath = Join-Path $stateRoot 'config.json'
$tokenPath = Join-Path $stateRoot 'netlify-token.dpapi'
$proxyKeyPath = Join-Path $stateRoot 'proxy-key.dpapi'

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
Write-Host 'ជំហានស្រេចចិត្ត ៖ Site URL របស់ ZoeW (ឧ. https://zoew.netlify.app)។'
Write-Host 'បើបញ្ចូល ឧបករណ៍នឹងផ្ទៀងផ្ទាត់ដោយខ្លួនឯងថា Cookie ថ្មីដល់ Function ពិត។'
Write-Host 'ចុច Enter ដើម្បីរំលង។'

$siteUrl = ''
while ($true) {
    $siteUrl = (Read-Host 'បញ្ចូល ZoeW Site URL (ស្រេចចិត្ត)').Trim()
    if ([string]::IsNullOrWhiteSpace($siteUrl)) { $siteUrl = ''; break }
    if ($siteUrl -match '^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?/?$') {
        $siteUrl = $siteUrl.TrimEnd('/')
        break
    }
    Write-Host 'Site URL ត្រូវចាប់ផ្តើមដោយ https:// និងគ្មានផ្លូវខាងក្រោយ។' -ForegroundColor Yellow
}

Write-Host ''
Write-Host 'បង្កើត Personal Access Token នៅ Netlify > User settings > Applications។'
Write-Host 'តម្លៃដែលវាយខាងក្រោមមិនបង្ហាញលើអេក្រង់ទេ។'
$secureToken = Read-Host 'បញ្ចូល Netlify Personal Access Token' -AsSecureString

$secureProxyKey = $null
if (-not [string]::IsNullOrWhiteSpace($siteUrl)) {
    Write-Host ''
    Write-Host 'ជំហានស្រេចចិត្ត ៖ តម្លៃ ZTO_PROXY_KEY ដដែលនឹងក្នុង Netlify។'
    Write-Host 'វាត្រូវការសម្រាប់ការផ្ទៀងផ្ទាត់ និងរបៀប --check / --auto ប៉ុណ្ណោះ។'
    Write-Host 'តម្លៃដែលវាយខាងក្រោមមិនបង្ហាញលើអេក្រង់ទេ។ ចុច Enter ដើម្បីរំលង។'
    $secureProxyKey = Read-Host 'បញ្ចូល ZTO_PROXY_KEY (ស្រេចចិត្ត)' -AsSecureString
}

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

    if ($null -ne $secureProxyKey -and $secureProxyKey.Length -ge 16) {
        # គ្មាន custom encryption key ➜ Windows DPAPI / CurrentUser ដដែល។
        $encryptedProxyKey = ConvertFrom-SecureString -SecureString $secureProxyKey
        [System.IO.File]::WriteAllText(
            $proxyKeyPath,
            $encryptedProxyKey,
            [System.Text.Encoding]::ASCII
        )
    }

    $configJson = @{ version = 1; siteId = $siteId; siteUrl = $siteUrl } | ConvertTo-Json -Compress
    $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::WriteAllText($configPath, $configJson, $utf8NoBom)

    Write-Host ''
    Write-Host ('បានរក្សា config ក្នុង ' + $stateRoot)
    Write-Host 'Token ត្រូវបានអ៊ិនគ្រីបដោយ Windows user នេះ មិនមែន plain text ទេ។'
} finally {
    if ($null -ne $secureToken) {
        $secureToken.Dispose()
    }
    if ($null -ne $secureProxyKey) {
        $secureProxyKey.Dispose()
    }
}
