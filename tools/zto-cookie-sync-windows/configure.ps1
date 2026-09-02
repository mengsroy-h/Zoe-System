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

$PROXY_KEY_MIN = 16

# ⛔ ការរត់ឡើងវិញត្រូវ **រក្សាតម្លៃចាស់** ៖ Netlify បង្ហាញ PAT តែម្តងគត់
# ដូច្នេះការបង្ខំវាយវាថ្មី ដើម្បីបំពេញតម្លៃស្រេចចិត្ត ២ គឺជាផ្លូវងាប់។
$existingSiteId = ''
$existingSiteUrl = ''
if (Test-Path -LiteralPath $configPath) {
    try {
        $existing = Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($null -ne $existing) {
            $existingSiteId = [string]$existing.siteId
            $existingSiteUrl = [string]$existing.siteUrl
        }
    } catch {
        $existingSiteId = ''
        $existingSiteUrl = ''
    }
}
$hasToken = Test-Path -LiteralPath $tokenPath
$hasProxyKey = Test-Path -LiteralPath $proxyKeyPath

Write-Host ''
Write-Host 'Netlify Site ID រកបាននៅ Project configuration > General > Project details។'
if (-not [string]::IsNullOrWhiteSpace($existingSiteId)) {
    Write-Host ('រក្សាទុករួច ៖ ' + $existingSiteId + ' — ចុច Enter ដើម្បីរក្សាដដែល។')
}

$siteId = ''
while ($siteId -notmatch '^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$') {
    $answer = (Read-Host 'បញ្ចូល ZoeW Netlify Site ID').Trim()
    if ([string]::IsNullOrWhiteSpace($answer) -and -not [string]::IsNullOrWhiteSpace($existingSiteId)) {
        $siteId = $existingSiteId
        break
    }
    $siteId = $answer
    if ($siteId -notmatch '^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$') {
        Write-Host 'Site ID ខូចទម្រង់។ សូមចម្លង Site ID មិនមែន URL។' -ForegroundColor Yellow
    }
}

Write-Host ''
Write-Host 'Site URL របស់ ZoeW (ឧ. https://zoew.netlify.app)។'
Write-Host 'វាចាំបាច់សម្រាប់របៀប --check និង --auto (schedule-zto-cookie.cmd)។'
if (-not [string]::IsNullOrWhiteSpace($existingSiteUrl)) {
    Write-Host ('រក្សាទុករួច ៖ ' + $existingSiteUrl + ' — ចុច Enter ដើម្បីរក្សាដដែល។')
    Write-Host 'វាយ - (សញ្ញាដក) ដើម្បីលុបវាចេញ។'
} else {
    Write-Host 'ចុច Enter ដើម្បីរំលង (របៀប --auto នឹងប្រើមិនបាន)។'
}

$siteUrl = ''
while ($true) {
    $answer = (Read-Host 'បញ្ចូល ZoeW Site URL').Trim()
    if ($answer -eq '-') { $siteUrl = ''; break }
    if ([string]::IsNullOrWhiteSpace($answer)) { $siteUrl = $existingSiteUrl; break }
    if ($answer -match '^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?/?$') {
        $siteUrl = $answer.TrimEnd('/')
        break
    }
    Write-Host 'Site URL ត្រូវចាប់ផ្តើមដោយ https:// និងគ្មានផ្លូវខាងក្រោយ។' -ForegroundColor Yellow
}

Write-Host ''
Write-Host 'បង្កើត Personal Access Token នៅ Netlify > User settings > Applications។'
if ($hasToken) {
    Write-Host 'Token ចាស់ត្រូវបានរក្សាទុករួច — ចុច Enter ដើម្បីរក្សាដដែល។' -ForegroundColor Green
    Write-Host 'វាយតម្លៃថ្មីតែពេលចង់ប្តូរ Token ប៉ុណ្ណោះ។'
} else {
    Write-Host 'តម្លៃដែលវាយខាងក្រោមមិនបង្ហាញលើអេក្រង់ទេ។'
}

$secureToken = $null
$keepToken = $false
while ($true) {
    $secureToken = Read-Host 'បញ្ចូល Netlify Personal Access Token' -AsSecureString
    if ($secureToken.Length -eq 0) {
        if ($hasToken) { $keepToken = $true; break }
        Write-Host 'ត្រូវការ Token — មិនទាន់មានតម្លៃចាស់ទេ។' -ForegroundColor Yellow
        $secureToken.Dispose()
        continue
    }
    if ($secureToken.Length -lt 16 -or $secureToken.Length -gt 4096) {
        Write-Host 'Netlify token ខូចទម្រង់ (ត្រូវវែងយ៉ាងតិច ១៦ តួ)។' -ForegroundColor Yellow
        $secureToken.Dispose()
        continue
    }
    break
}

# ⛔ prompt សោ Proxy លេចតែពេលមាន Site URL — សារកំហុសរបស់ --auto ត្រូវប្រាប់
# ការពិតនោះ បើមិនដូច្នេះអ្នកប្រើរកមិនឃើញ prompt ទី ២ ដែលសារនិយាយដល់។
$secureProxyKey = $null
$keepProxyKey = $false
if (-not [string]::IsNullOrWhiteSpace($siteUrl)) {
    Write-Host ''
    Write-Host 'តម្លៃ ZTO_PROXY_KEY ដដែលនឹងក្នុង Netlify environment variables។'
    Write-Host 'វាត្រូវការសម្រាប់របៀប --check / --auto និងការផ្ទៀងផ្ទាត់ខ្លួនឯង។'
    if ($hasProxyKey) {
        Write-Host 'សោចាស់ត្រូវបានរក្សាទុករួច — ចុច Enter ដើម្បីរក្សាដដែល។' -ForegroundColor Green
    } else {
        Write-Host ('តម្លៃមិនបង្ហាញលើអេក្រង់ទេ។ ត្រូវវែងយ៉ាងតិច ' + $PROXY_KEY_MIN + ' តួ។')
    }
    while ($true) {
        $secureProxyKey = Read-Host 'បញ្ចូល ZTO_PROXY_KEY' -AsSecureString
        if ($secureProxyKey.Length -eq 0) {
            if ($hasProxyKey) { $keepProxyKey = $true; break }
            Write-Host 'គ្មានសោ ➜ របៀប --auto និង --check ប្រើមិនបាន។' -ForegroundColor Yellow
            $confirm = (Read-Host 'រំលងមែនទេ? វាយ y ដើម្បីរំលង ឬ Enter ដើម្បីវាយសោ').Trim()
            if ($confirm -match '^(y|yes)$') { $secureProxyKey.Dispose(); $secureProxyKey = $null; break }
            $secureProxyKey.Dispose()
            continue
        }
        # ⛔ សោខ្លីពេក ត្រូវប្រាប់ មិនមែនទម្លាក់ស្ងាត់ — ការទម្លាក់ស្ងាត់ធ្វើឲ្យ
        # អ្នកប្រើវាយរួច រួច --auto នៅតែធ្លាក់ដោយសារដដែល (វាស់រួច 2026-09-02)។
        if ($secureProxyKey.Length -lt $PROXY_KEY_MIN) {
            Write-Host ('សោ Proxy ខ្លីពេក ៖ វាយ ' + $secureProxyKey.Length + ' តួ តែត្រូវការយ៉ាងតិច ' + $PROXY_KEY_MIN + ' តួ។') -ForegroundColor Yellow
            Write-Host 'សូមចម្លងតម្លៃ ZTO_PROXY_KEY ពី Netlify ឲ្យគ្រប់។' -ForegroundColor Yellow
            $secureProxyKey.Dispose()
            $secureProxyKey = $null
            continue
        }
        break
    }
}

try {
    New-Item -ItemType Directory -Force -Path $stateRoot | Out-Null

    if (-not $keepToken) {
        # គ្មាន custom encryption key ➜ Windows DPAPI / CurrentUser។
        $encryptedToken = ConvertFrom-SecureString -SecureString $secureToken
        [System.IO.File]::WriteAllText(
            $tokenPath,
            $encryptedToken,
            [System.Text.Encoding]::ASCII
        )
    }

    if ([string]::IsNullOrWhiteSpace($siteUrl)) {
        # ⛔ សោកំព្រា ៖ Site URL ទទេ ➜ សោដែលនៅសល់ធ្វើឲ្យច្រកទ្វារតាមឯកសារ
        # ជោគជ័យ ខណៈ --auto ងាប់ស្ងាត់រាល់ការចូល Windows។
        if (Test-Path -LiteralPath $proxyKeyPath) {
            Remove-Item -LiteralPath $proxyKeyPath -Force
        }
    } elseif ($null -ne $secureProxyKey -and -not $keepProxyKey) {
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
    if ([string]::IsNullOrWhiteSpace($siteUrl)) {
        Write-Host 'ℹ️ គ្មាន Site URL ➜ របៀប --auto និង --check ប្រើមិនបាន។' -ForegroundColor Yellow
    } elseif (-not (Test-Path -LiteralPath $proxyKeyPath)) {
        Write-Host 'ℹ️ គ្មាន ZTO_PROXY_KEY ➜ របៀប --auto និង --check ប្រើមិនបាន។' -ForegroundColor Yellow
    } else {
        Write-Host '✅ របៀប --auto និង --check រួចរាល់។' -ForegroundColor Green
    }
} finally {
    if ($null -ne $secureToken) {
        $secureToken.Dispose()
    }
    if ($null -ne $secureProxyKey) {
        $secureProxyKey.Dispose()
    }
}
