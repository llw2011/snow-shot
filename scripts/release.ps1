[CmdletBinding()]
param(
    [ValidateSet("Preflight", "Build", "Publish", "Monitor", "Resume", "Verify")]
    [string]$Mode = "Preflight",

    [string]$Tag,
    [string]$Remote = "origin",
    [string]$Branch = "main",
    [string]$Repository = "llw2011/snow-shot",
    [string]$TokenFile,
    [string]$ManifestPath,
    [string]$AssetsDirectory,
    [string]$OutputDirectory,
    [string]$SigningKeyPath,
    [string]$SigningPasswordPath,

    [switch]$ConfirmPublish,
    [switch]$DryRun,
    [switch]$NoWait,
    [switch]$AllowDirty,
    [switch]$AllowToolchainDrift,
    [int]$TimeoutMinutes = 135,
    [switch]$Help
)

<##
.SYNOPSIS
    Reproducible local entry point for Snow Shot builds and GitHub releases.

.DESCRIPTION
    The script deliberately has no git write operations.  It never creates or
    moves tags, pushes refs, pulls branches, creates branches, or cancels/reruns
    Actions runs.  The only remote write is the explicitly confirmed
    workflow_dispatch used by -Mode Publish.

    GitHub Actions remains the release path for macOS ARM/Intel and the
    fixed-runtime/offline Windows installers.  -Mode Build intentionally builds
    only the signed Windows standard OTA artifact and stages it locally; it does
    not create a public Release or a partial latest.json.

.EXAMPLE
    .\scripts\release.ps1 -Mode Preflight -Tag v0.8.0

.EXAMPLE
    .\scripts\release.ps1 -Mode Build

.EXAMPLE
    .\scripts\release.ps1 -Mode Build -OutputDirectory .\.tmp\build\staging\0.8.0-beta\windows-standard

.EXAMPLE
    .\scripts\release.ps1 -Mode Publish -Tag v0.8.0 -ConfirmPublish

.EXAMPLE
    .\scripts\release.ps1 -Mode Verify -Tag v0.8.0
##>

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

$script:RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$script:BuildRoot = Join-Path $script:RepoRoot ".tmp\build"
$script:TauriTargetDirectory = Join-Path $script:BuildRoot "tauri-target"
$script:StagingRoot = Join-Path $script:BuildRoot "staging"
$script:ApiBase = "https://api.github.com"
$script:Token = $null
$script:RequiredNodeMajor = 22
$script:RequiredPnpm = "10.8.1"
$script:RequiredRust = [Version]"1.90.0"
$script:ExcalidrawCommit = "d57ac317fc926bba6f7332e9ac24de7a84359d5f"
$script:OnnxRuntimeSha256 = "5552742c81e368808d4e676b1a64b9bf66f2798efe5d46c49950ec6512ddc9c7"
$script:WorkflowFile = "release.yml"

# Windows PowerShell 5.1 otherwise negotiates legacy protocols on some
# machines, causing seemingly random GitHub API/download failures.
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch { }

function Write-Info {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Host "[release] $Message"
}

function Write-WarningMessage {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Warning "[release] $Message"
}

function Fail {
    param([Parameter(Mandatory = $true)][string]$Message)
    throw $Message
}

function Show-Usage {
    @"
Snow Shot release entry point

Read-only / local:
  -Mode Preflight [-Tag vX.Y.Z] (does not require build tools)
  -Mode Build [-DryRun] [-OutputDirectory path]
  -Mode Verify -Tag vX.Y.Z (executes the verification; DryRun is not accepted)

Remote release (requires an explicit acknowledgement):
  -Mode Publish -Tag vX.Y.Z -ConfirmPublish
  -Mode Monitor|Resume -Tag vX.Y.Z

Token lookup order: SNOWSHOT_GITHUB_TOKEN, GITHUB_TOKEN, GH_TOKEN (or an
explicit untracked token file for legacy administration only; never github.txt).
The token is kept in memory and is never printed or passed as an argument.
Local Build signing material lookup: TAURI_SIGNING_PRIVATE_KEY and
TAURI_SIGNING_PRIVATE_KEY_PASSWORD, then $HOME\.tauri\snow-shot-updater.key
and .password. The private material is never printed or committed.
Local Build stages only the Windows standard OTA installer and .sig. It does
not upload a Release; macOS ARM/Intel and public Release assembly use Actions.
No mode creates/moves tags, pushes refs, pulls branches, creates branches, or
automatically cancels/reruns an Actions run.  -DryRun never dispatches.
"@ | Write-Host
}

function Invoke-Git {
    param(
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [switch]$AllowFailure
    )
    Push-Location -LiteralPath $script:RepoRoot
    try {
        $result = @(& git @Arguments 2>&1)
        $exitCode = $LASTEXITCODE
    }
    finally {
        Pop-Location
    }
    if (-not $AllowFailure -and $exitCode -ne 0) {
        $detail = ($result | ForEach-Object { [string]$_ }) -join [Environment]::NewLine
        Fail ("git {0} failed (exit {1}){2}" -f ($Arguments -join " "), $exitCode, $(if ($detail) { ": $detail" } else { "" }))
    }
    return $result
}

function Get-GitText {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)
    return ((Invoke-Git -Arguments $Arguments) | ForEach-Object { [string]$_ }) -join "`n" | ForEach-Object { $_.Trim() }
}

function Invoke-External {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [string]$WorkingDirectory = $script:RepoRoot
    )
    $resolvedWorkingDirectory = (Resolve-Path -LiteralPath $WorkingDirectory -ErrorAction Stop).Path
    Write-Info ("Running {0} in {1}" -f $FilePath, $resolvedWorkingDirectory)
    Push-Location -LiteralPath $resolvedWorkingDirectory
    try {
        & $FilePath @Arguments
        if ($LASTEXITCODE -ne 0) {
            Fail ("{0} exited with code {1}" -f $FilePath, $LASTEXITCODE)
        }
    }
    finally {
        Pop-Location
    }
}

function Require-Command {
    param([Parameter(Mandatory = $true)][string]$Name)
    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $command) {
        Fail ("Required command '{0}' was not found on PATH." -f $Name)
    }
    return $command
}

function Get-JsonFile {
    param([Parameter(Mandatory = $true)][string]$RelativePath)
    $path = Join-Path $script:RepoRoot $RelativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        Fail ("Required file is missing: {0}" -f $RelativePath)
    }
    try {
        return (Get-Content -LiteralPath $path -Raw | ConvertFrom-Json)
    }
    catch {
        Fail ("Invalid JSON in {0}: {1}" -f $RelativePath, $_.Exception.Message)
    }
}

function Get-VersionInfo {
    $tauri = Get-JsonFile -RelativePath "src-tauri/tauri.conf.json"
    $cargoTomlPath = Join-Path $script:RepoRoot "src-tauri/Cargo.toml"
    $cargoLockPath = Join-Path $script:RepoRoot "src-tauri/Cargo.lock"
    $cargoToml = Get-Content -LiteralPath $cargoTomlPath -Raw
    $cargoLock = Get-Content -LiteralPath $cargoLockPath -Raw

    $cargoMatch = [regex]::Match($cargoToml, '(?ms)^\[package\].*?^version\s*=\s*"([^"]+)"')
    if (-not $cargoMatch.Success) { Fail "Could not read [package] version from src-tauri/Cargo.toml" }
    $lockMatch = [regex]::Match($cargoLock, '(?ms)^\[\[package\]\]\s*\r?\nname\s*=\s*"snow-shot"\s*\r?\nversion\s*=\s*"([^"]+)"')
    if (-not $lockMatch.Success) { Fail "Could not read snow-shot version from src-tauri/Cargo.lock" }

    $configVersion = [string]$tauri.version
    $cargoVersion = [string]$cargoMatch.Groups[1].Value
    $lockVersion = [string]$lockMatch.Groups[1].Value
    if (-not $configVersion -or -not $cargoVersion -or -not $lockVersion) {
        Fail "One or more release version fields are empty."
    }
    if (($configVersion -ne $cargoVersion) -or ($configVersion -ne $lockVersion)) {
        Fail ("Version mismatch: tauri.conf.json={0}, Cargo.toml={1}, Cargo.lock={2}" -f $configVersion, $cargoVersion, $lockVersion)
    }
    return [pscustomobject]@{
        Version = $configVersion
        Tauri = $tauri
    }
}

function Assert-TagFormat {
    param([Parameter(Mandatory = $true)][string]$ReleaseTag)
    if ($ReleaseTag -notmatch '^v\d+\.\d+\.\d+(?:(?:[.-])[0-9A-Za-z.+-]+|\+[0-9A-Za-z.-]+)?$') {
        Fail ("Invalid release tag '{0}'. Expected vX.Y.Z or a prerelease suffix." -f $ReleaseTag)
    }
}

function Get-LocalTagCommit {
    param([Parameter(Mandatory = $true)][string]$ReleaseTag)
    Assert-TagFormat -ReleaseTag $ReleaseTag
    $tagRef = "refs/tags/$ReleaseTag"
    $tagType = (Get-GitText -Arguments @("cat-file", "-t", $tagRef))
    if ($tagType -ne "tag") {
        Fail ("Tag {0} is not an annotated tag (found {1}); refusing to release." -f $ReleaseTag, $tagType)
    }
    return (Get-GitText -Arguments @("rev-parse", "$tagRef^{commit}"))
}

function Get-TrackedStatus {
    return @((Invoke-Git -Arguments @("status", "--porcelain=v1", "--untracked-files=all")))
}

function Assert-RepositoryState {
    param(
        [switch]$StrictClean,
        [switch]$RequireOriginRef
    )
    $branchName = Get-GitText -Arguments @("branch", "--show-current")
    if ($branchName -ne $Branch) {
        Fail ("Release operations must run on branch '{0}', not '{1}'." -f $Branch, $branchName)
    }
    $head = Get-GitText -Arguments @("rev-parse", "HEAD")
    if ($StrictClean) {
        $status = Get-TrackedStatus
        if ($status.Count -gt 0) {
            $preview = ($status | Select-Object -First 12) -join "`n"
            Fail ("Working tree is not clean; commit or stash changes before release:`n{0}" -f $preview)
        }
    }
    $remoteHead = $null
    if ($RequireOriginRef) {
        $remoteRef = "refs/remotes/$Remote/$Branch"
        $remoteHead = Get-GitText -Arguments @("rev-parse", "--verify", $remoteRef)
        if ($remoteHead -ne $head) {
            Fail ("{0}/{1} ({2}) does not match HEAD ({3}). Refresh the remote reference explicitly, then rerun preflight." -f $Remote, $Branch, $remoteHead, $head)
        }
    }
    return [pscustomobject]@{ Head = $head; Branch = $branchName; RemoteHead = $remoteHead }
}

function Assert-RepositoryIdentifier {
    if ($Repository -notmatch '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$') {
        Fail ("Invalid GitHub repository identifier: {0}" -f $Repository)
    }
}

function Assert-RemoteName {
    Assert-RepositoryIdentifier
    if ($Remote -ne "origin") {
        Fail "Only the explicitly configured origin remote is allowed for release dispatch. The script never uses upstream."
    }
    $url = Get-GitText -Arguments @("remote", "get-url", $Remote)
    if ($url -notmatch "(?i)github\.com[/:]$([regex]::Escape($Repository))(?:\.git)?$") {
        Fail ("Remote '{0}' does not point to GitHub repository {1}: {2}" -f $Remote, $Repository, $url)
    }
}

function Assert-NodeToolchain {
    Require-Command -Name "node.exe" | Out-Null

    $nodeVersion = (& node.exe --version 2>&1 | Out-String).Trim()
    $nodeMatch = [regex]::Match($nodeVersion, '^v(\d+)')
    if (-not $nodeMatch.Success) { Fail "Could not determine Node.js version." }
    $nodeMajor = [int]$nodeMatch.Groups[1].Value
    if ($nodeMajor -ne $script:RequiredNodeMajor) {
        if ($AllowToolchainDrift) {
            Write-WarningMessage ("Node.js {0} detected; CI is pinned to Node {1}. Continuing because -AllowToolchainDrift was supplied." -f $nodeVersion, $script:RequiredNodeMajor)
        }
        else {
            Fail ("Node.js {0} detected; release builds require Node {1}.x (use -AllowToolchainDrift only for a non-release diagnostic)." -f $nodeVersion, $script:RequiredNodeMajor)
        }
    }

}

function Assert-WindowsBuildToolchain {
    Assert-NodeToolchain
    Require-Command -Name "pnpm.cmd" | Out-Null
    Require-Command -Name "yarn.cmd" | Out-Null
    Require-Command -Name "rustc.exe" | Out-Null
    Require-Command -Name "cargo.exe" | Out-Null
    Require-Command -Name "rustup.exe" | Out-Null

    $pnpmVersion = (& pnpm.cmd --version 2>&1 | Out-String).Trim()
    if ($pnpmVersion -ne $script:RequiredPnpm) {
        if ($AllowToolchainDrift) { Write-WarningMessage ("pnpm {0} detected; CI is pinned to pnpm {1}." -f $pnpmVersion, $script:RequiredPnpm) }
        else { Fail ("pnpm {0} detected; release builds require pnpm {1}." -f $pnpmVersion, $script:RequiredPnpm) }
    }

    $rustVersionText = (& rustc.exe --version 2>&1 | Out-String).Trim()
    $rustMatch = [regex]::Match($rustVersionText, 'rustc\s+(\d+\.\d+\.\d+)')
    if (-not $rustMatch.Success) { Fail "Could not determine rustc version." }
    $rustVersion = [Version]$rustMatch.Groups[1].Value
    if ($rustVersion -lt $script:RequiredRust) { Fail ("rustc {0} is older than the required {1}." -f $rustVersion, $script:RequiredRust) }

    $targets = @(& rustup.exe target list --installed 2>&1)
    if (-not ($targets -contains "x86_64-pc-windows-msvc")) {
        Fail "Rust target x86_64-pc-windows-msvc is not installed. Install it explicitly, then rerun preflight."
    }

    if (-not (Get-Command "cl.exe" -ErrorAction SilentlyContinue)) {
        if ($AllowToolchainDrift) { Write-WarningMessage "cl.exe is not on PATH; start a Visual Studio Developer PowerShell before building." }
        else { Fail "cl.exe is not on PATH. Start a Visual Studio Developer PowerShell with the MSVC toolchain." }
    }
    if (-not (Get-Command "rc.exe" -ErrorAction SilentlyContinue) -and -not $env:WindowsSdkDir) {
        if ($AllowToolchainDrift) { Write-WarningMessage "Windows SDK tools are not on PATH (rc.exe/WindowsSdkDir)." }
        else { Fail "Windows SDK tools are not available (rc.exe/WindowsSdkDir)." }
    }
}

function Sync-BuildPaths {
    $configScript = Join-Path $script:RepoRoot "scripts\build-config.mjs"
    if (-not (Test-Path -LiteralPath $configScript -PathType Leaf)) {
        Fail "Build path contract is missing: scripts/build-config.mjs"
    }
    Push-Location $script:RepoRoot
    try {
        $payload = @(& node.exe $configScript json 2>&1)
        $exitCode = $LASTEXITCODE
    }
    finally {
        Pop-Location
    }
    if ($exitCode -ne 0) {
        Fail ("Could not read the build path contract (exit {0})." -f $exitCode)
    }
    try {
        $paths = (($payload | ForEach-Object { [string]$_ }) -join "`n") | ConvertFrom-Json
    }
    catch {
        Fail ("Build path contract returned invalid JSON: {0}" -f $_.Exception.Message)
    }
    foreach ($name in @("repositoryRoot", "buildRoot", "tauriTargetDirectory", "stagingRoot")) {
        if (-not $paths.$name) { Fail ("Build path contract is missing '{0}'." -f $name) }
    }
    $expectedRoot = [IO.Path]::GetFullPath($script:RepoRoot)
    if ([IO.Path]::GetFullPath([string]$paths.repositoryRoot) -ne $expectedRoot) {
        Fail "Build path contract points at a different repository root."
    }
    $script:BuildRoot = [IO.Path]::GetFullPath([string]$paths.buildRoot)
    $script:TauriTargetDirectory = [IO.Path]::GetFullPath([string]$paths.tauriTargetDirectory)
    $script:StagingRoot = [IO.Path]::GetFullPath([string]$paths.stagingRoot)
}

function Assert-Excalidraw {
    $path = Join-Path $script:RepoRoot "..\excalidraw"
    if (-not (Test-Path -LiteralPath $path -PathType Container)) {
        Fail ("Sibling Excalidraw checkout is missing: {0}. CI uses commit {1}." -f $path, $script:ExcalidrawCommit)
    }
    $commit = (Get-GitText -Arguments @("-C", $path, "rev-parse", "HEAD"))
    if ($commit -ne $script:ExcalidrawCommit) {
        Fail ("Excalidraw checkout is at {0}; expected pinned commit {1}." -f $commit, $script:ExcalidrawCommit)
    }
    $dirty = @(& git -C $path status --porcelain=v1 --untracked-files=no 2>&1)
    if ($LASTEXITCODE -ne 0) { Fail "Unable to inspect the Excalidraw checkout." }
    if ($dirty.Count -gt 0) { Fail "Sibling Excalidraw checkout has tracked changes; release inputs must be reproducible." }
}

function Assert-LocalResources {
    $ortPath = Join-Path $script:RepoRoot "src-tauri\lib\onnxruntime.lib"
    if (-not (Test-Path -LiteralPath $ortPath -PathType Leaf)) {
        Fail "Missing ignored resource src-tauri/lib/onnxruntime.lib. CI downloads the pinned archive; local builds need the extracted library."
    }
    $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $ortPath).Hash.ToLowerInvariant()
    if ($hash -ne $script:OnnxRuntimeSha256) {
        Fail ("onnxruntime.lib SHA-256 {0} does not match the pinned resource {1}." -f $hash, $script:OnnxRuntimeSha256)
    }
}

function Resolve-LocalSigner {
    $key = [Environment]::GetEnvironmentVariable("TAURI_SIGNING_PRIVATE_KEY", "Process")
    $password = [Environment]::GetEnvironmentVariable("TAURI_SIGNING_PRIVATE_KEY_PASSWORD", "Process")
    $keyPath = $null
    $passwordPath = $null
    $rootPrefix = $script:RepoRoot.TrimEnd([char[]]@([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)) + [IO.Path]::DirectorySeparatorChar

    if (-not $key) {
        $keyCandidate = if ($SigningKeyPath) { $SigningKeyPath } else { Join-Path $HOME ".tauri\snow-shot-updater.key" }
        try { $keyPath = (Resolve-Path -LiteralPath $keyCandidate -ErrorAction Stop).Path }
        catch { Fail ("Local updater private key is missing: {0}" -f $keyCandidate) }
        if ($keyPath.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
            Fail "Signing material must be outside the repository; refusing to read a key from tracked project paths."
        }
        $key = ([IO.File]::ReadAllText($keyPath)).Trim()
    }
    if (-not $key) { Fail "Local updater private key is empty." }

    if (-not $password) {
        $passwordCandidate = if ($SigningPasswordPath) { $SigningPasswordPath } else { Join-Path $HOME ".tauri\snow-shot-updater.key.password" }
        try { $passwordPath = (Resolve-Path -LiteralPath $passwordCandidate -ErrorAction Stop).Path }
        catch { Fail ("Local updater key password file is missing: {0}" -f $passwordCandidate) }
        if ($passwordPath.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
            Fail "Signing material must be outside the repository; refusing to read a password from tracked project paths."
        }
        $password = ([IO.File]::ReadAllText($passwordPath)).Trim()
    }
    if (-not $password) { Fail "Local updater key password is empty." }
    return [pscustomobject]@{ KeyPath = $keyPath; Key = $key; Password = $password }
}

function Assert-UpdaterConfiguration {
    $files = @("src-tauri/tauri.windows.conf.json", "src-tauri/tauri.macos.conf.json", "src-tauri/webview2.x64.json")
    $pubkey = $null
    $expectedEndpoint = "https://github.com/$Repository/releases/latest/download/latest.json"
    foreach ($relative in $files) {
        $config = Get-JsonFile -RelativePath $relative
        $current = [string]$config.plugins.updater.pubkey
        if (-not $current) { Fail "Updater public key is missing in $relative." }
        if ($null -eq $pubkey) { $pubkey = $current }
        elseif ($pubkey -ne $current) { Fail "Updater public keys differ across platform configs." }
        $endpointList = @($config.plugins.updater.endpoints)
        if ($relative -ne "src-tauri/webview2.x64.json" -and ($endpointList.Count -ne 1 -or [string]$endpointList[0] -ne $expectedEndpoint)) {
            Fail "Unexpected updater endpoint in $relative; expected $expectedEndpoint."
        }
    }
    $noOta = Get-JsonFile -RelativePath "src-tauri/tauri.no-ota.conf.json"
    if (@($noOta.plugins.updater.endpoints).Count -ne 0 -or [bool]$noOta.bundle.createUpdaterArtifacts) {
        Fail "tauri.no-ota.conf.json must disable updater endpoints and artifacts."
    }
    $release = Get-JsonFile -RelativePath "src-tauri/tauri.release.conf.json"
    if (-not [bool]$release.bundle.createUpdaterArtifacts) { Fail "tauri.release.conf.json must enable updater artifacts." }
}

function Invoke-Preflight {
    param(
        [switch]$ForBuild,
        [switch]$StrictClean,
        [switch]$RequireOriginRef,
        [switch]$RequireTag,
        [switch]$RequireRemote
    )
    Push-Location $script:RepoRoot
    try {
        Write-Info "Preflight: repository $Repository (remote $Remote/$Branch)"
        if ($RequireRemote -or $RequireOriginRef) { Assert-RemoteName }
        else { Assert-RepositoryIdentifier }
        $state = Assert-RepositoryState -StrictClean:$StrictClean -RequireOriginRef:$RequireOriginRef
        $versions = Get-VersionInfo
        if ($Tag) {
            Assert-TagFormat -ReleaseTag $Tag
            if ($Tag.Substring(1) -ne $versions.Version) {
                Fail ("Tag {0} does not match source version {1}." -f $Tag, $versions.Version)
            }
            $tagCommit = Get-LocalTagCommit -ReleaseTag $Tag
            if ($tagCommit -ne $state.Head) {
                Fail ("Annotated tag {0} peels to {1}, not HEAD {2}; the script will not move the tag." -f $Tag, $tagCommit, $state.Head)
            }
        }
        elseif ($RequireTag) {
            Fail "This mode requires -Tag."
        }
        Assert-UpdaterConfiguration
        if ($ForBuild) {
            Assert-Excalidraw
            Assert-LocalResources
            Assert-WindowsBuildToolchain
        }
        else {
            Assert-NodeToolchain
        }
        Write-Info ("Preflight OK: version {0}, HEAD {1}" -f $versions.Version, $state.Head)
        return [pscustomobject]@{ State = $state; Versions = $versions }
    }
    finally {
        Pop-Location
    }
}

function Read-Token {
    if ($script:Token) { return $script:Token }
    $candidates = @()
    if ($TokenFile) {
        $tokenCandidate = $TokenFile
        if ([IO.Path]::GetFileName($tokenCandidate).ToLowerInvariant() -eq "github.txt") {
            Fail "Refusing to read github.txt. Use SNOWSHOT_GITHUB_TOKEN/GITHUB_TOKEN/GH_TOKEN or an explicitly named untracked token file."
        }
        if (-not [IO.Path]::IsPathRooted($tokenCandidate)) {
            $tokenCandidate = Join-Path $script:RepoRoot $tokenCandidate
        }
        $tokenPath = (Resolve-Path -LiteralPath $tokenCandidate -ErrorAction Stop).Path
        $separators = [char[]]@([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
        $rootPrefix = $script:RepoRoot.TrimEnd($separators) + [IO.Path]::DirectorySeparatorChar
        if ($tokenPath.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
            $relative = $tokenPath.Substring($rootPrefix.Length).Replace([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
            # `--error-unmatch` writes a native error for ignored/untracked
            # files; PowerShell 5.1 promotes that stderr to a terminating error
            # under ErrorActionPreference=Stop. An empty normal `ls-files`
            # result is the safe, cross-version test we need here.
            $tracked = @(& git -C $script:RepoRoot ls-files -- $relative 2>$null)
            if ($tracked.Count -gt 0) { Fail "Refusing to read a tracked token file: $TokenFile" }
        }
        $candidates += [IO.File]::ReadAllText($tokenPath)
    }
    else {
        foreach ($name in @("SNOWSHOT_GITHUB_TOKEN", "GITHUB_TOKEN", "GH_TOKEN")) {
            $value = [Environment]::GetEnvironmentVariable($name)
            if ($value) { $candidates += $value; break }
        }
    }
    if ($candidates.Count -eq 0) { Fail "A GitHub token is required (use -TokenFile or SNOWSHOT_GITHUB_TOKEN/GITHUB_TOKEN/GH_TOKEN)." }
    $value = ([string]$candidates[0]).Trim()
    if (-not $value) { Fail "The GitHub token is empty." }
    if ($value -match "\s") { Fail "The GitHub token contains whitespace; check the token file/environment." }
    $script:Token = $value
    return $script:Token
}

function Invoke-GitHubApi {
    param(
        [Parameter(Mandatory = $true)][ValidateSet("GET", "POST", "PATCH")][string]$Method,
        [Parameter(Mandatory = $true)][string]$Path,
        [object]$Body,
        [switch]$AllowAnonymous
    )
    $uri = if ($Path -match '^https?://') { $Path } else { "$($script:ApiBase)$Path" }
    $headers = @{ Accept = "application/vnd.github+json"; "X-GitHub-Api-Version" = "2022-11-28"; "User-Agent" = "snow-shot-release-script" }
    if ($script:Token) { $headers.Authorization = "Bearer $script:Token" }
    elseif (-not $AllowAnonymous) { Read-Token | Out-Null; $headers.Authorization = "Bearer $script:Token" }
    $params = @{ Method = $Method; Uri = $uri; Headers = $headers; ErrorAction = "Stop"; TimeoutSec = 30 }
    if ($null -ne $Body) {
        $params.Body = ($Body | ConvertTo-Json -Depth 10 -Compress)
        $params.ContentType = "application/json"
    }
    for ($attempt = 1; $attempt -le 3; $attempt++) {
        try { return Invoke-RestMethod @params }
        catch {
            $status = $null
            if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
            $retryable = $Method -eq "GET" -and $attempt -lt 3 -and ($status -eq 429 -or ($status -ne $null -and $status -ge 500))
            if ($retryable) {
                Start-Sleep -Seconds (2 * $attempt)
                continue
            }
            if ($status) { Fail ("GitHub API {0} {1} failed with HTTP {2}." -f $Method, $Path, $status) }
            Fail ("GitHub API {0} {1} failed: {2}" -f $Method, $Path, $_.Exception.Message)
        }
    }
}

function Get-RemoteRefCommit {
    param([Parameter(Mandatory = $true)][string]$Ref)
    $encoded = [Uri]::EscapeDataString($Ref)
    $response = Invoke-GitHubApi -Method GET -Path "/repos/$Repository/git/ref/$encoded"
    return [string]$response.object.sha
}

function Get-RemoteAnnotatedTagCommit {
    param([Parameter(Mandatory = $true)][string]$ReleaseTag)
    $encoded = [Uri]::EscapeDataString($ReleaseTag)
    $ref = Invoke-GitHubApi -Method GET -Path "/repos/$Repository/git/ref/tags/$encoded"
    if ([string]$ref.object.type -ne "tag") {
        Fail "Remote tag $ReleaseTag is lightweight; release tags must be annotated."
    }
    $sha = [string]$ref.object.sha
    for ($index = 0; $index -lt 5; $index++) {
        $tag = Invoke-GitHubApi -Method GET -Path "/repos/$Repository/git/tags/$sha"
        if ([string]$tag.object.type -eq "commit") { return [string]$tag.object.sha }
        if ([string]$tag.object.type -ne "tag") { Fail "Remote tag $ReleaseTag did not resolve to a commit." }
        $sha = [string]$tag.object.sha
    }
    Fail "Remote tag $ReleaseTag has too many tag indirections."
}

function Get-ReleaseByTag {
    param([Parameter(Mandatory = $true)][string]$ReleaseTag)
    $encoded = [Uri]::EscapeDataString($ReleaseTag)
    try { return Invoke-GitHubApi -Method GET -Path "/repos/$Repository/releases/tags/$encoded" -AllowAnonymous }
    catch {
        if ($_.Exception.Message -match "HTTP 404") { return $null }
        throw
    }
}

function Get-WorkflowRuns {
    param([Parameter(Mandatory = $true)][string]$HeadSha)
    $encodedHead = [Uri]::EscapeDataString($HeadSha)
    $response = Invoke-GitHubApi -Method GET -Path "/repos/$Repository/actions/workflows/$script:WorkflowFile/runs?per_page=100&head_sha=$encodedHead"
    return @($response.workflow_runs)
}

function Test-RunTag {
    param([Parameter(Mandatory = $true)]$Run, [Parameter(Mandatory = $true)][string]$ReleaseTag)
    $title = [string]$Run.display_title
    if ($title -and $title -match [regex]::Escape($ReleaseTag)) { return $true }
    $name = [string]$Run.name
    if ($name -and $name -match [regex]::Escape($ReleaseTag)) { return $true }
    return $false
}

function Find-ReleaseRun {
    param(
        [Parameter(Mandatory = $true)][string]$HeadSha,
        [Parameter(Mandatory = $true)][string]$ReleaseTag,
        [DateTimeOffset]$Since = ([DateTimeOffset]::UtcNow.AddHours(-24))
    )
    $runs = Get-WorkflowRuns -HeadSha $HeadSha
    $activeStates = @("queued", "in_progress", "waiting", "requested", "pending")
    $candidates = @($runs | Where-Object {
        $active = $activeStates -contains [string]$_.status
        $hasTag = Test-RunTag -Run $_ -ReleaseTag $ReleaseTag
        # Older runs predate run-name and expose neither the tag nor inputs in
        # the list response. Since this workflow is release-only and the API
        # query is already restricted to one head SHA, an active legacy run is
        # safer to adopt than to dispatch a duplicate.
        $legacyActive = $active -and ([string]$_.event -eq "workflow_dispatch" -or [string]$_.event -eq "push")
        ($hasTag -or $legacyActive) -and
        ([DateTimeOffset]::Parse([string]$_.created_at) -ge $Since)
    } | Sort-Object { [DateTimeOffset]::Parse([string]$_.created_at) } -Descending)
    if ($candidates.Count -gt 0) { return $candidates[0] }
    return $null
}

function Wait-ForReleaseRun {
    param(
        [Parameter(Mandatory = $true)][string]$HeadSha,
        [Parameter(Mandatory = $true)][string]$ReleaseTag,
        [Parameter(Mandatory = $true)][DateTimeOffset]$Since
    )
    # GitHub's dispatch endpoint is eventually consistent.  This is a short,
    # bounded discovery window only; long-running observation is delegated to
    # `gh run watch`, so this script never implements an endless polling loop.
    $delays = @(2, 5, 10)
    for ($attempt = 0; $attempt -le $delays.Count; $attempt++) {
        $run = Find-ReleaseRun -HeadSha $HeadSha -ReleaseTag $ReleaseTag -Since $Since.AddMinutes(-2)
        if ($run) { return $run }
        if ($attempt -lt $delays.Count -and -not $DryRun) { Start-Sleep -Seconds $delays[$attempt] }
    }
    return $null
}

function Watch-ReleaseRun {
    param([Parameter(Mandatory = $true)]$Run)
    $runId = [string]$Run.id
    $runUrl = [string]$Run.html_url
    Write-Info ("Actions run {0}: {1}" -f $runId, $runUrl)
    if ($NoWait) {
        Write-Info "NoWait requested; leaving the run active without cancellation or rerun."
        return $true
    }
    $gh = Get-Command gh.exe -ErrorAction SilentlyContinue
    if (-not $gh) {
        Fail "gh.exe is not installed; install GitHub CLI or run `gh run watch $runId --repo $Repository` manually. The remote run was not cancelled."
    }
    $oldGhToken = [Environment]::GetEnvironmentVariable("GH_TOKEN", "Process")
    $hadGhToken = $null -ne $oldGhToken
    $env:GH_TOKEN = Read-Token
    try {
        $process = Start-Process -FilePath $gh.Source -ArgumentList @("run", "watch", $runId, "--repo", $Repository, "--exit-status") -NoNewWindow -PassThru
        $timeoutMs = [Math]::Max(1, $TimeoutMinutes) * 60 * 1000
        if (-not $process.WaitForExit($timeoutMs)) {
            # Kill only the local watcher process; never cancel the remote run.
            try { $process.Kill() } catch { }
            Fail ("Monitor timed out after {0} minutes. The Actions run remains active: {1}" -f $TimeoutMinutes, $runUrl)
        }
        if ($process.ExitCode -ne 0) {
            $latest = Invoke-GitHubApi -Method GET -Path "/repos/$Repository/actions/runs/$runId"
            Fail ("Actions run finished with status {0}/{1}: {2}" -f $latest.status, $latest.conclusion, $runUrl)
        }
        Write-Info "Actions run completed successfully."
        return $true
    }
    finally {
        if ($hadGhToken) { $env:GH_TOKEN = $oldGhToken } else { Remove-Item Env:GH_TOKEN -ErrorAction SilentlyContinue }
    }
}

function Get-CanonicalAssetNames {
    param([Parameter(Mandatory = $true)][string]$Version)
    return @(
        "Snow.Shot_${Version}_darwin-aarch64.app.tar.gz",
        "Snow.Shot_${Version}_darwin-aarch64.app.tar.gz.sig",
        "Snow.Shot_${Version}_darwin-aarch64.dmg",
        "Snow.Shot_${Version}_darwin-x64.app.tar.gz",
        "Snow.Shot_${Version}_darwin-x64.app.tar.gz.sig",
        "Snow.Shot_${Version}_darwin-x64.dmg",
        "Snow.Shot_${Version}_windows-x64_setup.exe",
        "Snow.Shot_${Version}_windows-x64_setup.exe.sig",
        "Snow.Shot_${Version}_windows-x64_webview_setup.exe",
        "Snow.Shot_${Version}_windows-x64_offline_setup.exe",
        "latest.json"
    )
}

function Invoke-Verify {
    if ($DryRun) { Fail "-DryRun is supported only for Build and Publish; Verify must execute its checks." }
    Assert-NodeToolchain
    if ($ManifestPath) {
        if (-not $Tag) { Fail "Verify with -ManifestPath still requires -Tag so the manifest version and URLs can be checked." }
        $args = @("scripts/release-manifest.mjs", "verify", "--tag", $Tag, "--manifest", $ManifestPath)
        if ($AssetsDirectory) { $args += @("--assets-dir", $AssetsDirectory) }
        if ($ManifestPath -and $AssetsDirectory) {
            $localChecksums = Join-Path (Resolve-Path -LiteralPath $AssetsDirectory).Path "checksums.json"
            if (Test-Path -LiteralPath $localChecksums -PathType Leaf) { $args += @("--checksums", $localChecksums) }
        }
        Invoke-External -FilePath "node.exe" -Arguments $args
        return
    }
    if (-not $Tag) { Fail "Verify requires -Tag unless -ManifestPath is supplied." }
    Assert-TagFormat -ReleaseTag $Tag
    $versions = Get-VersionInfo
    if ($Tag.Substring(1) -ne $versions.Version) { Fail "Tag does not match source version." }
    $release = Get-ReleaseByTag -ReleaseTag $Tag
    if (-not $release) { Fail "No GitHub Release exists for $Tag." }
    if ([bool]$release.draft -or [bool]$release.prerelease) { Fail "Release $Tag is still draft or prerelease; OTA is not public." }
    $assetNames = @($release.assets | ForEach-Object { [string]$_.name })
    foreach ($name in (Get-CanonicalAssetNames -Version $versions.Version)) {
        if ($assetNames -notcontains $name) { Fail "Release $Tag is missing asset $name." }
    }
    $manifestAsset = @($release.assets | Where-Object { $_.name -eq "latest.json" } | Select-Object -First 1)
    if ($manifestAsset.Count -ne 1) { Fail "Release $Tag has no unique latest.json asset." }
    $checksumsAsset = @($release.assets | Where-Object { $_.name -eq "checksums.json" } | Select-Object -First 1)
    $manifestUrl = [string]$manifestAsset[0].browser_download_url
    $manifestArgs = @("scripts/release-manifest.mjs", "verify", "--tag", $Tag, "--manifest-url", $manifestUrl)
    if ($checksumsAsset.Count -eq 1) {
        $checksumsUrl = [string]$checksumsAsset[0].browser_download_url
        $manifestArgs += @("--checksums-url", $checksumsUrl)
    }
    else {
        Write-WarningMessage "Release $Tag has no checksums.json; accepting legacy compatibility mode. New releases must include it."
    }
    Invoke-External -FilePath "node.exe" -Arguments $manifestArgs
    Write-Info ("Public Release verified: {0}" -f [string]$release.html_url)
}

function Invoke-Build {
    # A local build validates the source and toolchain but does not require the
    # current commit to equal origin/main; only Publish uses that remote gate.
    $preflight = Invoke-Preflight -ForBuild -StrictClean:(-not $AllowDirty)
    Sync-BuildPaths
    if ($DryRun) {
        Write-Info "DRY-RUN: local Windows standard OTA build would run pnpm install, Excalidraw build, signed Tauri NSIS build, and stage one installer plus .sig."
        return
    }
    $signer = Resolve-LocalSigner
    $lockFiles = @("pnpm-lock.yaml", "src-tauri/Cargo.lock")
    $beforeHashes = @{}
    foreach ($relative in $lockFiles) { $beforeHashes[$relative] = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $script:RepoRoot $relative)).Hash }

    $oldOnlineStatus = [Environment]::GetEnvironmentVariable("PUBLIC_ONLINE_STATUS", "Process")
    $hadOnlineStatus = $null -ne $oldOnlineStatus
    $oldSigningKey = [Environment]::GetEnvironmentVariable("TAURI_SIGNING_PRIVATE_KEY", "Process")
    $hadSigningKey = $null -ne $oldSigningKey
    $oldSigningPassword = [Environment]::GetEnvironmentVariable("TAURI_SIGNING_PRIVATE_KEY_PASSWORD", "Process")
    $hadSigningPassword = $null -ne $oldSigningPassword
    $env:PUBLIC_ONLINE_STATUS = "true"
    $env:TAURI_SIGNING_PRIVATE_KEY = $signer.Key
    $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $signer.Password
    try {
        Invoke-External -FilePath "pnpm.cmd" -Arguments @("install", "--frozen-lockfile") -WorkingDirectory $script:RepoRoot
        $excalidraw = (Resolve-Path (Join-Path $script:RepoRoot "..\excalidraw")).Path
        Invoke-External -FilePath "yarn.cmd" -Arguments @("install", "--frozen-lockfile") -WorkingDirectory $excalidraw
        # A previous local package build leaves declaration output under this
        # package.  TypeScript then resolves both the stale declarations and
        # the source tree while rebuilding @excalidraw/common, which duplicates
        # global declarations such as Window.h.  Match update:excalidraw and a
        # fresh CI checkout by removing only this generated package output.
        Invoke-External -FilePath "yarn.cmd" -Arguments @("rimraf", "./packages/excalidraw/dist") -WorkingDirectory $excalidraw
        Invoke-External -FilePath "yarn.cmd" -Arguments @("build:packages") -WorkingDirectory $excalidraw
        # tauri.windows.conf.json is auto-merged by the CLI. The release overlay
        # turns on updater artifacts while retaining the Windows NSIS settings.
        Invoke-External -FilePath "node.exe" -Arguments @("scripts/build.mjs", "tauri", "--ci", "--target", "x86_64-pc-windows-msvc", "--config", "src-tauri/tauri.release.conf.json", "--", "--locked") -WorkingDirectory $script:RepoRoot
    }
    finally {
        if ($hadOnlineStatus) { $env:PUBLIC_ONLINE_STATUS = $oldOnlineStatus }
        else { Remove-Item Env:PUBLIC_ONLINE_STATUS -ErrorAction SilentlyContinue }
        if ($hadSigningKey) { $env:TAURI_SIGNING_PRIVATE_KEY = $oldSigningKey }
        else { Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY -ErrorAction SilentlyContinue }
        if ($hadSigningPassword) { $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $oldSigningPassword }
        else { Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD -ErrorAction SilentlyContinue }
    }

    foreach ($relative in $lockFiles) {
        $after = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $script:RepoRoot $relative)).Hash
        if ($after -ne $beforeHashes[$relative]) { Fail ("Build changed locked file {0}; refusing to hand off an unreproducible result." -f $relative) }
    }
    $bundle = Join-Path $script:TauriTargetDirectory "x86_64-pc-windows-msvc\release\bundle"
    if (-not (Test-Path -LiteralPath $bundle -PathType Container)) { Fail ("Windows bundle directory is missing: {0}" -f $bundle) }
    $version = [string]$preflight.Versions.Version

    $output = if ($OutputDirectory) {
        if ([IO.Path]::IsPathRooted($OutputDirectory)) { $OutputDirectory } else { Join-Path $script:RepoRoot $OutputDirectory }
    }
    else { Join-Path $script:StagingRoot (Join-Path $version "windows-standard") }
    $output = [IO.Path]::GetFullPath($output)
    $stageArgs = @(
        "scripts/stage-release-assets.mjs",
        "--bundle-dir", $bundle,
        "--output", $output,
        "--kind", "windows-standard",
        "--version", $version
    )
    Invoke-External -FilePath "node.exe" -Arguments $stageArgs -WorkingDirectory $script:RepoRoot
    Write-Info ("Local Windows OTA build complete. Staged installer and signature under {0}" -f $output)
    Write-Info "This directory is not a complete public OTA manifest; macOS ARM/Intel and Release publication remain an Actions workflow responsibility."
}

function Invoke-Publish {
    if (-not $Tag) { Fail "Publish requires -Tag." }
    Assert-TagFormat -ReleaseTag $Tag
    if (-not $ConfirmPublish -and -not $DryRun) {
        Fail "Publish is intentionally gated. Re-run with -ConfirmPublish after reviewing preflight output."
    }
    if ($Remote -ne "origin" -or $Branch -ne "main") {
        Fail "Publish is restricted to origin/main; no other remote or branch is accepted."
    }
    if ($DryRun) {
        Invoke-Preflight -StrictClean -RequireOriginRef -RequireTag | Out-Null
        Write-Info ("DRY-RUN: would dispatch .github/workflows/{0} on {1} for {2}, then monitor and verify." -f $script:WorkflowFile, $Branch, $Tag)
        return
    }
    if (-not $NoWait -and -not (Get-Command gh.exe -ErrorAction SilentlyContinue)) {
        Fail "gh.exe is required for Publish monitoring. Use -NoWait for dispatch-only mode or install GitHub CLI first."
    }
    Read-Token | Out-Null
    $info = Invoke-Preflight -StrictClean -RequireOriginRef -RequireTag
    $head = $info.State.Head
    $remoteMain = Get-RemoteRefCommit -Ref "heads/$Branch"
    if ($remoteMain -ne $head) { Fail ("GitHub {0}/{1} is {2}, not local HEAD {3}. No dispatch was sent." -f $Repository, $Branch, $remoteMain, $head) }
    $remoteTag = Get-RemoteAnnotatedTagCommit -ReleaseTag $Tag
    if ($remoteTag -ne $head) { Fail ("Remote annotated tag {0} peels to {1}, not HEAD {2}. No tag is modified by this script." -f $Tag, $remoteTag, $head) }

    $existingRelease = Get-ReleaseByTag -ReleaseTag $Tag
    if ($existingRelease -and -not [bool]$existingRelease.draft -and -not [bool]$existingRelease.prerelease) {
        Write-Info "A public Release already exists; no duplicate dispatch will be sent. Verifying it instead."
        Invoke-Verify
        return
    }

    $dispatchSince = [DateTimeOffset]::UtcNow
    $existingRun = Find-ReleaseRun -HeadSha $head -ReleaseTag $Tag -Since $dispatchSince.AddHours(-24)
    if ($existingRun -and (@("queued", "in_progress", "waiting", "requested", "pending") -contains [string]$existingRun.status)) {
        Write-Info "An active Actions run for this commit/tag already exists; taking over monitoring."
        if ((Watch-ReleaseRun -Run $existingRun) -and -not $NoWait) { Invoke-Verify }
        return
    }
    if ($existingRun -and [string]$existingRun.conclusion -and [string]$existingRun.conclusion -ne "success") {
        Fail ("A previous Actions run for {0} ended with {1}. It was not rerun automatically: {2}" -f $Tag, $existingRun.conclusion, $existingRun.html_url)
    }

    Write-Info ("Dispatching workflow on origin/{0} for {1}." -f $Branch, $Tag)
    Invoke-GitHubApi -Method POST -Path "/repos/$Repository/actions/workflows/$script:WorkflowFile/dispatches" -Body @{ ref = $Branch; inputs = @{ version = $Tag } } | Out-Null
    Write-Info "Dispatch accepted by GitHub."
    if ($NoWait) { return }
    $run = Wait-ForReleaseRun -HeadSha $head -ReleaseTag $Tag -Since $dispatchSince
    if (-not $run) {
        Write-WarningMessage "GitHub accepted the dispatch but did not expose a run in the bounded discovery window. No duplicate dispatch was sent; run Monitor later."
        return
    }
    if ((Watch-ReleaseRun -Run $run) -and -not $NoWait) { Invoke-Verify }
}

try {
    if ($Help) { Show-Usage; exit 0 }
    if ($TimeoutMinutes -lt 1) { Fail "TimeoutMinutes must be at least 1." }
    if ($DryRun -and @("Build", "Publish") -notcontains $Mode) {
        Fail "-DryRun is supported only for Build and Publish."
    }
    if ($Mode -eq "Preflight") {
        Invoke-Preflight -StrictClean:(-not $AllowDirty) -RequireOriginRef | Out-Null
    }
    elseif ($Mode -eq "Build") {
        Invoke-Build
    }
    elseif ($Mode -eq "Verify") {
        Invoke-Verify
    }
    elseif ($Mode -eq "Monitor" -or $Mode -eq "Resume") {
        if (-not $Tag) { Fail "$Mode requires -Tag." }
        Read-Token | Out-Null
        $state = Invoke-Preflight -StrictClean -RequireOriginRef -RequireTag
        $run = Find-ReleaseRun -HeadSha $state.State.Head -ReleaseTag $Tag -Since ([DateTimeOffset]::UtcNow.AddDays(-7))
        if (-not $run) { Fail "No matching Actions run was found for $Tag on HEAD $($state.State.Head)." }
        if ((Watch-ReleaseRun -Run $run) -and -not $NoWait) { Invoke-Verify }
    }
    elseif ($Mode -eq "Publish") {
        Invoke-Publish
    }
}
catch {
    Write-Error ("[release] {0}" -f $_.Exception.Message)
    exit 1
}
