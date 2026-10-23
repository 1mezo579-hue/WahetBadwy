@echo off
chcp 65001 >nul
title تشغيل كاشير مشويات اولاد بسيوني - طبع تلقائي ومباشر بدون نوافذ
color 0E

echo ======================================================================
echo          سيرفر كاشير مشويات اولاد بسيوني - MASHWEYAT AWLAD BASIONY POS CLOUD
echo      تشغيل وضع الطباعة التلقائية المباشرة بدون شاشات تأكيد نهائياً
echo ======================================================================
echo.
echo [1/2] فحص متصفحات الإنترنت المتوافقة (Google Chrome أو Microsoft Edge)...
echo [2/2] تجهيز وضع الطباعة الصامتة (--kiosk-printing) للطباعة المباشرة على Xprinter...
echo.

set POS_URL=https://wahetbadwy.vercel.app/pos
set USER_DATA=%LOCALAPPDATA%\MashweyatAwladBasionyPOS

:: 1. الأولوية للتشغيل عبر Microsoft Edge (موجود في كل أجهزة ويندوز 10 و 11)
start msedge.exe --kiosk-printing --user-data-dir="%USER_DATA%" --app="%POS_URL%"
if %ERRORLEVEL% EQU 0 (
    echo [✔] تم تشغيل شاشة الكاشير بنجاح عبر Microsoft Edge مع الطباعة الأوتوماتيكية المباشرة على Xprinter!
    exit
)

:: 2. المحاولة الثانية عبر Google Chrome عند عدم توفر الإيدج
start chrome.exe --kiosk-printing --user-data-dir="%USER_DATA%" --app="%POS_URL%"
if %ERRORLEVEL% EQU 0 (
    echo [✔] تم تشغيل شاشة الكاشير بنجاح عبر Google Chrome مع الطباعة الأوتوماتيكية المباشرة على Xprinter!
    exit
)

:: 3. في حالة عدم التعرف على مسار المتصفح الافتراضي يتم استهدافه بالمسارات القياسية
if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --kiosk-printing --user-data-dir="%USER_DATA%" --app="%POS_URL%"
    exit
)

if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing --user-data-dir="%USER_DATA%" --app="%POS_URL%"
    exit
)

echo [!] تعذر العثور على المسار التلقائي، جاري تشغيل الرابط بالمتصفح الافتراضي...
start %POS_URL%
exit