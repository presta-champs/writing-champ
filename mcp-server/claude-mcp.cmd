@echo off
cd /d "D:\Downloads\writing-champ-master\writing-champ-master\mcp-server"
set NODE_ENV=production
for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
    if not "%%a"=="" if not "%%a"=="#" set "%%a=%%b"
)
"D:\Downloads\writing-champ-master\writing-champ-master\mcp-server\node_modules\.bin\tsx.cmd" stdio.ts
