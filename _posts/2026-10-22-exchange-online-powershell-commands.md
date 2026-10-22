---
layout: post
title: "Các lệnh PowerShell hữu ích khi quản trị Exchange Online"
seo_title: "Exchange Online PowerShell: lệnh quản trị hữu ích"
description: "Lệnh PowerShell Exchange Online thường dùng cho mailbox, nhóm, mail flow, quyền, calendar, bảo mật, audit và migration, kèm ví dụ copy để chạy."
date: 2026-10-22
author: "Tam Nguyen"
reading_time: 12
topic: m365
thumb_label: "EXCHANGE ONLINE"
tags:
  - Exchange Online
  - PowerShell
  - Microsoft 365
card_tags:
  - Exchange Online
  - PowerShell
summary: "Tra cứu lệnh Exchange Online PowerShell thường dùng cho mailbox, nhóm, mail flow, quyền, calendar, bảo mật và migration; có ví dụ copy để chạy."
redirect_from:
  - /posts/exchange-online-powershell-commands.html
---

Khi xử lý sự cố Exchange Online, nhiều việc như kiểm tra dung lượng mailbox, tìm email bị lỗi gửi hay xác minh quyền truy cập đều có thể làm nhanh bằng PowerShell. Bài viết này gom các lệnh thường dùng thành từng nhóm: **copy lệnh, sửa giá trị mẫu cho đúng tenant của bạn, rồi chạy trong PowerShell**.

> **Tóm tắt nhanh:** Cài module `ExchangeOnlineManagement`, kết nối bằng tài khoản có quyền phù hợp, sau đó chạy từng lệnh trong nhóm cần kiểm tra. Các lệnh đọc thông tin có thể chạy trực tiếp; các ví dụ thay đổi cấu hình có `-WhatIf` để xem trước trước khi áp dụng thật.

Bài viết chọn lọc các lệnh quản trị thường gặp từ bộ script 79 kịch bản: tra cứu mailbox và nhóm, xử lý mail flow, phân quyền, calendar/phòng họp, bảo mật, audit và migration. Đây là **bộ lệnh tham khảo theo tác vụ**, không phải toàn bộ script có helper, xử lý phân trang và xuất báo cáo trong file nguồn.

## Chuẩn bị và kết nối Exchange Online

Chỉ cần cài module một lần trên máy. Mở PowerShell bằng tài khoản Windows của bạn; không cần chạy với quyền Administrator nếu cài ở phạm vi `CurrentUser`.

```powershell
Install-Module ExchangeOnlineManagement -Scope CurrentUser
```

Nạp module và kết nối bằng tài khoản quản trị. Thay địa chỉ mẫu bằng tài khoản của bạn; đăng nhập hoàn tất trong cửa sổ xác thực hiện ra.

```powershell
Import-Module ExchangeOnlineManagement
Connect-ExchangeOnline -UserPrincipalName admin@contoso.com
```

Kiểm tra phiên đã kết nối đúng chưa. Nếu không còn cần chạy lệnh, hãy ngắt phiên để đóng kết nối.

```powershell
Get-ConnectionInformation |
    Where-Object State -eq 'Connected' |
    Select-Object UserPrincipalName, TenantID, ConnectionUri

Disconnect-ExchangeOnline -Confirm:$false
```

Các ví dụ tiếp theo giả định bạn đã kết nối thành công. Thay `user@contoso.com`, `shared@contoso.com` và `contoso.com` bằng địa chỉ thực tế; nếu thiếu quyền, Exchange Online sẽ trả về lỗi phân quyền.

## Tra cứu mailbox, người nhận và nhóm

Liệt kê mailbox theo loại, ví dụ toàn bộ shared mailbox. Với tenant lớn, hãy giữ bộ lọc và giới hạn số dòng trước khi yêu cầu kết quả không giới hạn.

```powershell
Get-Mailbox -RecipientTypeDetails SharedMailbox -ResultSize 100 |
    Select-Object DisplayName, PrimarySmtpAddress, Alias, WhenCreated
```

`Get-Recipient` tra cứu mọi loại recipient có email trong Exchange, không chỉ mailbox. Dùng bộ lọc tên/email để tìm đúng đối tượng trước khi thao tác.

```powershell
$SearchText = 'Alex'

Get-Recipient -Anr $SearchText -ResultSize 20 |
    Select-Object DisplayName, PrimarySmtpAddress, RecipientTypeDetails
```

`Get-Mailbox` hiển thị thuộc tính mailbox. Dùng `-Identity` để truy vấn một mailbox cụ thể, sau đó chọn đúng các trường cần xem thay vì xuất toàn bộ đối tượng.

```powershell
$Mailbox = 'user@contoso.com'

Get-Mailbox -Identity $Mailbox |
    Format-List DisplayName, PrimarySmtpAddress, RecipientTypeDetails,
                HiddenFromAddressListsEnabled, ForwardingSmtpAddress,
                DeliverToMailboxAndForward
```

Kiểm tra dung lượng và số lượng thư mục trong mailbox bằng `Get-MailboxStatistics`. Lệnh này chỉ đọc thông tin; nếu cần rà soát nhiều mailbox, nên giới hạn phạm vi trước vì mỗi mailbox cần được truy vấn.

```powershell
$Mailbox = 'user@contoso.com'

Get-MailboxStatistics -Identity $Mailbox |
    Select-Object DisplayName, TotalItemSize, ItemCount, DeletedItemCount, LastLogonTime
```

Nếu mailbox có archive, kiểm tra dung lượng archive bằng `-Archive`. Mailbox không bật archive có thể không trả về thống kê archive.

```powershell
$Mailbox = 'user@contoso.com'
$MailboxInfo = Get-Mailbox -Identity $Mailbox

if ($MailboxInfo.ArchiveStatus -eq 'Active') {
    Get-MailboxStatistics -Identity $Mailbox -Archive |
        Select-Object DisplayName, TotalItemSize, ItemCount
} else {
    Write-Host "$Mailbox does not have an active archive mailbox."
}
```

Xem cấu hình trả lời tự động hiện tại trước khi cập nhật Out of Office.

```powershell
$Mailbox = 'user@contoso.com'

Get-MailboxAutoReplyConfiguration -Identity $Mailbox |
    Format-List AutoReplyState, StartTime, EndTime, ExternalAudience,
                InternalMessage, ExternalMessage
```

`Get-CASMailbox` giúp kiểm tra các giao thức client như OWA, MAPI, ActiveSync, POP, IMAP và EWS trên mailbox.

```powershell
$Mailbox = 'user@contoso.com'

Get-CASMailbox -Identity $Mailbox |
    Select-Object DisplayName, OWAEnabled, MAPIEnabled, ActiveSyncEnabled,
                  PopEnabled, ImapEnabled, EwsEnabled
```

Kiểm tra mailbox bị giữ bởi Litigation Hold hoặc retention/compliance hold. Đây là bước tra cứu; thay đổi hold có thể ảnh hưởng nghĩa vụ lưu trữ và eDiscovery.

```powershell
$Mailbox = 'user@contoso.com'

Get-Mailbox -Identity $Mailbox |
    Format-List LitigationHoldEnabled, LitigationHoldDate, InPlaceHolds,
                RetentionHoldEnabled, DelayHoldApplied, DelayReleaseHoldApplied
```

Liệt kê thành viên của distribution group. Thay địa chỉ bằng email hoặc alias của distribution group; lệnh này không dùng để liệt kê thành viên Microsoft 365 group.

```powershell
$Group = 'team@contoso.com'

Get-DistributionGroupMember -Identity $Group |
    Select-Object DisplayName, PrimarySmtpAddress, RecipientType
```

Với Microsoft 365 group, dùng `Get-UnifiedGroup` và `Get-UnifiedGroupLinks` để kiểm tra nhóm, thành viên hoặc chủ sở hữu.

```powershell
$Group = 'project@contoso.com'

Get-UnifiedGroup -Identity $Group |
    Select-Object DisplayName, PrimarySmtpAddress, AccessType

Get-UnifiedGroupLinks -Identity $Group -LinkType Members |
    Select-Object DisplayName, PrimarySmtpAddress

Get-UnifiedGroupLinks -Identity $Group -LinkType Owners |
    Select-Object DisplayName, PrimarySmtpAddress
```

Liệt kê distribution group, xem bộ lọc của dynamic distribution group và kiểm tra thành viên được resolve. Dynamic group không lưu danh sách thành viên cố định; kết quả được tính theo filter.

```powershell
Get-DistributionGroup -ResultSize 100 |
    Select-Object DisplayName, PrimarySmtpAddress, GroupType

Get-DynamicDistributionGroup -Identity 'dynamic@contoso.com' |
    Format-List Name, PrimarySmtpAddress, RecipientFilter

Get-DynamicDistributionGroupMember -Identity 'dynamic@contoso.com' |
    Select-Object DisplayName, PrimarySmtpAddress, RecipientType
```

Tra ngược các mail-enabled group trực tiếp mà một recipient là thành viên bằng bộ lọc `Members`. Lệnh này không thay thế truy vấn membership của Entra security group không mail-enabled.

```powershell
$Recipient = 'user@contoso.com'
$User = Get-Recipient -Identity $Recipient
$DistinguishedName = $User.DistinguishedName -replace "'", "''"

Get-Recipient -Filter "Members -eq '$DistinguishedName'" -ResultSize Unlimited |
    Select-Object DisplayName, PrimarySmtpAddress, RecipientTypeDetails
```

Liệt kê loại recipient khác thường cần tra cứu như mail contact và mail user.

```powershell
Get-MailContact -ResultSize 100 |
    Select-Object DisplayName, ExternalEmailAddress, PrimarySmtpAddress

Get-MailUser -ResultSize 100 |
    Select-Object DisplayName, PrimarySmtpAddress, ExternalEmailAddress
```

Đọc thuộc tính tổ chức của người dùng như title, department, manager và office. Dùng `-Identity` để giới hạn đúng tài khoản.

```powershell
$User = 'user@contoso.com'

Get-User -Identity $User |
    Select-Object DisplayName, UserPrincipalName, Title, Department, Company,
                  Manager, Office, Phone, MobilePhone, City, CountryOrRegion
```

## Kiểm tra mail flow và tìm email

`Get-MessageTraceV2` tra cứu trạng thái gửi nhận trong khoảng thời gian gần đây. Điền người gửi, người nhận và thời gian cần kiểm tra; nếu để trống địa chỉ, có thể trả về nhiều kết quả nên hãy thu hẹp điều kiện khi cần.

```powershell
$StartDate = (Get-Date).AddDays(-2)
$EndDate = Get-Date
$Sender = 'sender@contoso.com'
$Recipient = 'user@contoso.com'

Get-MessageTraceV2 -StartDate $StartDate -EndDate $EndDate `
    -SenderAddress $Sender -RecipientAddress $Recipient |
    Select-Object Received, SenderAddress, RecipientAddress, Subject, Status,
                  MessageTraceId
```

Kiểm tra forwarding được cấu hình trực tiếp trên mailbox bằng `Get-Mailbox`. Phân biệt `ForwardingSmtpAddress` với `DeliverToMailboxAndForward`: tùy lựa chọn, thư có thể được chuyển tiếp hoặc vẫn giữ bản sao trong mailbox.

```powershell
$Mailbox = 'user@contoso.com'

Get-Mailbox -Identity $Mailbox |
    Select-Object DisplayName, ForwardingSmtpAddress, DeliverToMailboxAndForward
```

Xem Inbox rules của một mailbox để tìm quy tắc tự chuyển tiếp, redirect hoặc xử lý thư. Hãy rà soát kỹ những rule không nhận ra, đặc biệt khi đang điều tra dấu hiệu gửi thư bất thường.

```powershell
$Mailbox = 'user@contoso.com'

Get-InboxRule -Mailbox $Mailbox |
    Select-Object Name, Enabled, Priority, ForwardTo, RedirectTo, DeleteMessage
```

Liệt kê transport rules, accepted domains và connector để kiểm tra cấu hình mail flow ở cấp tổ chức.

```powershell
Get-TransportRule |
    Select-Object Name, State, Mode, Priority

Get-AcceptedDomain |
    Select-Object Name, DomainName, DomainType

Get-InboundConnector |
    Select-Object Name, Enabled, SenderDomains

Get-OutboundConnector |
    Select-Object Name, Enabled, RecipientDomains, SmartHosts
```

Xem chi tiết một message trace bằng `Get-MessageTraceDetailV2`. Lấy `MessageTraceId` từ kết quả trace phía trên và nhập đúng recipient của bản tin.

```powershell
$MessageTraceId = '00000000-0000-0000-0000-000000000000'
$Recipient = 'user@contoso.com'

Get-MessageTraceDetailV2 -MessageTraceId $MessageTraceId `
    -RecipientAddress $Recipient |
    Select-Object Date, Event, Action, Detail
```

Rà soát mailbox có cấu hình SMTP forwarding hoặc chuyển tiếp đến một recipient khác. Đây là truy vấn đọc-only; với danh sách lớn, cân nhắc xuất ra CSV và kiểm tra theo từng nhóm.

```powershell
Get-Mailbox -ResultSize Unlimited |
    Where-Object {
        $_.ForwardingSmtpAddress -or $_.ForwardingAddress -or
        $_.DeliverToMailboxAndForward
    } |
    Select-Object DisplayName, PrimarySmtpAddress, ForwardingSmtpAddress,
                  ForwardingAddress, DeliverToMailboxAndForward
```

Kiểm tra remote domain để xác minh chính sách auto-forward, trả lời tự động và định dạng TNEF cho email gửi ra ngoài tenant.

```powershell
Get-RemoteDomain |
    Select-Object Name, DomainName, AutoForwardEnabled, AutoReplyEnabled,
                  TNEFEnabled
```

Xem quy tắc journaling và cấu hình ký DKIM theo domain. DKIM giúp ký email gửi đi; lệnh ở đây chỉ đọc trạng thái cấu hình.

```powershell
Get-JournalRule |
    Select-Object Name, Enabled, Scope, Recipient, JournalEmailAddress

Get-DkimSigningConfig |
    Select-Object Domain, Enabled, Selector1CNAME, Selector2CNAME
```

Kiểm tra transport rules và cấu hình vận chuyển cấp tổ chức. `Get-TransportConfig` trả về nhiều thuộc tính; chọn một số giá trị thường cần rà soát.

```powershell
Get-TransportRule |
    Select-Object Name, State, Mode, Priority, Description

Get-TransportConfig |
    Format-List MaxReceiveSize, MaxSendSize, ExternalPostmasterAddress,
                SmtpClientAuthenticationDisabled
```

## Kiểm tra quyền mailbox và calendar

`Get-MailboxPermission` cho biết ai có quyền Full Access trên mailbox. Bộ lọc bên dưới bỏ qua quyền kế thừa để tập trung vào các quyền được cấp trực tiếp.

```powershell
$Mailbox = 'shared@contoso.com'

Get-MailboxPermission -Identity $Mailbox |
    Where-Object { -not $_.IsInherited } |
    Select-Object User, AccessRights, Deny
```

Kiểm tra quyền Send As bằng `Get-RecipientPermission`; đây là quyền khác với Full Access. Có Full Access không đồng nghĩa với việc người dùng có thể gửi thư dưới danh nghĩa mailbox.

```powershell
$Mailbox = 'shared@contoso.com'

Get-RecipientPermission -Identity $Mailbox |
    Select-Object Trustee, AccessRights, IsInherited
```

Kiểm tra quyền trên thư mục Calendar. Tên thư mục có thể được bản địa hóa; nếu `:\Calendar` không khớp, trước hết tìm đường dẫn thư mục bằng `Get-MailboxFolderStatistics`.

```powershell
$Mailbox = 'user@contoso.com'

Get-MailboxFolderStatistics -Identity $Mailbox -FolderScope Calendar |
    Select-Object Name, FolderPath

Get-MailboxFolderPermission -Identity "${Mailbox}:\Calendar"
```

Để xem quyền trên các thư mục mailbox khác, lấy danh sách folder trước rồi truy vấn permission cho từng folder. Ví dụ chỉ in ra các quyền không phải Default/Anonymous để dễ rà soát.

```powershell
$Mailbox = 'user@contoso.com'

Get-MailboxFolderStatistics -Identity $Mailbox | ForEach-Object {
    $FolderPath = "$($Mailbox):" + ($_.FolderPath -replace '/', '\')
    Get-MailboxFolderPermission -Identity $FolderPath |
        Where-Object { "$($_.User)" -notin 'Default', 'Anonymous' } |
        Select-Object @{Name='Folder';Expression={$FolderPath}},
                      User, AccessRights
}
```

Kiểm tra quyền Send on Behalf ngay trên thuộc tính mailbox. Quyền này khác Send As: người nhận thư có thể thấy người gửi đã gửi thay mặt mailbox.

```powershell
$Mailbox = 'shared@contoso.com'

Get-Mailbox -Identity $Mailbox |
    Select-Object DisplayName, GrantSendOnBehalfTo
```

Đọc cấu hình giờ làm việc, múi giờ và lịch của người dùng bằng `Get-MailboxCalendarConfiguration`.

```powershell
$Mailbox = 'user@contoso.com'

Get-MailboxCalendarConfiguration -Identity $Mailbox |
    Format-List WorkingHoursStartTime, WorkingHoursEndTime,
                WorkingHoursTimeZone, WorkingDays, RemindersEnabled
```

Với mailbox phòng họp, `Get-CalendarProcessing` hiển thị thiết lập nhận và xử lý yêu cầu đặt lịch. Thay `room@contoso.com` bằng địa chỉ mailbox phòng cần kiểm tra.

```powershell
$Room = 'room@contoso.com'

Get-CalendarProcessing -Identity $Room |
    Format-List AutomateProcessing, AllBookInPolicy, AllRequestInPolicy,
                BookInPolicy, RequestInPolicy, ResourceDelegates
```

Liệt kê room list và các phòng thuộc một danh sách để xác minh tài nguyên có thể tìm thấy trong Room Finder.

```powershell
Get-DistributionGroup -RecipientTypeDetails RoomList |
    Select-Object DisplayName, PrimarySmtpAddress

Get-DistributionGroupMember -Identity 'hcm-rooms@contoso.com' |
    Select-Object DisplayName, PrimarySmtpAddress, RecipientTypeDetails
```

Xem metadata phòng như tòa nhà, tầng, sức chứa và thiết bị họp. Thay `room@contoso.com` bằng SMTP address của room mailbox.

```powershell
Get-Place -Identity 'room@contoso.com' |
    Select-Object DisplayName, Type, Building, Floor, Capacity, City,
                  AudioDeviceName, VideoDeviceName, DisplayDeviceName,
                  IsWheelChairAccessible
```

Để chẩn đoán lịch phòng, truy vấn meeting items trong một khoảng ngày cụ thể. Kết quả có subject, thời gian và trạng thái cuộc họp; chỉ dùng khi có quyền và mục đích hỗ trợ phù hợp.

```powershell
$Room = 'room@contoso.com'
$StartDate = (Get-Date).AddDays(-7)
$EndDate = Get-Date

Get-CalendarDiagnosticObjects -Identity $Room `
    -StartDate $StartDate -EndDate $EndDate -ResultSize 1000 |
    Select-Object NormalizedSubject, StartTime, EndTime, Location,
                  ItemClass, AppointmentState, IsCancelled, ResponseType
```

Thêm hoặc gỡ quyền trên thư mục Calendar bằng `Add-MailboxFolderPermission` và `Remove-MailboxFolderPermission`. Thay `Editor` bằng mức quyền phù hợp, chẳng hạn `Reviewer`, và chỉ bỏ `-WhatIf` sau khi xác nhận đúng mailbox, thư mục và người dùng.

```powershell
$Mailbox = 'user@contoso.com'
$Trustee = 'delegate@contoso.com'
$CalendarFolder = "${Mailbox}:\Calendar"

Add-MailboxFolderPermission -Identity $CalendarFolder `
    -User $Trustee -AccessRights Editor -WhatIf
```

```powershell
$Mailbox = 'user@contoso.com'
$Trustee = 'delegate@contoso.com'
$CalendarFolder = "${Mailbox}:\Calendar"

Remove-MailboxFolderPermission -Identity $CalendarFolder `
    -User $Trustee -Confirm:$false -WhatIf
```

Với mailbox phòng, có thể bật Resource Booking Assistant bằng `Set-CalendarProcessing`. Ví dụ chỉ xem trước thiết lập tự động xử lý yêu cầu; không tự thay đổi chính sách người được phép đặt phòng.

```powershell
$Room = 'room@contoso.com'

Set-CalendarProcessing -Identity $Room `
    -AutomateProcessing AutoAccept -WhatIf
```

## Kiểm tra audit, chính sách và bảo mật

Tìm hoạt động quản trị Exchange trong Unified Audit Log. Điều chỉnh ngày và `UserIds` để giới hạn kết quả; để trống `UserIds` nếu muốn tìm trên toàn tenant.

```powershell
$StartDate = (Get-Date).AddDays(-7)
$EndDate = Get-Date
$Admin = 'admin@contoso.com'

Search-UnifiedAuditLog -StartDate $StartDate -EndDate $EndDate `
    -RecordType ExchangeAdmin -UserIds $Admin -ResultSize 1000 |
    Select-Object CreationDate, UserIds, Operations, ObjectId, AuditData
```

Kiểm tra thư đang nằm trong quarantine theo khoảng ngày. Lệnh dưới đây chỉ truy vấn, không giải phóng hay xóa thư.

```powershell
$StartDate = (Get-Date).AddDays(-7)
$EndDate = Get-Date

Get-QuarantineMessage -StartDate $StartDate -EndDate $EndDate |
    Select-Object ReceivedTime, SenderAddress, RecipientAddress, Subject,
                  Type, ReleaseStatus
```

Đọc cấu hình audit và danh sách thao tác được audit trên mailbox. Nếu điều tra audit bypass, kiểm tra cả association của mailbox và tài khoản được miễn audit.

```powershell
$Mailbox = 'user@contoso.com'

Get-Mailbox -Identity $Mailbox |
    Select-Object AuditEnabled, AuditLogAgeLimit, AuditAdmin, AuditDelegate,
                  AuditOwner

Get-MailboxAuditBypassAssociation -Identity 'admin@contoso.com'
```

Kiểm tra các chính sách chống phishing, spam, malware và lọc kết nối. Đây là các lệnh đọc cấu hình; mỗi policy có thể có nhiều rule xác định đối tượng được áp dụng.

```powershell
Get-AntiPhishPolicy |
    Select-Object Name, IsDefault, EnableSpoofIntelligence,
                  EnableMailboxIntelligence

Get-HostedContentFilterPolicy |
    Select-Object Name, IsDefault, SpamAction, HighConfidenceSpamAction,
                  PhishSpamAction, BulkThreshold

Get-HostedOutboundSpamFilterPolicy |
    Select-Object Name, IsDefault, AutoForwardingMode,
                  RecipientLimitExternalPerHour, RecipientLimitPerDay

Get-MalwareFilterPolicy |
    Select-Object Name, IsDefault, EnableFileFilter, FileTypes, FileTypeAction

Get-HostedConnectionFilterPolicy |
    Select-Object Name, IsDefault, IPAllowList, IPBlockList
```

Kiểm tra policy hạn chế ứng dụng truy cập mailbox và các quyết định allow/block dành cho spoofed sender.

```powershell
Get-ApplicationAccessPolicy |
    Select-Object AppId, ScopeName, ScopeIdentity, AccessRight, Description

Get-TenantAllowBlockListSpoofItems |
    Select-Object SpoofedUser, SendingInfrastructure, SpoofType, Action,
                  LastModifiedDateTime
```

Đọc sender/domain allow và block list theo từng inbound spam policy, cùng các mục Tenant Allow/Block List. Kiểm tra rõ loại danh sách và trạng thái trước khi quyết định xử lý một mục.

```powershell
Get-HostedContentFilterPolicy |
    Select-Object Name, IsDefault, AllowedSenders, AllowedSenderDomains,
                  BlockedSenders, BlockedSenderDomains

Get-TenantAllowBlockListItems -ListType Sender
Get-TenantAllowBlockListItems -ListType Url
Get-TenantAllowBlockListItems -ListType FileHash
Get-TenantAllowBlockListItems -ListType IP
Get-TenantAllowBlockListSpoofItems
```

Kiểm tra cấu hình thư rác cá nhân của mailbox, bao gồm danh sách người gửi an toàn và bị chặn.

```powershell
$Mailbox = 'user@contoso.com'

Get-MailboxJunkEmailConfiguration -Identity $Mailbox |
    Select-Object Enabled, TrustedSendersAndDomains,
                  BlockedSendersAndDomains
```

### Audit, role và chính sách tổ chức

Tìm các role group Exchange và thành viên; đây là cách nhanh để rà soát quyền quản trị cấp tổ chức.

```powershell
Get-RoleGroup |
    Select-Object Name, Roles, ManagedBy

Get-RoleGroupMember -Identity 'Organization Management' |
    Select-Object Name, PrimarySmtpAddress, RecipientType
```

Xem role assignment của một tài khoản. Kết quả phụ thuộc scope và role đã được gán trong RBAC.

```powershell
$Admin = 'admin@contoso.com'

Get-ManagementRoleAssignment -RoleAssignee $Admin |
    Select-Object Role, RoleAssigneeName, AssignmentMethod, RecipientReadScope,
                  RecipientWriteScope
```

Kiểm tra chính sách retention và các tag liên quan. Các lệnh này tra cứu cấu hình MRM của Exchange, không thay thế việc kiểm tra retention policy trong Purview.

```powershell
Get-RetentionPolicy |
    Select-Object Name, RetentionPolicyTagLinks

Get-RetentionPolicyTag |
    Select-Object Name, Type, RetentionEnabled, AgeLimitForRetention,
                  RetentionAction
```

Tra cứu các policy phổ biến của OWA, thiết bị di động, chia sẻ và role assignment. Dùng `Get-*` tương ứng để xem cấu hình của policy cụ thể.

```powershell
Get-OwaMailboxPolicy
Get-MobileDeviceMailboxPolicy
Get-SharingPolicy
Get-RoleAssignmentPolicy
Get-AddressBookPolicy
Get-ThrottlingPolicy
```

### Cấu hình tenant, địa chỉ và migration

Kiểm tra accepted domains, address list, GAL và email address policy để xác minh định tuyến và cách recipient xuất hiện trong danh bạ.

```powershell
Get-AcceptedDomain |
    Select-Object Name, DomainName, DomainType

Get-AddressList |
    Select-Object Name, RecipientFilter

Get-GlobalAddressList |
    Select-Object Name, RecipientFilter

Get-EmailAddressPolicy |
    Select-Object Name, EnabledEmailAddressTemplates, Priority
```

Đọc cấu hình tổ chức, quan hệ chia sẻ với tenant ngoài và trạng thái migration. Với migration, trạng thái batch và move request giúp xác định tác vụ đang đồng bộ, hoàn tất hay lỗi.

```powershell
Get-OrganizationConfig |
    Format-List Name, DisplayName, ExternalDirectoryOrganizationId,
                DefaultPublicFolderMailbox

Get-OrganizationRelationship |
    Select-Object Name, DomainNames, FreeBusyAccessEnabled,
                  FreeBusyAccessLevel

Get-MigrationBatch |
    Select-Object Identity, Status, TotalCount, SyncedCount, FailedCount

Get-MoveRequest |
    Select-Object DisplayName, Status, TargetDatabase, BatchName
```

Exchange Online còn có mailbox soft-deleted hoặc inactive, thường cần kiểm tra trong kịch bản khôi phục hay eDiscovery. Các switch lọc kết quả; không dùng lệnh xóa để xử lý các mailbox này khi chưa xác minh yêu cầu lưu trữ.

```powershell
Get-Mailbox -SoftDeletedMailbox -ResultSize 100 |
    Select-Object DisplayName, PrimarySmtpAddress, WhenSoftDeleted

Get-Mailbox -InactiveMailboxOnly -ResultSize 100 |
    Select-Object DisplayName, PrimarySmtpAddress, LitigationHoldEnabled,
                  InPlaceHolds
```

Liệt kê thiết bị ActiveSync đã liên kết với mailbox để hỗ trợ xử lý sự cố đồng bộ thiết bị.

```powershell
$Mailbox = 'user@contoso.com'

Get-MobileDevice -Mailbox $Mailbox |
    Select-Object UserDisplayName, DeviceType, DeviceModel, DeviceOS,
                  DeviceAccessState, FirstSyncTime
```

### Tìm hiểu cmdlet khi cần thêm tham số

Nếu một cmdlet có nhiều parameter set, dùng `Get-Help` để xem cú pháp và ví dụ. Có thể kiểm tra nhanh tham số mà phiên hiện tại hiển thị bằng `Get-Command`.

```powershell
Get-Help Get-Mailbox -Full
Get-Help Get-MessageTraceV2 -Examples

(Get-Command Get-Mailbox).Parameters.Keys | Sort-Object
```

Một số cmdlet chỉ xuất hiện khi module đủ mới, phiên Exchange Online đã kết nối, và role của tài khoản cho phép. Kiểm tra trước khi kết luận lệnh không tồn tại:

```powershell
Get-Module ExchangeOnlineManagement -ListAvailable |
    Select-Object Name, Version, Path

Get-ConnectionInformation |
    Select-Object UserPrincipalName, State, ConnectionUri

Get-Command Get-MessageTraceV2
```

Nếu `Get-MessageTraceV2` chưa có trong phiên, hãy cập nhật module rồi kết nối lại; trong môi trường còn dùng cmdlet cũ, `Get-MessageTrace` có thể vẫn được hỗ trợ.

## Thay đổi cấu hình có bước xem trước

Các lệnh dưới đây có thể thay đổi cấu hình thật. `-WhatIf` yêu cầu PowerShell hiển thị hành động dự kiến thay vì áp dụng thay đổi. Kiểm tra đúng đối tượng và tham số trước; chỉ bỏ `-WhatIf` sau khi đã xác nhận thay đổi được phê duyệt.

### Bật trả lời tự động

Điền nội dung, thời gian và mailbox cần cấu hình. `Scheduled` bật trả lời trong khoảng thời gian đã chọn; dùng `Enabled` nếu muốn bật ngay, hoặc `Disabled` để tắt.

```powershell
$Mailbox = 'user@contoso.com'
$StartTime = [datetime]'2026-11-01 08:00'
$EndTime = [datetime]'2026-11-10 18:00'
$Message = 'I am out of the office and will return on November 11.'

Set-MailboxAutoReplyConfiguration -Identity $Mailbox `
    -AutoReplyState Scheduled `
    -StartTime $StartTime -EndTime $EndTime `
    -InternalMessage $Message -ExternalMessage $Message `
    -ExternalAudience All -WhatIf
```

### Cấp hoặc thu hồi quyền Full Access

Full Access cho phép mở và quản lý nội dung mailbox, nhưng không bao gồm Send As. Thay trustee bằng recipient cụ thể; xác minh `-WhatIf` trước khi chạy lệnh thật.

```powershell
$Mailbox = 'shared@contoso.com'
$Trustee = 'delegate@contoso.com'

Add-MailboxPermission -Identity $Mailbox -User $Trustee `
    -AccessRights FullAccess -InheritanceType All `
    -AutoMapping $true -WhatIf
```

Để thu hồi quyền Full Access đã cấp trực tiếp, dùng lệnh sau. Chỉ gỡ đúng trustee đã xác minh.

```powershell
$Mailbox = 'shared@contoso.com'
$Trustee = 'delegate@contoso.com'

Remove-MailboxPermission -Identity $Mailbox -User $Trustee `
    -AccessRights FullAccess -InheritanceType All -WhatIf
```

### Cấp hoặc thu hồi Send As

Send As cho phép gửi thư với địa chỉ của mailbox. Hãy kiểm tra người nhận và mục tiêu trước khi áp dụng, nhất là với mailbox dùng chung hoặc mailbox có dữ liệu nhạy cảm.

```powershell
$Mailbox = 'shared@contoso.com'
$Trustee = 'delegate@contoso.com'

Add-RecipientPermission -Identity $Mailbox -Trustee $Trustee `
    -AccessRights SendAs -WhatIf
```

```powershell
$Mailbox = 'shared@contoso.com'
$Trustee = 'delegate@contoso.com'

Remove-RecipientPermission -Identity $Mailbox -Trustee $Trustee `
    -AccessRights SendAs -Confirm:$false -WhatIf
```

### Cấp hoặc thu hồi Send on Behalf

Send on Behalf hiển thị người gửi đã gửi thư thay mặt mailbox. Các tham số `@{Add=...}` và `@{Remove=...}` giúp chỉ thêm hoặc gỡ một delegate, không ghi đè danh sách hiện có.

```powershell
$Mailbox = 'shared@contoso.com'
$Trustee = 'delegate@contoso.com'

Set-Mailbox -Identity $Mailbox `
    -GrantSendOnBehalfTo @{ Add = $Trustee } -WhatIf
```

```powershell
$Mailbox = 'shared@contoso.com'
$Trustee = 'delegate@contoso.com'

Set-Mailbox -Identity $Mailbox `
    -GrantSendOnBehalfTo @{ Remove = $Trustee } -WhatIf
```

### Cập nhật tên hiển thị hoặc ẩn khỏi GAL

Chỉ đưa vào lệnh những thuộc tính thực sự muốn thay đổi. Ví dụ này đổi tên hiển thị và bỏ trạng thái ẩn khỏi danh sách địa chỉ toàn cục (GAL).

```powershell
$Mailbox = 'shared@contoso.com'

Set-Mailbox -Identity $Mailbox `
    -DisplayName 'Project Shared Mailbox' `
    -HiddenFromAddressListsEnabled $false -WhatIf
```

### Bật hoặc gỡ chuyển tiếp thư

Forwarding có thể làm thư rời khỏi mailbox hoặc tenant. Xác minh địa chỉ đích và chính sách bảo mật trước khi thay đổi.

```powershell
$Mailbox = 'user@contoso.com'
$ForwardTo = 'delegate@contoso.com'

Set-Mailbox -Identity $Mailbox `
    -ForwardingSmtpAddress $ForwardTo `
    -DeliverToMailboxAndForward $true -WhatIf
```

Để xóa cấu hình chuyển tiếp ở mailbox, đặt địa chỉ chuyển tiếp về `$null` và tắt tùy chọn giữ bản sao khi forward.

```powershell
$Mailbox = 'user@contoso.com'

Set-Mailbox -Identity $Mailbox `
    -ForwardingSmtpAddress $null `
    -DeliverToMailboxAndForward $false -WhatIf
```

### Xuất kết quả và lưu ý khi chạy lệnh

Có thể nối kết quả của lệnh đọc với `Export-Csv` để lưu báo cáo mở bằng Excel. Thay đường dẫn và tên file theo nhu cầu.

```powershell
$Mailbox = 'user@contoso.com'

Get-MailboxStatistics -Identity $Mailbox |
    Select-Object DisplayName, TotalItemSize, ItemCount, LastLogonTime |
    Export-Csv -Path '.\mailbox-statistics.csv' `
        -NoTypeInformation -Encoding UTF8
```

Một số lưu ý giúp chạy lệnh an toàn và dễ xử lý lỗi hơn:

- Chạy **từng khối lệnh** thay vì dán cả bộ script không liên quan vào cùng một phiên.
- Thay các giá trị mẫu như `user@contoso.com`, ngày tháng và tên nhóm trước khi chạy.
- Bắt đầu bằng truy vấn một đối tượng cụ thể; hạn chế truy vấn toàn tenant nếu chưa cần.
- Lệnh `Get-*` thường dùng để đọc dữ liệu; lệnh `Set-*`, `Add-*` và `Remove-*` có thể thay đổi cấu hình hoặc quyền.
- Với lệnh thay đổi, xem trước bằng `-WhatIf`, kiểm tra đối tượng và phạm vi, rồi mới chạy thật theo quy trình phê duyệt của tổ chức.
- Nếu cmdlet không được nhận diện, kiểm tra module và phiên bằng `Get-Module ExchangeOnlineManagement` và `Get-ConnectionInformation`; nếu thiếu quyền, yêu cầu cấp role phù hợp thay vì dùng tài khoản khác.

## Kết luận

Exchange Online PowerShell hữu ích nhất khi cần tra cứu nhanh, lặp lại thao tác hoặc xuất thông tin để điều tra. Hãy bắt đầu bằng các lệnh đọc dữ liệu, lọc đúng đối tượng, rồi mới thực hiện thay đổi có kiểm soát bằng `-WhatIf`. Bạn thường cần nhóm lệnh nào nhất khi quản trị Exchange Online?
