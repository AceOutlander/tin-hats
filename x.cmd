@echo off
rem Runs any command with the project-local Node, npm and git on PATH.
rem Usage (from anywhere):  tin-hats\x.cmd npm run build
setlocal
set "ROOT=%~dp0"
set "PATH=%ROOT%.tools\node;%ROOT%.tools\git\cmd;%PATH%"
set "npm_config_cache=%ROOT%.tools\npm-cache"
set "npm_config_update_notifier=false"
set "npm_config_fund=false"
set "npm_config_audit=false"
set "PLAYWRIGHT_BROWSERS_PATH=%ROOT%.tools\ms-playwright"
set "CI=1"
cd /d "%ROOT%"
call %*
exit /b %ERRORLEVEL%
