---
layout: post
title: "Đồng bộ hình nền Desktop cho toàn bộ máy Windows trong công ty bằng Intune và PowerShell"
seo_title: "Đồng bộ wallpaper Windows bằng Intune và PowerShell"
description: "Đặt một hình nền Desktop thống nhất cho mọi máy Windows trong công ty bằng Intune: tải ảnh từ URL, áp dụng bằng SystemParametersInfo trong phiên user, kèm full script."
date: 2026-11-06
author: "Tam Nguyen"
reading_time: 8
topic: windows
thumb_label: "WINDOWS · INTUNE"
tags:
  - Windows
  - Intune
  - PowerShell
  - Branding
card_tags:
  - Intune
  - Wallpaper
summary: "Một script PowerShell chạy qua Intune để mọi máy Windows trong công ty dùng chung hình nền Desktop, đổi ảnh chỉ bằng cách thay file trên web."
redirect_from:
  - /posts/dong-bo-wallpaper-windows-bang-intune.html
---

Bộ phận truyền thông vừa ra bộ nhận diện mới và muốn **toàn bộ laptop Windows** trong công ty dùng chung một hình nền Desktop trước buổi town hall. Văn phòng có vài trăm máy, đã chuyển hẳn sang Entra ID join và quản lý bằng Intune, không còn GPO. Gửi email nhờ user tự đổi thì được khoảng một nửa. Bài này hướng dẫn dùng một script PowerShell nhỏ, chạy qua Intune trong phiên của user, để tải ảnh từ một URL và đặt làm hình nền cho mọi máy.

> **Tóm tắt nhanh:** Script tải ảnh từ một URL cố định, lưu vào thư mục của user, rồi gọi API `SystemParametersInfo` của Windows để đặt hình nền ngay lập tức. Script **phải chạy trong phiên của user đang đăng nhập**, vì hình nền là thiết lập theo từng user. Deploy bằng Intune Platform script với tùy chọn *Run this script using the logged on credentials = Yes*. Lần sau muốn đổi ảnh, chỉ cần thay file ở URL rồi cho script chạy lại.

## Bối cảnh: các cách đặt hình nền trên Intune

| Cách | Phiên bản Windows | Ưu điểm | Hạn chế |
|---|---|---|---|
| **Script PowerShell (bài này)** | Pro, Enterprise, Education | Chạy được trên mọi phiên bản, đổi ảnh dễ | User vẫn tự đổi lại được |
| Settings catalog → *Desktop Image Url* (Personalization CSP) | Enterprise, Education | Có sẵn trong Intune, khóa không cho đổi | Không áp dụng cho Windows Pro |
| Windows Spotlight / theme | Tùy phiên bản | Đẹp, tự xoay ảnh | Không kiểm soát được nội dung |

Trong môi trường của mình có cả máy Windows Pro, nên chọn cách dùng script để mọi máy đều nhận được. Nếu toàn bộ máy của bạn là Enterprise và muốn **khóa** hình nền, hãy dùng [Personalization CSP](https://learn.microsoft.com/windows/client-management/mdm/personalization-csp) thay vì script.

## Vì sao phải chạy trong phiên của user

Hình nền Desktop lưu trong registry của **từng user**, tại `HKCU\Control Panel\Desktop\Wallpaper`. Hàm `SystemParametersInfo` chỉ thay đổi hình nền của phiên đang gọi nó.

- Nếu script chạy bằng tài khoản **SYSTEM** (mặc định của Intune), nó chỉ đổi hình nền của SYSTEM, user không thấy gì cả.
- Nếu chạy bằng **tài khoản user**, hình nền đổi ngay trên màn hình đang dùng, không cần đăng xuất.

Đó là lý do mọi bước bên dưới đều chạy trong ngữ cảnh user.

## Script hoạt động thế nào: 4 bước

### Bước 1: Chuẩn bị thư mục lưu ảnh

Ảnh được lưu trong thư mục **của user** (`%LOCALAPPDATA%\CompanyWallpaper`), không phải `C:\ProgramData`. Trên máy dùng chung, file trong `ProgramData` do user đầu tiên tạo ra thì user thứ hai không ghi đè được, và script sẽ lỗi khi đổi ảnh mới.

```powershell
$dir  = Join-Path $env:LOCALAPPDATA 'CompanyWallpaper'
$file = Join-Path $dir 'company_wallpaper.jpg'
New-Item -ItemType Directory -Path $dir -Force | Out-Null
```

### Bước 2: Tải ảnh an toàn

Ảnh được tải về file tạm trước, kiểm tra hợp lệ rồi mới thay file chính. Nếu mạng chập chờn làm file tải dở, hình nền hiện tại vẫn giữ nguyên, không bị thành màn hình đen.

```powershell
$tmp = "$file.download"
Invoke-WebRequest -Uri $ImageUrl -OutFile $tmp -UseBasicParsing -TimeoutSec 60
if ((Get-Item $tmp).Length -lt 10KB) { throw "File tải về quá nhỏ, có thể không phải ảnh" }
Move-Item -Path $tmp -Destination $file -Force
```

URL nên là nơi user nào cũng đọc được mà không cần đăng nhập, ví dụ Azure Blob Storage, CDN của công ty, hoặc web server nội bộ.

### Bước 3: Đặt kiểu hiển thị

Trước khi đặt ảnh, ghi kiểu hiển thị vào registry. Giá trị `10` là **Fill** (lấp đầy màn hình, cắt bớt nếu khác tỉ lệ), phù hợp với hầu hết màn hình laptop.

| Kiểu | `WallpaperStyle` | `TileWallpaper` |
|---|---|---|
| Fill | `10` | `0` |
| Fit | `6` | `0` |
| Stretch | `2` | `0` |
| Center | `0` | `0` |
| Span (nhiều màn hình) | `22` | `0` |

```powershell
Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name WallpaperStyle -Value '10'
Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name TileWallpaper  -Value '0'
```

### Bước 4: Áp dụng bằng SystemParametersInfo

PowerShell không có lệnh đổi hình nền, nên script khai báo một đoạn C# nhỏ để gọi API `SystemParametersInfo` trong `user32.dll`:

- `0x14` là `SPI_SETDESKWALLPAPER`, lệnh đổi hình nền.
- `3` là tổ hợp `SPIF_UPDATEINIFILE | SPIF_SENDCHANGE`: lưu vào profile của user và báo cho Windows vẽ lại ngay.

```powershell
Add-Type -TypeDefinition @'
using System.Runtime.InteropServices;
namespace Win32 {
    public class Wallpaper {
        [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        static extern bool SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni);
        public static bool SetWallpaper(string path) {
            return SystemParametersInfo(0x14, 0, path, 3);
        }
    }
}
'@
[Win32.Wallpaper]::SetWallpaper($file)
```

Script kiểm tra `'Win32.Wallpaper' -as [type]` trước khi `Add-Type`, để chạy lại nhiều lần trong cùng một phiên PowerShell không bị lỗi "type already exists".

## Deploy bằng Intune

Vào **Intune admin center → Devices → Windows → Scripts and remediations → Platform scripts → Add**, tải file `Set-CompanyWallpaper.ps1` lên rồi chọn:

| Thiết lập | Giá trị |
|---|---|
| Run this script using the logged on credentials | **Yes** |
| Enforce script signature check | No (hoặc Yes nếu bạn ký script) |
| Run script in 64-bit PowerShell Host | Yes |
| Assignments | Group user hoặc group thiết bị Windows |

<div class="callout warn">
  <span>⚠️</span>
  <div><b>Lưu ý</b>Platform script chỉ chạy <b>một lần</b> cho mỗi user trên mỗi máy. Khi muốn đổi sang ảnh mới, thay file ở URL rồi <b>tải lại script</b> trong Intune (sửa một dòng comment là đủ để Intune coi là script mới). Nếu có license Intune Remediations, có thể dùng Remediation với lịch chạy hằng ngày để máy tự cập nhật.</div>
</div>

Muốn thử trước khi assign, chạy trực tiếp trên máy pilot bằng tài khoản user thường:

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\Set-CompanyWallpaper.ps1
```

## Những lỗi mình đã gặp

- **Script báo thành công nhưng hình nền không đổi** — script đang chạy bằng SYSTEM. Kiểm tra lại tùy chọn *Run this script using the logged on credentials* phải là **Yes**.
- **`Access to the path ... is denied` trên máy dùng chung** — bản đầu lưu ảnh vào `C:\ProgramData\Wallpaper`. User thứ hai không ghi đè được file của user đầu tiên. Cách xử lý: lưu vào `%LOCALAPPDATA%` như bước 1.
- **Màn hình đen sau khi chạy** — file ảnh tải dở hoặc URL trả về trang lỗi HTML thay vì ảnh. Cách xử lý: tải về file tạm, kiểm tra dung lượng rồi mới thay file chính.
- **Không đổi được trên một số máy** — các máy đó đang nhận policy *Desktop Image Url* hoặc *Prevent changing desktop background* từ cấu hình khác. Policy luôn thắng script. Kiểm tra trong *Device configuration* xem có profile nào trùng.
- **Ảnh bị mờ trên màn hình 4K** — ảnh nguồn chỉ có độ phân giải Full HD. Hãy dùng ảnh ít nhất 3840×2160 và định dạng JPG chất lượng cao để Windows không nén thêm.

## Kết luận

Với một script ngắn chạy trong phiên của user, mọi máy Windows trong công ty có chung một hình nền, kể cả máy Windows Pro mà Personalization CSP không hỗ trợ. Ba điểm cần nhớ: chạy bằng tài khoản user, lưu ảnh trong thư mục của user, và tải ảnh qua file tạm để không làm hỏng hình nền hiện tại.

Việc nên làm tiếp: đưa ảnh lên một URL cố định, thử script trên vài máy pilot, rồi assign cho cả công ty. Công ty bạn có khóa hình nền Desktop không, hay chỉ đặt mặc định và để user tự đổi?

## Full script

Lưu thành `Set-CompanyWallpaper.ps1`. Sửa `$ImageUrl` thành đường dẫn ảnh của công ty. Có thể đổi `$Style` thành `Fill`, `Fit`, `Stretch`, `Center` hoặc `Span`.

```powershell
#Requires -Version 5.1
<#
.SYNOPSIS
  Tai anh nen tu URL va dat lam hinh nen Desktop cho user dang dang nhap.
  Phai chay trong phien cua user (Intune: Run this script using the logged on credentials = Yes).
.EXAMPLE
  .\Set-CompanyWallpaper.ps1
  .\Set-CompanyWallpaper.ps1 -ImageUrl "https://cdn.contoso.com/brand/wallpaper.jpg" -Style Fit
#>
[CmdletBinding()]
param(
    [string]$ImageUrl = 'https://cdn.contoso.com/brand/company_wallpaper.jpg',
    [ValidateSet('Fill','Fit','Stretch','Center','Span')]
    [string]$Style = 'Fill'
)
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$Dir     = Join-Path $env:LOCALAPPDATA 'CompanyWallpaper'
$File    = Join-Path $Dir 'company_wallpaper.jpg'
$LogFile = Join-Path $Dir 'Set-CompanyWallpaper.log'
function Write-Log([string]$Message) {
    $line = "{0:yyyy-MM-dd HH:mm:ss}  {1}" -f (Get-Date), $Message
    Write-Host $line
    Add-Content -Path $LogFile -Value $line -ErrorAction SilentlyContinue
}
function Set-CompanyWallpaper {
    param(
        [Parameter(Mandatory)][string]$ImageUrl,
        [string]$Style = 'Fill'
    )
    # Khong chay duoi SYSTEM: hinh nen la thiet lap theo tung user
    if ([Security.Principal.WindowsIdentity]::GetCurrent().IsSystem) {
        throw "Script dang chay bang SYSTEM. Hay chay trong phien cua user." }
    # 1) Thu muc luu anh trong profile cua user
    New-Item -ItemType Directory -Path $Dir -Force | Out-Null
    # 2) Tai anh ve file tam, kiem tra roi moi thay file chinh
    $tmp = "$File.download"
    Invoke-WebRequest -Uri $ImageUrl -OutFile $tmp -UseBasicParsing -TimeoutSec 60
    if ((Get-Item $tmp).Length -lt 10KB) {
        Remove-Item $tmp -Force -ErrorAction SilentlyContinue
        throw "File tai ve qua nho, co the URL khong tra ve anh: $ImageUrl" }
    Move-Item -Path $tmp -Destination $File -Force
    Write-Log "Da tai anh: $ImageUrl -> $File"
    # 3) Kieu hien thi
    $styleMap = @{ Fill = '10'; Fit = '6'; Stretch = '2'; Center = '0'; Span = '22' }
    Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name WallpaperStyle -Value $styleMap[$Style]
    Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name TileWallpaper  -Value '0'
    # 4) Ap dung bang SystemParametersInfo
    if (-not ('Win32.Wallpaper' -as [type])) {
        Add-Type -TypeDefinition @'
using System.Runtime.InteropServices;
namespace Win32 {
    public class Wallpaper {
        [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        static extern bool SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni);
        public static bool SetWallpaper(string path) {
            // 0x14 = SPI_SETDESKWALLPAPER, 3 = SPIF_UPDATEINIFILE | SPIF_SENDCHANGE
            return SystemParametersInfo(0x14, 0, path, 3);
        }
    }
}
'@
    }
    if (-not [Win32.Wallpaper]::SetWallpaper($File)) {
        throw "SystemParametersInfo that bai, ma loi Win32: $([Runtime.InteropServices.Marshal]::GetLastWin32Error())" }
    Write-Log "Da dat hinh nen ($Style) cho $env:USERNAME"
}
try {
    Set-CompanyWallpaper -ImageUrl $ImageUrl -Style $Style
    exit 0
}
catch {
    Write-Log "LOI: $($_.Exception.Message)"
    exit 1
}
```

<!--
Phần cuối bài (nút Chia sẻ LinkedIn, Facebook, Copy link, khung tác giả, bài trước/sau)
và Mục lục bên phải được layout tự thêm vào, không cần viết trong file này.
Xem trước trên máy: bundle exec jekyll serve --unpublished (chỉ cần khi bài còn published: false).
-->
