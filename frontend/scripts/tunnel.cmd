@echo off
REM Forward Android device ports to localhost for development
REM Handles multiple connected devices by picking the first non-TCP device

for /f "tokens=1" %%a in ('adb devices ^| findstr /v "List" ^| findstr /v "_tcp" ^| findstr /v "adb-"') do (
  adb -s %%a reverse tcp:3000 tcp:3000 2>nul
  adb -s %%a reverse tcp:8081 tcp:8081 2>nul
  goto :done
)

:done
