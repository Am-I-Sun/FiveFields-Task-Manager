@echo off
echo Starting Five Fields local server...
start http://localhost:8000
python -m http.server 8000
