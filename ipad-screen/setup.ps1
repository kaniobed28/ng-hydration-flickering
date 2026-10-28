# One-time setup for the iPad second screen.
#
#   - installs the open-source Virtual Display Driver (a fake second monitor)
#     with resolutions that match iPads, and switches Windows to "Extend"
#   - allows the server port through Windows Firewall on private networks
#   - offers to mark the current Wi-Fi as Private
#
# Run setup.cmd (double-click), or: powershell -ExecutionPolicy Bypass -File setup.ps1
# Remove everything again with:     setup.cmd -Uninstall

param(
  [switch]$Uninstall,
  [int]$Port = 8080
)

$ErrorActionPreference = 'Stop'

# Pinned release of https://github.com/VirtualDrivers/Virtual-Display-Driver
$DriverUrl    = 'https://github.com/VirtualDrivers/Virtual-Display-Driver/releases/download/25.7.23/VirtualDisplayDriver-x86.Driver.Only.zip'
$DriverSha256 = 'E24210692B442B39AF763536330CE78B423F19342B7A7792C26DE3944E418B3A'
$HardwareId   = 'Root\MttVDD'
$SettingsDir  = 'C:\VirtualDisplayDriver'   # where the driver reads vdd_settings.xml
$FirewallName = 'iPad second screen'

# --- Re-launch as administrator ------------------------------------------------
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  $argList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"", '-Port', $Port)
  if ($Uninstall) { $argList += '-Uninstall' }
  Start-Process powershell.exe -Verb RunAs -ArgumentList $argList
  exit
}

function Step($text) { Write-Host "`n> $text" -ForegroundColor Cyan }
function Done($text) { Write-Host "  $text" -ForegroundColor Green }
function Note($text) { Write-Host "  $text" -ForegroundColor Yellow }

function Get-VirtualDisplay {
  Get-PnpDevice -ErrorAction SilentlyContinue | Where-Object { $_.HardwareID -contains $HardwareId }
}

# Creating a root-enumerated device needs SetupAPI (this is what devcon.exe does).
Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;

public static class VddInstaller {
  [StructLayout(LayoutKind.Sequential)]
  struct SP_DEVINFO_DATA { public int cbSize; public Guid ClassGuid; public int DevInst; public IntPtr Reserved; }

  [DllImport("setupapi.dll", SetLastError = true)]
  static extern IntPtr SetupDiCreateDeviceInfoList(ref Guid classGuid, IntPtr hwnd);
  [DllImport("setupapi.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  static extern bool SetupDiCreateDeviceInfoW(IntPtr set, string name, ref Guid classGuid, string desc, IntPtr hwnd, int flags, ref SP_DEVINFO_DATA data);
  [DllImport("setupapi.dll", SetLastError = true)]
  static extern bool SetupDiSetDeviceRegistryPropertyW(IntPtr set, ref SP_DEVINFO_DATA data, int property, byte[] buffer, int size);
  [DllImport("setupapi.dll", SetLastError = true)]
  static extern bool SetupDiCallClassInstaller(int function, IntPtr set, ref SP_DEVINFO_DATA data);
  [DllImport("setupapi.dll")]
  static extern bool SetupDiDestroyDeviceInfoList(IntPtr set);
  [DllImport("newdev.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  static extern bool UpdateDriverForPlugAndPlayDevicesW(IntPtr hwnd, string hardwareId, string infPath, int flags, out bool reboot);

  const int DICD_GENERATE_ID = 1, SPDRP_HARDWAREID = 1, DIF_REGISTERDEVICE = 0x19, INSTALLFLAG_FORCE = 1;

  public static void CreateDevice(string hardwareId, Guid classGuid, string className) {
    IntPtr set = SetupDiCreateDeviceInfoList(ref classGuid, IntPtr.Zero);
    if (set == new IntPtr(-1)) throw new Win32Exception(Marshal.GetLastWin32Error());
    try {
      var data = new SP_DEVINFO_DATA();
      data.cbSize = Marshal.SizeOf(data);
      if (!SetupDiCreateDeviceInfoW(set, className, ref classGuid, null, IntPtr.Zero, DICD_GENERATE_ID, ref data))
        throw new Win32Exception(Marshal.GetLastWin32Error());
      byte[] ids = Encoding.Unicode.GetBytes(hardwareId + "\0\0");
      if (!SetupDiSetDeviceRegistryPropertyW(set, ref data, SPDRP_HARDWAREID, ids, ids.Length))
        throw new Win32Exception(Marshal.GetLastWin32Error());
      if (!SetupDiCallClassInstaller(DIF_REGISTERDEVICE, set, ref data))
        throw new Win32Exception(Marshal.GetLastWin32Error());
    } finally {
      SetupDiDestroyDeviceInfoList(set);
    }
  }

  public static bool InstallDriver(string hardwareId, string infPath) {
    bool reboot;
    if (!UpdateDriverForPlugAndPlayDevicesW(IntPtr.Zero, hardwareId, infPath, INSTALLFLAG_FORCE, out reboot))
      throw new Win32Exception(Marshal.GetLastWin32Error());
    return reboot;
  }
}
'@

# --- Uninstall -------------------------------------------------------------------
if ($Uninstall) {
  Step 'Removing the virtual display'
  $devices = @(Get-VirtualDisplay)
  $infs = @(Get-CimInstance Win32_PnPSignedDriver | Where-Object { $_.HardWareID -eq $HardwareId } | ForEach-Object { $_.InfName } | Select-Object -Unique)
  foreach ($d in $devices) { pnputil /remove-device "$($d.InstanceId)" | Out-Null }
  foreach ($inf in $infs) { if ($inf) { pnputil /delete-driver $inf /uninstall /force | Out-Null } }
  if ($devices.Count) { Done 'Virtual display removed.' } else { Done 'No virtual display was installed.' }

  Step 'Removing the firewall rule'
  Get-NetFirewallRule -DisplayName $FirewallName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
  Done 'Firewall rule removed.'

  if (Test-Path $SettingsDir) { Remove-Item $SettingsDir -Recurse -Force }
  Write-Host "`nAll done. Press Enter to close."; [void](Read-Host)
  exit
}

# --- 1. Virtual display driver -------------------------------------------------
Step 'Virtual display (the extra monitor Windows extends onto)'
if (Get-VirtualDisplay) {
  Done 'Already installed.'
} else {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $work = Join-Path $env:TEMP ('vdd-' + [guid]::NewGuid())
  New-Item -ItemType Directory $work | Out-Null
  $zip = Join-Path $work 'driver.zip'

  Write-Host '  Downloading the Virtual Display Driver...'
  Invoke-WebRequest -Uri $DriverUrl -OutFile $zip -UseBasicParsing
  if ((Get-FileHash $zip -Algorithm SHA256).Hash -ne $DriverSha256) { throw 'The downloaded driver does not match the expected checksum. Nothing was installed.' }
  Expand-Archive $zip -DestinationPath $work
  $inf = Get-ChildItem $work -Recurse -Filter MttVDD.inf | Select-Object -First 1
  if (-not $inf) { throw 'MttVDD.inf was not found in the download.' }

  # iPad resolutions, so the extra screen is sharp and fills the iPad.
  $resolutions = @(
    @(2048, 1536), # iPad (older), iPad mini 4/5, iPad Air 1-3
    @(2160, 1620), # iPad 7-9
    @(2360, 1640), # iPad 10, iPad Air 4-5, iPad Air 11"
    @(2266, 1488), # iPad mini 6-7
    @(2388, 1668), # iPad Pro 11"
    @(2420, 1668), # iPad Pro 11" (M4)
    @(2732, 2048), # iPad Pro 12.9", iPad Air 13"
    @(2752, 2064), # iPad Pro 13" (M4)
    @(1366, 1024), # half-size: faster, larger text
    @(1180, 820),
    @(1920, 1080)
  )
  $settings = [xml](Get-Content (Join-Path $inf.DirectoryName 'vdd_settings.xml') -Raw)
  $list = $settings.vdd_settings.resolutions
  $list.RemoveAll()
  foreach ($r in $resolutions) {
    $node = $settings.CreateElement('resolution')
    foreach ($pair in @(@('width', $r[0]), @('height', $r[1]), @('refresh_rate', 60))) {
      $child = $settings.CreateElement($pair[0]); $child.InnerText = [string]$pair[1]; [void]$node.AppendChild($child)
    }
    [void]$list.AppendChild($node)
  }
  New-Item -ItemType Directory $SettingsDir -Force | Out-Null
  $settings.Save((Join-Path $SettingsDir 'vdd_settings.xml'))

  Write-Host '  Installing the driver (Windows may ask you to confirm)...'
  $displayClass = [guid]'4D36E968-E325-11CE-BFC1-08002BE10318'
  [VddInstaller]::CreateDevice($HardwareId, $displayClass, 'Display')
  $reboot = [VddInstaller]::InstallDriver($HardwareId, $inf.FullName)
  Remove-Item $work -Recurse -Force
  Done 'Installed.'
  if ($reboot) { Note 'Windows says a restart is needed before the new screen appears.' }
}

Start-Sleep -Seconds 2
& "$env:SystemRoot\System32\DisplaySwitch.exe" /extend
Done 'Windows is set to "Extend these displays".'

# --- 2. Firewall -----------------------------------------------------------------
Step "Firewall (let the iPad reach this PC on port $Port)"
Get-NetFirewallRule -DisplayName $FirewallName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName $FirewallName -Direction Inbound -Protocol TCP -LocalPort $Port -Profile Private -Action Allow | Out-Null
Done "Allowed on private networks."

# --- 3. Network type -------------------------------------------------------------
Step 'Network type'
foreach ($p in @(Get-NetConnectionProfile | Where-Object { $_.IPv4Connectivity -ne 'Disconnected' })) {
  if ($p.NetworkCategory -eq 'Public') {
    $answer = Read-Host "  '$($p.Name)' is set to Public, so the iPad cannot connect. Make it Private? Only do this for your home or office network. [Y/n]"
    if ($answer -notmatch '^[nN]') {
      Set-NetConnectionProfile -InterfaceIndex $p.InterfaceIndex -NetworkCategory Private
      Done "'$($p.Name)' is now Private."
    } else {
      Note "Left '$($p.Name)' as Public. The iPad will not be able to connect over it."
    }
  } else {
    Done "'$($p.Name)' is $($p.NetworkCategory)."
  }
}

# --- Next steps ------------------------------------------------------------------
Write-Host "`nSetup finished." -ForegroundColor Green
Write-Host '  - Optional: Settings > System > Display, click the new screen and pick the resolution of your iPad.'
Write-Host '  - Then double-click start.cmd to use the iPad as a second screen.'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Note 'Node.js is not installed. Get the LTS version from https://nodejs.org before running start.cmd.'
}
Write-Host "`nPress Enter to close."; [void](Read-Host)
