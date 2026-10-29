---
layout: post
title: "Windows Update cho System Admin & Helpdesk: 4 cách cập nhật và bộ lệnh kiểm tra lỗi"
seo_title: "Windows Update: 4 cách cập nhật & lệnh check lỗi"
description: "Hướng dẫn System Admin và Helpdesk cập nhật Windows bằng PSWindowsUpdate, Installation Assistant, WSUS, Intune Update Ring, kèm lệnh check OS và log lỗi."
date: 2026-10-29
author: "Tam Nguyen"
reading_time: 11
topic: windows
thumb_label: "WINDOWS UPDATE"
tags:
  - Windows Update
  - WSUS
  - Intune
  - PowerShell
card_tags:
  - Windows Update
  - Intune
summary: "4 cách cập nhật Windows cho máy công ty, khi nào dùng cách nào, và bộ lệnh check OS version, log lỗi Windows Update cho Helpdesk."
redirect_from:
  - /posts/windows-update-cho-system-admin-helpdesk.html
---

Đợt nâng cấp Windows 11 từ **24H2 lên 25H2** vừa rồi, mình phải xử lý hàng loạt laptop không chịu lên phiên bản mới. Máy có trong WSUS, group đã được approve, Intune vẫn check-in bình thường, vậy mà build vẫn đứng yên ở `26100`. Có máy fail vì pending reboot, có máy bị phần mềm EDR chặn driver của Setup, có máy chỉ đơn giản là user tắt máy giữa chừng. Bài này tổng hợp lại **tất cả các cách** mình đã dùng để đẩy Windows Update xuống máy, cùng bộ lệnh để Helpdesk tự kiểm tra trước khi escalate.

> **Tóm tắt nhanh:** Dùng **Intune Update Ring** hoặc **WSUS** làm kênh chính cho cả fleet. Với những máy bị kẹt, dùng **PSWindowsUpdate** để ép cài patch tháng, và **Windows 11 Installation Assistant** để ép nâng cấp feature update. Trước khi sửa, luôn check OS version, pending reboot và log lỗi.

## Bối cảnh: vì sao cần nhiều cách

Một môi trường doanh nghiệp thường có hai loại update:

- **Quality update** — bản vá hằng tháng, phát hành vào thứ Ba của tuần thứ hai mỗi tháng (*Patch Tuesday*).
- **Feature update** — phiên bản mới mỗi năm một lần, thường vào khoảng tháng 10 (ví dụ 24H2 → 25H2).

Kênh chính (WSUS hoặc Intune) xử lý tốt khoảng 90% máy. Phần còn lại là máy ít bật, máy hay mang ra ngoài, máy bị lỗi component store, máy bị agent bảo mật can thiệp. Những máy này cần một "kế hoạch B" chạy bằng script.

### Bảng tra build Windows 11

| Phiên bản | Build | Ghi chú |
|---|---|---|
| 24H2 | `26100.x` | Số sau dấu chấm (`UBR`) cho biết bản patch tháng |
| 25H2 | `26200.x` | 25H2 dùng chung codebase với 24H2, nên số UBR thường giống nhau |

## So sánh 4 cách cập nhật Windows

| Cách | Phù hợp khi | Ưu điểm | Hạn chế |
|---|---|---|---|
| **1. PSWindowsUpdate** | Ép cài patch tháng, driver, firmware trên máy bị tụt patch | Kiểm soát chi tiết từng KB, chạy được qua Intune | Không xử lý pending reboot, script Intune có timeout |
| **2. Installation Assistant** | Ép nâng cấp feature update (24H2 → 25H2) | Full in-place upgrade, dựng lại component store | Chạy lâu (vài giờ), dễ bị agent bảo mật chặn |
| **3. WSUS** | Môi trường on-prem, cần duyệt từng bản update | Tiết kiệm băng thông, kiểm soát approval | Phải bảo trì server, SUSDB dễ phình |
| **4. Intune Update Ring** | Máy hybrid/cloud, user làm việc từ xa | Không cần hạ tầng, có deadline và report | Cần license phù hợp, phải tính deferral hợp lý |

Ngoài ra, Helpdesk vẫn có thể bấm **Settings → Windows Update → Check for updates** trên máy user. Đây là cách nhanh nhất cho một máy lẻ, nhưng không dùng được để xử lý hàng loạt.

## Cách 1: Dùng module PSWindowsUpdate

PSWindowsUpdate là module PowerShell cho phép scan, tải và cài update bằng lệnh. Mình dùng nó trong một Intune Win32 app để xử lý các máy bị tụt patch nhiều tháng.

### Cài module (chạy bằng quyền Admin)

```powershell
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
Install-PackageProvider -Name NuGet -MinimumVersion 2.8.5.201 -Force
Set-PSRepository -Name PSGallery -InstallationPolicy Trusted
Install-Module PSWindowsUpdate -Scope AllUsers -Force -AllowClobber
Import-Module PSWindowsUpdate
```

### Các lệnh hay dùng

```powershell
# Scan update từ nguồn mặc định (WSUS nếu máy đang trỏ WSUS)
Get-WindowsUpdate

# Scan từ Microsoft Update (có driver, firmware, Office...)
Get-WindowsUpdate -MicrosoftUpdate

# Cài tất cả, không tự reboot
Get-WindowsUpdate -AcceptAll -Install -IgnoreReboot -Verbose

# Cài driver/firmware nhưng bỏ qua Feature Upgrade và Hotpatch
Get-WindowsUpdate -MicrosoftUpdate -AcceptAll -Install -IgnoreReboot -NotCategory "Upgrades" -NotTitle 'Security Update \(Hotpatch capable\)' -Verbose

# Cài đúng một KB
Get-WindowsUpdate -KBArticleID "KB5xxxxxx" -Install -AcceptAll -IgnoreReboot -Verbose

# Lịch sử update và trạng thái reboot
Get-WUHistory -Last 50
Get-WURebootStatus -Silent
```

<div class="callout warn">
  <span>⚠️</span>
  <div><b>Lưu ý</b><code>-IgnoreReboot</code> chỉ có nghĩa là <b>không tự restart</b> sau khi cài. Nó không bỏ qua trạng thái pending reboot. Nếu máy đang chờ reboot, bản update tiếp theo sẽ fail với lỗi <code>0x80240016</code>.</div>
</div>

### Script của mình

<!-- ===== DÁN SCRIPT PSWINDOWSUPDATE CỦA BẠN VÀO ĐÂY ===== -->

```powershell
# ==========================================================
# Windows Update Remediation (PSWindowsUpdate)
# Deploy via Intune Win32 app - SYSTEM context, 64-bit
# ==========================================================

# >>> Dán script vào đây <<<
```

Khi viết script loại này, nhớ ba điểm:

1. **Kiểm tra kết quả từng update.** `-ErrorAction Stop` không bắt được trường hợp cmdlet chạy xong nhưng một update trả về `Result = Failed`. Hãy lưu output lại và đếm số dòng `Failed`.
2. **Dừng khi có pending reboot.** Sau phase cài driver/.NET, nếu máy cần reboot thì `exit 3010` để Intune xử lý reboot, đừng chạy tiếp phase cài cumulative update.
3. **Intune PowerShell script (Platform script) có timeout 30 phút.** Tải và cài update dễ vượt quá thời gian này, nên đóng gói thành **Win32 app** thay vì Platform script.

## Cách 2: Dùng Windows 11 Installation Assistant

Khi feature update qua WSUS/Intune không chạy, mình dùng **Windows 11 Installation Assistant** để ép in-place upgrade. Assistant tải toàn bộ media và chạy Windows Setup, nên nó cũng là cách "chữa cháy" cho máy bị lỗi component store.

### Chạy thủ công

```powershell
# Chạy im lặng, tự chấp nhận EULA, copy log ra thư mục riêng
Start-Process "C:\Temp\Windows11InstallationAssistant.exe" -ArgumentList '/QuietInstall /SkipEULA /CopyLogs "C:\Temp\AssistantLogs"'
```

### Thiết kế để chạy tự động

Upgrade cần **khoảng 6 tiếng máy bật liên tục và có mạng**. Nếu user tắt máy giữa chừng, upgrade dừng lại. Vì vậy mình không chạy Assistant trực tiếp từ Intune, mà làm như sau:

1. Intune Win32 app copy `Windows11InstallationAssistant.exe` và script chạy vào máy, rồi tạo một **Scheduled Task** chạy bằng SYSTEM.
2. Task chạy **mỗi khi máy khởi động và lặp lại mỗi 1-2 tiếng**.
3. Mỗi lần chạy, script kiểm tra:
   - Build ≥ `26200` → đã lên 25H2, tự xóa task và dừng.
   - Process `Windows10UpgraderApp`, `SetupHost` hoặc `setupprep` đang chạy → bỏ qua, không chạy chồng.
   - Còn lại → chạy Assistant.

| Process | Xuất hiện khi |
|---|---|
| `Windows10UpgraderApp` | Assistant đang kiểm tra, tải và chuẩn bị |
| `setupprep` / `SetupHost` | Windows Setup đang cài ngầm, trước khi máy restart |

### Script của mình

<!-- ===== DÁN SCRIPT TẠO SCHEDULED TASK VÀO ĐÂY ===== -->

```powershell
# TaskScheduler_Upgrade_Win11.ps1
# Intune Win32 app - Install command (Install behavior: System)
# Copy payload + register Scheduled Task (At startup + repeat)

# >>> Dán script vào đây <<<
```

<!-- ===== DÁN SCRIPT CHẠY ASSISTANT VÀO ĐÂY ===== -->

```powershell
# Upgrade_Windows_11_Assistant.ps1
# Run by Scheduled Task as SYSTEM
# Build >= 26200 -> remove task | Setup running -> skip | Else -> launch Assistant

# >>> Dán script vào đây <<<
```

<!-- ===== DÁN DETECTION SCRIPT CHO INTUNE VÀO ĐÂY ===== -->

```powershell
# Detection script cho Intune Win32 app

# >>> Dán script vào đây <<<
```

### Theo dõi tiến độ Setup

```powershell
# Process liên quan đến upgrade
Get-Process Windows10UpgraderApp, SetupHost, setupprep -ErrorAction SilentlyContinue | Select-Object Name, Id, StartTime

# Phần trăm tiến độ (chỉ có khi SetupHost đang chạy)
Get-ItemProperty 'HKLM:\SYSTEM\Setup\MoSetup\Volatile' -ErrorAction SilentlyContinue | Select-Object SetupProgress, SetupPhase

# Trạng thái Scheduled Task
Get-ScheduledTask -TaskName "Upgrade_Windows_25H2" | Get-ScheduledTaskInfo | Format-List TaskName, LastRunTime, LastTaskResult, NextRunTime
```

<div class="callout">
  <span>💡</span>
  <div><b>Tip</b>Nếu máy ít được bật, hãy gửi email cho user: sao lưu dữ liệu lên OneDrive, cắm sạc, giữ máy bật và có mạng liên tục ít nhất 6 tiếng trong một ngày bất kỳ, rồi restart khi hệ thống yêu cầu.</div>
</div>

## Cách 3: Dùng WSUS

WSUS phù hợp khi bạn muốn duyệt từng bản update trước khi cho máy cài. Máy client được trỏ về WSUS bằng GPO.

### Cấu hình GPO mình đang dùng

| Setting | Giá trị | Ý nghĩa |
|---|---|---|
| Configure Automatic Updates | Mode 4 | Tự tải từ WSUS và cài theo lịch |
| Scheduled install day / time | Every day / 12:00 | Cài lúc 12h trưa mỗi ngày |
| Install updates for other Microsoft products | Enabled | Cập nhật cả Office và sản phẩm Microsoft khác |
| Deadline for quality / feature updates | 3 ngày, grace 2 ngày | User có 3 ngày, sau đó thêm 2 ngày grace rồi bắt buộc restart |
| Restart reminder | Mỗi 2 giờ, cảnh báo trước 30 phút | Nhắc user restart trước khi bị ép |

### Kiểm tra máy client đang trỏ WSUS nào

```powershell
# WSUS server và reporting server
Get-ItemProperty 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate' -ErrorAction SilentlyContinue | Select-Object WUServer, WUStatusServer, TargetReleaseVersion, TargetReleaseVersionInfo

# UseWUServer = 1 nghĩa là máy đang dùng WSUS
Get-ItemProperty 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU' -ErrorAction SilentlyContinue | Select-Object UseWUServer, AUOptions, NoAutoUpdate

# Test kết nối tới WSUS (đổi tên server và port cho đúng: 8530 HTTP / 8531 HTTPS)
Test-NetConnection wsus.contoso.local -Port 8531

# Áp lại GPO
gpupdate /force
```

Nếu `TargetReleaseVersionInfo` đang khóa ở `24H2`, máy sẽ **không bao giờ** thấy bản 25H2. Ngoài ra, khi máy đã lên phiên bản mới, nhớ **sync và approve product của phiên bản đó** (ví dụ *Windows 11, version 25H2*) trên WSUS, nếu không máy sẽ scan ra "found 0 updates" và thiếu patch.

## Cách 4: Dùng Intune Windows Update Ring

Với máy quản lý bằng Intune, mình chia thành ba policy:

- **Feature update policy** — chỉ định phiên bản đích, ví dụ *Windows 11, version 25H2*. Đây là lớp chặn chính để máy không tự nhảy lên phiên bản cao hơn mong muốn.
- **Quality update policy** — có thể *expedite* bản vá bảo mật nếu máy đang thấp hơn một mốc patch nhất định.
- **Update Ring** — điều khiển deferral, deadline, giờ hoạt động và hành vi restart.

### Cấu hình Update Ring tham khảo

| Setting | Giá trị |
|---|---|
| Microsoft product updates | Allow |
| Windows drivers | Allow |
| Quality / Feature update deferral (days) | 1 (chỉnh theo kế hoạch rollout) |
| Feature update uninstall period | 2 ngày |
| Servicing channel | General Availability channel |
| Automatic update behavior | Auto install at maintenance time |
| Active hours | 16:00 – 10:00 (chỉnh theo kế hoạch) |
| Option to pause Windows updates | Disable |
| Use deadline settings | Allow — Feature: 1, Quality: 1, Grace period: 1 |
| Auto reboot before deadline | No |

Nên rollout theo vòng: **Pilot (IT) → nhóm nhỏ người dùng → toàn công ty**, mỗi vòng cách nhau vài ngày để kịp phát hiện lỗi.

## Bộ lệnh kiểm tra OS và log lỗi

Đây là phần Helpdesk nên chạy **trước khi** escalate ticket. Mở PowerShell bằng **Run as Administrator**.

### 1. Check OS hiện tại

```powershell
reg query "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion" /v DisplayVersion
```

```powershell
wmic os get Caption,Version,BuildNumber
```

```powershell
# Thay thế cho wmic (wmic đang bị Microsoft loại bỏ dần trên Windows 11)
Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion' | Select-Object ProductName, DisplayVersion, CurrentBuild, UBR
```

`ProductName` có thể vẫn ghi "Windows 10" trên máy Windows 11. Đừng dựa vào trường này, hãy xem `CurrentBuild`.

### 2. Check trạng thái Feature Update

```powershell
# Gộp log Windows Update (ETW) thành file đọc được, mặc định ra Desktop
Get-WindowsUpdateLog -LogPath C:\Temp\WindowsUpdate.log
```

```powershell
Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\WindowsUpdate\UpdatePolicy\PolicyState"
```

```powershell
Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\WindowsUpdate\UX\Settings"
```

```powershell
# Pending reboot? (True = máy đang chờ restart)
Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending'
Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired'
```

```powershell
# Dung lượng trống ổ C
Get-PSDrive C | Select-Object @{N='FreeGB';E={[math]::Round($_.Free/1GB,1)}}
```

### 3. Check Windows Update errors

```powershell
Get-WinEvent -LogName Microsoft-Windows-WindowsUpdateClient/Operational -MaxEvents 50 | Select-Object TimeCreated, Id, LevelDisplayName, Message | Format-List *
```

```powershell
# Lọc lỗi trong WindowsUpdate.log đã gộp ở bước 2
Select-String -Path C:\Temp\WindowsUpdate.log -Pattern 'FAILED|0x8024|0x8007' | Select-Object -Last 100
```

```powershell
# Lịch sử update kèm mã lỗi dạng hex (cần PSWindowsUpdate)
Get-WUHistory -Last 100 | Where-Object Result -eq 'Failed' | Select-Object Date, Title, KB, @{N='HResult';E={'0x{0:X8}' -f ($_.HResult -band 0xFFFFFFFF)}}
```

### 4. Check lỗi Feature Upgrade (Setup)

```powershell
# Log lỗi của Windows Setup - dùng nháy đơn để PowerShell không hiểu $WINDOWS là biến
Get-Content 'C:\$WINDOWS.~BT\Sources\Panther\setuperr.log' -Tail 50
```

```powershell
# Kết luận của SetupDiag sau lần upgrade fail
Get-ItemProperty 'HKLM:\SYSTEM\Setup\SetupDiag\Results' -ErrorAction SilentlyContinue | Format-List FailureData, FailureDetails, LastSetupOperation, LastSetupPhase
```

```powershell
# Log của Installation Assistant
Get-Content 'C:\Windows\Logs\MoSetup\BlueBox.log' -Tail 100
```

```powershell
# Có bị rollback không?
Get-Content 'C:\$WINDOWS.~BT\Sources\Rollback\setuperr.log' -Tail 40 -ErrorAction SilentlyContinue
```

### 5. Check component store (khi patch tháng fail lặp lại)

```powershell
Select-String -Path C:\Windows\Logs\CBS\CBS.log -Pattern ', Error\s' | Select-Object -Last 60
```

```powershell
DISM /Online /Cleanup-Image /ScanHealth
DISM /Online /Cleanup-Image /RestoreHealth
sfc /scannow
```

### 6. Reset Windows Update cache (bước cuối, khi các cách trên không hiệu quả)

```cmd
net stop wuauserv
del /f /s /q %windir%\SoftwareDistribution\*
net start wuauserv
```

<div class="callout danger">
  <span>⛔</span>
  <div><b>Nguy hiểm</b>Không xóa registry <code>RebootPending</code> hay <code>PendingFileRenameOperations</code> để "lừa" Windows Update. Làm vậy chỉ che trạng thái chờ reboot, không hoàn tất thao tác servicing bên dưới và có thể làm hỏng component store.</div>
</div>

## Những lỗi mình đã gặp

| Mã lỗi | Triệu chứng | Nguyên nhân gốc | Cách xử lý |
|---|---|---|---|
| `0x80240016` | Cumulative update fail lặp lại | Máy đang pending reboot từ update trước | Reboot rồi cài lại; script phải dừng và trả `3010` khi có pending reboot |
| `0x80070005` + `0x50010` | Upgrade dừng ở bước *Start Monitoring Driver*, phase Downlevel | Agent EDR bật Anti-Tamper chặn Setup tạo service driver `WinSetupMon` | Thêm exclusion/interop cho `C:\$WINDOWS.~BT\Sources\SetupHost.exe` hoặc chuyển máy sang group tắt Anti-Tamper trong lúc upgrade |
| `0x800736B3` / `0x800f0905` | Patch tháng fail mãi, DISM RestoreHealth cũng không sửa được | Component store có package bị kẹt ở trạng thái *Resolved* | In-place upgrade bằng Installation Assistant để dựng lại component store |
| `0xC1800104` → `0x800705BB` | Setup dừng giữa chừng | Setup bị ngắt: user tắt máy, hoặc script chạy chồng lên nhau | Scheduled Task chạy lại khi khởi động, kiểm tra process trước khi chạy Assistant |
| `0xC190020E` | Setup thoát sau khoảng 1 tiếng | Thường là thiếu dung lượng, nhưng cũng có thể che lỗi khác | Kiểm tra ổ C và phân vùng Recovery; nếu đủ thì đọc thêm Panther log |
| Upgrade rollback sau reboot | Setup đạt 100% nhưng sau reboot vẫn là 24H2 | Lần reboot không đi vào Setup, ví dụ một update khác cũng đang chờ reboot | Không để update khác chen vào trong lúc Setup chờ reboot; chạy lại |

Thêm vài "bẫy" nhỏ nhưng mất nhiều thời gian:

- **`$WINDOWS` bị PowerShell hiểu là biến.** Dùng nháy đơn `'C:\$WINDOWS.~BT\...'` hoặc escape bằng backtick.
- **Script báo thành công nhưng update vẫn Failed.** Phải kiểm tra cột `Result` của từng update.
- **PSWindowsUpdate báo "Installed" nhưng build không đổi.** Update mới chỉ được *stage*, cần reboot (đôi khi hai lần) mới commit.
- **Copy file exe bị lỗi "being used by another process".** Assistant cũ vẫn đang chạy. Đừng kill process, chỉ copy khi file khác hash và cho script đi tiếp.
- **`LastTaskResult = 267014`** không phải lỗi, chỉ có nghĩa là task bị dừng vì máy reboot.

## Kết luận

Không có một cách Windows Update nào xử lý được 100% máy. Hãy dùng **Intune Update Ring hoặc WSUS** làm kênh chính, giữ **PSWindowsUpdate** và **Installation Assistant** làm công cụ chữa cháy cho các máy kẹt. Quan trọng nhất là đọc đúng log trước khi sửa: check build, check pending reboot, rồi mới đọc `setuperr.log` hoặc event log. Bước tiếp theo bạn nên làm là lưu bộ lệnh ở trên vào tài liệu nội bộ của team Helpdesk.

Còn bạn, máy trong công ty bạn hay fail Windows Update vì lỗi nào nhất?

<!--
Phần cuối bài (nút Chia sẻ LinkedIn, Facebook, Copy link, khung tác giả, bài trước/sau)
và Mục lục bên phải được layout tự thêm vào, không cần viết trong file này.
Xem trước trên máy: bundle exec jekyll serve --unpublished (chỉ cần khi bài còn published: false).
-->
