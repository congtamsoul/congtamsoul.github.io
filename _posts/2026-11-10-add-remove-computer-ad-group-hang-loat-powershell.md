---
layout: post
title: "Add và remove computer khỏi AD group hàng loạt bằng PowerShell"
seo_title: "Add/Remove AD group member hàng loạt bằng PowerShell"
description: "Cách add, remove computer vào AD group on-prem theo file CSV và xóa toàn bộ member bằng PowerShell, phục vụ pilot WSUS, GPO và upgrade Windows 11."
date: 2026-11-10
author: "Tam Nguyen"
reading_time: 7
topic: windows
thumb_label: "ACTIVE DIRECTORY"
image: /images/photo/31.jpg
tags:
  - Windows Server
  - Active Directory
  - PowerShell
  - WSUS
  - GPO
card_tags:
  - Active Directory
  - PowerShell
summary: "Add, remove computer vào AD group pilot từ file CSV và dọn sạch member chỉ với vài dòng PowerShell, có log để đối chiếu."
redirect_from:
  - /posts/ad-onprem-add-remove-computer-group-member-powershell.html
---

Không phải mọi thứ đều đã lên Intune. Với môi trường hybrid, nhiều thay đổi vẫn đi qua **Active Directory on-prem**: GPO, WSUS client-side targeting, hay đợt upgrade Windows 11 theo từng nhóm máy. Cách làm vẫn như trên cloud — tạo group nhỏ, add máy pilot, theo dõi rồi mở rộng. Nhưng add từng computer qua **Active Directory Users and Computers (ADUC)** với vài chục, vài trăm máy thì vừa mất thời gian vừa dễ sót.

**Tóm tắt nhanh:** chuẩn bị file CSV có cột `DeviceName`, chạy PowerShell với module `ActiveDirectory` để add hoặc remove computer khỏi group. Script kiểm tra membership trước khi thao tác và ghi log bằng `Start-Transcript`. Khi kết thúc đợt pilot, có thể dùng script riêng để xóa toàn bộ member của group.

## Bối cảnh: pilot trên AD on-prem

Mình thường dùng AD group cho các trường hợp:

- **WSUS** — group như `VN.WSUS.CongTam` được link với GPO trỏ máy vào đúng target group trên WSUS để nhận feature update Windows 11.
- **GPO filtering** — chỉ apply GPO mới cho nhóm máy pilot bằng Security Filtering.
- **Group test cho user/service** — ví dụ `VN.EEM.CongTam.Test`, cần dọn sạch sau mỗi đợt test.

Danh sách pilot thay đổi liên tục, nên cần một cách **add/remove nhanh, lặp lại được**, chỉ cần sửa file CSV.

#### Vì sao không dùng ADUC

ADUC phù hợp khi chỉ thao tác vài máy. Với danh sách lớn, script nhanh hơn, có log để đối chiếu và dễ chạy lại khi danh sách thay đổi.

## Chuẩn bị: module, quyền và file CSV

### Yêu cầu

- Chạy trên máy có **RSAT: Active Directory** (hoặc trực tiếp trên DC/jump server) để có module `ActiveDirectory`.
- Tài khoản có quyền **sửa member** của group, chẳng hạn được delegate quyền trên group hoặc OU phù hợp.
- Chạy PowerShell bằng tài khoản domain có quyền cần thiết.

### File CSV danh sách máy

Tạo file `C:\devices.csv`:

```csv
DeviceName
VN-WIN-PC001
VN-WIN-PC002
```

`DeviceName` là thuộc tính `Name` của computer object trong AD, không có dấu `$`. Các script bên dưới tìm computer theo đúng tên và ghi log nếu không tìm thấy hoặc có kết quả không duy nhất.

| Script | Input | Dùng khi |
|---|---|---|
| Add theo list | CSV `DeviceName` | Đưa máy vào đợt pilot |
| Remove theo list | CSV `DeviceName` | Rút máy lỗi ra khỏi pilot |
| Remove all member | Chỉ tên group | Kết thúc đợt test, dọn group |

## Add hoặc remove computer theo file CSV

Hai script có cùng quy trình: import danh sách, đọc member của group một lần, tìm computer theo `DeviceName`, rồi chỉ thay đổi membership khi cần. Cách đọc member một lần tránh gọi `Get-ADGroupMember` lặp lại cho từng dòng CSV.

Script Add ghi log tại `C:\log_Add_devices_to_Group.txt`; script Remove ghi log tại `C:\log_Remove_devices_from_Group.txt`. Đổi `$adGroupName` cho đúng group trong môi trường của bạn.

### Script Add computer vào AD group

```powershell
Import-Module ActiveDirectory

$csvPath = "C:\devices.csv"
$adGroupName = "VN.WSUS.CongTam"

Start-Transcript -Path "C:\log_Add_devices_to_Group.txt" -Force
try {
    $devices = Import-Csv -Path $csvPath -ErrorAction Stop
    $memberDns = @(Get-ADGroupMember -Identity $adGroupName -ErrorAction Stop |
        Select-Object -ExpandProperty DistinguishedName)

    foreach ($device in $devices) {
        $deviceName = "$($device.DeviceName)".Trim()
        if (-not $deviceName) {
            Write-Warning "Skipped a CSV row with an empty DeviceName."
            continue
        }

        $computers = @(Get-ADComputer -Filter { Name -eq $deviceName } `
            -Properties DistinguishedName -ErrorAction Stop)

        if ($computers.Count -eq 0) {
            Write-Warning "Device $deviceName not found in Active Directory."
            continue
        }
        if ($computers.Count -gt 1) {
            Write-Warning "Device name $deviceName is not unique. Skipped."
            continue
        }

        $adComputer = $computers[0]
        if ($memberDns -contains $adComputer.DistinguishedName) {
            Write-Host "$deviceName is already a member of $adGroupName."
            continue
        }

        Add-ADGroupMember -Identity $adGroupName -Members $adComputer -ErrorAction Stop
        $memberDns += $adComputer.DistinguishedName
        Write-Host "$deviceName added to $adGroupName."
    }

    Write-Host "Script execution completed."
}
finally {
    Stop-Transcript
}
```

### Script Remove computer khỏi AD group theo list

```powershell
Import-Module ActiveDirectory

$csvPath = "C:\devices.csv"
$adGroupName = "VN.WSUS.CongTam"

Start-Transcript -Path "C:\log_Remove_devices_from_Group.txt" -Force
try {
    $devices = Import-Csv -Path $csvPath -ErrorAction Stop
    $memberDns = @(Get-ADGroupMember -Identity $adGroupName -ErrorAction Stop |
        Select-Object -ExpandProperty DistinguishedName)

    foreach ($device in $devices) {
        $deviceName = "$($device.DeviceName)".Trim()
        if (-not $deviceName) {
            Write-Warning "Skipped a CSV row with an empty DeviceName."
            continue
        }

        $computers = @(Get-ADComputer -Filter { Name -eq $deviceName } `
            -Properties DistinguishedName -ErrorAction Stop)

        if ($computers.Count -eq 0) {
            Write-Warning "Device $deviceName not found in Active Directory."
            continue
        }
        if ($computers.Count -gt 1) {
            Write-Warning "Device name $deviceName is not unique. Skipped."
            continue
        }

        $adComputer = $computers[0]
        if ($memberDns -notcontains $adComputer.DistinguishedName) {
            Write-Host "$deviceName is not a member of $adGroupName."
            continue
        }

        Remove-ADGroupMember -Identity $adGroupName -Members $adComputer `
            -Confirm:$false -ErrorAction Stop
        $memberDns = @($memberDns | Where-Object { $_ -ne $adComputer.DistinguishedName })
        Write-Host "$deviceName removed from $adGroupName."
    }

    Write-Host "Script execution completed."
}
finally {
    Stop-Transcript
}
```

## Xóa toàn bộ member của group

Khi kết thúc đợt test, có thể xóa toàn bộ member trực tiếp của group bằng script dưới đây. Script áp dụng với user, computer và group lồng; thao tác chỉ remove membership trong group được chỉ định.

> **Cảnh báo:** đây là thao tác xóa sạch member. Kiểm tra kỹ tên group và export danh sách member trước khi chạy để có thể đối chiếu hoặc khôi phục.

```powershell
Import-Module ActiveDirectory

$GroupName = "VN.EEM.CongTam.Test"
$backupPath = "C:\backup_members.csv"

$GroupMembers = @(Get-ADGroupMember -Identity $GroupName -ErrorAction Stop)
$GroupMembers |
    Select-Object Name, SamAccountName, ObjectClass, DistinguishedName |
    Export-Csv -Path $backupPath -NoTypeInformation -Encoding UTF8

if ($GroupMembers.Count -eq 0) {
    Write-Host "Group has no members: $GroupName"
} else {
    Write-Host "Backup exported to $backupPath. Members to remove: $($GroupMembers.Count)"
    Remove-ADGroupMember -Identity $GroupName -Members $GroupMembers -Confirm
    Write-Host "All direct members have been removed from $GroupName."
}
```

`Get-ADGroupMember` có thể gặp giới hạn với group rất lớn (trên 5.000 member). Với group như vậy, kiểm tra giới hạn của AD Web Services và cách truy xuất member phù hợp trong domain trước khi chạy thao tác hàng loạt.

## Quy trình pilot và lỗi thường gặp

1. Tạo AD group pilot, link GPO hoặc cấu hình WSUS targeting vào group.
2. Cập nhật `devices.csv`, chạy script Add với vài máy trước.
3. Trên máy client, chạy `gpupdate /force` hoặc reboot để nhận cấu hình mới. **Computer group membership trong access token có thể cần reboot** mới được cập nhật.
4. Theo dõi kết quả vài ngày; máy lỗi thì chạy script Remove.
5. Kết thúc đợt, export backup rồi chạy script Remove all nếu group cần được dọn sạch.

Một số lỗi hay gặp:

- **Máy không tồn tại** — `Get-ADComputer -Identity` có thể throw lỗi khi không tìm thấy; script ở trên dùng `-Filter` và kiểm tra kết quả trước khi thao tác.
- **Script chậm với group lớn** — không gọi `Get-ADGroupMember` lại cho từng máy; các script trên load danh sách member một lần.
- **Đã add nhưng chưa nhận GPO/WSUS** — kiểm tra link GPO, Security Filtering, WSUS targeting và reboot máy để refresh computer token.
- **Access denied** — xác nhận tài khoản đang chạy PowerShell được delegate quyền sửa member của đúng group.

## Kết luận

Với một file CSV và PowerShell, việc quản lý member của AD group pilot trở nên nhanh và có log rõ ràng để đối chiếu. Kết hợp với cách add device vào Entra cloud group bằng Graph API, bạn có thể quản lý pilot trên cả on-prem lẫn cloud theo cùng một quy trình. Hãy thử với vài máy và xác nhận đúng group trước khi chạy trên danh sách lớn.

Bạn đang quản lý pilot group trên AD on-prem theo cách nào — ADUC, script hay công cụ khác? Chia sẻ ở phần bình luận nhé.
