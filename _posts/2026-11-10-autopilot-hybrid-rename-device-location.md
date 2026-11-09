---
layout: post
title: "Tự động đặt tên device theo location khi Autopilot Hybrid Join"
seo_title: "Rename device theo location trong Autopilot Hybrid"
description: "Cách dùng Group Tag khi import hash Autopilot và Intune script để tự đặt tên device theo location, đồng bộ trên AD on-prem, Entra ID và Intune."
date: 2026-11-10
author: "Tam Nguyen"
reading_time: 9
topic: windows
thumb_label: "AUTOPILOT NAMING"
image: /images/photo/33.jpg
tags:
  - Windows
  - Intune
  - Autopilot
  - Active Directory
  - PowerShell
card_tags:
  - Autopilot
  - Intune
summary: "Gắn Group Tag khi import hash Autopilot để Intune script tự đặt tên máy theo location, nhất quán trên AD, Entra ID và Intune."
redirect_from:
  - /posts/autopilot-hybrid-rename-device-theo-location.html
---

Trong môi trường **hybrid**, mỗi máy mới enroll qua Autopilot sẽ xuất hiện ở **AD on-prem**, **Entra ID** và **Intune**. Nếu tên máy là chuỗi ngẫu nhiên như `DESKTOP-7F3K2LQ`, việc tìm máy, phân group theo văn phòng hay đối chiếu với IT Asset đều khó hơn. Khi triển khai máy cho HCM, Hà Nội và Đà Nẵng, mình muốn tên cho biết location, loại máy và serial.

**Tóm tắt nhanh:** gán **Group Tag** theo location khi import hardware hash Autopilot, dùng dynamic group để assign đúng Hybrid deployment profile. Sau khi enroll, Intune script đọc tên profile, xác định mã văn phòng và đổi tên theo quy ước như `VN-HCML-234ABC`. Tên máy domain-joined bị giới hạn 15 ký tự theo NetBIOS, và script cần một cách cung cấp credential domain an toàn nếu dùng `Rename-Computer -DomainCredential`.

## Bối cảnh: vì sao cần naming convention

Với **Hybrid Azure AD Join (Entra hybrid join)**, tên thiết bị được cấu hình trong Domain Join profile không cung cấp template `%SERIAL%` giống trải nghiệm Entra join. Máy có thể nhận tên với chuỗi ngẫu nhiên, không thể hiện location hay loại thiết bị.

Một naming convention hữu ích nên:

- **Theo location** — ví dụ HCM, HaNoi, DaNang.
- **Phân biệt loại máy** — `L` cho laptop, `WS` cho workstation/desktop.
- **Chứa serial** — tiện đối chiếu IT Asset và bảo hành.
- **Không vượt quá 15 ký tự** — giới hạn tên NetBIOS computer trong môi trường AD.

## Luồng tổng quan

1. Import hardware hash Autopilot từ CSV và đặt **Group Tag** theo location.
2. Dynamic device group match Group Tag rồi nhận **Autopilot deployment profile** tương ứng.
3. Máy chạy OOBE, join domain qua Intune Connector và enroll Intune.
4. Intune platform script đọc deployment profile, suy ra mã location và tạo tên mới.
5. Script đổi tên máy; sau khi reboot và các chu kỳ đồng bộ hoàn tất, kiểm tra lại tên trong AD, Entra ID và Intune.

## Bước 1: Import hash và gán Group Tag

File CSV hardware hash Autopilot có cột `Group Tag`. Điền location trước khi import:

```csv
Device Serial Number,Windows Product ID,Hardware Hash,Group Tag
5CG1234ABC,,T0Gb...,HCM
5CG5678DEF,,T0Gb...,HaNoi
PF3XYZ12,,T0Gb...,DaNang
```

Với máy đã import, có thể sửa Group Tag trong **Intune admin center → Devices → Windows → Enrollment → Devices** (Windows Autopilot devices), chọn thiết bị rồi cập nhật thuộc tính.

## Bước 2: Dynamic group và deployment profile

Tạo dynamic device group theo Group Tag (`OrderID`). Ví dụ rule cho HCM:

```text
(device.devicePhysicalIds -any (_ -eq "[OrderID]:HCM"))
```

| Group Tag | Dynamic group | Deployment profile | OfficeCode |
|---|---|---|---|
| HCM | `VN.Autopilot.HCM` | `Autopilot-Hybrid-HCM` | HCM |
| HaNoi | `VN.Autopilot.HaNoi` | `Autopilot-Hybrid-HaNoi` | HN |
| DaNang | `VN.Autopilot.DaNang` | `Autopilot-Hybrid-DaNang` | DN |

> **Quan trọng:** trong ví dụ này, tên deployment profile cần chứa từ khóa location (`HCM`, `HaNoi`, `DaNang`) vì script dùng tên đó để xác định văn phòng. Tên group và profile chỉ là ví dụ; hãy đổi đồng bộ theo quy ước của môi trường.

## Bước 3: Quy tắc đặt tên

Script đọc `DeploymentProfileName` tại registry:

```text
HKLM:\SOFTWARE\Microsoft\Provisioning\Diagnostics\Autopilot
```

Quy tắc minh họa:

- Có pin (`Win32_Battery`) thì xem là laptop: `VN-<OfficeCode>L-<Serial>`.
- Không có pin thì xem là workstation: `VN-<OfficeCode>WS-<Serial>`.
- Serial rỗng hoặc là giá trị mặc định như `O.E.M`, `Default`, `ÿÿÿ` thì dùng số thay thế; nên kiểm tra trùng tên trước khi triển khai rộng.
- Nếu tên dài hơn 15 ký tự, giữ phần cuối của serial để tên nằm trong giới hạn.

| Location | Loại máy | Serial | Tên máy |
|---|---|---|---|
| HCM | Laptop | `5CG1234ABC` | `VN-HCML-234ABC` |
| HaNoi | Laptop | `PF3XYZ12` | `VN-HNL-PF3XYZ12` |
| DaNang | Desktop | `8CC9ABCD` | `VN-DNWS-8CC9ABCD` |

## Bước 4: Deploy script bằng Intune

Vào **Intune admin center → Devices → Windows → Scripts and remediations → Platform scripts → Add**:

| Setting | Giá trị |
|---|---|
| Run this script using the logged on credentials | No (chạy SYSTEM) |
| Enforce script signature check | No, hoặc Yes nếu đã ký script |
| Run script in 64 bit PowerShell Host | Yes |
| Assignment | Dynamic group Autopilot theo location |

Tên mới thường có hiệu lực sau khi **reboot**. Tên trên Entra ID và Intune có thể cập nhật trễ theo chu kỳ đồng bộ và check-in; xác nhận thực tế trên từng hệ thống trước khi coi migration hoàn tất.

## Bảo mật credential và lỗi thường gặp

Để `username/password` trong script, kể cả khi password được encode Base64, **không phải cách bảo vệ bí mật**. Người có quyền đọc script hoặc thiết bị có thể lấy lại credential. Không đưa password thật vào file `.ps1`, Intune payload hay log. Script mẫu dưới đây cố ý để trống phần lấy credential; cần tích hợp một cơ chế secret retrieval được tổ chức phê duyệt trước khi dùng `Rename-Computer -DomainCredential`. Không thể gọi `Get-Credential` tương tác trong platform script chạy nền dưới SYSTEM.

- Dùng tài khoản dịch vụ riêng, chỉ được delegate quyền cần thiết trên OU chứa computer object; không dùng Domain Admin.
- Giới hạn quyền xem/chỉnh sửa script và assignment trong Intune, bảo vệ thiết bị local admin, giám sát tài khoản dịch vụ và luân phiên secret.
- Nếu từng để credential thật trong script, hãy rotate password và rà soát nơi script đã được tải xuống hoặc lưu trữ.

Một số lỗi triển khai khác:

- **Tên máy thiếu location** — profile name không khớp từ khóa, hoặc tên profile chưa có trong registry. Kiểm tra `DeploymentProfileName`.
- **Không kết nối được domain controller** — máy cần line of sight tới DC (mạng nội bộ hoặc VPN) khi đổi tên.
- **Access denied** — tài khoản dùng khi rename chưa được delegate quyền trên computer object/OU.
- **Tên đã tồn tại trong AD** — có thể còn computer object cũ từ lần cài trước; kiểm tra và xử lý object trước khi enroll lại.
- **Tên chưa đổi sau khi script chạy** — kiểm tra log và reboot thiết bị.

## Kết luận

Kết hợp Group Tag, dynamic group và Intune script giúp thiết lập quy ước tên nhất quán theo location, loại máy và serial cho thiết bị Autopilot Hybrid Join. Hãy thử với một nhóm nhỏ, xác nhận giới hạn 15 ký tự, quyền domain và cơ chế cấp credential trước khi mở rộng. Sau reboot, kiểm tra tên trong AD, Entra ID và Intune để xác nhận đồng bộ. Bạn đang đặt tên device trong môi trường hybrid theo quy ước nào?

## Full script

> Đây là khung script minh họa. Trước khi upload, hãy hoàn thiện hàm `Get-RenameCredential` bằng cơ chế secret retrieval được phê duyệt; không thay bằng password hard-coded. Test trên pilot group và xác nhận quyền rename trên OU.

```powershell
$ErrorActionPreference = "Stop"

$LogDirectory = "C:\ProgramData\Microsoft\IntuneManagementExtension\Logs"
New-Item -Path $LogDirectory -ItemType Directory -Force | Out-Null

$CurrentName = (Get-CimInstance Win32_ComputerSystem).Name
$LogFile = Join-Path $LogDirectory "Rename_$CurrentName.txt"
Start-Transcript -Path $LogFile -Force

try {
    $ProfilePath = "HKLM:\SOFTWARE\Microsoft\Provisioning\Diagnostics\Autopilot"
    $ProfileName = Get-ItemPropertyValue -Path $ProfilePath `
        -Name "DeploymentProfileName" -ErrorAction Stop

    $OfficeCode = switch -Regex ($ProfileName) {
        "HCM"    { "HCM"; break }
        "HaNoi"  { "HN";  break }
        "DaNang" { "DN";  break }
        default  { throw "Deployment profile does not contain a supported location: $ProfileName" }
    }

    $Battery = Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue
    $IsLaptop = $null -ne $Battery
    $Serial = (Get-CimInstance Win32_BIOS).SerialNumber.Trim()

    if ([string]::IsNullOrWhiteSpace($Serial) -or
        $Serial -match "^(O\.E\.M\.|Default|ÿÿÿ)$") {
        $Serial = Get-Random -Minimum 1000000 -Maximum 9999999
        Write-Warning "Invalid or missing serial; using a generated numeric suffix."
    }

    $DeviceType = if ($IsLaptop) { "L" } else { "WS" }
    $Prefix = "VN-$OfficeCode$DeviceType-"
    $SerialLength = 15 - $Prefix.Length

    if ($SerialLength -lt 1) {
        throw "Naming prefix exceeds the 15-character computer-name limit: $Prefix"
    }

    if ($Serial.Length -gt $SerialLength) {
        $Serial = $Serial.Substring($Serial.Length - $SerialLength)
    }

    $NewName = "$Prefix$Serial"
    if ($NewName -eq $CurrentName) {
        Write-Output "Device already has the expected name: $CurrentName"
        exit 0
    }

    # Implement using an approved secret provider; do not embed credentials here.
    throw "Configure Get-RenameCredential with your approved secret retrieval method before deployment."
    # $Credential = Get-RenameCredential
    # Rename-Computer -NewName $NewName -DomainCredential $Credential -ErrorAction Stop

    Write-Output "Rename requested: $CurrentName -> $NewName. Reboot is required."
}
catch {
    Write-Error $_
    exit 1
}
finally {
    Stop-Transcript
}
```
