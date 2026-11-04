---
layout: post
title: "Offboarding nhân viên nghỉ việc trên Microsoft 365: khóa truy cập ngay, giữ dữ liệu, bàn giao đúng thứ tự"
seo_title: "Offboarding user Microsoft 365 bằng Graph PowerShell"
description: "Quy trình offboarding nhân viên nghỉ việc trên Microsoft 365: chặn đăng nhập, thu hồi phiên, xóa forwarding, shared mailbox, bàn giao OneDrive và gỡ license an toàn."
date: 2026-11-04
author: "Tam Nguyen"
reading_time: 12
topic: m365
thumb_label: "MICROSOFT 365 · OFFBOARDING"
image: /images/photo/28.jpg
tags:
  - Microsoft 365
  - Microsoft Graph
  - Exchange Online
  - OneDrive
  - Intune
card_tags:
  - Microsoft 365
  - Offboarding
summary: "Quy trình 9 bước khóa tài khoản nhân viên nghỉ việc trên Microsoft 365 mà không mất email, OneDrive hay quyền sở hữu group."
redirect_from:
  - /posts/offboarding-user-microsoft-365-graph-powershell.html
---

Chiều thứ Sáu, HR báo một nhân viên nghỉ việc có hiệu lực từ 16 giờ. Quản lý dặn thêm: *"Giữ lại toàn bộ email và file trong OneDrive của bạn ấy, có hợp đồng khách hàng ở trong đó."* Nếu admin chỉ gỡ license cho nhanh, mailbox sẽ bị xóa sau 30 ngày, OneDrive vào trạng thái chờ xóa, và các group nhân viên đó làm chủ không còn ai quản lý. Trong khi đó, Outlook trên điện thoại của họ vẫn nhận thư tới khi token hết hạn. Bài này trình bày quy trình offboarding 9 bước mình dùng cho tenant Microsoft 365, viết bằng **Microsoft Graph PowerShell** và **Exchange Online PowerShell**.

> **Tóm tắt nhanh:** Thứ tự quyết định tất cả: **chặn truy cập trước, bàn giao dữ liệu sau, gỡ license cuối cùng**. Chặn đăng nhập và thu hồi phiên ngay; xóa forwarding và rule; chuyển mailbox sang shared; bàn giao OneDrive; chuyển chủ group; retire thiết bị; rồi mới gỡ license và ẩn khỏi sổ địa chỉ.

## Bối cảnh: vì sao thứ tự quan trọng

Ba sai lầm phổ biến nhất khi offboarding đều do làm sai thứ tự:

| Làm sai | Hậu quả |
|---|---|
| Gỡ license trước khi chuyển sang shared mailbox | Mailbox bị xóa mềm sau 30 ngày |
| Gỡ license trước khi bàn giao OneDrive | OneDrive vào thời gian lưu giữ, quản lý có thể không kịp lấy file |
| Chặn đăng nhập nhưng không thu hồi phiên | Outlook, Teams trên điện thoại vẫn chạy tới khi token hết hạn |

Nếu tenant có **Microsoft Entra ID Governance**, [Lifecycle Workflows](https://learn.microsoft.com/entra/id-governance/what-are-lifecycle-workflows) có sẵn các tác vụ leaver như tắt tài khoản, gỡ group, gỡ license. Script trong bài phù hợp khi chưa có license này, hoặc cần thêm phần bàn giao mailbox và OneDrive.

## Đầu vào và chuẩn bị

HR gửi file `hr-offboarding-batch.csv`:

| Cột | Ví dụ | Ý nghĩa |
|---|---|---|
| `UserPrincipalName` | `an.nguyen@contoso.com` | Tài khoản nghỉ việc |
| `LastWorkingDay` | `2026-11-07` | Ngày làm việc cuối |
| `HandoverTo` | `binh.tran@contoso.com` | Người nhận bàn giao, để trống thì dùng quản lý |
| `LegalHold` | `Yes` / `No` | Có cần giữ dữ liệu cho pháp lý không |

Người nhận bàn giao mặc định là **quản lý trực tiếp** trong thuộc tính `manager` của Entra ID:

```powershell
Connect-MgGraph -Scopes "User.ReadWrite.All","Group.ReadWrite.All","Directory.ReadWrite.All",
    "UserAuthenticationMethod.ReadWrite.All","DeviceManagementManagedDevices.PrivilegedOperations.All" -NoWelcome
Connect-ExchangeOnline -ShowBanner:$false
$user = Get-MgUser -UserId $r.UserPrincipalName -Property Id,DisplayName,UserPrincipalName
$to   = if ($r.HandoverTo) { Get-MgUser -UserId $r.HandoverTo }
        else { Get-MgUserManager -UserId $user.Id | ForEach-Object { Get-MgUser -UserId $_.Id } }
if (-not $to) { throw "Không xác định được người nhận bàn giao cho $($user.UserPrincipalName)" }
```

## Quy trình Offboarding 9 bước

| # | Bước | Nhóm |
|---|---|---|
| 1 | Chặn đăng nhập | Chặn truy cập |
| 2 | Thu hồi phiên, xóa phương thức xác thực | Chặn truy cập |
| 3 | Xóa forwarding và inbox rule | Chặn rò rỉ |
| 4 | Retire thiết bị di động | Chặn rò rỉ |
| 5 | Litigation Hold nếu cần, chuyển sang shared mailbox | Giữ dữ liệu |
| 6 | Bàn giao OneDrive | Giữ dữ liệu |
| 7 | Chuyển chủ group, gỡ khỏi group | Bàn giao |
| 8 | Gỡ license, ẩn khỏi sổ địa chỉ | Dọn dẹp |
| 9 | Ghi báo cáo, gửi cho quản lý và HR | Báo cáo |

### Bước 1 và 2: Chặn truy cập

```powershell
Update-MgUser -UserId $user.Id -AccountEnabled:$false
Revoke-MgUserSignInSession -UserId $user.Id
Get-MgUserAuthenticationMethod -UserId $user.Id | Where-Object {
    $_.AdditionalProperties.'@odata.type' -eq '#microsoft.graph.microsoftAuthenticatorAuthenticationMethod' } |
    ForEach-Object { Remove-MgUserAuthenticationMicrosoftAuthenticatorMethod -UserId $user.Id `
        -MicrosoftAuthenticatorAuthenticationMethodId $_.Id }
```

`AccountEnabled = false` chặn đăng nhập mới. `Revoke-MgUserSignInSession` vô hiệu hóa refresh token, buộc các ứng dụng đang mở phải xác thực lại và bị từ chối. Với những ứng dụng hỗ trợ [Continuous Access Evaluation](https://learn.microsoft.com/entra/identity/conditional-access/concept-continuous-access-evaluation), việc chặn có hiệu lực gần như tức thì.

## Ngăn dữ liệu rò rỉ

### Bước 3: Xóa forwarding và inbox rule

```powershell
Set-Mailbox -Identity $user.UserPrincipalName -ForwardingAddress $null -ForwardingSmtpAddress $null `
    -DeliverToMailboxAndForward $false
Get-InboxRule -Mailbox $user.UserPrincipalName |
    Where-Object { $_.ForwardTo -or $_.ForwardAsAttachmentTo -or $_.RedirectTo } |
    Remove-InboxRule -Confirm:$false
```

Mình chỉ xóa rule có chuyển tiếp ra ngoài, giữ lại rule sắp xếp thư để người nhận bàn giao dễ tra cứu.

### Bước 4: Retire thiết bị

Với máy công ty, dùng **Retire** để gỡ dữ liệu và cấu hình công ty. Với điện thoại cá nhân đăng ký theo kiểu app protection, chỉ cần **selective wipe** dữ liệu trong app.

```powershell
Get-MgUserManagedDevice -UserId $user.Id | ForEach-Object {
    Invoke-MgRetireDeviceManagementManagedDevice -ManagedDeviceId $_.Id
    Write-Host "Retire: $($_.DeviceName) ($($_.OperatingSystem))" }
```

<div class="callout danger">
  <span>⛔</span>
  <div><b>Nguy hiểm</b>Đừng dùng <b>Wipe</b> cho laptop công ty trước khi đã xác nhận không còn dữ liệu cục bộ chưa đồng bộ lên OneDrive. Wipe xóa sạch máy và không thể hoàn tác. Thu hồi máy vật lý trước, kiểm tra, rồi mới reset.</div>
</div>

## Giữ dữ liệu: mailbox và OneDrive

### Bước 5: Litigation Hold và shared mailbox

```powershell
$upn  = $user.UserPrincipalName
$size = (Get-EXOMailboxStatistics -Identity $upn).TotalItemSize.Value.ToBytes() / 1GB
if ($r.LegalHold -eq 'Yes') {
    Set-Mailbox -Identity $upn -LitigationHoldEnabled $true -LitigationHoldDuration 2555 }
Set-Mailbox -Identity $upn -Type Shared
Add-MailboxPermission -Identity $upn -User $to.UserPrincipalName -AccessRights FullAccess `
    -InheritanceType All -AutoMapping $true | Out-Null
Write-Host ("Mailbox {0:N1} GB" -f $size)
```

Shared mailbox dưới 50 GB, không có archive và không có hold **không cần license**. Nếu vượt một trong các điều kiện đó, phải giữ license Exchange Online Plan 2 (hoặc Exchange Online Archiving) cho mailbox.

### Bước 6: Bàn giao OneDrive

Từ lúc gỡ license, OneDrive của user bị xóa được giữ lại theo cấu hình **OneDrive retention** (mặc định 30 ngày, tối đa 3650 ngày). Bàn giao trước khi gỡ license để quản lý có đủ thời gian.

```powershell
Connect-SPOService -Url "https://contoso-admin.sharepoint.com"
$od = (Get-SPOSite -IncludePersonalSite $true -Limit All -Filter "Owner -eq '$upn'").Url
Set-SPOSite -Identity $od -SharingCapability Disabled
Set-SPOUser -Site $od -LoginName $to.UserPrincipalName -IsSiteCollectionAdmin $true | Out-Null
```

Gửi link `$od` cho người nhận bàn giao và nhắc họ chuyển các file cần thiết sang thư viện SharePoint của nhóm.

<div class="callout">
  <span>💡</span>
  <div><b>Tip</b>Trong <i>Microsoft 365 admin center → Settings → Org settings → OneDrive</i>, bật tính năng tự động cấp quyền OneDrive cho quản lý khi user bị xóa. Script vẫn nên làm thủ công để chủ động hơn về thời điểm.</div>
</div>

## Bàn giao group và dọn dẹp

### Bước 7: Chuyển chủ group

Luôn **thêm chủ mới trước, gỡ chủ cũ sau**, để group không bao giờ ở trạng thái không có chủ.

```powershell
Get-MgUserOwnedObject -UserId $user.Id -All |
  Where-Object { $_.AdditionalProperties.'@odata.type' -eq '#microsoft.graph.group' } |
  ForEach-Object {
    $gid = $_.Id
    $owners = (Get-MgGroupOwner -GroupId $gid -All).Id
    if ($to.Id -notin $owners) {
        New-MgGroupOwnerByRef -GroupId $gid -BodyParameter @{
            "@odata.id" = "https://graph.microsoft.com/v1.0/users/$($to.Id)" } }
    Remove-MgGroupOwnerDirectoryObjectByRef -GroupId $gid -DirectoryObjectId $user.Id }
Get-MgUserMemberOf -UserId $user.Id -All |
  Where-Object { $_.AdditionalProperties.'@odata.type' -eq '#microsoft.graph.group' -and
                 -not $_.AdditionalProperties.membershipRule } |
  ForEach-Object { Remove-MgGroupMemberDirectoryObjectByRef -GroupId $_.Id -DirectoryObjectId $user.Id `
                     -ErrorAction SilentlyContinue }
```

Dynamic group được bỏ qua vì không thể gỡ thành viên bằng tay. Thay vào đó, xóa các thuộc tính mà rule dựa vào (`department`, `employeeType`...) để user tự rời group.

### Bước 8: Gỡ license, ẩn khỏi sổ địa chỉ

```powershell
Update-MgUser -UserId $user.Id -Department $null -JobTitle $null -EmployeeType $null
Remove-MgUserManagerByRef -UserId $user.Id -ErrorAction SilentlyContinue
$direct = (Get-MgUserLicenseDetail -UserId $user.Id).SkuId
if ($direct) { Set-MgUserLicense -UserId $user.Id -AddLicenses @() -RemoveLicenses $direct | Out-Null }
Set-Mailbox -Identity $upn -HiddenFromAddressListsEnabled $true
```

Nếu dùng group-based licensing, việc rời group license ở bước 7 hoặc thay đổi `employeeType` đã thu hồi license. Lệnh `Set-MgUserLicense` chỉ dọn license gán trực tiếp còn sót. **Không gỡ** license của mailbox lớn hơn 50 GB hoặc đang bị hold.

### Bước 9: Báo cáo

Mỗi bước ghi `OK`, `FAIL` hoặc `SKIP` vào `offboarding-result-yyyyMMdd.csv`, rồi gửi bản tóm tắt cho người nhận bàn giao và HR, kèm link OneDrive và thời hạn lưu giữ.

## Những lỗi thường gặp

- **Người nhận bàn giao không thấy mailbox trong Outlook** — AutoMapping cần thời gian đồng bộ, có thể tới vài giờ. Cách xử lý: hướng dẫn thêm thủ công qua *File → Account Settings → Change → More Settings → Advanced*.
- **Group không còn chủ** — gỡ chủ cũ trước, lệnh thêm chủ mới thất bại vì lỗi mạng. Cách xử lý: luôn thêm trước, gỡ sau như bước 7.
- **Mailbox bị khóa sau khi gỡ license** — mailbox lớn hơn 50 GB hoặc có archive. Cách xử lý: kiểm tra `TotalItemSize` và trạng thái archive trước khi gỡ license.
- **`Remove-MgGroupMemberDirectoryObjectByRef` báo lỗi với một số group** — đó là dynamic group hoặc group đồng bộ từ AD on-prem. Group on-prem phải gỡ trong Active Directory rồi chờ đồng bộ.
- **Không tìm thấy OneDrive** — user chưa từng mở OneDrive nên site chưa được tạo. Ghi `SKIP` thay vì `FAIL`.

## Kết luận

Offboarding không phải là xóa tài khoản, mà là **khóa cửa nhưng giữ lại đồ đạc**. Chặn truy cập và thu hồi phiên ngay khi HR báo; bàn giao mailbox, OneDrive và quyền sở hữu group trước; gỡ license sau cùng. Ghi trạng thái từng bước giúp HR và quản lý yên tâm rằng không có gì bị bỏ sót.

Việc nên làm tiếp: rà lại quy trình hiện tại của team bạn, nhất là vị trí của bước gỡ license và việc có thu hồi phiên hay không. Xem thêm bài [Onboarding](/posts/onboarding-user-microsoft-365-graph-powershell.html) để có trọn vòng đời tài khoản. Công ty bạn giữ mailbox và OneDrive của nhân viên nghỉ việc bao lâu?

## Full script Offboarding

Script gộp toàn bộ 9 bước trong bài. Chạy bằng **PowerShell 7**, cần module `Microsoft.Graph`, `ExchangeOnlineManagement` và `Microsoft.Online.SharePoint.PowerShell`. Luôn chạy với `-WhatIfOnly` trước để xem danh sách việc sẽ làm.

```powershell
<#
.SYNOPSIS  Offboarding user Microsoft 365: chan truy cap, giu du lieu, ban giao, go license.
.EXAMPLE   .\Invoke-M365Offboarding.ps1 -CsvPath .\hr-offboarding-batch.csv -WhatIfOnly
.EXAMPLE   .\Invoke-M365Offboarding.ps1 -CsvPath .\hr-offboarding-batch.csv
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)] [string]$CsvPath,
    [switch]$WhatIfOnly
)
#region ===== CONFIG =====
$SpoAdminUrl     = "https://contoso-admin.sharepoint.com"
$SenderMailbox   = "it-offboarding@contoso.com"
$HrMailbox       = "hr@contoso.com"
$SharedLimitGB   = 50
$HoldDays        = 2555
$OutDir          = Join-Path $PSScriptRoot "output"
#endregion
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
# ===== CONNECT =====
Connect-MgGraph -NoWelcome -Scopes "User.ReadWrite.All","Group.ReadWrite.All","Directory.ReadWrite.All",
    "UserAuthenticationMethod.ReadWrite.All","DeviceManagementManagedDevices.PrivilegedOperations.All",
    "DeviceManagementManagedDevices.Read.All","Mail.Send"
Connect-ExchangeOnline -ShowBanner:$false
Connect-SPOService -Url $SpoAdminUrl
$Rows   = Import-Csv $CsvPath
$Result = [System.Collections.Generic.List[object]]::new()
foreach ($r in $Rows) {
    $log = [ordered]@{ UPN = $r.UserPrincipalName; HandoverTo=''; BlockSignIn='SKIP'; RevokeSessions='SKIP'
        Forwarding='SKIP'; Devices='SKIP'; Mailbox='SKIP'; OneDrive='SKIP'; Groups='SKIP'
        License='SKIP'; HideGAL='SKIP'; OneDriveUrl=''; MailboxGB=0; Error='' }
    try {
        $user = Get-MgUser -UserId $r.UserPrincipalName -Property Id,DisplayName,UserPrincipalName,AccountEnabled
        $upn  = $user.UserPrincipalName
        # Nguoi nhan ban giao
        $to = if ($r.HandoverTo) { Get-MgUser -UserId $r.HandoverTo -Property Id,DisplayName,UserPrincipalName,Mail }
              else { $m = Get-MgUserManager -UserId $user.Id -ErrorAction SilentlyContinue
                     if ($m) { Get-MgUser -UserId $m.Id -Property Id,DisplayName,UserPrincipalName,Mail } }
        if (-not $to) { throw "Khong xac dinh duoc nguoi nhan ban giao" }
        $log.HandoverTo = $to.UserPrincipalName
        $mbxStat = Get-EXOMailboxStatistics -Identity $upn -ErrorAction SilentlyContinue
        $sizeGB  = if ($mbxStat) { [math]::Round($mbxStat.TotalItemSize.Value.ToBytes()/1GB,2) } else { 0 }
        $mbx     = Get-EXOMailbox -Identity $upn -Properties ArchiveStatus -ErrorAction SilentlyContinue
        $log.MailboxGB = $sizeGB
        $keepLicense = ($sizeGB -ge $SharedLimitGB) -or ($mbx.ArchiveStatus -eq 'Active') -or ($r.LegalHold -eq 'Yes')
        if ($WhatIfOnly) {
            Write-Host "[WHATIF] $upn -> ban giao cho $($to.UserPrincipalName); mailbox $sizeGB GB; giu license: $keepLicense" -ForegroundColor Yellow
            $Result.Add([pscustomobject]$log); continue
        }
        # 1. Chan dang nhap
        Update-MgUser -UserId $user.Id -AccountEnabled:$false
        $log.BlockSignIn = 'OK'
        # 2. Thu hoi phien + go Authenticator
        Revoke-MgUserSignInSession -UserId $user.Id | Out-Null
        Get-MgUserAuthenticationMicrosoftAuthenticatorMethod -UserId $user.Id -ErrorAction SilentlyContinue |
            ForEach-Object { Remove-MgUserAuthenticationMicrosoftAuthenticatorMethod -UserId $user.Id `
                -MicrosoftAuthenticatorAuthenticationMethodId $_.Id }
        $log.RevokeSessions = 'OK'
        if ($mbx) {
            # 3. Forwarding + inbox rule chuyen tiep
            Set-Mailbox -Identity $upn -ForwardingAddress $null -ForwardingSmtpAddress $null -DeliverToMailboxAndForward $false
            Get-InboxRule -Mailbox $upn | Where-Object { $_.ForwardTo -or $_.ForwardAsAttachmentTo -or $_.RedirectTo } |
                Remove-InboxRule -Confirm:$false
            $log.Forwarding = 'OK'
        }
        # 4. Retire thiet bi
        $devices = Get-MgUserManagedDevice -UserId $user.Id -ErrorAction SilentlyContinue
        foreach ($d in $devices) { Invoke-MgRetireDeviceManagementManagedDevice -ManagedDeviceId $d.Id }
        $log.Devices = if ($devices) { "OK ($(@($devices).Count))" } else { 'SKIP' }
        # 5. Hold + shared mailbox + FullAccess
        if ($mbx) {
            if ($r.LegalHold -eq 'Yes') { Set-Mailbox -Identity $upn -LitigationHoldEnabled $true -LitigationHoldDuration $HoldDays }
            Set-Mailbox -Identity $upn -Type Shared
            Add-MailboxPermission -Identity $upn -User $to.UserPrincipalName -AccessRights FullAccess `
                -InheritanceType All -AutoMapping $true | Out-Null
            $log.Mailbox = 'OK'
        }
        # 6. OneDrive
        $od = Get-SPOSite -IncludePersonalSite $true -Limit All -Filter "Owner -eq '$upn'" -ErrorAction SilentlyContinue |
              Where-Object Url -like "*-my.sharepoint.com/personal/*" | Select-Object -First 1
        if ($od) {
            Set-SPOSite -Identity $od.Url -SharingCapability Disabled
            Set-SPOUser -Site $od.Url -LoginName $to.UserPrincipalName -IsSiteCollectionAdmin $true | Out-Null
            $log.OneDrive = 'OK'; $log.OneDriveUrl = $od.Url
        }
        # 7. Chuyen chu group (them truoc, go sau) + go membership tinh
        Get-MgUserOwnedObject -UserId $user.Id -All |
          Where-Object { $_.AdditionalProperties.'@odata.type' -eq '#microsoft.graph.group' } | ForEach-Object {
            $gid = $_.Id
            if ($to.Id -notin (Get-MgGroupOwner -GroupId $gid -All).Id) {
                New-MgGroupOwnerByRef -GroupId $gid -BodyParameter @{
                    "@odata.id" = "https://graph.microsoft.com/v1.0/users/$($to.Id)" } }
            Remove-MgGroupOwnerDirectoryObjectByRef -GroupId $gid -DirectoryObjectId $user.Id }
        Get-MgUserMemberOf -UserId $user.Id -All |
          Where-Object { $_.AdditionalProperties.'@odata.type' -eq '#microsoft.graph.group' -and
                         -not $_.AdditionalProperties.membershipRule -and
                         -not $_.AdditionalProperties.onPremisesSyncEnabled } | ForEach-Object {
            Remove-MgGroupMemberDirectoryObjectByRef -GroupId $_.Id -DirectoryObjectId $user.Id -ErrorAction SilentlyContinue }
        $log.Groups = 'OK'
        # 8. Xoa thuoc tinh to chuc, go license (neu an toan), an khoi GAL
        Update-MgUser -UserId $user.Id -BodyParameter @{ department = $null; jobTitle = $null; employeeType = $null }
        Remove-MgUserManagerByRef -UserId $user.Id -ErrorAction SilentlyContinue
        if ($keepLicense) { $log.License = 'KEPT (>50GB/archive/hold)' }
        else {
            $direct = (Get-MgUser -UserId $user.Id -Property LicenseAssignmentStates).LicenseAssignmentStates |
                      Where-Object { -not $_.AssignedByGroup } | Select-Object -ExpandProperty SkuId -Unique
            if ($direct) { Set-MgUserLicense -UserId $user.Id -AddLicenses @() -RemoveLicenses @($direct) | Out-Null }
            $log.License = 'OK'
        }
        if ($mbx) { Set-Mailbox -Identity $upn -HiddenFromAddressListsEnabled $true; $log.HideGAL = 'OK' }
        # 9. Bao cao cho nguoi nhan ban giao + HR
        $body = "<p>Tai khoan <b>$($user.DisplayName)</b> ($upn) da duoc offboard.</p>" +
                "<ul><li>Mailbox (shared, $sizeGB GB): da cap FullAccess cho $($to.UserPrincipalName)</li>" +
                "<li>OneDrive: $($log.OneDriveUrl)</li><li>License: $($log.License)</li></ul>" +
                "<p>Vui long chuyen file can thiet sang SharePoint cua nhom truoc thoi han luu giu OneDrive.</p>"
        Send-MgUserMail -UserId $SenderMailbox -BodyParameter @{ message = @{
            subject = "[Offboarding] $($user.DisplayName)"
            body = @{ contentType = "HTML"; content = $body }
            toRecipients = @(@{ emailAddress = @{ address = $to.Mail } }, @{ emailAddress = @{ address = $HrMailbox } }) } }
        Write-Host "OK  $upn" -ForegroundColor Green
    }
    catch { $log.Error = $_.Exception.Message; Write-Host "ERR $($r.UserPrincipalName): $($log.Error)" -ForegroundColor Red }
    $Result.Add([pscustomobject]$log)
}
$ResultFile = Join-Path $OutDir ("offboarding-result-{0:yyyyMMdd-HHmm}.csv" -f (Get-Date))
$Result | Export-Csv $ResultFile -NoTypeInformation -Encoding UTF8
$Result | Format-Table UPN,HandoverTo,BlockSignIn,Mailbox,OneDrive,Groups,License -AutoSize
Write-Host "DONE -> $ResultFile" -ForegroundColor Cyan
```

Mẫu file `hr-offboarding-batch.csv`:

```text
UserPrincipalName,LastWorkingDay,HandoverTo,LegalHold
an.nguyen@contoso.com,2026-11-07,,No
binh.tran@contoso.com,2026-11-07,chi.le@contoso.com,Yes
```

<div class="callout warn">
  <span>⚠️</span>
  <div><b>Lưu ý</b>Chạy thử trên tenant test hoặc một tài khoản test trước. Các bước chặn đăng nhập, retire thiết bị và gỡ license có hiệu lực ngay. Tài khoản dùng để chạy cần quyền User Administrator, Exchange Administrator, SharePoint Administrator và Intune Administrator.</div>
</div>

<!--
Phần cuối bài (nút Chia sẻ LinkedIn, Facebook, Copy link, khung tác giả, bài trước/sau)
và Mục lục bên phải được layout tự thêm vào, không cần viết trong file này.
Xem trước trên máy: bundle exec jekyll serve --unpublished (chỉ cần khi bài còn published: false).
-->
