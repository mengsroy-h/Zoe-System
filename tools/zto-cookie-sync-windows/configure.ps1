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

# Re-running setup must KEEP the old values: Netlify shows a PAT only once,
# so forcing a new one just to fill in two optional values is a dead end.
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
Write-Host 'Find the Netlify Site ID under Project configuration > General > Project details.'
if (-not [string]::IsNullOrWhiteSpace($existingSiteId)) {
    Write-Host ('Saved: ' + $existingSiteId + ' - press Enter to keep it.')
}

$siteId = ''
while ($siteId -notmatch '^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$') {
    $answer = (Read-Host 'Enter the ZoeW Netlify Site ID').Trim()
    if ([string]::IsNullOrWhiteSpace($answer) -and -not [string]::IsNullOrWhiteSpace($existingSiteId)) {
        $siteId = $existingSiteId
        break
    }
    $siteId = $answer
    if ($siteId -notmatch '^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$') {
        Write-Host 'That Site ID has a bad shape. Copy the Site ID, not the URL.' -ForegroundColor Yellow
    }
}

Write-Host ''
Write-Host 'The ZoeW Site URL (for example https://zoew.netlify.app).'
Write-Host 'It is needed for --check and --auto mode (schedule-zto-cookie.cmd).'
if (-not [string]::IsNullOrWhiteSpace($existingSiteUrl)) {
    Write-Host ('Saved: ' + $existingSiteUrl + ' - press Enter to keep it.')
    Write-Host 'Type - (a single dash) to remove it.'
} else {
    Write-Host 'Press Enter to skip (then --auto mode stays unavailable).'
}

$siteUrl = ''
while ($true) {
    $answer = (Read-Host 'Enter the ZoeW Site URL').Trim()
    if ($answer -eq '-') { $siteUrl = ''; break }
    if ([string]::IsNullOrWhiteSpace($answer)) { $siteUrl = $existingSiteUrl; break }
    if ($answer -match '^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?/?$') {
        $siteUrl = $answer.TrimEnd('/')
        break
    }
    Write-Host 'The Site URL must start with https:// and carry no path.' -ForegroundColor Yellow
}

Write-Host ''
Write-Host 'Create a Personal Access Token at Netlify > User settings > Applications.'
if ($hasToken) {
    Write-Host 'The old token is already saved - press Enter to keep it.' -ForegroundColor Green
    Write-Host 'Type a new value only when you want to replace the token.'
} else {
    Write-Host 'What you type below is not shown on screen.'
}

$secureToken = $null
$keepToken = $false
while ($true) {
    $secureToken = Read-Host 'Enter the Netlify Personal Access Token' -AsSecureString
    if ($secureToken.Length -eq 0) {
        if ($hasToken) { $keepToken = $true; break }
        Write-Host 'A token is required - there is no saved value yet.' -ForegroundColor Yellow
        $secureToken.Dispose()
        continue
    }
    if ($secureToken.Length -lt 16 -or $secureToken.Length -gt 4096) {
        Write-Host 'That Netlify token has a bad shape (at least 16 characters).' -ForegroundColor Yellow
        $secureToken.Dispose()
        continue
    }
    break
}

# The proxy-key prompt appears only when a Site URL exists, and the --auto
# error message says so - otherwise the second prompt can never be found.
$secureProxyKey = $null
$keepProxyKey = $false
if (-not [string]::IsNullOrWhiteSpace($siteUrl)) {
    Write-Host ''
    Write-Host 'The ZTO_PROXY_KEY value, the same one as in the Netlify environment.'
    Write-Host 'It is needed for --check / --auto mode and for the self-check.'
    if ($hasProxyKey) {
        Write-Host 'The old key is already saved - press Enter to keep it.' -ForegroundColor Green
    } else {
        Write-Host ('This value is not shown on screen. At least ' + $PROXY_KEY_MIN + ' characters.')
    }
    while ($true) {
        $secureProxyKey = Read-Host 'Enter ZTO_PROXY_KEY' -AsSecureString
        if ($secureProxyKey.Length -eq 0) {
            if ($hasProxyKey) { $keepProxyKey = $true; break }
            Write-Host 'No key means --auto and --check stay unavailable.' -ForegroundColor Yellow
            $confirm = (Read-Host 'Skip it? Type y to skip, or press Enter to type the key').Trim()
            if ($confirm -match '^(y|yes)$') { $secureProxyKey.Dispose(); $secureProxyKey = $null; break }
            $secureProxyKey.Dispose()
            continue
        }
        # A key that is too short must be reported, never dropped silently:
        # a silent drop leaves the user typing it and --auto still failing.
        if ($secureProxyKey.Length -lt $PROXY_KEY_MIN) {
            Write-Host ('The proxy key is too short: you typed ' + $secureProxyKey.Length + ' characters, at least ' + $PROXY_KEY_MIN + ' are needed.') -ForegroundColor Yellow
            Write-Host 'Copy the whole ZTO_PROXY_KEY value from Netlify.' -ForegroundColor Yellow
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
        # No custom encryption key: Windows DPAPI / CurrentUser.
        $encryptedToken = ConvertFrom-SecureString -SecureString $secureToken
        [System.IO.File]::WriteAllText(
            $tokenPath,
            $encryptedToken,
            [System.Text.Encoding]::ASCII
        )
    }

    if ([string]::IsNullOrWhiteSpace($siteUrl)) {
        # Orphan key: with an empty Site URL a leftover key makes the
        # file-based gate pass while --auto stays silently dead.
        if (Test-Path -LiteralPath $proxyKeyPath) {
            Remove-Item -LiteralPath $proxyKeyPath -Force
        }
    } elseif ($null -ne $secureProxyKey -and -not $keepProxyKey) {
        # No custom encryption key here either: Windows DPAPI / CurrentUser.
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
    Write-Host ('Saved the configuration in ' + $stateRoot)
    Write-Host 'The token is encrypted for this Windows user, never stored as plain text.'
    if ([string]::IsNullOrWhiteSpace($siteUrl)) {
        Write-Host 'INFO: no Site URL, so --auto and --check stay unavailable.' -ForegroundColor Yellow
    } elseif (-not (Test-Path -LiteralPath $proxyKeyPath)) {
        Write-Host 'INFO: no ZTO_PROXY_KEY, so --auto and --check stay unavailable.' -ForegroundColor Yellow
    } else {
        Write-Host 'OK: --auto and --check are ready.' -ForegroundColor Green
    }
} finally {
    if ($null -ne $secureToken) {
        $secureToken.Dispose()
    }
    if ($null -ne $secureProxyKey) {
        $secureProxyKey.Dispose()
    }
}
