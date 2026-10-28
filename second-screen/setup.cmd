@echo off
rem One-time setup (needs administrator): virtual display and firewall. Pass -Uninstall to undo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1" %*
