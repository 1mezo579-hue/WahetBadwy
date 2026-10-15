@echo off
chcp 65001 >nul
title تشغيل كاشير واحة بدوي - وضع الطباعة الصامتة المباشرة
color 0E

echo ======================================================================
echo          منظومة كاشير واحة بدوي - WAHET BADAWY POS CLOUD
echo      تشغيل وضع الطباعة الصامتة المباشرة إلى الطابعة الافتراضية
echo ======================================================================
echo.
echo [1/2] جاري فحص المتصفح الافتراضي (Google Chrome أو Microsoft Edge)...
echo [2/2] جاري تشغيل شاشة الكاشير بوضع (--kiosk-printing) للطباعة الفورية بدون نوافذ...
echo.

set POS_URL=https://wahetbadwy.vercel.app/pos
set USER_DATA=%LOCALAPPDATA%\WahetBadawyPOS

:: 1. محاولة التشغيل عبر Microsoft Edge (مدمج في كل أجهزة ويندوز 10 و 11)
start msedge.exe --kiosk-printing --user-data-dir="%USER_DATA%" --app="%POS_URL%"
if %ERRORLEVEL% EQU 0 (
    echo [✓] تم تشغيل شاشة الكاشير بنجاح عبر Microsoft Edge مع الطباعة التلقائية الصامتة على Xprinter!
    exit
)

:: 2. محاولة التشغيل عبر Google Chrome إذا كان مثبتاً
start chrome.exe --kiosk-printing --user-data-dir="%USER_DATA%" --app="%POS_URL%"
if %ERRORLEVEL% EQU 0 (
    echo [✓] تم تشغيل شاشة الكاشير بنجاح عبر Google Chrome مع الطباعة التلقائية الصامتة على Xprinter!
    exit
)

:: 3. في حالة عدم العثور على المسار التلقائي، البحث في المسارات القياسية
if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --kiosk-printing --user-data-dir="%USER_DATA%" --app="%POS_URL%"
    exit
)

if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing --user-data-dir="%USER_DATA%" --app="%POS_URL%"
    exit
)

echo [!] تعذر العثور على متصفح متوافق، جاري الفتح بالمتصفح الافتراضي...
start %POS_URL%
exit
