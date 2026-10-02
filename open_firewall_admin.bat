@echo off
echo Opening firewall ports for Hotel Kapila...
netsh advfirewall firewall delete rule name="Kapila Frontend 8008" >nul 2>&1
netsh advfirewall firewall delete rule name="Kapila Backend 3001" >nul 2>&1
netsh advfirewall firewall add rule name="Kapila Frontend 8008" dir=in action=allow protocol=TCP localport=8008
netsh advfirewall firewall add rule name="Kapila Backend 3001" dir=in action=allow protocol=TCP localport=3001
echo.
echo ============================================
echo  Hotel Kapila - Network Access Ready!
echo ============================================
echo  Server LAN IP : 192.168.1.9
echo  Frontend URL  : http://192.168.1.9:8008
echo  Backend API   : http://192.168.1.9:3001
echo ============================================
echo  Open the Frontend URL on any tablet/phone
echo  connected to the same Wi-Fi network.
echo ============================================
pause
