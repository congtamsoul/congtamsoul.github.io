layout: post
title: "Tự động vá máy Windows bị tụt patch: Power BI phân loại, Power Automate gom group, Intune cài update"
seo_title: "Tự động vá máy Windows outdated bằng Intune"
description: "So sánh OS build từng máy từ Intune Data Warehouse với bảng Patch Tuesday trong Power BI, rồi Power Automate và Graph API đưa máy outdated vào group để Intune tự cài update."
date: 2026-10-29
author: "Tam Nguyen"
reading_time: 10
topic: windows
thumb_label: "PATCH COMPLIANCE"
tags:
  - Windows Update
  - Intune
  - Power BI
  - Power Automate
  - Microsoft Graph
card_tags:
  - Windows Update
  - Intune
summary: "Xác định máy Windows tụt bao nhiêu tháng patch bằng Power BI, rồi tự động đưa vào group để Intune chạy Install-WindowsUpdate."
redirect_from:
  - /posts/auto-fix-windows-outdated-os-version.html
---

Thứ Ba của tuần thứ hai mỗi tháng, Microsoft phát hành bản cumulative update mới cho Windows (*Patch Tuesday*). Update Ring trên Intune đã cấu hình deadline, WSUS đã approve, vậy mà một tuần sau mở báo cáo vẫn thấy hàng trăm máy đứng ở build của tháng trước, thậm chí của ba, bốn tháng trước. Với khoảng **2.000 máy Windows**, câu hỏi không chỉ là "máy nào chưa update", mà là **máy nào đang tụt bao nhiêu tháng** để ưu tiên xử lý. Bài này chia sẻ cách mình tự động hóa toàn bộ quy trình: phát hiện, phân loại, rồi để Intune tự vá.

> **Tóm tắt nhanh:** Power BI lấy OS version của từng máy từ Intune Data Warehouse, so với bảng Excel Online tổng hợp build theo từng tháng patch, rồi DAX tính máy đang ở tháng nào và tụt bao nhiêu tháng. Power Automate lấy danh sách máy outdated và dùng Graph API thêm vào một group. Group này đã được assign cho Intune app chạy `Install-WindowsUpdate`.

## Bối cảnh: vì sao Update Ring thôi là chưa đủ

Update Ring và WSUS xử lý tốt phần lớn máy. Phần còn lại thường bị kẹt vì:

- **Pending reboot** từ lần update trước, khiến bản mới fail với lỗi `0x80240016`.
- **Máy ít bật**: user mở máy vài tiếng rồi tắt, không đủ thời gian tải và cài.
- **Component store lỗi**, bản vá fail lặp lại mỗi tháng.
- **Máy đã lên phiên bản mới** (ví dụ 25H2) nhưng WSUS chưa approve product tương ứng, nên scan ra "found 0 updates".

Báo cáo mặc định của Intune chỉ cho biết OS version, không cho biết version đó thuộc tháng patch nào. Vì vậy mình tự xây phần phân loại.

## Kiến trúc tổng thể

| Bước | Thành phần | Việc làm |
|---|---|---|
| 1 | **Excel Online** | Bảng tổng hợp build theo từng tháng patch, cập nhật mỗi Patch Tuesday |
| 2 | **Intune Data Warehouse** | Nguồn OS version, last sync, primary user của từng máy |
| 3 | **Power BI + DAX** | So sánh version, xác định tháng patch và số tháng bị tụt |
| 4 | **Power Automate** | Lấy danh sách máy outdated từ dataset |
| 5 | **Graph API** | Thêm máy vào group `Windows Outdated` |
| 6 | **Intune Win32 app** | Assign cho group, chạy script `Install-WindowsUpdate` |
| 7 | **Power BI** | Theo dõi máy ra khỏi danh sách sau mỗi chu kỳ |

*Hình 1: luồng xử lý từ Power BI đến Intune.*

## Bước 1: Hiểu cấu trúc OS version

Intune trả về OS version dạng `10.0.26100.6899`. Hai phần cuối mới quan trọng:

| Phần | Ví dụ | Ý nghĩa |
|---|---|---|
| Build | `26100` | Phiên bản Windows: `26100` = 24H2, `26200` = 25H2 |
| UBR | `6899` | *Update Build Revision*: tăng sau mỗi bản cumulative update |

Chỉ so sánh chuỗi là sai, vì `"10.0.26100.999"` > `"10.0.26100.6899"` theo thứ tự chữ cái. Cần tách `Build` và `UBR` ra thành số.

Vì 24H2 và 25H2 dùng chung codebase, cùng một bản patch tháng thường có **cùng số UBR** trên cả hai build. Dù vậy, mình vẫn lưu từng cặp `Build + UBR` riêng trong bảng để tránh nhầm.

### Bảng Patch Catalog (Excel Online)

| OS | Build | UBR | Full Version | Patch Month | Release Date | Type |
|---|---|---|---|---|---|---|
| Windows 11 25H2 | 26200 | xxxx | 10.0.26200.xxxx | 2026-10 | 2026-10-13 | B (Security) |
| Windows 11 24H2 | 26100 | xxxx | 10.0.26100.xxxx | 2026-10 | 2026-10-13 | B (Security) |
| Windows 11 24H2 | 26100 | xxxx | 10.0.26100.xxxx | 2026-09 | 2026-09-08 | B (Security) |

Nguồn để điền bảng này là trang **Windows release health** của Microsoft. Mỗi tháng chỉ cần thêm vài dòng.

<div class="callout">
  <span>💡</span>
  <div><b>Tip</b>Ghi rõ cột <code>Type</code>: bản B (Patch Tuesday) và bản D (preview cuối tháng) có UBR khác nhau. Máy cài bản preview sẽ có UBR cao hơn bản B, nên khi tra tháng patch, hãy lấy bản B gần nhất có UBR ≤ UBR của máy.</div>
</div>

## Bước 2-3: Phân loại máy outdated bằng DAX

### Cột tính toán trên bảng Intune

```dax
Build =
VALUE ( PATHITEM ( SUBSTITUTE ( Intune[osVersion], ".", "|" ), 3 ) )

UBR =
VALUE ( PATHITEM ( SUBSTITUTE ( Intune[osVersion], ".", "|" ), 4 ) )
```

### Bảng WindowsPatchStatus

```dax
WindowsPatchStatus =
VAR _LatestRelease =
    MAX ( PatchCatalog[Release Date] )
VAR _Windows =
    FILTER ( Intune, Intune[operatingSystem] = "Windows" )
VAR _Classified =
    ADDCOLUMNS (
        _Windows,
        "CurrentPatchDate",
            VAR _B = Intune[Build]
            VAR _U = Intune[UBR]
            RETURN
                MAXX (
                    FILTER ( PatchCatalog,
                        PatchCatalog[Build] = _B
                            && PatchCatalog[UBR] <= _U
                            && PatchCatalog[Type] = "B (Security)" ),
                    PatchCatalog[Release Date]
                ),
        "LatestUBR",
            VAR _B = Intune[Build]
            RETURN
                MAXX (
                    FILTER ( PatchCatalog,
                        PatchCatalog[Build] = _B
                            && PatchCatalog[Type] = "B (Security)" ),
                    PatchCatalog[UBR]
                )
    )
RETURN
    SELECTCOLUMNS (
        _Classified,
        "Device Name",     Intune[deviceName],
        "Entra Device ID", Intune[azureADDeviceId],
        "Primary User",    Intune[userPrincipalName],
        "OS Version",      Intune[osVersion],
        "Last Sync",       Intune[lastSyncDateTime],
        "Patch Month",
            IF ( ISBLANK ( [CurrentPatchDate] ), "Unknown", FORMAT ( [CurrentPatchDate], "YYYY-MM" ) ),
        "Months Behind",
            IF ( ISBLANK ( [CurrentPatchDate] ), BLANK (),
                DATEDIFF ( [CurrentPatchDate], _LatestRelease, MONTH ) ),
        "Status",
            SWITCH (
                TRUE (),
                ISBLANK ( [LatestUBR] ), "Unsupported Build",
                Intune[UBR] >= [LatestUBR], "Up to date",
                DATEDIFF ( Intune[lastSyncDateTime], TODAY (), DAY ) > 30, "Outdated - Inactive",
                DATEDIFF ( [CurrentPatchDate], _LatestRelease, MONTH ) >= 3, "Outdated - Critical",
                "Outdated"
            )
    )
```

### Ý nghĩa các Status

| Status | Điều kiện | Xử lý |
|---|---|---|
| **Up to date** | UBR ≥ UBR mới nhất của build đó | Không làm gì |
| **Outdated** | Tụt 1-2 tháng, máy vẫn sync | Thêm vào group để tự vá |
| **Outdated - Critical** | Tụt từ 3 tháng trở lên | Thêm vào group, Helpdesk theo dõi riêng |
| **Outdated - Inactive** | Không sync quá 30 ngày | Không thêm vào group, chuyển sang quy trình Non-Compliance |
| **Unsupported Build** | Build không có trong Patch Catalog (ví dụ 23H2 đã hết hỗ trợ) | Cần feature update, không phải quality update |

Cần tách riêng hai nhóm cuối vì:
- Máy **Inactive** không check-in thì có thêm vào group cũng không chạy được app.
- Máy **Unsupported Build** cần nâng cấp phiên bản, `Install-WindowsUpdate` không xử lý được.

### DAX của mình


```dax
-- WindowsPatchStatus (bản đang chạy thực tế)

```

## Bước 4-5: Power Automate đưa máy outdated vào group

### Flow

1. **Recurrence**: chạy hằng ngày, bắt đầu từ khoảng 7 ngày sau Patch Tuesday để Update Ring có thời gian tự xử lý trước.
2. **Run a query against a dataset**:

```dax
EVALUATE
FILTER (
    WindowsPatchStatus,
    WindowsPatchStatus[Status] IN { "Outdated", "Outdated - Critical" }
)
```

3. **Apply to each** máy:
   - Tra **Object ID** của device trong Entra ID:

```http
GET https://graph.microsoft.com/v1.0/devices?$filter=deviceId eq '{Entra Device ID}'&$select=id
```

   - Thêm vào group:

```http
POST https://graph.microsoft.com/v1.0/groups/{group-id}/members/$ref
Content-Type: application/json

{
  "@odata.id": "https://graph.microsoft.com/v1.0/directoryObjects/{object-id}"
}
```

4. **Dọn group**: lấy danh sách thành viên hiện tại, máy nào đã `Up to date` thì gỡ ra:

```http
DELETE https://graph.microsoft.com/v1.0/groups/{group-id}/members/{object-id}/$ref
```

Gọi Graph từ Power Automate bằng action **HTTP with Microsoft Entra ID** hoặc HTTP + App Registration có quyền `GroupMember.ReadWrite.All` và `Device.Read.All`.

<div class="callout warn">
  <span>⚠️</span>
  <div><b>Lưu ý</b>Thêm một máy đã có trong group, Graph sẽ trả lỗi <code>400</code> ("One or more added object references already exist"). Hãy cấu hình <b>Configure run after</b> để flow không dừng ở lỗi này, hoặc kiểm tra thành viên trước khi thêm. Thêm delay ngắn giữa các request để tránh throttling.</div>
</div>

### Flow của mình


```text
# Power Automate - Outdated Windows -> Add to Group

```

## Bước 6: Intune app chạy Install-WindowsUpdate

### Thiết kế script

Script đóng gói thành **Win32 app**, không dùng Platform script vì Platform script có timeout 30 phút, không đủ cho tải và cài update. Luồng xử lý:

1. Kiểm tra **pending reboot**. Nếu đang chờ, thoát với `exit 3010` để Intune xử lý reboot trước.
2. Cài module **PSWindowsUpdate** nếu chưa có.
3. Scan và cài update, bỏ qua feature upgrade:

```powershell
Get-WindowsUpdate -MicrosoftUpdate -AcceptAll -Install -IgnoreReboot -NotCategory "Upgrades" -Verbose
```

4. Kiểm tra cột `Result` của **từng** update. Nếu có `Failed`, ghi mã lỗi ra log và trả exit code lỗi.
5. Nếu cần reboot, trả `3010`.

### Script của mình


```powershell
###################################################################
# Windows_Patch_Remediation.ps1
# Intune Win32 app - SYSTEM context, 64-bit PowerShell
# Pending reboot check -> PSWindowsUpdate -> verify result -> exit code
###################################################################

```

### Detection script

Detection nên kiểm tra **UBR của máy đã đạt mức tối thiểu** của tháng patch hiện tại. Không nên dựa vào file log hay registry do chính script tạo ra, vì chạy xong chưa chắc đã cài thành công.


```powershell
# Detection - exit 0 + STDOUT khi UBR >= mức tối thiểu
# $MinUBR cập nhật mỗi tháng theo Patch Catalog

```

### Cấu hình Win32 app

| Mục | Giá trị |
|---|---|
| Install command | `%windir%\sysnative\WindowsPowerShell\v1.0\powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Windows_Patch_Remediation.ps1` |
| Install behavior | System |
| Device restart behavior | Determine behavior based on return codes |
| Return codes | `0` Success, `3010` Soft reboot, `1` Failed |
| Assignment | **Required** cho group `Windows Outdated` |

<div class="callout danger">
  <span>⛔</span>
  <div><b>Nguy hiểm</b>Không bỏ qua pending reboot bằng cách xóa key <code>RebootPending</code> hoặc <code>PendingFileRenameOperations</code>. Làm vậy chỉ che trạng thái chờ reboot, có thể làm hỏng component store và khiến máy fail update ở những tháng tiếp theo.</div>
</div>

## Các lệnh kiểm tra trên máy

```powershell
# OS version và UBR
Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion' | Select-Object DisplayVersion, CurrentBuild, UBR

# Pending reboot
Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending'
Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired'

# Lịch sử update fail
Get-WUHistory -Last 50 | Where-Object Result -eq 'Failed' | Select-Object Date, Title, KB

# Event log của Windows Update
Get-WinEvent -LogName Microsoft-Windows-WindowsUpdateClient/Operational -MaxEvents 50 | Select-Object TimeCreated, Id, LevelDisplayName, Message

# Log của Intune Management Extension (kết quả chạy Win32 app)
Get-Content 'C:\ProgramData\Microsoft\IntuneManagementExtension\Logs\AppWorkload.log' -Tail 100
```

## Những lỗi mình đã gặp

| Lỗi | Triệu chứng | Nguyên nhân gốc | Cách xử lý |
|---|---|---|---|
| So sánh version sai | Máy mới bị báo outdated | So sánh chuỗi `osVersion` | Tách `Build` và `UBR` thành số |
| Máy cài bản preview bị báo sai tháng | Patch Month trống | Tra UBR chính xác thay vì "≤" | Lấy bản B gần nhất có UBR ≤ UBR máy |
| Máy 25H2 báo Unsupported Build | Cả loạt máy mới nâng cấp bị đánh dấu | Patch Catalog chưa có dòng cho build `26200` | Thêm dòng cho mỗi build đang hỗ trợ |
| `0x80240016` | App chạy nhưng update fail | Máy đang pending reboot | Script trả `3010` khi có pending reboot |
| Script báo thành công nhưng UBR không đổi | Detection fail lặp lại | Update mới được stage, chưa reboot | Trả `3010`, detection dựa trên UBR |
| Found 0 updates | Máy outdated nhưng không có gì để cài | WSUS chưa approve product của phiên bản mới | Sync và approve product, hoặc scan từ Microsoft Update |
| Graph trả 404 khi thêm vào group | Flow fail | Dùng `azureADDeviceId` thay cho Object ID | Tra Object ID trước khi thêm |

## Kết luận

Update Ring vá được phần lớn máy, còn quy trình này lo phần còn lại. Khi biết chính xác máy nào đang ở tháng patch nào, bạn có thể ưu tiên xử lý máy tụt nhiều tháng và tách riêng máy cần feature update. Bước đầu tiên nên làm là dựng bảng Patch Catalog và trang Power BI phân loại, chạy vài chu kỳ ở chế độ chỉ báo cáo, rồi mới bật flow thêm máy vào group.

Ở công ty bạn, sau Patch Tuesday bao lâu thì tỷ lệ máy được vá đạt mục tiêu?

<!--
Phần cuối bài (nút Chia sẻ LinkedIn, Facebook, Copy link, khung tác giả, bài trước/sau)
và Mục lục bên phải được layout tự thêm vào, không cần viết trong file này.
Xem trước trên máy: bundle exec jekyll serve --unpublished (chỉ cần khi bài còn published: false).
-->
