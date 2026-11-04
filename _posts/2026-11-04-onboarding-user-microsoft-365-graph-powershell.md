---
layout: post
title: "Onboarding nhân viên mới trên Microsoft 365 bằng Microsoft Graph PowerShell: từ file HR đến ngày làm việc đầu tiên"
seo_title: "Onboarding user Microsoft 365 bằng Graph PowerShell"
description: "Thiết kế quy trình onboarding nhân viên mới trên Microsoft 365: kiểm tra dữ liệu HR, tạo user, group-based licensing, Temporary Access Pass, cấu hình mailbox."
date: 2026-11-04
author: "Tam Nguyen"
reading_time: 12
topic: m365
thumb_label: "MICROSOFT 365 · ONBOARDING"
image: /images/photo/22.jpg
tags:
  - Microsoft 365
  - Microsoft Graph
  - Entra ID
  - Exchange Online
  - PowerShell
card_tags:
  - Microsoft 365
  - Onboarding
summary: "Quy trình 7 bước tạo tài khoản Microsoft 365 cho nhân viên mới bằng Graph PowerShell: kiểm tra dữ liệu, license theo group, Temporary Access Pass."
redirect_from:
  - /posts/onboarding-user-microsoft-365-graph-powershell.html
---

Đầu tháng, HR gửi một file Excel với 20 nhân viên mới, ngày nhận việc là thứ Hai. Mỗi người cần có tài khoản, email, Teams và cách đăng nhập lần đầu an toàn trước 8 giờ sáng. Làm tay qua Entra admin center thì mỗi tài khoản mất 15-20 phút, và lỗi hay gặp nhất không nằm ở thao tác mà ở **dữ liệu**: thiếu phòng ban, sai tên quản lý, nhập nhầm loại hợp đồng. Bài này trình bày cách mình thiết kế quy trình onboarding cho tenant khoảng vài nghìn user dùng Microsoft 365 E3, chỉ dùng **Microsoft Graph PowerShell** và **Exchange Online PowerShell**.

> **Tóm tắt nhanh:** Onboarding gồm 7 bước: kiểm tra dữ liệu HR trước ngày nhận việc, tạo user với đủ thuộc tính, gán quản lý, thêm vào group để nhận license tự động, chờ mailbox rồi cấu hình, cấp Temporary Access Pass để đăng nhập lần đầu, và ghi báo cáo. Nguyên tắc quan trọng nhất: **dữ liệu chưa sạch thì không tạo tài khoản**.

## Bối cảnh: các nguyên tắc thiết kế

Trước khi viết code, mình chốt 4 nguyên tắc:

- **Một nguồn dữ liệu duy nhất** — mọi thông tin lấy từ file HR xuất ra, không nhập tay giữa chừng.
- **License theo group, không gán trực tiếp** — dùng [group-based licensing](https://learn.microsoft.com/entra/identity/users/licensing-groups-assign) để user rời group là tự thu hồi license.
- **Không có mật khẩu đi qua email** — dùng [Temporary Access Pass](https://learn.microsoft.com/entra/identity/authentication/howto-authentication-temporary-access-pass) (TAP) có thời hạn để user tự đăng ký MFA hoặc passkey.
- **Mỗi bước đều ghi kết quả** — `OK`, `FAIL` hoặc `SKIP`, để biết chính xác bước nào cần làm lại.

Nếu tenant có license **Microsoft Entra ID Governance**, bạn nên xem thêm [Lifecycle Workflows](https://learn.microsoft.com/entra/id-governance/what-are-lifecycle-workflows), tính năng có sẵn cho joiner/leaver. Script trong bài phù hợp với tenant chưa có license này, hoặc cần tùy biến nhiều hơn.

## Dữ liệu đầu vào và bước kiểm tra trước

HR xuất file `hr-onboarding-batch.csv` với các cột sau:

| Cột | Ví dụ | Thuộc tính Entra ID |
|---|---|---|
| `GivenName`, `Surname` | `An`, `Nguyen` | `givenName`, `surname` |
| `EmployeeId` | `E10234` | `employeeId` |
| `ContractType` | `Fulltime` / `Parttime` | `employeeType` |
| `Department`, `JobTitle` | `Finance`, `Accountant` | `department`, `jobTitle` |
| `City`, `Country` | `Ho Chi Minh`, `VN` | `city`, `usageLocation` |
| `ManagerEmployeeId` | `E00871` | dùng để tìm quản lý |
| `PersonalEmail` | `an@gmail.com` | `otherMails` |
| `StartDate` | `2026-11-10` | `employeeHireDate` |

Quản lý được tìm bằng `employeeId` — một thuộc tính chuẩn của Entra ID — thay vì lưu mã trong custom attribute. Nhờ vậy quan hệ quản lý nằm đúng chỗ (`manager`), dùng được cho Teams, Outlook org chart và dynamic group.

### Script kiểm tra trước (chạy trước ngày nhận việc 4 ngày)

```powershell
Connect-MgGraph -Scopes "User.Read.All" -NoWelcome
$rows   = Import-Csv ".\hr-onboarding-batch.csv"
$need   = 'GivenName','Surname','EmployeeId','ContractType','Department',
          'JobTitle','City','Country','ManagerEmployeeId','PersonalEmail','StartDate'
$report = foreach ($r in $rows) {
    $issues = @()
    $issues += $need | Where-Object { [string]::IsNullOrWhiteSpace($r.$_) } |
               ForEach-Object { "Thiếu $_" }
    if ($r.ContractType -notin 'Fulltime','Parttime') { $issues += "ContractType không hợp lệ" }
    if (Get-MgUser -Filter "employeeId eq '$($r.EmployeeId)'" -ConsistencyLevel eventual -CountVariable c) {
        $issues += "EmployeeId đã tồn tại" }
    if (-not (Get-MgUser -Filter "employeeId eq '$($r.ManagerEmployeeId)'" -ConsistencyLevel eventual -CountVariable c)) {
        $issues += "Không tìm thấy quản lý" }
    [pscustomobject]@{
        EmployeeId = $r.EmployeeId
        Name       = "$($r.GivenName) $($r.Surname)"
        Status     = if ($issues) { 'NOT READY' } else { 'READY' }
        Issues     = $issues -join '; '
    }
}
$report | Export-Csv ".\onboarding-precheck-report.csv" -NoTypeInformation -Encoding UTF8
$report | Format-Table -AutoSize
```

Gửi file `onboarding-precheck-report.csv` cho HR. Chỉ những dòng `READY` mới được đưa vào bước tạo tài khoản.

## Quy trình Onboarding 7 bước

| # | Bước | Công cụ |
|---|---|---|
| 1 | Tạo user với đủ thuộc tính | Graph |
| 2 | Gán quản lý | Graph |
| 3 | Thêm vào group license theo loại hợp đồng | Graph |
| 4 | Chờ mailbox được tạo | Exchange Online |
| 5 | Cấu hình mailbox | Exchange Online |
| 6 | Cấp Temporary Access Pass | Graph |
| 7 | Ghi báo cáo và gửi thông tin cho quản lý | Graph (sendMail) |

### Bước 1: Tạo user

UPN theo quy tắc `ten.ho@contoso.com`. Nếu trùng, thêm số thứ tự. Mật khẩu ban đầu là chuỗi ngẫu nhiên dài, **không ai cần biết**, vì user sẽ đăng nhập bằng TAP.

```powershell
function New-UpnCandidate($given, $sur, $domain) {
    $base = ("$given.$sur" -replace '\s','').ToLower()
    $base = $base.Normalize('FormD') -replace '\p{Mn}','' -replace 'đ','d'
    $upn = "$base@$domain"; $i = 1
    while (Get-MgUser -Filter "userPrincipalName eq '$upn'" -ErrorAction SilentlyContinue) {
        $upn = "$base$i@$domain"; $i++ }
    $upn
}
$upn  = New-UpnCandidate $r.GivenName $r.Surname "contoso.com"
$pwd  = -join ((33..126) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
$user = New-MgUser -AccountEnabled -DisplayName "$($r.GivenName) $($r.Surname)" `
    -GivenName $r.GivenName -Surname $r.Surname -UserPrincipalName $upn `
    -MailNickname ($upn.Split('@')[0]) -EmployeeId $r.EmployeeId `
    -EmployeeType $r.ContractType -Department $r.Department -JobTitle $r.JobTitle `
    -City $r.City -UsageLocation $r.Country -OtherMails @($r.PersonalEmail) `
    -EmployeeHireDate ([datetime]$r.StartDate) `
    -PasswordProfile @{ Password = $pwd; ForceChangePasswordNextSignIn = $false }
```

`UsageLocation` là bắt buộc trước khi gán license, nên phải đặt ngay khi tạo.

### Bước 2: Gán quản lý

```powershell
$mgr = Get-MgUser -Filter "employeeId eq '$($r.ManagerEmployeeId)'" -ConsistencyLevel eventual -CountVariable c
Set-MgUserManagerByRef -UserId $user.Id -BodyParameter @{
    "@odata.id" = "https://graph.microsoft.com/v1.0/users/$($mgr.Id)" }
```

### Bước 3: Gán license qua group

Mỗi loại hợp đồng tương ứng một security group đã được gán sẵn license:

| ContractType | Group | License |
|---|---|---|
| `Fulltime` | `LIC-M365-E3-Fulltime` | Microsoft 365 E3 |
| `Parttime` | `LIC-M365-F3-Parttime` | Microsoft 365 F3 |

```powershell
$licGroup = @{ Fulltime = '<GROUP_ID_E3>'; Parttime = '<GROUP_ID_F3>' }
New-MgGroupMember -GroupId $licGroup[$r.ContractType] -DirectoryObjectId $user.Id
```

<div class="callout">
  <span>💡</span>
  <div><b>Tip</b>Thay vì thêm thành viên bằng script, bạn có thể làm cho hai group này là <b>dynamic group</b> với rule <code>(user.employeeType -eq "Fulltime")</code>. Khi HR đổi loại hợp đồng, license tự đổi theo mà không cần ai can thiệp.</div>
</div>

## Cấu hình mailbox

### Bước 4: Chờ mailbox

Sau khi license được áp dụng, Exchange Online cần vài phút tới vài chục phút để tạo mailbox. Dùng vòng lặp có giới hạn thay vì chờ cố định:

```powershell
Connect-ExchangeOnline -ShowBanner:$false
$deadline = (Get-Date).AddMinutes(20)
do { Start-Sleep 30; $mbx = Get-EXOMailbox -Identity $upn -ErrorAction SilentlyContinue }
until ($mbx -or (Get-Date) -gt $deadline)
if (-not $mbx) { throw "Mailbox của $upn chưa sẵn sàng sau 20 phút" }
```

### Bước 5: Archive, giao thức cũ, retention, ngôn ngữ

```powershell
if ($r.ContractType -eq 'Fulltime') { Enable-Mailbox -Identity $upn -Archive }
Set-CASMailbox -Identity $upn -PopEnabled $false -ImapEnabled $false -SmtpClientAuthenticationDisabled $true
Set-Mailbox -Identity $upn -RetentionPolicy "Company-Default-Retention"
Set-MailboxRegionalConfiguration -Identity $upn -Language vi-VN -TimeZone "SE Asia Standard Time" -LocalizeDefaultFolderName
```

Tốt hơn nữa là đặt các giá trị này trong **CAS mailbox plan** và retention policy mặc định của tenant, để mailbox mới tự có. Script khi đó chỉ đóng vai trò kiểm tra lại.

## Đăng nhập lần đầu bằng Temporary Access Pass

### Bước 6: Cấp TAP

TAP là mã dùng một lần (hoặc nhiều lần) có thời hạn, cho phép user đăng nhập và tự đăng ký Microsoft Authenticator hoặc passkey. TAP có hiệu lực từ 8 giờ sáng ngày nhận việc, kéo dài 8 tiếng.

```powershell
Connect-MgGraph -Scopes "UserAuthenticationMethod.ReadWrite.All" -NoWelcome
$start = ([datetime]$r.StartDate).Date.AddHours(8)
$tap = New-MgUserAuthenticationTemporaryAccessPassMethod -UserId $user.Id -BodyParameter @{
    startDateTime     = $start.ToUniversalTime().ToString("o")
    lifetimeInMinutes = 480
    isUsableOnce      = $false }
```

<div class="callout warn">
  <span>⚠️</span>
  <div><b>Lưu ý</b>Chính sách TAP phải được bật trong <i>Entra admin center → Protection → Authentication methods</i>, và nhóm user mới phải nằm trong phạm vi áp dụng. Thời hạn tối đa của TAP do chính sách này quyết định.</div>
</div>

### Bước 7: Gửi thông tin và ghi báo cáo

TAP chỉ gửi cho **quản lý trực tiếp**, không gửi tới email cá nhân của nhân viên. Quản lý trao mã cho nhân viên vào sáng ngày đầu tiên.

```powershell
$body = @"
<p>Chào $($mgr.DisplayName),</p>
<p>Tài khoản cho nhân viên mới <b>$($user.DisplayName)</b> đã sẵn sàng.</p>
<ul><li>Tài khoản: $upn</li>
<li>Temporary Access Pass: <b>$($tap.TemporaryAccessPass)</b></li>
<li>Hiệu lực: $($start.ToString('dd/MM/yyyy HH:mm')), trong 8 tiếng</li></ul>
<p>Vui lòng trao mã trực tiếp cho nhân viên vào ngày đầu tiên.</p>
"@
Send-MgUserMail -UserId "it-onboarding@contoso.com" -BodyParameter @{
    message = @{ subject = "[Onboarding] Tài khoản cho $($user.DisplayName)"
                 body = @{ contentType = "HTML"; content = $body }
                 toRecipients = @(@{ emailAddress = @{ address = $mgr.Mail } }) } }
```

Báo cáo ghi ra `onboarding-result-yyyyMMdd.csv`, gồm UPN và trạng thái từng bước, **không bao giờ** ghi TAP hay mật khẩu.

## Những lỗi thường gặp

- **`License assignment failed because UsageLocation is not set`** — user tạo thiếu `UsageLocation`, group-based licensing báo lỗi trong tab *Licenses* của group. Cách xử lý: luôn đặt `UsageLocation` ở bước 1, rồi chạy lại xử lý license cho group.
- **`Enable-Mailbox -Archive` báo không tìm thấy mailbox** — chạy khi mailbox chưa tạo xong. Cách xử lý: dùng vòng lặp chờ ở bước 4.
- **Tìm `employeeId` báo lỗi filter** — một số filter trên thuộc tính mở rộng cần advanced query. Cách xử lý: thêm `-ConsistencyLevel eventual -CountVariable`.
- **Không tạo được TAP** — chính sách TAP chưa bật hoặc user không nằm trong phạm vi áp dụng. Kiểm tra lại chính sách trước đợt onboarding.
- **Tên có dấu tiếng Việt tạo UPN lỗi** — `Nguyễn Đức` thành ký tự lạ. Hàm `New-UpnCandidate` bỏ dấu bằng `Normalize('FormD')` và đổi riêng `đ` thành `d`.

## Kết luận

Một quy trình onboarding tốt bắt đầu **trước** ngày tạo tài khoản: kiểm tra dữ liệu HR sớm, chỉ tạo khi dữ liệu sạch. Phần còn lại dựa vào các tính năng sẵn có của Microsoft 365: group-based licensing cho license, `manager` chuẩn của Entra cho quan hệ báo cáo, và Temporary Access Pass để không phải gửi mật khẩu.

Việc nên làm tiếp: chạy script kiểm tra trước với đợt nhân viên mới tiếp theo và gửi kết quả cho HR. Đọc thêm bài [Offboarding](/posts/offboarding-user-microsoft-365-graph-powershell.html) để có trọn vòng đời tài khoản. Team bạn đang cấp quyền đăng nhập lần đầu bằng mật khẩu tạm hay đã chuyển sang Temporary Access Pass?

## Full script Onboarding

Script dưới đây gộp toàn bộ các bước trong bài. Chạy bằng **PowerShell 7**, cần module `Microsoft.Graph` và `ExchangeOnlineManagement`. Sửa phần `CONFIG` cho đúng tenant, chạy với `-Mode PreCheck` trước, rồi `-Mode Create` khi HR đã sửa xong dữ liệu.

```powershell
<#
.SYNOPSIS  Onboarding user Microsoft 365 (Entra ID + Exchange Online) tu file HR.
.EXAMPLE   .\Invoke-M365Onboarding.ps1 -CsvPath .\hr-onboarding-batch.csv -Mode PreCheck
.EXAMPLE   .\Invoke-M365Onboarding.ps1 -CsvPath .\hr-onboarding-batch.csv -Mode Create
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)] [string]$CsvPath,
    [ValidateSet('PreCheck','Create')] [string]$Mode = 'PreCheck'
)
#region ===== CONFIG =====
$Domain          = "contoso.com"
$SenderMailbox   = "it-onboarding@contoso.com"
$RetentionPolicy = "Company-Default-Retention"
$LicenseGroup    = @{ Fulltime = "<GROUP_ID_E3>"; Parttime = "<GROUP_ID_F3>" }
$TapLifetimeMin  = 480
$MailboxWaitMin  = 20
$OutDir          = Join-Path $PSScriptRoot "output"
#endregion
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
$Required = 'GivenName','Surname','EmployeeId','ContractType','Department','JobTitle',
            'City','Country','ManagerEmployeeId','PersonalEmail','StartDate'
function Get-UserByEmployeeId([string]$Id) {
    Get-MgUser -Filter "employeeId eq '$Id'" -ConsistencyLevel eventual -CountVariable c `
        -Property Id,DisplayName,Mail,UserPrincipalName,EmployeeId | Select-Object -First 1
}
function New-UpnCandidate([string]$Given, [string]$Sur) {
    $base = ("$Given.$Sur" -replace '\s','').ToLower() -replace 'đ','d'
    $base = ($base.Normalize([Text.NormalizationForm]::FormD) -replace '\p{Mn}','') -replace '[^a-z0-9\.]',''
    $upn = "$base@$Domain"; $i = 1
    while (Get-MgUser -Filter "userPrincipalName eq '$upn'" -ErrorAction SilentlyContinue) {
        $upn = "$base$i@$Domain"; $i++ }
    $upn
}
function New-RandomPassword { -join ((48..57)+(65..90)+(97..122)+(33,35,36,37,64) | Get-Random -Count 32 | ForEach-Object {[char]$_}) }
# ===== CONNECT =====
Connect-MgGraph -NoWelcome -Scopes "User.ReadWrite.All","Group.ReadWrite.All",
    "UserAuthenticationMethod.ReadWrite.All","Mail.Send"
$Rows = Import-Csv $CsvPath
# ===== PRE-CHECK =====
$Check = foreach ($r in $Rows) {
    $issues = @()
    $issues += $Required | Where-Object { [string]::IsNullOrWhiteSpace($r.$_) } | ForEach-Object { "Thieu $_" }
    if ($r.ContractType -notin 'Fulltime','Parttime') { $issues += "ContractType khong hop le" }
    if ($r.EmployeeId -and (Get-UserByEmployeeId $r.EmployeeId)) { $issues += "EmployeeId da ton tai" }
    if ($r.ManagerEmployeeId -and -not (Get-UserByEmployeeId $r.ManagerEmployeeId)) { $issues += "Khong tim thay quan ly" }
    try { [void][datetime]$r.StartDate } catch { $issues += "StartDate sai dinh dang" }
    [pscustomobject]@{ EmployeeId = $r.EmployeeId; Name = "$($r.GivenName) $($r.Surname)"
        Status = if ($issues) {'NOT READY'} else {'READY'}; Issues = $issues -join '; ' }
}
$Check | Export-Csv (Join-Path $OutDir "onboarding-precheck-report.csv") -NoTypeInformation -Encoding UTF8
$Check | Format-Table -AutoSize
if ($Mode -eq 'PreCheck') { return }
# ===== CREATE =====
Connect-ExchangeOnline -ShowBanner:$false
$Ready  = $Rows | Where-Object { $_.EmployeeId -in ($Check | Where-Object Status -eq 'READY').EmployeeId }
$Result = [System.Collections.Generic.List[object]]::new()
foreach ($r in $Ready) {
    $log = [ordered]@{ EmployeeId = $r.EmployeeId; UPN = ''; CreateUser='SKIP'; Manager='SKIP'
        License='SKIP'; Mailbox='SKIP'; MailboxConfig='SKIP'; TAP='SKIP'; Notify='SKIP'; Error='' }
    try {
        # 1. Tao user
        $upn = New-UpnCandidate $r.GivenName $r.Surname
        $log.UPN = $upn
        $user = New-MgUser -AccountEnabled -DisplayName "$($r.GivenName) $($r.Surname)" `
            -GivenName $r.GivenName -Surname $r.Surname -UserPrincipalName $upn `
            -MailNickname ($upn.Split('@')[0]) -EmployeeId $r.EmployeeId -EmployeeType $r.ContractType `
            -Department $r.Department -JobTitle $r.JobTitle -City $r.City -UsageLocation $r.Country `
            -OtherMails @($r.PersonalEmail) -EmployeeHireDate ([datetime]$r.StartDate) `
            -PasswordProfile @{ Password = (New-RandomPassword); ForceChangePasswordNextSignIn = $false }
        $log.CreateUser = 'OK'
        # 2. Gan quan ly
        $mgr = Get-UserByEmployeeId $r.ManagerEmployeeId
        Set-MgUserManagerByRef -UserId $user.Id -BodyParameter @{
            "@odata.id" = "https://graph.microsoft.com/v1.0/users/$($mgr.Id)" }
        $log.Manager = 'OK'
        # 3. License qua group
        New-MgGroupMember -GroupId $LicenseGroup[$r.ContractType] -DirectoryObjectId $user.Id
        $log.License = 'OK'
        # 4. Cho mailbox
        $deadline = (Get-Date).AddMinutes($MailboxWaitMin)
        do { Start-Sleep 30; $mbx = Get-EXOMailbox -Identity $upn -ErrorAction SilentlyContinue }
        until ($mbx -or (Get-Date) -gt $deadline)
        if (-not $mbx) { $log.Mailbox = 'FAIL'; throw "Mailbox chua san sang sau $MailboxWaitMin phut" }
        $log.Mailbox = 'OK'
        # 5. Cau hinh mailbox
        if ($r.ContractType -eq 'Fulltime') { Enable-Mailbox -Identity $upn -Archive | Out-Null }
        Set-CASMailbox -Identity $upn -PopEnabled $false -ImapEnabled $false -SmtpClientAuthenticationDisabled $true
        Set-Mailbox -Identity $upn -RetentionPolicy $RetentionPolicy
        Set-MailboxRegionalConfiguration -Identity $upn -Language vi-VN -TimeZone "SE Asia Standard Time" -LocalizeDefaultFolderName
        $log.MailboxConfig = 'OK'
        # 6. Temporary Access Pass
        $start = ([datetime]$r.StartDate).Date.AddHours(8)
        if ($start -lt (Get-Date)) { $start = Get-Date }
        $tap = New-MgUserAuthenticationTemporaryAccessPassMethod -UserId $user.Id -BodyParameter @{
            startDateTime = $start.ToUniversalTime().ToString("o")
            lifetimeInMinutes = $TapLifetimeMin; isUsableOnce = $false }
        $log.TAP = 'OK'
        # 7. Gui thong tin cho quan ly (khong ghi TAP vao log)
        $body = "<p>Chao $($mgr.DisplayName),</p><p>Tai khoan cho nhan vien moi <b>$($user.DisplayName)</b> da san sang.</p>" +
                "<ul><li>Tai khoan: $upn</li><li>Temporary Access Pass: <b>$($tap.TemporaryAccessPass)</b></li>" +
                "<li>Hieu luc tu: $($start.ToString('dd/MM/yyyy HH:mm')), trong $([int]($TapLifetimeMin/60)) tieng</li></ul>" +
                "<p>Vui long trao ma truc tiep cho nhan vien vao ngay dau tien.</p>"
        Send-MgUserMail -UserId $SenderMailbox -BodyParameter @{ message = @{
            subject = "[Onboarding] Tai khoan cho $($user.DisplayName)"
            body = @{ contentType = "HTML"; content = $body }
            toRecipients = @(@{ emailAddress = @{ address = $mgr.Mail } }) } }
        $log.Notify = 'OK'
        Write-Host "OK  $upn" -ForegroundColor Green
    }
    catch { $log.Error = $_.Exception.Message; Write-Host "ERR $($r.EmployeeId): $($log.Error)" -ForegroundColor Red }
    $Result.Add([pscustomobject]$log)
}
$ResultFile = Join-Path $OutDir ("onboarding-result-{0:yyyyMMdd-HHmm}.csv" -f (Get-Date))
$Result | Export-Csv $ResultFile -NoTypeInformation -Encoding UTF8
$Result | Format-Table EmployeeId,UPN,CreateUser,License,Mailbox,TAP,Notify -AutoSize
Write-Host "DONE -> $ResultFile" -ForegroundColor Cyan
```

Mẫu file `hr-onboarding-batch.csv`:

```text
GivenName,Surname,EmployeeId,ContractType,Department,JobTitle,City,Country,ManagerEmployeeId,PersonalEmail,StartDate
An,Nguyen,E10234,Fulltime,Finance,Accountant,Ho Chi Minh,VN,E00871,an.personal@example.com,2026-11-10
Binh,Tran,E10235,Parttime,Sales,Sales Assistant,Ha Noi,VN,E00654,binh.personal@example.com,2026-11-10
```

<!--
Phần cuối bài (nút Chia sẻ LinkedIn, Facebook, Copy link, khung tác giả, bài trước/sau)
và Mục lục bên phải được layout tự thêm vào, không cần viết trong file này.
Xem trước trên máy: bundle exec jekyll serve --unpublished (chỉ cần khi bài còn published: false).
-->
