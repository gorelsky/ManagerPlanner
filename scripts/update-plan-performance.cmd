@echo off
setlocal EnableExtensions

rem Show Russian file names and messages correctly in the terminal.
chcp 65001 >nul

rem Keep the launcher ASCII-only. The PowerShell worker contains the Unicode
rem source path and therefore works from cmd regardless of the active codepage.
set "SCRIPT_DIR=%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%update-plan-performance.ps1"
exit /b %errorlevel%
