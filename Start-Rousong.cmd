@echo off
setlocal
cd /d "%~dp0"
if not exist "source\Rousong.cs" goto incomplete
if not exist "source\MotionData.cs" goto incomplete
if not exist "source\assets\atlas.png" goto incomplete
if not exist "source\assets\motions.png" goto incomplete
if not exist "source\assets\scratch-board.png" goto incomplete
if not exist "source\assets\scratch-smooth.png" goto incomplete
if not exist "source\assets\relax.png" goto incomplete
set "PET_FX=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319"
if not exist "%PET_FX%\csc.exe" set "PET_FX=%WINDIR%\Microsoft.NET\Framework\v4.0.30319"
if not exist "%PET_FX%\csc.exe" goto missing
rem Always compile the included sources AND all current atlases and the scratching board. Never launch a stale cached EXE.
rem Keep the previous EXE intact if compilation fails.
echo Building the adult-tabby version with stretch, butterfly, ball, scratching, yawning and rolling poses...
"%PET_FX%\csc.exe" /nologo /target:winexe /platform:anycpu /optimize+ /utf8output /out:"Rousong.next.exe" /resource:"source\assets\atlas.png",Rousong.Atlas /resource:"source\assets\motions.png",Rousong.Motions /resource:"source\assets\scratch-board.png",Rousong.ScratchBoard /resource:"source\assets\scratch-smooth.png",Rousong.ScratchSmooth /resource:"source\assets\relax.png",Rousong.Relax /r:System.dll /r:System.Core.dll /r:System.Runtime.Serialization.dll /r:System.Xaml.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll /r:"%PET_FX%\WPF\WindowsBase.dll" /r:"%PET_FX%\WPF\PresentationCore.dll" /r:"%PET_FX%\WPF\PresentationFramework.dll" "source\Rousong.cs" "source\MotionData.cs" >build.log 2>&1
if errorlevel 1 goto failed
move /y "Rousong.next.exe" "Rousong.exe" >nul 2>&1
if errorlevel 1 goto locked
if /i "%~1"=="--self-test" goto test
start "" "%~dp0Rousong.exe"
exit /b 0
:test
start "" /wait "%~dp0Rousong.exe" --self-test
if errorlevel 1 goto test_failed
echo PASS. See TestResults\PASS.txt, the activity PNGs and 64 motion snapshots.
exit /b 0
:incomplete
echo Missing source or image. Extract the whole ZIP, then try again.
goto stop
:missing
echo Windows .NET Framework 4.x is required. No system changes were made.
echo You can open Rousong-Preview.html instead.
goto stop
:failed
echo Build failed. The previous EXE was kept but was not launched.
echo Details are in build.log. You can open Rousong-Preview.html instead.
type build.log
goto stop
:locked
echo The new version was built, but Rousong.exe could not be replaced.
echo Close the old cat using its tray menu, then run this launcher again.
echo If it is already closed, extract this ZIP into a writable folder.
goto stop
:test_failed
echo Self-test failed. Read TestResults\FAIL.txt.
goto stop
:stop
if /i not "%~1"=="--self-test" pause
exit /b 1
