@echo off
rem One-time setup: virtual display, firewall, network type. Pass -Uninstall to undo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1" %*
