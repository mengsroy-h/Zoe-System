[CmdletBinding()]
param(
    [switch]$Remove,
    [string]$Start = '06:00',
    [int]$IntervalMinutes = 1,
    [int]$WindowHours = 16
)

$ErrorActionPreference = 'Stop'

$TaskName = 'Zoe ZTO Cookie Sync'
$toolDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$runner = Join-Path $toolDir 'sync-zto-cookie.cmd'

function Get-ExistingTask {
    try {
        return Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
    } catch {
        return $null
    }
}

if ($Remove) {
    if ($null -eq (Get-ExistingTask)) {
        Write-Host ('Nothing to remove: no task named "' + $TaskName + '".')
        exit 0
    }
    try {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    } catch {
        Write-Host 'ERROR: the task could not be removed.' -ForegroundColor Red
        Write-Host 'It was probably created by an Administrator. Remove it from Task'
        Write-Host 'Scheduler, or run this file once from an Administrator window.'
        exit 1
    }
    Write-Host 'Removed.'
    exit 0
}

if (-not (Test-Path -LiteralPath $runner)) {
    Write-Host 'ERROR: sync-zto-cookie.cmd is missing next to this file.' -ForegroundColor Red
    exit 1
}

# The scheduler starts the action with an interactive token, so a plain .cmd
# would flash a console window every time. PowerShell launched hidden starts
# the runner hidden as well. The Chromium window stays visible on purpose:
# when Argus really needs a login, the user has to see it.
$quotedRunner = "'" + $runner.Replace("'", "''") + "'"
$command = '& { Start-Process -FilePath ' + $quotedRunner + " -ArgumentList '--auto' -WindowStyle Hidden -Wait }"
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument (
    '-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -Command "' + $command + '"'
)

# The real cause of "ERROR: Access is denied." (user report, 2026-09-05):
# `schtasks /Create /SC ONLOGON` WITHOUT /RU registers a logon trigger for
# EVERY user of the machine, and that needs Administrator. This tool is a
# per-user tool by design - DPAPI/CurrentUser holds the Netlify token and the
# browser profile belongs to this Windows account - so the task must name its
# owner. InteractiveToken keeps it password-free: no stored credential, and
# the task runs only while this user is logged on, which the browser needs.
$userId = $env:USERNAME
if (-not [string]::IsNullOrWhiteSpace($env:USERDOMAIN)) {
    $userId = $env:USERDOMAIN + '\' + $env:USERNAME
}
$principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited

# A capture can hold the browser for up to 10 minutes while the repeat timer
# keeps ticking. IgnoreNew stops a second window from opening on top of a
# login the user is in the middle of.
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 20)

$logonTrigger = New-ScheduledTaskTrigger -AtLogOn -User $userId

# ONLOGON alone means a cookie that dies at 10am waits for the next restart.
# The repeat window covers working hours instead.
#
# The interval is 1 minute on purpose. The Function already knows the cookie is
# dead the moment ZTO rejects a real scan (noteCookieRejected), so every second
# of delay after that is polling lag and nothing else. At 1 minute the shop
# loses the one scan that hit the expiry, not half an hour of them. The poll
# itself is cheap: the diagnostics endpoint answers from memory and the poll
# does not force a blob read.
$startAt = [datetime]::Today.Add([timespan]::Parse($Start))
$dailyTrigger = New-ScheduledTaskTrigger -Daily -At $startAt
$repeatApplied = $false
try {
    $pattern = New-ScheduledTaskTrigger -Once -At $startAt `
        -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes) `
        -RepetitionDuration (New-TimeSpan -Hours $WindowHours)
    $dailyTrigger.Repetition = $pattern.Repetition
    $repeatApplied = $true
} catch {
    $repeatApplied = $false
}

$triggers = @($logonTrigger, $dailyTrigger)

Write-Host ''
Write-Host ('Registering "' + $TaskName + '" for this Windows user only.')
Write-Host ('   runs: sync-zto-cookie.cmd --auto')
Write-Host ('   when: at logon, and every ' + $IntervalMinutes + ' minute(s) from ' + $Start + ' for ' + $WindowHours + ' hours')
Write-Host '   It checks the Function first and opens the browser only if the cookie is dead.'
Write-Host ''

try {
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $triggers `
        -Principal $principal -Settings $settings -Force | Out-Null
} catch {
    Write-Host 'ERROR: the scheduled task could not be created.' -ForegroundColor Red
    Write-Host ''
    Write-Host 'The two causes that produce "Access is denied" here:'
    Write-Host ('   1. A task named "' + $TaskName + '" already exists and was created by')
    Write-Host '      an Administrator. Open Task Scheduler, delete it, then run this again.'
    Write-Host '   2. Company policy blocks task creation. Ask for an Administrator to run'
    Write-Host '      this file once, or start it from an Administrator window.'
    Write-Host ''
    Write-Host ('Windows said: ' + $_.Exception.Message)
    exit 1
}

if (-not $repeatApplied) {
    # No silent downgrade: a logon-only task looks identical from the outside
    # while the whole point of this change - self repair during the day - is
    # missing.
    Write-Host 'WARNING: the logon trigger was registered, but this Windows build refused' -ForegroundColor Yellow
    Write-Host '         the repeat window. Open Task Scheduler and add a daily trigger' -ForegroundColor Yellow
    Write-Host ('         with "Repeat task every ' + $IntervalMinutes + ' minutes" by hand.') -ForegroundColor Yellow
    exit 1
}

# Registering at 3pm when the window opens at 6am would leave the daily
# trigger pointing at tomorrow, so nothing would be polled for the rest of
# today. Kicking the task once closes that gap and proves it really runs.
try {
    Start-ScheduledTask -TaskName $TaskName
    Write-Host 'Started one check now, so you do not have to wait for the next trigger.'
} catch {
    Write-Host 'WARNING: the task was created but could not be started right now.' -ForegroundColor Yellow
    Write-Host '         It will still run at the next trigger.' -ForegroundColor Yellow
}

Write-Host 'Done.' -ForegroundColor Green
Write-Host 'Run "schedule-zto-cookie.cmd remove" to delete the task.'
exit 0
