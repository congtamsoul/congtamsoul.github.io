---
layout: post
title: "Tự động phát hiện và sửa tên máy Windows sai location bằng Power BI, Graph API và Autopilot Group Tag"
seo_title: "Tự động sửa tên máy Windows sai location"
description: "Dùng Power BI so tên máy Intune với location của primary user, xuất danh sách sai, rồi Graph API cập nhật Autopilot Group Tag để máy tự đặt tên đúng khi setup."
date: 2026-10-29
author: "Tam Nguyen"
reading_time: 9
topic: windows
thumb_label: "DEVICE NAMING"
tags:
  - Intune
  - Autopilot
  - Power BI
  - Microsoft Graph
card_tags:
  - Autopilot
  - Intune
summary: "Phát hiện máy Windows đặt tên sai location bằng Power BI, rồi cập nhật Autopilot Group Tag qua Graph API để máy tự đặt tên đúng."
redirect_from:
  - /posts/auto-rename-incorrect-windows-devices.html
---

Quy ước đặt tên máy ở công ty mình rất rõ: máy ở Hồ Chí Minh bắt đầu bằng `VN-HCM`, máy ở Hà Nội bắt đầu bằng `VN-HN`, theo sau là serial number. Nhờ vậy, chỉ cần nhìn tên là biết máy thuộc văn phòng nào, ai phụ trách hỗ trợ, policy nào áp dụng. Nhưng sau vài năm điều chuyển nhân sự, đổi máy, mượn máy giữa các văn phòng, báo cáo Intune có hàng trăm máy mang tên `VN-HCM` trong khi người dùng đang ngồi ở Hà Nội, và ngược lại. Bài này chia sẻ cách mình phát hiện và sửa tên máy sai một cách tự động trên khoảng **2.000 máy Windows**.

> **Tóm tắt nhanh:** Power BI lấy tên máy từ Intune Data Warehouse và location của primary user từ AD, rồi DAX so prefix tên máy với prefix đúng của location. Danh sách máy sai được xuất ra, Graph API cập nhật **Group Tag** trong Autopilot. Khi máy được setup lại, script đọc Group Tag và đặt tên `<Tag>-<Serial Number>`.

## Bối cảnh: vì sao tên máy sai lại là vấn đề

Tên máy sai không chỉ là chuyện thẩm mỹ:

- **Dynamic group sai.** Nhiều group trong Intune lọc theo prefix tên máy, nên máy sai tên sẽ nhận sai policy, sai app, sai lịch update.
- **Helpdesk hỗ trợ nhầm văn phòng.** Ticket bị chuyển qua lại giữa các site.
- **Báo cáo theo location sai lệch.** Số máy, compliance, patch của từng văn phòng không đúng thực tế.

Nguyên nhân gốc thường nằm ở **Autopilot Group Tag**: tag được gán từ lúc nhập máy, và khi máy chuyển văn phòng thì không ai cập nhật lại tag.

## Kiến trúc tổng thể

| Bước | Thành phần | Việc làm |
|---|---|---|
| 1 | **Intune Data Warehouse** | Tên máy, serial, primary user |
| 2 | **AD Users** | Location của primary user (`physicalDeliveryOfficeName`) |
| 3 | **Bảng mapping** | Location → Prefix đúng (`VN-HCM`, `VN-HN`...) |
| 4 | **Power BI + DAX** | So prefix tên máy với prefix đúng, xác định máy sai |
| 5 | **Power Automate** | Lấy danh sách máy sai, xuất CSV |
| 6 | **Graph API** | Cập nhật Group Tag của máy trong Autopilot |
| 7 | **Script đặt tên** | Khi setup, đọc Group Tag và đặt tên `<Tag>-<Serial>` |

*Hình 1: luồng xử lý từ Power BI đến Autopilot.*

## Bước 1-3: Chuẩn bị bảng mapping Location → Prefix

Location trong AD thường không đồng nhất: cùng một văn phòng có thể được ghi `TP. Ho Chi Minh-VP. Phu Nu` hoặc `TP. Ho Chi Minh-VP Phu Nu`. Vì vậy mình dùng một bảng mapping riêng thay vì viết cứng trong DAX.

| Office Location (AD) | Expected Prefix | Alternative Prefix |
|---|---|---|
| TP. Ho Chi Minh | VN-HCM | |
| Ha Noi | VN-HN | |
| TP. Ho Chi Minh-VP. Phu Nu | VN-PNL | VN-PNWS |
| TP. Ho Chi Minh-VP Phu Nu | VN-PNL | VN-PNWS |

Cột **Alternative Prefix** dùng cho các loại máy đặc biệt cùng location (ví dụ workstation). Máy mang prefix này vẫn được tính là đúng, nhưng khi hiển thị chỉ show **Expected Prefix** cho gọn.

<div class="callout">
  <span>💡</span>
  <div><b>Tip</b>Đặt bảng mapping trong Excel Online và cho team quản lý location tự cập nhật. Khi mở văn phòng mới, chỉ cần thêm một dòng, không cần sửa DAX.</div>
</div>

## Bước 4: Xác định máy sai tên bằng DAX

### Bảng WrongNameIntune

```dax
WrongNameIntune =
VAR _Base =
    FILTER (
        Intune,
        Intune[operatingSystem] = "Windows"
            && NOT ( LEFT ( Intune[deviceName], 4 ) IN { "VN-L" } )   -- loại trừ prefix không cần kiểm tra
    )
VAR _Enriched =
    ADDCOLUMNS (
        _Base,
        "OfficeLocation",
            LOOKUPVALUE ( UsersAD[physicalDeliveryOfficeName], UsersAD[UserPrincipalName], Intune[userPrincipalName] ),
        "ExpectedPrefix",
            VAR _Loc = LOOKUPVALUE ( UsersAD[physicalDeliveryOfficeName], UsersAD[UserPrincipalName], Intune[userPrincipalName] )
            RETURN LOOKUPVALUE ( LocationMap[Expected Prefix], LocationMap[Office Location], _Loc ),
        "AltPrefix",
            VAR _Loc = LOOKUPVALUE ( UsersAD[physicalDeliveryOfficeName], UsersAD[UserPrincipalName], Intune[userPrincipalName] )
            RETURN LOOKUPVALUE ( LocationMap[Alternative Prefix], LocationMap[Office Location], _Loc )
    )
VAR _Checked =
    ADDCOLUMNS (
        _Enriched,
        "IsCorrect",
            ( NOT ISBLANK ( [ExpectedPrefix] ) && LEFT ( Intune[deviceName], LEN ( [ExpectedPrefix] ) + 1 ) = [ExpectedPrefix] & "-" )
                || ( NOT ISBLANK ( [AltPrefix] ) && LEFT ( Intune[deviceName], LEN ( [AltPrefix] ) + 1 ) = [AltPrefix] & "-" )
    )
RETURN
    SELECTCOLUMNS (
        FILTER ( _Checked, NOT [IsCorrect] ),
        "Device Name",     Intune[deviceName],
        "Serial Number",   Intune[serialNumber],
        "Primary User",    Intune[userPrincipalName],
        "Office Location", [OfficeLocation],
        "Expected Prefix", [ExpectedPrefix],
        "Expected Name",
            IF ( ISBLANK ( [ExpectedPrefix] ), BLANK (), [ExpectedPrefix] & "-" & Intune[serialNumber] ),
        "Reason",
            SWITCH (
                TRUE (),
                ISBLANK ( Intune[userPrincipalName] ), "No Primary User",
                ISBLANK ( [OfficeLocation] ), "No Office Location",
                ISBLANK ( [ExpectedPrefix] ), "Location not in mapping",
                "Wrong Device Name"
            ),
        "Action",
            IF ( ISBLANK ( [ExpectedPrefix] ), "Re-check", "Update Group Tag" )
    )
```

Vài điểm cần chú ý:

- So sánh **cả dấu `-`** sau prefix: nếu chỉ so `VN-HN`, máy `VN-HNX...` cũng bị coi là đúng.
- Máy **không có primary user** hoặc user **không có location** không thể xác định tên đúng. Giữ lại trong bảng với Action = `Re-check` thay vì loại bỏ, để không "mất" máy khỏi báo cáo.
- Muốn đối chiếu thêm với người dùng thực tế trên Jira Asset, có thể thêm cột `Jira Assigned User` và `Jira Status`, và đánh dấu riêng các máy `In Stock`.

### DAX của mình


```dax
-- WrongNameIntune (bản đang chạy thực tế)

```

## Bước 5-6: Cập nhật Group Tag bằng Graph API

### Xuất danh sách bằng Power Automate

1. **Run a query against a dataset**:

```dax
EVALUATE
FILTER ( WrongNameIntune, WrongNameIntune[Action] = "Update Group Tag" )
```

2. **Create CSV table** → **Create file** lưu vào SharePoint, tên file kèm ngày chạy.

### Gọi Graph API

Với mỗi máy trong CSV:

1. Tìm Autopilot identity theo serial:

```http
GET https://graph.microsoft.com/v1.0/deviceManagement/windowsAutopilotDeviceIdentities?$filter=contains(serialNumber,'{Serial Number}')
```

2. Cập nhật Group Tag:

```http
POST https://graph.microsoft.com/v1.0/deviceManagement/windowsAutopilotDeviceIdentities/{id}/updateDeviceProperties
Content-Type: application/json

{
  "groupTag": "VN-HN"
}
```

Ví dụ khung script PowerShell, chạy bằng App Registration có quyền `DeviceManagementServiceConfig.ReadWrite.All`:

```powershell
Connect-MgGraph -ClientId $ClientId -TenantId $TenantId -CertificateThumbprint $Thumbprint

$Devices = Import-Csv "C:\Rename\WrongName_$(Get-Date -Format yyyyMMdd).csv"
foreach ($d in $Devices) {
    $serial = $d.'Serial Number'
    $tag    = $d.'Expected Prefix'

    $ap = (Invoke-MgGraphRequest -Method GET -Uri "https://graph.microsoft.com/v1.0/deviceManagement/windowsAutopilotDeviceIdentities?`$filter=contains(serialNumber,'$serial')").value
    if ($ap.Count -ne 1) { Write-Warning "$serial : tìm thấy $($ap.Count) bản ghi Autopilot, bỏ qua"; continue }
    if ($ap[0].groupTag -eq $tag) { Write-Host "$serial : tag đã đúng"; continue }

    Invoke-MgGraphRequest -Method POST `
        -Uri "https://graph.microsoft.com/v1.0/deviceManagement/windowsAutopilotDeviceIdentities/$($ap[0].id)/updateDeviceProperties" `
        -Body (@{ groupTag = $tag } | ConvertTo-Json)
    Write-Host "$serial : $($ap[0].groupTag) -> $tag"
}
```

### Script của mình


```powershell
# Update_Autopilot_GroupTag.ps1
# Read CSV -> find Autopilot identity by serial -> update groupTag -> log

```

<div class="callout warn">
  <span>⚠️</span>
  <div><b>Lưu ý</b>Group Tag thường được dùng để tạo dynamic group Autopilot (<code>device.devicePhysicalIds -any _ -eq "[OrderID]:VN-HN"</code>). Đổi tag sẽ làm máy chuyển sang group khác và có thể nhận <b>deployment profile, app và policy khác</b>. Chạy thử trên vài máy pilot và kiểm tra các assignment trước khi chạy hàng loạt.</div>
</div>

## Bước 7: Script đặt tên máy theo Group Tag

Group Tag quyết định tên máy **lúc setup**. Script chạy trong quá trình Autopilot đọc tag và đặt tên theo dạng `<Tag>-<Serial Number>`, ví dụ `VN-HCM-5CG1234ABC`.

Lưu ý khi viết script này:

- Tên máy Windows tối đa **15 ký tự** (giới hạn NetBIOS). `VN-HCM-` đã chiếm 7 ký tự, nên chỉ còn 8 ký tự cho serial. Cần quy tắc cắt serial thống nhất (ví dụ lấy 8 ký tự cuối).
- Loại bỏ ký tự không hợp lệ và khoảng trắng trong serial.
- Máy **đã được setup** sẽ không tự đổi tên khi tag thay đổi. Cần reset/wipe để chạy lại Autopilot, hoặc đổi tên trực tiếp (xem phần dưới).

### Script của mình


```powershell
# Rename_By_GroupTag.ps1
# Read Autopilot Group Tag -> build "<Tag>-<Serial>" -> Rename-Computer

```

### Với máy đang dùng: đổi tên mà không cần setup lại

Với máy **Entra joined**, Intune hỗ trợ đổi tên từ xa bằng action **Rename device**, hoặc qua Graph (endpoint beta):

```http
POST https://graph.microsoft.com/beta/deviceManagement/managedDevices/{managedDeviceId}/setDeviceName
Content-Type: application/json

{
  "deviceName": "VN-HN-5CG1234A"
}
```

Máy cần **restart** để tên mới có hiệu lực. Với máy **Hybrid joined**, đổi tên từ Intune không được hỗ trợ. Hãy đổi tên trên máy khi có kết nối tới domain controller, hoặc để lần setup lại tiếp theo áp dụng tên mới từ Group Tag.

## Các lệnh kiểm tra

```powershell
# Tên máy và serial trên máy
$env:COMPUTERNAME
(Get-CimInstance Win32_BIOS).SerialNumber

# Group Tag hiện tại của máy trong Autopilot (qua Graph)
Get-MgDeviceManagementWindowsAutopilotDeviceIdentity -Filter "contains(serialNumber,'5CG1234ABC')" | Select-Object SerialNumber, GroupTag, AzureActiveDirectoryDeviceId

# Thông tin Autopilot đã tải về máy lúc setup (có Group Tag / OrderID)
Get-Content 'C:\Windows\ServiceState\wmansvc\AutopilotDDSZTDFile.json' -ErrorAction SilentlyContinue | ConvertFrom-Json | Select-Object ZtdCorrelationId, CloudAssignedTenantDomain, DeploymentProfileName
```

## Những lỗi mình đã gặp

| Lỗi | Triệu chứng | Nguyên nhân gốc | Cách xử lý |
|---|---|---|---|
| Location không khớp mapping | Nhiều máy bị Reason "Location not in mapping" | Cùng văn phòng nhưng AD ghi khác nhau (`VP. Phu Nu` / `VP Phu Nu`) | Thêm đủ các biến thể vào bảng mapping |
| Máy đúng bị báo sai | Máy workstation cùng location bị đánh dấu sai | Chỉ kiểm tra một prefix | Thêm cột Alternative Prefix |
| Máy sai bị báo đúng | `VN-HNX...` được coi là `VN-HN` | So prefix không kèm dấu `-` | So `Prefix & "-"` |
| `LOOKUPVALUE` lỗi | Bảng DAX không load | Một UPN có nhiều dòng trong AD | Lọc trùng ở Power Query trước |
| Đổi tag nhưng tên không đổi | Máy vẫn mang tên cũ | Tag chỉ có tác dụng khi setup | Wipe/reset, hoặc Rename device từ Intune |
| Tên máy bị cắt | Tên mới thiếu ký tự cuối serial | Vượt giới hạn 15 ký tự | Cắt serial theo quy tắc cố định trong script |
| Graph tìm thấy nhiều bản ghi | Script bỏ qua máy | Serial bị import Autopilot nhiều lần | Dọn bản ghi trùng trước khi cập nhật |

## Kết luận

Tên máy đúng giúp mọi thứ phía sau đúng theo: group, policy, báo cáo và việc hỗ trợ của Helpdesk. Thay vì sửa tên từng máy, hãy sửa từ gốc là Autopilot Group Tag, để mỗi lần setup máy đều tự đặt tên đúng. Việc nên làm đầu tiên là dựng bảng mapping Location → Prefix và trang Power BI phân loại, chạy vài tuần để làm sạch dữ liệu location trước khi bật cập nhật tự động.

Ở công ty bạn, quy ước đặt tên máy được kiểm soát theo cách nào?

<!--
Phần cuối bài (nút Chia sẻ LinkedIn, Facebook, Copy link, khung tác giả, bài trước/sau)
và Mục lục bên phải được layout tự thêm vào, không cần viết trong file này.
Xem trước trên máy: bundle exec jekyll serve --unpublished (chỉ cần khi bài còn published: false).
-->
