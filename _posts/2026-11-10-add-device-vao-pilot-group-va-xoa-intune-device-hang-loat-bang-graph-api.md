---
layout: post
title: "Add device vào Pilot Group và xóa Intune device hàng loạt bằng Graph API"
seo_title: "Add/Remove Intune device pilot group bằng Graph API"
description: "Cách add hàng loạt device vào Entra cloud group để pilot Intune policy, app và xóa Intune device bằng Graph API, PowerShell và file CSV, không cần click tay."
date: 2026-11-10
author: "Tam Nguyen"
reading_time: 8
topic: m365
thumb_label: "INTUNE + GRAPH API"
image: /images/photo/30.jpg
tags:
  - Microsoft 365
  - Intune
  - Graph API
  - PowerShell
  - Entra ID
card_tags:
  - Intune
  - Graph API
summary: "Add hàng chục device vào pilot group và xóa Intune device chỉ với 1 file CSV và Graph API token, không cần click tay trên portal."
redirect_from:
  - /posts/intune-pilot-group-add-remove-device-graph-api.html
---

Mỗi lần triển khai một **Configuration profile**, một policy mới, một app hay một đợt **Uninstall apps** trên Intune, mình đều không bao giờ assign thẳng cho All Devices. Quy trình luôn là: tạo một group nhỏ, add vài chục máy pilot, theo dõi vài ngày rồi mới mở rộng. Vấn đề là danh sách pilot thay đổi liên tục — hôm nay 20 máy Windows của team IT, mai thêm 30 máy của phòng ban khác — và add từng device trên Entra portal thì vừa chậm vừa dễ sót.

**Tóm tắt nhanh:** chuẩn bị file CSV gồm `Device Name` và `EntraID`, lấy access token từ Graph Explorer, chạy script PowerShell để add device vào Entra cloud assign group qua Graph API. Script tự bỏ qua máy đã là member, retry khi bị throttling và xuất file kết quả. Xóa Intune device cũng làm tương tự với action `delete`.

## Bối cảnh: vì sao cần pilot group

Trong môi trường quản lý Intune, devices, Microsoft 365 và Windows Server, mỗi thay đổi đều có thể ảnh hưởng hàng nghìn máy. Pilot group giúp:

- **Giảm rủi ro** — lỗi policy, app cài fail hay uninstall nhầm chỉ ảnh hưởng một nhóm nhỏ.
- **Kiểm chứng thực tế** — xem report, log trên máy thật trước khi apply all.
- **Rollback nhanh** — chỉ cần remove device khỏi group hoặc unassign.

Vì vậy mình thường có nhiều group kiểu `VN.Group.CongTam`, dạng **Assigned (cloud group)**, không phải Dynamic. Cái cần là một cách **add/remove member nhanh, lặp lại được**, chỉ cần sửa file CSV.

#### Vì sao không dùng portal hay Dynamic group

Portal chỉ phù hợp vài máy. Dynamic group thì phụ thuộc rule thuộc tính, không phù hợp khi danh sách pilot là chọn tay theo người dùng cụ thể.

## Chuẩn bị: token và file CSV

### Lấy access token từ Graph Explorer

1. Mở [Graph Explorer](https://developer.microsoft.com/graph/graph-explorer) và đăng nhập bằng tài khoản admin.
2. Ở tab **Modify permissions**, consent các quyền cần thiết: `GroupMember.ReadWrite.All`, `Device.Read.All`, `DeviceManagementManagedDevices.ReadWrite.All` (cho phần delete).
3. Chạy một query bất kỳ (ví dụ `GET https://graph.microsoft.com/v1.0/me`), mở tab **Access token** và copy token.
4. Lưu token vào `C:\Temp\IntuneToken.txt`.

> **Lưu ý:** token chỉ sống khoảng 1 giờ. Đây là token của chính bạn, không lưu lâu, không commit lên Git, xóa file sau khi chạy xong.

### File CSV danh sách device

File `C:\Temp\DevicesToAdd.csv`:

```csv
Device Name,EntraID
VN-WIN-PC001,1a2b3c4d-xxxx-xxxx-xxxx-xxxxxxxxxxxx
VN-WIN-PC002,5e6f7a8b-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

Cột `EntraID` có thể là **Entra Object ID** hoặc **Device ID** — script tự nhận diện.

<table>
<tr><th>ID</th><th>Lấy ở đâu</th><th>Ghi chú</th></tr>
<tr><td>Entra Object ID</td><td>Entra admin center → Devices → Object ID</td><td>Dùng trực tiếp để add member</td></tr>
<tr><td>Entra Device ID</td><td>Intune → device → Hardware → Azure AD Device ID</td><td>Script tự tra ra Object ID</td></tr>
<tr><td>Intune Device ID</td><td>Intune → device → Device ID (managedDevice id)</td><td>Chỉ dùng cho phần delete</td></tr>
</table>

## Add device vào Cloud Assign Group bằng Graph API

Script làm 3 việc chính:

1. **Resolve group** theo `displayName`, dừng nếu không tìm thấy, bị trùng tên hoặc là Dynamic group.
2. **Load member hiện có** vào `HashSet` (có xử lý phân trang `@odata.nextLink`) để không add trùng.
3. **Xử lý từng device**: thử tra theo Object ID, nếu không được thì fallback sang `deviceId`, sau đó `POST /groups/{id}/members/$ref`.

Hàm `Invoke-Graph` tự retry khi gặp **429/503 (throttling)** với thời gian chờ tăng dần, rất hữu ích khi add vài trăm máy.

Kết quả xuất ra `C:\Temp\EntraAddToGroup_Result.csv` với các trạng thái: `Added`, `Already member`, `Skipped - Not found in Entra ID`, `Error - ...`, kèm bảng thống kê cuối cùng.

> **Mẹo:** dòng lọc OS đang được comment. Bỏ comment nếu group chỉ dành cho macOS, hoặc đổi `'mac'` thành `'windows'` cho group Windows.

## Xóa Intune device bằng Graph API

Với những máy đã nghỉ (retired), đổi máy hoặc bị trùng record, mình dọn bằng action `delete` qua endpoint beta:

```http
POST https://graph.microsoft.com/beta/deviceManagement/managedDevices/executeAction
```

```json
{ "actionName": "delete", "deviceIds": ["<Intune Device ID>"] }
```

File `C:\Temp\DevicesToRemove.csv` cần cột `DeviceID` (**Intune Device ID**, không phải Entra ID), cùng với `Device Name` và `Primary user UPN` để log dễ đọc.

> **Cảnh báo:** đây là thao tác xóa record trên Intune, không phải remove khỏi group. Luôn chạy thử với 1-2 máy và kiểm tra kỹ CSV trước.

## Quy trình pilot mình đang dùng

1. Tạo cloud group pilot, assign profile/app/uninstall script vào group.
2. Cập nhật `DevicesToAdd.csv` → chạy script Add.
3. Theo dõi trạng thái trên Intune 2-3 ngày.
4. Ổn định → mở rộng assign; có lỗi → xử lý trên nhóm nhỏ.
5. Dọn record device cũ bằng script Delete khi cần.

## Những lỗi mình đã gặp

- **401 Unauthorized** — token hết hạn hoặc file token còn chữ `******` hoặc dấu xuống dòng. Script Add đã dùng `Trim()` và bỏ tiền tố `Bearer`; script Delete nên làm tương tự.
- **403 Forbidden** — chưa consent đủ quyền trong Graph Explorer, hoặc tài khoản không có role phù hợp (Intune Administrator / Groups Administrator).
- **Group is Dynamic** — không thể add member thủ công vào Dynamic group, phải dùng Assigned group.
- **Not found in Entra ID** — nhầm Intune Device ID với Entra ID, hoặc máy đã bị xóa khỏi Entra.
- **Delete không có tác dụng** — đưa Entra ID vào cột `DeviceID` thay vì Intune Device ID.

## Kết luận

Với một file CSV và một access token, việc add device vào pilot group hay dọn Intune device chỉ còn vài giây thay vì hàng chục phút click tay. Quan trọng hơn, kết quả có log và file CSV để đối chiếu. Hãy thử chuẩn bị một pilot group cho đợt deploy tiếp theo và chạy script với vài máy trước.

Bạn đang quản lý pilot group trên Intune theo cách nào — portal, Dynamic group hay script? Chia sẻ ở phần bình luận nhé.

## Full script

### Script Add device vào Entra cloud group

```powershell
##########################
# Add devices (Entra Object ID or Device ID) to Entra cloud group
# Group: Cloud Assign Group
##########################

$GetDevices = Import-Csv "C:\Temp\DevicesToAdd.csv" # Column: EntraID, Device Name
$serverUrl  = "https://graph.microsoft.com"
$userToken  = (Get-Content -Path 'C:\Temp\IntuneToken.txt' -Raw).Trim() -replace '^Bearer\s+', ''
$groupName  = "VN.Group.CongTam"
$Headers    = @{ 'Authorization' = "******" }

#region Helper - Graph call with retry on throttling (429/503)
function Invoke-Graph {
    param([string]$Uri, [string]$Method = 'GET', [string]$Body)
    for ($i = 1; $i -le 5; $i++) {
        try {
            $Params = @{ Uri = $Uri; Headers = $Headers; Method = $Method; ContentType = "application/json" }
            if ($Body) { $Params.Body = $Body }
            return Invoke-RestMethod @Params -ErrorAction Stop
        }
        catch {
            $code = $_.Exception.Response.StatusCode.value__
            if ($code -in 429, 503 -and $i -lt 5) { Start-Sleep -Seconds ($i * 5) } else { throw }
        }
    }
}
#endregion

Start-Transcript "C:\Temp\EntraAddToGroup.txt" -Force

#region 1. Resolve group ID
$group = (Invoke-Graph -Uri "$serverUrl/v1.0/groups?`$filter=displayName eq '$groupName'&`$select=id,groupTypes").value
if (-not $group -or $group.Count -ne 1) { Write-Host "Group '$groupName' not found or duplicated." -ForegroundColor Red; Stop-Transcript; return }
if ($group.groupTypes -contains 'DynamicMembership') { Write-Host "Group is Dynamic - cannot add members." -ForegroundColor Red; Stop-Transcript; return }
$groupId = $group.id
Write-Host "Group: $groupName ($groupId)" -ForegroundColor Cyan
#endregion

#region 2. Load existing device members
$existing = New-Object 'System.Collections.Generic.HashSet[string]'
$uri = "$serverUrl/v1.0/groups/$groupId/members/microsoft.graph.device?`$select=id&`$top=999"
while ($uri) {
    $resp = Invoke-Graph -Uri $uri
    $resp.value | ForEach-Object { [void]$existing.Add($_.id) }
    $uri = $resp.'@odata.nextLink'
}
Write-Host "Existing device members: $($existing.Count)" -ForegroundColor Cyan
#endregion

#region 3. Process each device
$Result = foreach ($Device in $GetDevices) {
    $inputId = "$($Device.EntraID)".Trim()
    $entra = $null; $idType = ""; $status = ""
    Write-Host "Processing $($Device.'Device Name') - EntraID: $inputId" -ForegroundColor Yellow
    try {
        # 3.1 Try as Object ID
        try {
            $entra  = Invoke-Graph -Uri "$serverUrl/v1.0/devices/$($inputId)?`$select=id,deviceId,displayName,operatingSystem"
            $idType = "ObjectId"
        } catch {
            # 3.2 Fallback: treat as Device ID
            $entra = (Invoke-Graph -Uri "$serverUrl/v1.0/devices?`$filter=deviceId eq '$inputId'&`$select=id,deviceId,displayName,operatingSystem").value | Select-Object -First 1
            if ($entra) { $idType = "DeviceId" }
        }

        if (-not $entra) { $status = "Skipped - Not found in Entra ID" }
        #elseif ($entra.operatingSystem -notmatch 'mac') { $status = "Skipped - OS is $($entra.operatingSystem)" }
        elseif ($existing.Contains($entra.id)) { $status = "Already member" }
        else {
            # 3.3 Add to group
            $BodyJSON = @{ "@odata.id" = "$serverUrl/v1.0/directoryObjects/$($entra.id)" } | ConvertTo-Json
            Invoke-Graph -Uri "$serverUrl/v1.0/groups/$groupId/members/`$ref" -Method 'POST' -Body $BodyJSON | Out-Null
            [void]$existing.Add($entra.id)
            $status = "Added"
        }
    }
    catch {
        $msg = if ($_.ErrorDetails.Message) { ($_.ErrorDetails.Message | ConvertFrom-Json).error.message } else { $_.Exception.Message }
        $status = if ($msg -match 'already exist') { "Already member" } else { "Error - $msg" }
    }

    $color = switch -Wildcard ($status) { "Added" {"Green"} "Error*" {"Red"} default {"Gray"} }
    Write-Host " -> [$idType] $status" -ForegroundColor $color

    [PSCustomObject]@{
        DeviceName    = $Device.'Device Name'
        InputID       = $inputId
        IdType        = $idType
        EntraObjectId = $entra.id
        EntraDeviceId = $entra.deviceId
        OS            = $entra.operatingSystem
        Status        = $status
    }
}
#endregion

$Result | Export-Csv "C:\Temp\EntraAddToGroup_Result.csv" -NoTypeInformation -Encoding UTF8
$Result | Group-Object Status | Select-Object Name, Count | Format-Table -AutoSize
Stop-Transcript
```

### Script xóa Intune device

```powershell
##########################
# Delete Intune managed devices via Graph API
##########################

$GetDevices = Import-Csv "C:\Temp\DevicesToRemove.csv" # Column: DeviceID (Intune ID), Device Name, Primary user UPN
$serverUrl  = "https://graph.microsoft.com"
$userToken  = Get-Content -Path 'C:\Temp\IntuneToken.txt'
$apiRequest = '/beta/deviceManagement/managedDevices/executeAction'

Start-Transcript "C:\Temp\IntuneCleanup.txt" -Force
foreach ($Device in $GetDevices) {
    $BodyJSON = @{
        "actionName" = "delete"
        "deviceIds"  = @( "$($Device."DeviceID")" )
    } | ConvertTo-Json -Depth 20

    Write-Host "Deleting Tired devices($($Device."Device Name") - User: $($Device."Primary user UPN"))" -ForegroundColor Yellow
    $Params = @{
        Uri         = ($serverUrl + $apiRequest)
        Headers     = @{ 'Authorization' = "******" }
        Method      = 'POST'
        Body        = $BodyJSON
        ContentType = "application/json"
    }
    Invoke-RestMethod @Params
}
```
