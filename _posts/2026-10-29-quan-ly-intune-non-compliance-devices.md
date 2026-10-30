---
layout: post
title: "Quản lý thiết bị Non-Compliance trên Intune: phân loại nguyên nhân, tự động xử lý và chặn truy cập"
seo_title: "Tự động xử lý Intune Non-Compliance devices"
description: "Kết hợp Intune, SentinelOne, Jira Asset và AD trong Power BI để phân loại máy Non-Compliance, rồi dùng Power Automate và Graph API xóa, wipe hoặc chặn truy cập."
date: 2026-10-29
author: "Tam Nguyen"
reading_time: 12
topic: security
thumb_label: "COMPLIANCE"
tags:
  - Intune
  - Compliance
  - Power BI
  - Power Automate
  - Microsoft Graph
card_tags:
  - Intune
  - Compliance
summary: "Gộp dữ liệu Intune, SentinelOne, Jira Asset, AD để phân loại máy Non-Compliance, rồi tự động xóa, wipe, chặn truy cập và báo user."
redirect_from:
  - /posts/quan-ly-intune-non-compliance-devices.html
---

Mở báo cáo Compliance trong Intune, mình thấy hàng trăm thiết bị **Not compliant**: laptop Windows, MacBook, điện thoại Android và iPhone. Nhìn qua thì tưởng đều là "máy có vấn đề bảo mật". Nhưng khi đào sâu, phần lớn lại là máy đã thanh lý, máy nằm trong kho, máy enroll trùng serial, hoặc máy của nhân viên đã nghỉ việc. Chỉ một phần nhỏ thật sự là máy đang được dùng nhưng không tuân thủ policy. Với môi trường khoảng **2.000 máy tính** cộng thêm thiết bị di động, xử lý từng máy bằng tay là không khả thi. Bài này chia sẻ cách mình phân loại tự động và xử lý theo từng nguyên nhân.

> **Tóm tắt nhanh:** Power BI gộp dữ liệu từ Intune Data Warehouse, SentinelOne, Jira Asset và AD, rồi dùng DAX gán cho mỗi máy một **Reason** và **Action Require**. Power Automate lấy nhóm Delete / Backup&Delete / Wipe ra CSV để chạy Graph API, còn các nhóm còn lại được thêm vào một group bị chặn truy cập tài nguyên công ty, kèm email báo cho user.

## Bối cảnh: vì sao không thể tin hoàn toàn vào Intune

Danh sách Non-Compliance của Intune có ba vấn đề:

- **Last check-in chưa chính xác.** Có máy vẫn đang online nhưng Intune ghi nhận check-in từ nhiều tuần trước.
- **Không biết trạng thái thực tế của máy.** Intune không biết máy đang ở kho, đang chuẩn bị bàn giao hay đã thanh lý.
- **Không biết trạng thái tài khoản.** Primary user có thể đã bị disable trên AD từ lâu.

Vì vậy mình bổ sung thêm ba nguồn dữ liệu để có bức tranh đầy đủ.

| Nguồn | Dùng để làm gì |
|---|---|
| **Intune Data Warehouse** | Danh sách thiết bị, trạng thái compliance, serial, primary user, last check-in |
| **SentinelOne** | Last seen từ agent EDR, dùng để đối chiếu với last check-in của Intune |
| **Jira Asset** | Trạng thái tài sản: `In Use`, `In Stock`, `In Prepare`, `Liquidation`, user đang được gán |
| **AD Computer / User object** | Tài khoản user và máy đang `Enabled` hay `Disabled` |

## Kiến trúc tổng thể

| Bước | Thành phần | Việc làm |
|---|---|---|
| 1 | **Power BI** | Lấy dữ liệu từ 4 nguồn, dùng DAX tạo bảng `NonCompliance` |
| 2 | **DAX** | Gán `Reason` và `Action Require` cho từng máy |
| 3 | **Power Automate (Flow 1)** | Lấy máy có Action = `Delete`, `Backup&Delete`, `Wipe`, xuất CSV |
| 4 | **Graph API** | Backup khóa (nếu cần), rồi delete hoặc wipe thiết bị |
| 5 | **Power Automate (Flow 2)** | Lấy các Action còn lại, thêm thiết bị vào group chặn truy cập |
| 6 | **Intune** | Group đã được assign sẵn cho app/policy thực thi chặn truy cập |
| 7 | **Power Automate (Flow 3)** | Gửi email cho user, hướng dẫn cách khắc phục |

*Hình 1: luồng xử lý từ Power BI đến Intune.*

## Bảng phân loại Reason và Action Require

Đây là phần quan trọng nhất của cả quy trình. Mỗi máy chỉ nhận **một** Reason, theo thứ tự ưu tiên từ trên xuống: điều kiện nào khớp trước thì dừng lại.

| Thứ tự | Reason | Action Require |
|---|---|---|
| 1 | Duplicate serial number (older check-in) | **Delete** |
| 2 | Liquidation | **Delete** |
| 3 | Device already in wipe state | **Delete** |
| 4 | In Stock and Primary User has a new device | **Delete** |
| 5 | In use and inactive for over 90 days | **Backup&Delete** |
| 6 | In stock and inactive for over 30 days | **Wipe** |
| 7 | No Serial Number | **Re-check** |
| 8 | No Primary User | **Re-enroll** |
| 9 | Primary user account disabled | **Re-enroll** |
| 10 | In use and inactive for over 30 days | **Contact User** |
| 11 | Other reasons | **Other** |

Vì sao thứ tự quan trọng? Một máy vừa trùng serial vừa inactive 90 ngày phải được xếp vào nhóm **Delete** (bản ghi cũ, an toàn để xóa), chứ không phải **Backup&Delete**. Tương tự, điều kiện "inactive 90 ngày" phải đứng trước "inactive 30 ngày".

<div class="callout">
  <span>💡</span>
  <div><b>Tip</b>"Inactive" được tính từ <b>last check-in gần nhất</b> giữa Intune và SentinelOne, không chỉ từ Intune. Nhờ vậy, máy vẫn đang online nhưng Intune chưa cập nhật sẽ không bị wipe hay xóa nhầm.</div>
</div>

## Bước 1-2: Tạo bảng phân loại bằng DAX

### Lấy last check-in gần nhất

Ý tưởng là so sánh hai mốc thời gian và lấy mốc mới hơn:

```dax
LastActivity =
VAR _Intune = Intune[lastSyncDateTime]
VAR _S1 =
    LOOKUPVALUE ( S1[Last Active Date], S1[Serial Number], Intune[serialNumber] )
RETURN
    IF ( ISBLANK ( _S1 ) || _Intune >= _S1, _Intune, _S1 )
```

### Bảng NonCompliance hoàn chỉnh

Dưới đây là khung DAX mình dùng. Tên bảng và cột là ví dụ, bạn đổi theo dataset thật:

```dax
NonCompliance =
VAR _Base =
    FILTER ( Intune, Intune[complianceState] = "noncompliant" )
VAR _Enriched =
    ADDCOLUMNS (
        _Base,
        "LastActivity",
            VAR _S1 = LOOKUPVALUE ( S1[Last Active Date], S1[Serial Number], Intune[serialNumber] )
            RETURN IF ( ISBLANK ( _S1 ) || Intune[lastSyncDateTime] >= _S1, Intune[lastSyncDateTime], _S1 ),
        "JiraStatus",
            LOOKUPVALUE ( Jira[Status], Jira[Serial Number], Intune[serialNumber] ),
        "UserEnabled",
            LOOKUPVALUE ( UsersAD[Enabled], UsersAD[UserPrincipalName], Intune[userPrincipalName] ),
        "IsDuplicateOlder",
            VAR _Serial = Intune[serialNumber]
            VAR _Newest =
                CALCULATE ( MAX ( Intune[lastSyncDateTime] ), ALL ( Intune ), Intune[serialNumber] = _Serial )
            RETURN NOT ISBLANK ( _Serial ) && Intune[lastSyncDateTime] < _Newest,
        "UserHasNewDevice",
            VAR _UPN = Intune[userPrincipalName]
            VAR _Me  = Intune[lastSyncDateTime]
            RETURN
                NOT ISBLANK ( _UPN )
                    && CALCULATE ( COUNTROWS ( Intune ), ALL ( Intune ), Intune[userPrincipalName] = _UPN, Intune[lastSyncDateTime] > _Me ) > 0
    )
VAR _Classified =
    ADDCOLUMNS (
        _Enriched,
        "InactiveDays", DATEDIFF ( [LastActivity], TODAY (), DAY ),
        "Reason",
            VAR _Days = DATEDIFF ( [LastActivity], TODAY (), DAY )
            RETURN
                SWITCH (
                    TRUE (),
                    [IsDuplicateOlder], "Duplicate serial number (older check-in)",
                    [JiraStatus] = "Liquidation", "Liquidation",
                    Intune[managementState] IN { "wipePending", "wipeIssued" }, "Device already in wipe state",
                    [JiraStatus] = "In Stock" && [UserHasNewDevice], "In Stock and Primary User has a new device",
                    [JiraStatus] = "In Use" && _Days > 90, "In use and inactive for over 90 days",
                    [JiraStatus] = "In Stock" && _Days > 30, "In stock and inactive for over 30 days",
                    ISBLANK ( Intune[serialNumber] ), "No Serial Number",
                    ISBLANK ( Intune[userPrincipalName] ), "No Primary User",
                    [UserEnabled] = FALSE (), "Primary user account disabled",
                    [JiraStatus] = "In Use" && _Days > 30, "In use and inactive for over 30 days",
                    "Other reasons"
                )
    )
RETURN
    SELECTCOLUMNS (
        _Classified,
        "Device Name",     Intune[deviceName],
        "Intune ID",       Intune[deviceId],
        "Entra Device ID", Intune[azureADDeviceId],
        "Serial Number",   Intune[serialNumber],
        "OS",              Intune[operatingSystem],
        "Primary User",    Intune[userPrincipalName],
        "Jira Status",     [JiraStatus],
        "Last Activity",   [LastActivity],
        "Inactive Days",   [InactiveDays],
        "Reason",          [Reason],
        "Action Require",
            SWITCH (
                [Reason],
                "Duplicate serial number (older check-in)", "Delete",
                "Liquidation", "Delete",
                "Device already in wipe state", "Delete",
                "In Stock and Primary User has a new device", "Delete",
                "In use and inactive for over 90 days", "Backup&Delete",
                "In stock and inactive for over 30 days", "Wipe",
                "No Serial Number", "Re-check",
                "No Primary User", "Re-enroll",
                "Primary user account disabled", "Re-enroll",
                "In use and inactive for over 30 days", "Contact User",
                "Other"
            )
    )
```

### DAX của mình


```dax
-- NonCompliance table (bản đang chạy thực tế)

```

Khi viết DAX cho bài toán này, chú ý:

- `LOOKUPVALUE` sẽ báo lỗi nếu khóa tra cứu bị trùng (ví dụ một serial có hai dòng trong Jira). Hãy lọc trùng ở Power Query trước, hoặc dùng `MAXX(FILTER(...))`.
- Ghi chú thêm cột `Reason` dạng chuỗi rõ ràng để Power Automate lọc và để License/Helpdesk team đọc hiểu ngay.
- Với máy bị loại khỏi kiểm tra (ví dụ máy không thuộc phạm vi), vẫn giữ trong bảng nhưng đặt Action = `Other` kèm lý do, để báo cáo không bị "mất" thiết bị.

## Bước 3-4: Xóa và wipe thiết bị bằng Power Automate và Graph API

### Flow 1: xuất danh sách ra CSV

1. **Recurrence** chạy theo lịch, ví dụ mỗi tuần.
2. **Run a query against a dataset** lấy các dòng có Action là `Delete`, `Backup&Delete` hoặc `Wipe`:

```dax
EVALUATE
FILTER (
    NonCompliance,
    NonCompliance[Action Require] IN { "Delete", "Backup&Delete", "Wipe" }
)
```

3. **Create CSV table** rồi **Create file** lưu vào SharePoint, đặt tên kèm ngày chạy để làm bằng chứng.

### Gọi Graph API

Một PowerShell script (chạy trên server hoặc Azure Automation bằng App Registration có quyền `DeviceManagementManagedDevices.ReadWrite.All` và `DeviceManagementManagedDevices.PrivilegedOperations.All`) đọc CSV và xử lý theo Action:

| Action | Graph API |
|---|---|
| **Delete** | `DELETE /deviceManagement/managedDevices/{id}` |
| **Wipe** | `POST /deviceManagement/managedDevices/{id}/wipe` |
| **Backup&Delete** | Backup BitLocker key (`/informationProtection/bitlocker/recoveryKeys`) và LAPS (`/directory/deviceLocalCredentials`), lưu lại, rồi mới `DELETE` |

```powershell
# Ví dụ khung xử lý - đọc CSV và gọi Graph theo Action
Connect-MgGraph -ClientId $ClientId -TenantId $TenantId -CertificateThumbprint $Thumbprint

$Devices = Import-Csv "C:\NonCompliance\Action_$(Get-Date -Format yyyyMMdd).csv"
foreach ($d in $Devices) {
    $id = $d.'Intune ID'
    switch ($d.'Action Require') {
        'Delete'        { Invoke-MgGraphRequest -Method DELETE -Uri "https://graph.microsoft.com/v1.0/deviceManagement/managedDevices/$id" }
        'Wipe'          { Invoke-MgGraphRequest -Method POST   -Uri "https://graph.microsoft.com/v1.0/deviceManagement/managedDevices/$id/wipe" -Body @{} }
        'Backup&Delete' { <# 1. Backup BitLocker + LAPS  2. Verify backup  3. DELETE #> }
    }
}
```

### Script của mình


```powershell
# NonCompliance_Cleanup.ps1
# Read CSV -> validate -> backup (if needed) -> delete / wipe -> log result

```

<div class="callout danger">
  <span>⛔</span>
  <div><b>Nguy hiểm</b>Delete và Wipe không thể hoàn tác. Trước khi gọi API, script phải kiểm tra lại từng máy: Intune ID còn tồn tại, serial khớp với CSV, last activity vẫn đúng như lúc xuất file. Với <code>Backup&Delete</code>, chỉ xóa khi đã lưu thành công khóa BitLocker và LAPS. Nên chạy chế độ <b>dry-run</b> và gửi danh sách cho người duyệt trước mỗi lần chạy thật.</div>
</div>

## Bước 5-6: Chặn truy cập tài nguyên công ty bằng Group

Các máy thuộc nhóm `Re-enroll`, `Re-check`, `Contact User`, `Other` vẫn đang thuộc về user, nên không xóa mà **chặn truy cập** cho tới khi máy Compliance trở lại.

### Flow 2: thêm thiết bị vào group

1. **Run a query against a dataset** lấy các dòng có Action **không** thuộc nhóm Delete / Backup&Delete / Wipe.
2. Với mỗi thiết bị, gọi Graph API thêm vào group đã được assign sẵn trong Intune:

```http
POST https://graph.microsoft.com/v1.0/groups/{group-id}/members/$ref
Content-Type: application/json

{
  "@odata.id": "https://graph.microsoft.com/v1.0/directoryObjects/{entra-device-object-id}"
}
```

Lưu ý: `{entra-device-object-id}` là **Object ID** của device trong Entra ID, khác với `azureADDeviceId` lấy từ Intune. Cần tra trước bằng `GET /devices?$filter=deviceId eq '{azureADDeviceId}'`.

3. Khi máy Compliance trở lại, flow chạy lần sau sẽ không còn thấy máy đó trong bảng. Thêm một bước **so sánh thành viên group với bảng hiện tại** để gỡ máy ra khỏi group (`DELETE /groups/{group-id}/members/{id}/$ref`).

### Group được dùng để làm gì

Group này được assign sẵn cho một Intune app/policy thực thi việc chặn truy cập, ví dụ gỡ chứng chỉ dùng cho Wi-Fi/VPN nội bộ, nên máy không kết nối được vào mạng công ty. Khi máy ra khỏi group, chứng chỉ được cấp lại.


```powershell
# Block_Access.ps1 - Intune app assigned to Non-Compliance group

```

<div class="callout warn">
  <span>⚠️</span>
  <div><b>Lưu ý</b>Chặn truy cập sẽ ảnh hưởng trực tiếp tới công việc của user. Hãy gửi email báo trước một khoảng thời gian, loại trừ các nhóm thiết bị đặc biệt (máy của lãnh đạo, máy dùng cho hệ thống quan trọng), và có quy trình mở chặn nhanh qua Helpdesk.</div>
</div>

## Bước 7: Gửi email cho user

Flow 3 gom theo `Primary User`, mỗi user chỉ nhận **một** email liệt kê các thiết bị và việc họ cần làm. Nội dung email thay đổi theo Action:

| Action | User cần làm |
|---|---|
| **Contact User** | Bật máy, kết nối mạng và mở Company Portal để đồng bộ |
| **Re-enroll** | Liên hệ Helpdesk để enroll lại thiết bị |
| **Re-check** | Liên hệ Helpdesk để kiểm tra lại thông tin thiết bị |
| **Other** | Đọc lý do Non-Compliance trong Company Portal và khắc phục |

```text
Subject: [IT Notice] Thiết bị {Device Name} không tuân thủ chính sách bảo mật

Chào anh/chị {User Name},

Thiết bị {Device Name} (Serial: {Serial Number}) đang ở trạng thái
Non-Compliance. Lý do: {Reason}.

Để tiếp tục truy cập tài nguyên công ty, vui lòng:
{Hướng dẫn theo Action}

Nếu không khắc phục trước ngày {Deadline}, thiết bị sẽ bị chặn truy cập
mạng nội bộ cho đến khi tuân thủ chính sách.

Trân trọng,
IT Team
```


## Các lệnh kiểm tra trên thiết bị

### Windows

```powershell
# Ép đồng bộ với Intune
Get-ScheduledTask | Where-Object TaskName -eq 'PushLaunch' | Start-ScheduledTask

# Trạng thái join Entra ID / MDM
dsregcmd /status | Select-String 'AzureAdJoined|DomainJoined|DeviceId|MdmUrl'

# Log của Intune Management Extension
Get-Content 'C:\ProgramData\Microsoft\IntuneManagementExtension\Logs\IntuneManagementExtension.log' -Tail 50

# Serial number
(Get-CimInstance Win32_BIOS).SerialNumber
```

### macOS

```bash
# Profile MDM đã cài
sudo profiles show -type enrollment
profiles list -all | grep -i -E "mdm|intune"

# Serial number
system_profiler SPHardwareDataType | grep Serial
```

### Kiểm tra từ Intune bằng Graph

```powershell
# Danh sách máy Non-Compliance kèm last sync
Get-MgDeviceManagementManagedDevice -Filter "complianceState eq 'noncompliant'" -All |
  Select-Object DeviceName, SerialNumber, OperatingSystem, UserPrincipalName, LastSyncDateTime
```

## Những lỗi mình đã gặp

| Lỗi | Triệu chứng | Nguyên nhân gốc | Cách xử lý |
|---|---|---|---|
| Xếp nhầm máy đang dùng vào nhóm Wipe | Máy vẫn online nhưng bị đánh dấu inactive | Chỉ dùng last check-in của Intune | Lấy mốc gần nhất giữa Intune và SentinelOne |
| `LOOKUPVALUE` báo lỗi | Bảng DAX không load được | Serial bị trùng trong Jira hoặc S1 | Lọc trùng trước, hoặc dùng `MAXX(FILTER(...))` |
| Một máy rơi vào nhiều nhóm | Báo cáo đếm sai | Thứ tự điều kiện trong `SWITCH` không đúng | Sắp xếp theo mức ưu tiên: Delete trước, inactive 90 trước 30 |
| Thêm device vào group thất bại | Graph trả lỗi 404 | Dùng `azureADDeviceId` thay cho Object ID | Tra Object ID bằng `/devices?$filter=deviceId eq '...'` |
| Bảng thiếu máy Jira `In Stock` không có user | Máy không hiện trong danh sách cần xử lý | Lọc `ISBLANK` loại luôn các dòng đó | Giữ lại, gán Reason `No Assigned User` hoặc `Other` |
| Flow Power Automate chạy quá lâu | Timeout hoặc throttling | Một flow lớn xử lý tất cả | Tách thành nhiều flow nhỏ theo Action, thêm delay giữa các request Graph |

## Kết luận

Danh sách Non-Compliance trong Intune chỉ là điểm bắt đầu. Khi gộp thêm SentinelOne, Jira Asset và AD, bạn biết được máy nào cần xóa, máy nào cần wipe, và máy nào chỉ cần nhắc user. Hãy bắt đầu bằng bảng phân loại trong Power BI và để nó chạy vài tuần ở chế độ **chỉ báo cáo**, trước khi bật Delete, Wipe và chặn truy cập.

Bạn đang xử lý thiết bị Non-Compliance theo cách nào: chặn bằng Conditional Access, gỡ chứng chỉ, hay dọn dẹp định kỳ bằng tay?

<!--
Phần cuối bài (nút Chia sẻ LinkedIn, Facebook, Copy link, khung tác giả, bài trước/sau)
và Mục lục bên phải được layout tự thêm vào, không cần viết trong file này.
Xem trước trên máy: bundle exec jekyll serve --unpublished (chỉ cần khi bài còn published: false).
-->
