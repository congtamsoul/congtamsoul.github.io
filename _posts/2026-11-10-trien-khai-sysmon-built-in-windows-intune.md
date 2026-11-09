---
layout: post
title: "Triển khai Sysmon built-in cho toàn bộ Windows bằng Intune"
seo_title: "Deploy Sysmon built-in Windows 11 bằng Intune"
description: "Cách migrate Sysmon standalone sang Sysmon built-in của Windows 11, đóng gói .intunewin kèm Sysmon_Config.xml và deploy cho toàn bộ Windows devices bằng Intune."
date: 2026-11-10
author: "Tam Nguyen"
reading_time: 9
topic: security
thumb_label: "SYSMON BUILT-IN"
image: /images/photo/32.jpg
tags:
  - Windows
  - Intune
  - Sysmon
  - Security
  - PowerShell
card_tags:
  - Sysmon
  - Intune
summary: "Migrate Sysmon standalone sang Sysmon built-in của Windows 11 và deploy cho toàn bộ Windows devices bằng một Win32 app trên Intune."
redirect_from:
  - /posts/deploy-sysmon-built-in-windows-intune.html
---

**Sysmon (System Monitor)** là tiện ích giám sát hệ thống, ghi lại hoạt động chi tiết của Windows vào Event Log. Sysmon giúp Admin theo dõi tiến trình, kết nối mạng, thay đổi tệp và các sự kiện khác để phục vụ điều tra. Trước đây, mình phải tự đóng gói bản Sysinternals và tạo scheduled task để cập nhật binary trên từng máy. Microsoft đã đưa **Sysmon built-in** vào Windows như một optional feature, giúp đơn giản hóa việc cập nhật; tuy nhiên, migrate số lượng lớn thiết bị vẫn cần làm theo từng bước và có kiểm soát.

**Tóm tắt nhanh:** đóng gói script migration cùng `Sysmon_Config.xml` thành `.intunewin`, tạo Win32 app trên Intune với detection rule kiểm tra feature `Sysmon` đã bật và có `sysmon.exe` trong `System32`, rồi triển khai theo nhóm pilot trước khi mở rộng. Script sẽ gỡ bản standalone, xóa scheduled task cũ, bật feature, apply config và khởi động service.

## Bối cảnh: từ Sysmon standalone sang built-in

Theo [Microsoft Learn – Sysmon](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/sysmon), Sysmon có sẵn dưới dạng **optional feature built-in cho Windows 11 từ tháng 2/2026**; tài liệu cũng đề cập Windows Server 2025. Một số điểm cần lưu ý:

- **Mặc định bị tắt** — phải bật feature, sau đó chạy `sysmon -i` để bắt đầu ghi log ([Microsoft Learn: How to enable Sysmon](https://learn.microsoft.com/en-us/windows/security/operating-system-security/sysmon/how-to-enable-sysmon)).
- **Không chạy song song với bản standalone** — cần gỡ bản Sysmon Sysinternals trước khi bật bản built-in.
- **Được cập nhật qua Windows Update** — không còn phải tự đóng gói binary mới ([4sysops](https://4sysops.com/archives/enable-built-in-sysmon-in-windows-11-with-powershell/)).
- Sysmon **chỉ ghi nhận**, không phân tích, cảnh báo hay chặn. Để phát hiện sự cố, cần chuyển log đến SIEM hoặc Windows Event Collection.

| Tiêu chí | Sysmon standalone | Sysmon built-in |
|---|---|---|
| Cài đặt | Tải binary Sysinternals, tự đóng gói | Bật Windows optional feature |
| Cập nhật | Tự làm (scheduled task, app mới) | Qua Windows Update |
| Binary | Tùy vị trí, ví dụ `C:\Windows\Sysmon64.exe` | `C:\Windows\System32\sysmon.exe` |
| Config XML | Dùng file cấu hình Sysmon | Dùng file cấu hình Sysmon |
| Event log | Applications and Services Logs → Microsoft → Windows → Sysmon → Operational | Applications and Services Logs → Microsoft → Windows → Sysmon → Operational |

## Chuẩn bị gói cài đặt

Tạo thư mục nguồn, ví dụ `C:\IntunePkg\Sysmon_BuiltIn\`, gồm hai file:

```text
Sysmon_BuiltIn\
├── Install_Sysmon_BuiltIn.ps1
└── Sysmon_Config.xml
```

Script đọc file cấu hình bằng `$PSScriptRoot`, vì vậy **`Sysmon_Config.xml` phải nằm cùng thư mục** với script trong gói `.intunewin`.

### Script làm gì

1. Dọn tiến trình uninstall bị treo: tìm và dừng `Sysmon64.exe` đang chạy với tham số `-u`.
2. Gỡ Sysmon standalone: tìm service Sysmon không trỏ đến `System32\sysmon.exe`, chạy `-u force` với timeout 60 giây, sau đó dọn service và binary còn sót.
3. Xóa scheduled task cũ tên `Install_Sysmon_Update`.
4. Bật feature `Sysmon` bằng `Enable-WindowsOptionalFeature -NoRestart`; thoát với mã lỗi nếu máy không hỗ trợ.
5. Kiểm tra binary `C:\Windows\System32\sysmon.exe`.
6. Apply config bằng `sysmon.exe -accepteula -i Sysmon_Config.xml`.
7. Khởi động service và in kết quả kiểm tra cuối cùng.

Log được ghi tại `C:\ProgramData\Microsoft\IntuneManagementExtension\Logs\Sysmon_Built_In_Install_<timestamp>.log`. Có thể thu thập cùng log IME khi chạy **Collect diagnostics** trên Intune.

## Đóng gói file .intunewin

Dùng [Microsoft Win32 Content Prep Tool](https://github.com/microsoft/Microsoft-Win32-Content-Prep-Tool):

```powershell
IntuneWinAppUtil.exe -c "C:\IntunePkg\Sysmon_BuiltIn" -s "Install_Sysmon_BuiltIn.ps1" -o "C:\IntunePkg\Output"
```

Kết quả là `Install_Sysmon_BuiltIn.intunewin`.

## Tạo Win32 app trên Intune

Vào **Intune admin center → Apps → Windows → Add → Windows app (Win32)**, rồi upload file `.intunewin`.

### Program

| Mục | Giá trị |
|---|---|
| Install command | `%SystemRoot%\sysnative\WindowsPowerShell\v1.0\powershell.exe -ExecutionPolicy Bypass -NoProfile -File .\Install_Sysmon_BuiltIn.ps1` |
| Uninstall command | `cmd.exe /c C:\Windows\System32\sysmon.exe -u` |
| Install behavior | System |
| Device restart behavior | No specific action |
| Return codes | 0 = Success, 1 = Failed |

> **Lưu ý:** dùng `sysnative` để chạy PowerShell 64-bit. Nếu chạy 32-bit, các lệnh như `Get-WindowsOptionalFeature` và đường dẫn `System32` có thể bị chuyển hướng sang `SysWOW64`, khiến script không tìm thấy `sysmon.exe`.

### Requirements

- **Operating system architecture:** x64 (thêm ARM64 nếu môi trường có thiết bị tương ứng).
- **Minimum OS:** Windows 11 có bản cập nhật chứa Sysmon built-in. Theo [Techdows](https://techdows.com/how-to-enable-built-in-sysmon-in-windows-11.html), feature xuất hiện từ build **26100.7918 / 26200.7918**. Hãy xác minh build và điều kiện hỗ trợ với tài liệu Microsoft hiện hành trước khi đặt requirement.

### Detection rule

Chọn **Use a custom detection script**, upload detection script ở cuối bài và đặt **Run script as 32-bit process on 64-bit clients = No**. Script chỉ đánh dấu app đã cài khi feature `Sysmon` có trạng thái `Enabled` và `sysmon.exe` tồn tại trong `System32`.

### Assignment

Triển khai theo quy trình pilot: assign **Required** cho một cloud group nhỏ trước, theo dõi log và trạng thái, sau đó mới mở rộng sang **All Devices** (có thể dùng filter để giới hạn Windows).

## Kiểm tra sau khi triển khai

Trên máy client, kiểm tra service, trạng thái feature, config và event log:

```powershell
Get-Service Sysmon
(Get-WindowsOptionalFeature -Online -FeatureName Sysmon).State
sysmon -c
Get-WinEvent -LogName "Microsoft-Windows-Sysmon/Operational" -MaxEvents 5
```

Trong Event Viewer, mở **Applications and Services Logs → Microsoft → Windows → Sysmon → Operational**. Để cập nhật config trên máy đã cài, dùng `sysmon -c <config.xml>` thay vì chạy lại `sysmon -i`.

## Những lỗi mình đã gặp

- **`Sysmon feature not available` (exit 1)** — máy chưa có bản cập nhật Windows chứa Sysmon built-in. Cập nhật Windows trước hoặc loại máy này khỏi assignment bằng requirement rule.
- **Bản standalone không gỡ được, uninstall treo** — script có bước dừng tiến trình `-u` và timeout 60 giây, sau đó thử xóa service bằng `sc.exe delete`. Kiểm tra log để xác nhận service đã được gỡ.
- **Built-in không bật vì còn service standalone** — kiểm tra `Get-Service sysmon*`; nếu còn service không dùng binary `System32\sysmon.exe`, xem lại bước gỡ trong log.
- **Detection báo thành công nhưng không có event** — detection hiện chỉ kiểm tra feature và binary, chưa xác minh service `Sysmon` đã được cài và đang chạy. Có thể mở rộng detection để kiểm tra trạng thái service.
- **Cài lại báo lỗi khi Sysmon đã được cài** — `sysmon -i` dùng cho lần cài đầu; với máy đã cài, dùng `sysmon -c` để cập nhật config.

## Kết luận

Sysmon built-in giảm công sức đóng gói và cập nhật binary Sysinternals. Một Win32 app trên Intune có thể giúp gỡ bản standalone, bật feature built-in và áp dụng config chuẩn của tổ chức. Hãy bắt đầu ở nhóm pilot, kiểm tra service và event log rồi mới mở rộng triển khai. Bước tiếp theo là chuyển log `Sysmon/Operational` về SIEM để khai thác dữ liệu.

Bạn đã chuyển sang Sysmon built-in chưa, và đang dùng config nào làm baseline? Chia sẻ ở phần bình luận nhé.

## Full script

### Install_Sysmon_BuiltIn.ps1

```powershell
# ---------- LOG SETUP ----------
$TimeStamp = (Get-Date).ToString("yyyy-MM-dd_HH-mm-ss")
$LogFile = "C:\ProgramData\Microsoft\IntuneManagementExtension\Logs\Sysmon_Built_In_Install_$TimeStamp.log"

Start-Transcript -Path $LogFile -Force

# ================================
# Sysmon Migration Script
# Standalone -> Built-in
# ================================

$ErrorActionPreference = "Continue"

Write-Output "====================================="
Write-Output "SYSMON MIGRATION START"
Write-Output "====================================="

# ================================
# 0. Cleanup Hung Uninstall Process
# ================================

Write-Output ""
Write-Output "Checking for hung Sysmon uninstall processes..."

Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
Where-Object {
    $_.Name -eq "Sysmon64.exe" -and
    $_.CommandLine -match "-u"
} |
ForEach-Object {
    Write-Output "Killing hung process PID $($_.ProcessId)"
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}

# ================================
# 1. Detect Legacy Sysmon
# ================================

Write-Output ""
Write-Output "Checking for legacy Sysmon installation..."

$LegacyServices = Get-CimInstance Win32_Service -ErrorAction SilentlyContinue |
    Where-Object {
        $_.Name -match "^Sysmon" -and
        $_.PathName -notmatch "\\System32\\sysmon\.exe"
    }

if ($LegacyServices) {
    foreach ($Svc in $LegacyServices) {
        Write-Output ""
        Write-Output "Legacy service detected"
        Write-Output "Service Name : $($Svc.Name)"
        Write-Output "Path Name    : $($Svc.PathName)"

        $ServiceName = $Svc.Name
        $ExePath = ($Svc.PathName -replace '"','').Split(" ")[0]

        Write-Output "Executable   : $ExePath"

        if (Test-Path $ExePath) {
            Write-Output "Running uninstall command..."

            try {
                $Proc = Start-Process `
                    -FilePath $ExePath `
                    -ArgumentList "-u force" `
                    -PassThru `
                    -WindowStyle Hidden

                if (-not $Proc.WaitForExit(60000)) {
                    Write-Output "WARNING: Uninstall timeout after 60 seconds"
                    Stop-Process -Id $Proc.Id -Force -ErrorAction SilentlyContinue
                }
                else {
                    Write-Output "Uninstall ExitCode: $($Proc.ExitCode)"
                }

                Start-Sleep -Seconds 10
            }
            catch {
                Write-Output "Binary uninstall failed."
                Write-Output $_.Exception.Message
            }
        }
        else {
            Write-Output "Legacy binary not found."
        }

        # Delete service if it remains after uninstall.
        if (Get-Service $ServiceName -ErrorAction SilentlyContinue) {
            Write-Output "Deleting leftover service..."
            sc.exe delete $ServiceName | Out-Null
            Start-Sleep 5
        }

        # Wait for service removal.
        $Timeout = 60

        while ($Timeout -gt 0) {
            if (-not (Get-Service $ServiceName -ErrorAction SilentlyContinue)) {
                break
            }

            Write-Output "Waiting for service removal..."
            Start-Sleep 2
            $Timeout -= 2
        }

        if (Get-Service $ServiceName -ErrorAction SilentlyContinue) {
            Write-Output "WARNING: $ServiceName still exists"
        }
        else {
            Write-Output "$ServiceName removed successfully"
        }

        # Remove Sysmon64.exe if it remains.
        if (Test-Path $ExePath) {
            try {
                Write-Output "Removing leftover binary..."
                Remove-Item $ExePath -Force -ErrorAction SilentlyContinue

                if (-not (Test-Path $ExePath)) {
                    Write-Output "Legacy binary removed"
                }
                else {
                    Write-Output "WARNING: Legacy binary still exists"
                }
            }
            catch {
                Write-Output $_.Exception.Message
            }
        }
    }
}
else {
    Write-Output "No legacy Sysmon installation found"
}

# ================================
# 2. Remove Scheduled Task
# ================================

Write-Output ""
Write-Output "Checking scheduled task Install_Sysmon_Update..."

if (Get-ScheduledTask -TaskName "Install_Sysmon_Update" -ErrorAction SilentlyContinue) {
    Write-Output "Scheduled task found, removing..."

    Unregister-ScheduledTask `
        -TaskName "Install_Sysmon_Update" `
        -Confirm:$false
}
else {
    Write-Output "Scheduled task not found"
}

# ================================
# 3. Enable Built-In Sysmon
# ================================

Write-Output ""
Write-Output "Checking Windows Sysmon feature..."

$Feature = Get-WindowsOptionalFeature `
    -Online `
    -FeatureName Sysmon `
    -ErrorAction SilentlyContinue

if (-not $Feature) {
    Write-Output "ERROR: Sysmon feature not available"
    Stop-Transcript
    exit 1
}

Write-Output "Current State: $($Feature.State)"

if ($Feature.State -ne "Enabled") {
    Write-Output "Enabling Sysmon feature..."

    Enable-WindowsOptionalFeature `
        -Online `
        -FeatureName Sysmon `
        -NoRestart `
        -All

    Start-Sleep 20
}

# Verify feature.
$Feature = Get-WindowsOptionalFeature `
    -Online `
    -FeatureName Sysmon

Write-Output "Feature State After Enable: $($Feature.State)"

if ($Feature.State -ne "Enabled") {
    Write-Output "ERROR: Failed to enable Sysmon feature"
    Stop-Transcript
    exit 1
}

# ================================
# 4. Verify Built-In Binary
# ================================

Write-Output ""
Write-Output "Checking Built-In Sysmon binary..."

$BuiltInSysmon = "$env:windir\System32\sysmon.exe"

if (-not (Test-Path $BuiltInSysmon)) {
    Write-Output "ERROR: sysmon.exe not found"
    Stop-Transcript
    exit 1
}

Write-Output "Built-In Sysmon found:"
Write-Output $BuiltInSysmon

# ================================
# 5. Apply Sysmon Config
# ================================

$configPath = Join-Path $PSScriptRoot "Sysmon_Config.xml"

Write-Output ""
Write-Output "Checking config file..."

if (Test-Path $configPath) {
    Write-Output "Applying Sysmon configuration..."
    Write-Output "Config Path: $configPath"

    & $BuiltInSysmon `
        -accepteula `
        -i $configPath

    Write-Output "Sysmon configuration applied"
}
else {
    Write-Output "WARNING: Sysmon_Config.xml not found"
}

# ================================
# 6. Start Sysmon Service
# ================================

Write-Output ""
Write-Output "Starting Sysmon service..."

try {
    Start-Service Sysmon -ErrorAction SilentlyContinue
    Start-Sleep 5
}
catch {
    Write-Output $_.Exception.Message
}

# ================================
# 7. Final Validation
# ================================

Write-Output ""
Write-Output "====================================="
Write-Output "FINAL VALIDATION"
Write-Output "====================================="

Write-Output ""
Write-Output "Built-In Sysmon Service:"

Get-Service Sysmon -ErrorAction SilentlyContinue |
    Format-Table Status,Name,DisplayName -AutoSize

Write-Output ""
Write-Output "Feature State:"

(Get-WindowsOptionalFeature `
    -Online `
    -FeatureName Sysmon).State

Write-Output ""
Write-Output "Binary:"

Test-Path "$env:windir\System32\sysmon.exe"

Write-Output ""
Write-Output "SYSMON MIGRATION COMPLETED"

Stop-Transcript

exit 0
```

### Detection script

```powershell
$Feature = Get-WindowsOptionalFeature `
    -Online `
    -FeatureName Sysmon `
    -ErrorAction SilentlyContinue

if (
    $Feature -and
    $Feature.State -eq "Enabled" -and
    (Test-Path "$env:windir\System32\sysmon.exe")
)
{
    Write-Output "Installed"
    exit 0
}

exit 1
```
