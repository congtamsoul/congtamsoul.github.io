---
layout: post
title: "Báo cáo và enforce Per-user MFA cho user không có Entra ID P1"
seo_title: "Report và enforce Entra per-user MFA bằng Graph API"
description: "Per-user MFA đã cũ nhưng vẫn cần cho user không có Entra ID P1. Cách report trạng thái và tự động enable per-user MFA bằng Graph API, PowerShell."
date: 2026-11-10
author: "Tam Nguyen"
reading_time: 9
topic: security
thumb_label: "PER-USER MFA"
image: /images/photo/35.jpg
tags:
  - Microsoft 365
  - Entra ID
  - MFA
  - Graph API
  - PowerShell
card_tags:
  - Entra ID
  - MFA
summary: "User không có Entra ID P1 không dùng được Conditional Access. Report và enforce per-user MFA bằng Graph API để vẫn đáp ứng yêu cầu bảo mật."
redirect_from:
  - /posts/entra-per-user-mfa-report-enforce-graph.html
---

Microsoft khuyến nghị dùng **Conditional Access** thay cho **per-user MFA (legacy)**. Nhưng Conditional Access cần license Entra ID P1 phù hợp cho user được áp dụng, trong khi một số nhóm nhân viên không có license này. Nếu không theo dõi riêng, các user đó có thể bị bỏ sót khỏi chính sách MFA. Cách dưới đây giúp lập báo cáo trạng thái và xử lý có kiểm soát; hãy xác minh yêu cầu license và phương thức MFA của tenant trước khi áp dụng.

**Tóm tắt nhanh:** dùng Microsoft Graph beta để report trạng thái per-user MFA (`disabled`, `enabled`, `enforced`). Sau khi xác minh phạm vi user và thông báo người dùng, chạy script app-only để đổi `disabled` sang `enabled`, có chế độ `-WhatIf`, retry khi bị throttling và xuất CSV kết quả.

## Bối cảnh: per-user MFA là giải pháp legacy

| Cách bật MFA | License | Ưu điểm | Hạn chế |
|---|---|---|---|
| Per-user MFA (legacy) | Không cần Entra ID P1 | Cấu hình riêng từng user | Ít linh hoạt, không có điều kiện theo location/device/app |
| Security defaults | Không cần Entra ID P1 | Bật bảo vệ cơ bản ở cấp tenant | Không dùng đồng thời với Conditional Access |
| Conditional Access | Entra ID P1 phù hợp | Linh hoạt theo điều kiện và là hướng được khuyến nghị | Cần license phù hợp cho user áp dụng |

Per-user MFA không thay thế đầy đủ Conditional Access và không nên xem là phương án lâu dài. Tùy cấu hình tenant, Security defaults và Conditional Access không thể bật đồng thời; hãy kiểm tra tài liệu và trạng thái chính sách hiện hành trước khi thay đổi.

### Ba trạng thái per-user MFA

- **disabled** — per-user MFA chưa bật.
- **enabled** — đã bật; user có thể được yêu cầu đăng ký phương thức MFA ở lần đăng nhập tiếp theo.
- **enforced** — MFA được yêu cầu theo trạng thái per-user sau khi đăng ký.

Script bên dưới chỉ cập nhật `disabled` thành `enabled`; nó không ghi đè user đang `enabled` hoặc `enforced`.

## Bước 1: Report trạng thái per-user MFA

Để chạy report một lần:

1. Mở [Graph Explorer](https://developer.microsoft.com/graph/graph-explorer), đăng nhập bằng tài khoản được phép đọc thông tin user và consent quyền cần thiết.
2. Lấy access token từ phiên Graph Explorer, lưu tạm vào `C:\Temp\GraphToken.txt`.
3. Chạy report script ở cuối bài. Script theo dõi `@odata.nextLink` đến hết trang và ghi đè CSV report mới.

Kết quả là `C:\Temp\PerUser_MFA_Report.csv` với các cột `id`, `userPrincipalName`, `displayName`, `perUserMfaState`. Có thể pivot theo `perUserMfaState` để xem số lượng user ở từng trạng thái.

> **Lưu ý:** access token có thời hạn ngắn, mang quyền của phiên đăng nhập và không nên lưu lâu, chia sẻ hoặc commit vào repository. Xóa file token sau khi sử dụng.

## Bước 2: Chuẩn bị App Registration

Script enforce dùng app-only để có thể chạy lặp lại mà không phụ thuộc token cá nhân:

1. Vào **Entra admin center → App registrations → New registration**.
2. Trong **API permissions → Microsoft Graph → Application permissions**, thêm:
   - `User.Read.All`
   - `Policy.ReadWrite.AuthenticationMethod`
3. Thực hiện **Grant admin consent**.
4. Tạo credential cho ứng dụng. Ưu tiên certificate hoặc secret được quản lý trong vault; không hardcode secret trong script hay Task Scheduler arguments.

Ứng dụng có quyền đọc user và thay đổi yêu cầu xác thực. Áp dụng quyền tối thiểu cần thiết, hạn chế người quản lý ứng dụng, bảo vệ credential và kiểm tra quyền Graph hiện hành trước khi cấp admin consent.

## Bước 3: Chọn đúng user và bật MFA

Script mẫu lọc user theo các điều kiện được cấu hình trong phần `$TargetCompany` và `$TargetJobTitle`, đồng thời bỏ qua Guest và account bị disable. Đây **không phải phép kiểm tra license**: `companyName` và `jobTitle` chỉ là tiêu chí chọn user. Trước khi chạy, cần đối chiếu danh sách này với nguồn license thực tế hoặc danh sách nhóm đã được phê duyệt; tránh suy ra “không có P1” chỉ từ chức danh.

Với từng user trong phạm vi:

1. `GET /beta/users/{id}/authentication/requirements`.
2. Nếu `perUserMfaState` là `disabled`, chạy `PATCH` đổi thành `enabled`.
3. Đọc lại để xác minh trạng thái sau cập nhật.

Script có `-WhatIf`, retry exponential backoff cho lỗi tạm thời và throttle giữa các request. CSV kết quả ghi action như `none`, `would-enable`, `enabled`, `get-failed` hoặc `patch-failed`.

### Cách chạy

```powershell
# Chạy thử trước; nhập client secret tại prompt dạng SecureString
.\Enable-PerUserMfa.ps1 `
    -TenantId "<tenant-id>" `
    -ClientId "<client-id>" `
    -ClientSecret (Read-Host -AsSecureString) `
    -WhatIf

# Chạy thật sau khi review danh sách WhatIf và thông báo người dùng
.\Enable-PerUserMfa.ps1 `
    -TenantId "<tenant-id>" `
    -ClientId "<client-id>" `
    -ClientSecret (Read-Host -AsSecureString)
```

Module Microsoft Graph PowerShell cần được cài đặt trước khi chạy. Không nên để script tự cài package khi chạy production; hãy cài và kiểm tra phiên bản trong môi trường quản trị trước.

## Quy trình triển khai và lỗi thường gặp

1. Chạy report hiện trạng và xác minh phạm vi với Security/Identity team.
2. Thông báo user bị ảnh hưởng, hướng dẫn đăng ký phương thức MFA và chuẩn bị helpdesk hỗ trợ.
3. Chạy script enforce với `-WhatIf`, đối chiếu danh sách và số lượng.
4. Chạy thật theo từng đợt nhỏ; theo dõi file kết quả và đăng nhập hỗ trợ.
5. Lên lịch kiểm tra định kỳ để phát hiện user mới, nhưng review phạm vi mỗi lần chạy.

Một số lỗi phổ biến:

- **Report thiếu user hoặc query lỗi** — kiểm tra consent quyền đọc user, `@odata.nextLink` và cú pháp URL. Trong chuỗi PowerShell có `$select` hoặc `$top`, cần escape dấu `$` bằng backtick.
- **401 Unauthorized** — token hết hạn hoặc header không có tiền tố `Bearer`. Script report bên dưới tự chuẩn hóa token thuần và token có prefix.
- **Report bị trùng dòng** — không dùng `Export-Csv -Append` cho mỗi lần chạy; script report ghi file mới.
- **Không match user nào** — kiểm tra giá trị thực tế của `companyName` và `jobTitle`; tiêu chí lọc theo exact value có thể bỏ sót biến thể.
- **403 khi PATCH** — xác minh Application permission, admin consent và quyền app-only được cấp.
- **User chưa sẵn sàng đăng ký MFA** — thông báo trước, xác nhận user có phương thức phù hợp và chuẩn bị quy trình hỗ trợ trước khi bật hàng loạt.

## Kết luận

Per-user MFA là tính năng legacy, không thay thế Conditional Access, nhưng report và quy trình enable có kiểm soát giúp phát hiện user chưa được bảo vệ trong phạm vi đã xác minh. Hãy bắt đầu bằng report và `-WhatIf`, rà license, chính sách tenant và tác động với người dùng trước khi chạy thật. Về lâu dài, lập kế hoạch license và chuyển sang Conditional Access phù hợp. Tổ chức của bạn đang xử lý MFA cho nhóm user không có P1 như thế nào?

## Full script

### Script report per-user MFA

```powershell
$ErrorActionPreference = "Stop"

$TokenPath = "C:\Temp\GraphToken.txt"
$OutputPath = "C:\Temp\PerUser_MFA_Report.csv"
$token = (Get-Content -Path $TokenPath -Raw -ErrorAction Stop).Trim()
$token = $token -replace '^Bearer\s+', ''

if ([string]::IsNullOrWhiteSpace($token)) {
    throw "Access token file is empty: $TokenPath"
}

$headers = @{
    Authorization = "Bearer $token"
    Accept = "application/json"
}

$uri = "https://graph.microsoft.com/beta/users?`$select=id,userPrincipalName,displayName,perUserMfaState&`$top=999"
$results = [System.Collections.Generic.List[object]]::new()

do {
    $response = Invoke-RestMethod `
        -Uri $uri `
        -Headers $headers `
        -Method Get `
        -ErrorAction Stop

    foreach ($user in $response.value) {
        $results.Add([pscustomobject]@{
            id                = $user.id
            userPrincipalName = $user.userPrincipalName
            displayName       = $user.displayName
            perUserMfaState   = $user.perUserMfaState
        })
    }

    $uri = $response.'@odata.nextLink'
} while ($uri)

$outputDirectory = Split-Path -Parent $OutputPath
if (-not (Test-Path $outputDirectory)) {
    New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
}

$results | Export-Csv -Path $OutputPath -NoTypeInformation -Encoding UTF8 -Force
Write-Host "Report exported: $OutputPath"
```

### Script enforce enable per-user MFA

```powershell
[CmdletBinding()]
param(
    [switch]$WhatIf,
    [string]$OutputCsv = "C:\Temp\perUserMfaState-disabled-to-enabled-report.csv",
    [int]$ThrottleMs = 150,
    [int]$MaxRetry = 6,
    [Parameter(Mandatory)][string]$TenantId,
    [Parameter(Mandatory)][string]$ClientId,
    [Parameter(Mandatory)][securestring]$ClientSecret
)

$ErrorActionPreference = "Stop"

# Replace these exact-match selectors with values validated against your tenant.
$TargetCompany = "Example Company"
$TargetJobTitle = "Target Job Title"

function Test-GuidString {
    param([string]$Value)

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $false
    }

    $parsedGuid = [guid]::Empty
    return [guid]::TryParse($Value, [ref]$parsedGuid)
}

function Invoke-GraphWithRetry {
    param(
        [Parameter(Mandatory)]
        [ValidateSet("GET", "PATCH")]
        [string]$Method,
        [Parameter(Mandatory)]
        [string]$Uri,
        [object]$Body = $null,
        [int]$RetryCount = 6
    )

    $attempt = 0
    $delaySeconds = 2

    while ($true) {
        try {
            $request = @{
                Method = $Method
                Uri = $Uri
                OutputType = "PSObject"
                ErrorAction = "Stop"
            }

            if ($null -ne $Body) {
                $request.Body = $Body
            }

            return Invoke-MgGraphRequest @request
        }
        catch {
            $attempt++
            $message = $_.Exception.Message
            $isTransient = $message -match "Too Many Requests|429|timeout|temporarily|503|504|Bad Gateway|Service Unavailable"

            if ($attempt -le $RetryCount -and $isTransient) {
                Write-Warning "Transient Graph error (attempt $attempt/$RetryCount); waiting $delaySeconds seconds."
                Start-Sleep -Seconds $delaySeconds
                $delaySeconds = [Math]::Min($delaySeconds * 2, 60)
                continue
            }

            throw
        }
    }
}

function Export-CsvSafe {
    param(
        [Parameter(Mandatory)]
        [object[]]$Data,
        [Parameter(Mandatory)]
        [string]$Path
    )

    $directory = Split-Path -Parent $Path
    if ($directory -and -not (Test-Path $directory)) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }

    try {
        $Data | Export-Csv -NoTypeInformation -Encoding UTF8 -Path $Path -Force -ErrorAction Stop
        Write-Host "Report exported: $Path"
    }
    catch {
        $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
        $fallbackPath = [IO.Path]::ChangeExtension($Path, "$timestamp.csv")
        Write-Warning "Could not write $Path; exporting to $fallbackPath"
        $Data | Export-Csv -NoTypeInformation -Encoding UTF8 -Path $fallbackPath -Force -ErrorAction Stop
        Write-Host "Report exported: $fallbackPath"
    }
}

if (-not (Test-GuidString $TenantId)) {
    throw "TenantId must be a GUID."
}
if (-not (Test-GuidString $ClientId)) {
    throw "ClientId must be the Application (client) ID GUID."
}
if (-not (Get-Command Connect-MgGraph -ErrorAction SilentlyContinue) -or
    -not (Get-Command Get-MgUser -ErrorAction SilentlyContinue) -or
    -not (Get-Command Invoke-MgGraphRequest -ErrorAction SilentlyContinue)) {
    throw "Required Microsoft Graph PowerShell commands are missing. Install and validate Microsoft.Graph before running this script."
}

$clientSecretCredential = [pscredential]::new($ClientId, $ClientSecret)
Connect-MgGraph `
    -TenantId $TenantId `
    -ClientSecretCredential $clientSecretCredential `
    -NoWelcome `
    -ErrorAction Stop

$results = [System.Collections.Generic.List[object]]::new()
$updated = 0
$failed = 0

try {
    $context = Get-MgContext
    if (-not $context -or $context.TenantId -ne $TenantId) {
        throw "Microsoft Graph connection did not establish the expected tenant context."
    }

    $users = Get-MgUser -All -Property Id,UserPrincipalName,DisplayName,AccountEnabled,UserType,CompanyName,JobTitle

    foreach ($user in $users) {
        if ($user.CompanyName -ne $TargetCompany) { continue }
        if ($user.UserType -eq "Guest") { continue }
        if ($user.AccountEnabled -ne $true) { continue }
        if ($user.JobTitle -ne $TargetJobTitle) { continue }

        Start-Sleep -Milliseconds $ThrottleMs
        $uri = "/beta/users/$($user.Id)/authentication/requirements"
        $state = $null
        $action = "none"
        $errorText = $null

        try {
            $requirements = Invoke-GraphWithRetry -Method GET -Uri $uri -RetryCount $MaxRetry
            $state = $requirements.perUserMfaState

            if ($state -eq "disabled") {
                if ($WhatIf) {
                    $action = "would-enable"
                }
                else {
                    $body = @{ perUserMfaState = "enabled" }
                    Invoke-GraphWithRetry -Method PATCH -Uri $uri -Body $body -RetryCount $MaxRetry | Out-Null

                    $verified = Invoke-GraphWithRetry -Method GET -Uri $uri -RetryCount $MaxRetry
                    $state = $verified.perUserMfaState

                    if ($state -ne "enabled") {
                        throw "PATCH completed but verification returned state '$state'."
                    }

                    $action = "enabled"
                    $updated++
                }
            }
        }
        catch {
            $errorText = $_.Exception.Message
            $action = if ($null -eq $state) { "get-failed" } else { "patch-failed" }
            $failed++
        }

        $results.Add([pscustomobject]@{
            UserPrincipalName = $user.UserPrincipalName
            DisplayName = $user.DisplayName
            UserId = $user.Id
            CompanyName = $user.CompanyName
            JobTitle = $user.JobTitle
            AccountEnabled = $user.AccountEnabled
            UserType = $user.UserType
            perUserMfaState = $state
            Action = $action
            Error = $errorText
        })
    }

    Write-Host "Matching users: $($results.Count)"
    Write-Host "Updated disabled -> enabled: $updated"
    Write-Host "Failures: $failed"
    Export-CsvSafe -Data $results.ToArray() -Path $OutputCsv
}
finally {
    Disconnect-MgGraph | Out-Null
}
```
