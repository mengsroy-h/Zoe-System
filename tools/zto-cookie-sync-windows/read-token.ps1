[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string] $TokenPath
)

$ErrorActionPreference = 'Stop'
$encryptedToken = [System.IO.File]::ReadAllText($TokenPath, [System.Text.Encoding]::ASCII).Trim()
if ([string]::IsNullOrWhiteSpace($encryptedToken)) {
    throw 'Encrypted token is empty.'
}

$secureToken = ConvertTo-SecureString $encryptedToken
$bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
try {
    $plainToken = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    [Console]::Out.Write($plainToken)
    $plainToken = $null
} finally {
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    $secureToken.Dispose()
}
