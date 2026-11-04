---
layout: post
title: "Cài nhiều máy in mạng cho Windows bằng Intune: driver, cổng TCP/IP và in 2 mặt trong một Win32 app"
seo_title: "Cài máy in mạng cho Windows bằng Intune Win32 app"
description: "Đóng gói driver và script PowerShell thành Intune Win32 app để cài nhiều máy in mạng cho Windows: pnputil, cổng TCP/IP, bật in 2 mặt, detection rule."
date: 2026-11-05
author: "Tam Nguyen"
reading_time: 10
topic: windows
thumb_label: "WINDOWS · INTUNE"
tags:
  - Windows
  - Intune
  - PowerShell
  - Printer
  - Win32 App
card_tags:
  - Intune
  - Printer
summary: "Một Win32 app trên Intune cài driver và nhiều máy in mạng theo tầng cho Windows, kèm detection rule và full script để copy."
redirect_from:
  - /posts/cai-nhieu-may-in-windows-bang-intune.html
---

Văn phòng có hai tầng, mỗi tầng một máy in đa năng HP LaserJet M5035 MFP. Mỗi khi có laptop mới, helpdesk phải tải driver, tạo cổng TCP/IP, thêm máy in, rồi vào *Printer properties* bật khay in 2 mặt. Làm tay thì mất 10-15 phút mỗi máy, và thường quên bước in 2 mặt nên user cứ in ra một mặt. Máy đã chuyển sang Entra ID join và quản lý bằng Intune, không còn GPO để deploy máy in. Bài này hướng dẫn đóng gói driver và script PowerShell thành **một Win32 app** trên Intune, cài cùng lúc nhiều máy in cho Windows.

> **Tóm tắt nhanh:** Đóng gói file `Printer.zip` (chứa driver) và script `Install-Printers.ps1` thành file `.intunewin`, tạo Win32 app chạy trong ngữ cảnh **System**. Script nạp driver bằng `pnputil`, đăng ký driver với Print Spooler, rồi tạo cổng TCP/IP, thêm máy in và bật Duplex Unit cho từng máy. Detection rule kiểm tra máy in cuối cùng đã tồn tại.

## Bối cảnh: vì sao chọn Win32 app

Intune có một số cách đưa máy in xuống Windows, mỗi cách hợp với một tình huống:

| Cách | Phù hợp khi | Hạn chế |
|---|---|---|
| **Win32 app + PowerShell** | Máy in mạng nội bộ, driver riêng, cần chỉnh cấu hình | Phải tự viết script và detection rule |
| Universal Print | Muốn bỏ print server, in từ mọi nơi | Cần license và máy in hỗ trợ (hoặc connector) |
| Settings catalog (Printer Provisioning) | Đã có Universal Print | Không dùng cho máy in TCP/IP thông thường |
| Platform script | Chạy một lần, đơn giản | Không có detection, khó cài lại, khó báo lỗi |

Máy in M5035 là đời cũ, chỉ có driver PCL6 dạng `.inf`, và môi trường không dùng Universal Print. Win32 app là lựa chọn hợp lý nhất: có detection rule, có retry, có báo cáo cài đặt theo từng thiết bị.

## Chuẩn bị gói cài đặt

Tạo một thư mục nguồn với 2 file:

```text
C:\IntuneSource\Printers\
├── Install-Printers.ps1
└── Printer.zip          # driver đã giải nén từ HP, nén lại, có file .inf bên trong
```

Kiểm tra tên driver chính xác trong file `.inf` trước khi đóng gói, vì `Add-PrinterDriver` cần đúng tên này:

```powershell
Select-String -Path .\Driver\*.inf -Pattern 'HP LaserJet M5035' | Select-Object -First 5
```

Sau đó đóng gói bằng [Microsoft Win32 Content Prep Tool](https://learn.microsoft.com/intune/intune-service/apps/apps-win32-prepare):

```powershell
.\IntuneWinAppUtil.exe -c "C:\IntuneSource\Printers" -s "Install-Printers.ps1" -o "C:\IntuneOutput" -q
```

<div class="callout">
  <span>💡</span>
  <div><b>Tip</b>Đưa <code>Printer.zip</code> vào chung gói <code>.intunewin</code> thay vì copy sẵn xuống <code>C:\TEMP</code>. Khi Intune chạy lệnh cài, file nằm cùng thư mục với script, nên script tự tìm thấy qua <code>$PSScriptRoot</code>. Không cần bước copy riêng.</div>
</div>

## Script hoạt động thế nào: 5 bước

### Bước 1: Kiểm tra điều kiện

Script dừng sớm nếu thiếu file driver hoặc máy chưa ở mạng văn phòng. Kiểm tra mạng bằng cách ping một IP nội bộ, ví dụ gateway. Nếu không ping được, script trả **exit code 1618** để Intune hiểu là "thử lại sau" thay vì đánh dấu cài thất bại.

```powershell
if (-not (Test-Connection -ComputerName $OfficeCheckIp -Count 3 -Quiet)) {
    Write-Log "Không ping được $OfficeCheckIp - chưa ở mạng văn phòng/VPN"
    exit 1618
}
```

Tham số `-SkipPing` dùng khi test trên máy không ở văn phòng.

### Bước 2: Giải nén driver vào thư mục riêng

Script chỉ xóa và tạo lại **đúng thư mục giải nén của nó**, không đụng tới phần còn lại của ổ đĩa:

```powershell
if (Test-Path $ExtractDir) { Remove-Item -Path $ExtractDir -Recurse -Force }
New-Item -ItemType Directory -Path $ExtractDir -Force | Out-Null
Expand-Archive -Path $ZipPath -DestinationPath $ExtractDir -Force
```

### Bước 3: Nạp driver vào driver store

Có 2 lệnh, làm 2 việc khác nhau:

1. `pnputil /add-driver ... /install` — đưa driver vào **driver store** của Windows.
2. `Add-PrinterDriver` — đăng ký driver đó với **Print Spooler** để tạo được máy in.

Thiếu bước 1 thì bước 2 báo không tìm thấy driver. Thiếu bước 2 thì `Add-Printer` báo lỗi tên driver.

```powershell
foreach ($inf in Get-ChildItem -Path $ExtractDir -Filter *.inf -Recurse) {
    & $PnpUtil /add-driver $inf.FullName /install | Out-Null
}
if (-not (Get-PrinterDriver -Name $DriverName -ErrorAction SilentlyContinue)) {
    Add-PrinterDriver -Name $DriverName
}
```

### Bước 4: Tạo cổng, thêm máy in, bật in 2 mặt

Danh sách máy in khai báo ở đầu script, mỗi phần tử là một máy:

```powershell
$Printers = @(
    @{ Name = 'Office-Floor3-MFP'; Ip = '192.168.30.101'; Floor = 3 },
    @{ Name = 'Office-Floor2-MFP'; Ip = '192.168.20.105'; Floor = 2 }
)
```

Với mỗi máy, script tạo cổng `IP_<địa chỉ>` nếu chưa có, thêm máy in nếu chưa có, rồi khai báo máy có **Duplex Unit**. Driver không tự biết máy in có khay đảo mặt, nên nếu bỏ bước này, tùy chọn *Print on both sides* sẽ bị mờ.

```powershell
Set-PrinterProperty -PrinterName $p.Name -PropertyName 'Config:DuplexUnit' -Value 'Installed'
```

Muốn mặc định in 2 mặt luôn, thêm `Set-PrintConfiguration -PrinterName $p.Name -DuplexingMode TwoSidedLongEdge`.

### Bước 5: Dọn dẹp và ghi log

Xóa thư mục giải nén, ghi danh sách máy in đã cài vào log tại `C:\ProgramData\Microsoft\IntuneManagementExtension\Logs\Install-Printers.log`. Đặt log ở đây để công cụ *Collect diagnostics* của Intune lấy được luôn.

## Tạo Win32 app trên Intune

Vào **Intune admin center → Apps → Windows → Add → Windows app (Win32)**, tải file `.intunewin` lên, rồi điền:

| Mục | Giá trị |
|---|---|
| Install command | `%SystemRoot%\sysnative\WindowsPowerShell\v1.0\powershell.exe -ExecutionPolicy Bypass -NoProfile -File .\Install-Printers.ps1` |
| Uninstall command | `%SystemRoot%\sysnative\WindowsPowerShell\v1.0\powershell.exe -ExecutionPolicy Bypass -NoProfile -File .\Install-Printers.ps1 -Uninstall` |
| Install behavior | **System** |
| Device restart behavior | No specific action |
| Return codes | `0` Success, `1618` Retry, `1` Failed |
| Requirements | Windows 10 22H2 trở lên, 64-bit |
| Detection rule | Custom script (bên dưới) |

### Detection rule

Script detection phải in ra một dòng bất kỳ và trả exit 0 khi **tất cả** máy in đã có. Không in gì nghĩa là chưa cài.

```powershell
$names = 'Office-Floor3-MFP','Office-Floor2-MFP'
$found = Get-Printer -ErrorAction SilentlyContinue | Where-Object Name -in $names
if (@($found).Count -eq $names.Count) { Write-Output "Installed"; exit 0 }
exit 1
```

<div class="callout warn">
  <span>⚠️</span>
  <div><b>Lưu ý</b>Khi thêm hoặc đổi máy in, nhớ sửa <b>cả</b> danh sách trong script cài lẫn detection rule, rồi tải gói mới lên dưới dạng phiên bản mới (supersedence). Nếu chỉ sửa script, máy đã cài sẽ không chạy lại vì detection vẫn báo "Installed".</div>
</div>

Assign app dạng **Required** cho group thiết bị của văn phòng. Có thể đưa lên Company Portal dạng **Available** để user tự cài lại khi cần.

## Những lỗi mình đã gặp

- **`pnputil` không tìm thấy hoặc không nạp được driver** — Intune Management Extension chạy PowerShell **32-bit**, nên `C:\Windows\System32` bị chuyển hướng sang `SysWOW64`, nơi không có `pnputil.exe` 64-bit. Cách xử lý: gọi PowerShell qua đường dẫn `sysnative` trong install command, và trong script cũng gọi `pnputil` qua `sysnative` khi đang chạy 32-bit.
- **`Add-PrinterDriver : The specified driver does not exist`** — tên driver trong script khác một ký tự so với tên trong file `.inf`, ví dụ thiếu chữ `Class`. Cách xử lý: copy tên chính xác từ file `.inf` như ở phần chuẩn bị.
- **Máy cài thất bại hàng loạt vào buổi sáng** — máy đang ở nhà, không ping được mạng văn phòng nên script trả lỗi. Cách xử lý: trả exit code `1618` để Intune thử lại sau, thay vì `1`.
- **Tùy chọn in 2 mặt bị mờ** — chưa khai báo `Config:DuplexUnit`. Tên thuộc tính khác nhau giữa các driver, dùng `Get-PrinterProperty -PrinterName <tên>` để xem tên đúng.
- **Máy in bị cài trùng với hậu tố `(Copy 1)`** — script cũ không kiểm tra máy in đã tồn tại. Script trong bài luôn kiểm tra cổng và máy in trước khi tạo.

## Kết luận

Với một Win32 app duy nhất, mọi máy Windows mới vào văn phòng đều có đủ máy in của các tầng, đúng driver, đúng cổng và bật sẵn in 2 mặt, mà helpdesk không phải đụng tay. Ba điểm cần nhớ: đóng gói driver cùng script, gọi PowerShell qua `sysnative`, và giữ detection rule khớp với danh sách máy in.

Việc nên làm tiếp: thử gói trên một máy pilot, kiểm tra log trong thư mục IME, rồi mới assign cho cả văn phòng. Team bạn đang deploy máy in bằng Win32 app, Universal Print hay vẫn dùng print server với GPO?

## Full script

Lưu thành `Install-Printers.ps1`, đặt cùng thư mục với `Printer.zip` trước khi đóng gói. Sửa danh sách `$Printers`, `$DriverName` và `$OfficeCheckIp` cho đúng môi trường của bạn.

```powershell
#Requires -Version 5.1
#Requires -RunAsAdministrator
<#
.SYNOPSIS
  Cai driver va nhieu may in mang (TCP/IP) cho Windows, dung lam Win32 app tren Intune.
.EXAMPLE
  .\Install-Printers.ps1
  .\Install-Printers.ps1 -SkipPing
  .\Install-Printers.ps1 -Uninstall
#>
[CmdletBinding()]
param(
    # File zip chua driver. Mac dinh nam cung thu muc voi script (trong goi .intunewin).
    [string]$ZipPath = (Join-Path $PSScriptRoot 'Printer.zip'),
    # Thu muc giai nen rieng, chi script nay xoa/tao lai.
    [string]$ExtractDir = 'C:\ProgramData\PrinterDeploy\Driver',
    # IP noi bo dung de kiem tra may dang o mang van phong.
    [string]$OfficeCheckIp = '192.168.1.1',
    # Ten driver phai trung chinh xac voi ten trong file .inf.
    [string]$DriverName = 'HP LaserJet M5035 MFP PCL6 Class Driver',
    [switch]$SkipPing,
    [switch]$Uninstall
)
$ErrorActionPreference = 'Stop'
# ===== DANH SACH MAY IN =====
$Printers = @(
    @{ Name = 'Office-Floor3-MFP'; Ip = '192.168.30.101'; Floor = 3 },
    @{ Name = 'Office-Floor2-MFP'; Ip = '192.168.20.105'; Floor = 2 }
)
# ===== LOG =====
$LogFile = 'C:\ProgramData\Microsoft\IntuneManagementExtension\Logs\Install-Printers.log'
function Write-Log([string]$Message) {
    $line = "{0:yyyy-MM-dd HH:mm:ss}  {1}" -f (Get-Date), $Message
    Write-Host $line
    Add-Content -Path $LogFile -Value $line -ErrorAction SilentlyContinue
}
# pnputil 64-bit: neu dang chay PowerShell 32-bit tren Windows 64-bit thi goi qua sysnative
$PnpUtil = if ([Environment]::Is64BitOperatingSystem -and -not [Environment]::Is64BitProcess) {
    "$env:windir\sysnative\pnputil.exe" } else { "$env:windir\System32\pnputil.exe" }
# ===== GO CAI DAT =====
if ($Uninstall) {
    foreach ($p in $Printers) {
        if (Get-Printer -Name $p.Name -ErrorAction SilentlyContinue) {
            Remove-Printer -Name $p.Name; Write-Log "Da go may in $($p.Name)" }
        $portName = "IP_$($p.Ip)"
        if (Get-PrinterPort -Name $portName -ErrorAction SilentlyContinue) {
            Remove-PrinterPort -Name $portName -ErrorAction SilentlyContinue; Write-Log "Da go cong $portName" }
    }
    exit 0
}
try {
    Write-Log "===== Bat dau cai may in ====="
    # 1) Kiem tra dieu kien
    if (-not (Test-Path -Path $ZipPath -PathType Leaf)) {
        Write-Log "Khong thay file driver: $ZipPath"; exit 1 }
    if (-not $SkipPing) {
        if (-not (Test-Connection -ComputerName $OfficeCheckIp -Count 3 -Quiet)) {
            Write-Log "Khong ping duoc $OfficeCheckIp - chua o mang van phong/VPN. Intune se thu lai."
            exit 1618 }
    }
    # 2) Giai nen driver
    if (Test-Path $ExtractDir) { Remove-Item -Path $ExtractDir -Recurse -Force }
    New-Item -ItemType Directory -Path $ExtractDir -Force | Out-Null
    Expand-Archive -Path $ZipPath -DestinationPath $ExtractDir -Force
    Write-Log "Da giai nen driver vao $ExtractDir"
    # 3) Nap driver vao driver store va dang ky voi Print Spooler
    $infFiles = Get-ChildItem -Path $ExtractDir -Filter *.inf -Recurse
    if (-not $infFiles) { Write-Log "Khong co file .inf trong $ExtractDir"; exit 1 }
    foreach ($inf in $infFiles) {
        Write-Log "pnputil: $($inf.FullName)"
        & $PnpUtil /add-driver $inf.FullName /install | Out-Null
    }
    if (-not (Get-PrinterDriver -Name $DriverName -ErrorAction SilentlyContinue)) {
        Add-PrinterDriver -Name $DriverName }
    if (-not (Get-PrinterDriver -Name $DriverName -ErrorAction SilentlyContinue)) {
        Write-Log "Driver '$DriverName' chua duoc cai; kiem tra ten driver trong file .inf."; exit 1 }
    Write-Log "Driver san sang: $DriverName"
    # 4) Moi may in: tao cong TCP/IP, them may in, bat Duplex Unit
    foreach ($p in $Printers) {
        Write-Log "--- Tang $($p.Floor): $($p.Name) ($($p.Ip)) ---"
        $portName = "IP_$($p.Ip)"
        if (-not (Get-PrinterPort -Name $portName -ErrorAction SilentlyContinue)) {
            Add-PrinterPort -Name $portName -PrinterHostAddress $p.Ip
            Write-Log "Da tao cong $portName" }
        if (-not (Get-Printer -Name $p.Name -ErrorAction SilentlyContinue)) {
            Add-Printer -Name $p.Name -PortName $portName -DriverName $DriverName
            Write-Log "Da them may in $($p.Name)" }
        else { Write-Log "May in '$($p.Name)' da ton tai - bo qua buoc them." }
        try {
            Set-PrinterProperty -PrinterName $p.Name -PropertyName 'Config:DuplexUnit' -Value 'Installed'
            Write-Log "Da bat DuplexUnit cho $($p.Name)" }
        catch { Write-Log "Khong dat duoc DuplexUnit cho $($p.Name): $($_.Exception.Message)" }
    }
    # 5) Don dep va ghi ket qua
    Remove-Item -Path $ExtractDir -Recurse -Force -ErrorAction SilentlyContinue
    Get-Printer | Where-Object Name -in $Printers.Name |
        ForEach-Object { Write-Log ("OK  {0} | {1} | {2}" -f $_.Name, $_.DriverName, $_.PortName) }
    Write-Log "===== Hoan tat ====="
    exit 0
}
catch {
    Write-Log "LOI: $($_.Exception.Message)"
    exit 1
}
```

Detection rule (Custom script, chạy 64-bit):

```powershell
$names = 'Office-Floor3-MFP','Office-Floor2-MFP'
$found = Get-Printer -ErrorAction SilentlyContinue | Where-Object Name -in $names
if (@($found).Count -eq $names.Count) { Write-Output "Installed"; exit 0 }
exit 1
```

<!--
Phần cuối bài (nút Chia sẻ LinkedIn, Facebook, Copy link, khung tác giả, bài trước/sau)
và Mục lục bên phải được layout tự thêm vào, không cần viết trong file này.
Xem trước trên máy: bundle exec jekyll serve --unpublished (chỉ cần khi bài còn published: false).
-->
