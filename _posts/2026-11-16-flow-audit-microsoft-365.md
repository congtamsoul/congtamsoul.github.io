---
layout: post
title: "Từ Collector đến Security Review: Flow audit Microsoft 365 giúp team IT tiết kiệm thời gian và tăng độ tin cậy"
seo_title: "Flow audit Microsoft 365 hiệu quả cho team IT"
description: "Chia sẻ flow tự động thu thập snapshot Microsoft 365, đánh giá rủi ro, triage bằng agent và đưa ra kế hoạch remediation thực tế cho tenant."
date: 2026-11-16
author: "Tam Nguyen"
reading_time: 7
topic: security
thumb_label: "MICROSOFT 365"
image: /images/photo/44.jpg
tags:
  - Microsoft 365
  - Security
  - Entra ID
card_tags:
  - Security
  - M365
summary: "Một flow thực tế để tự động thu thập snapshot, chạy audit, phân loại rủi ro và chuyển thành kế hoạch khắc phục cho tenant Microsoft 365."
redirect_from:
  - /posts/flow-audit-microsoft-365.html
---

Một trong những câu hỏi mà tôi hay gặp trong các dự án Microsoft 365 là: "Team IT cần một cách review tenant nhanh, có hệ thống và ít sai sót như thế nào?"

Câu trả lời không nằm ở việc chạy một script đơn lẻ. Nó nằm ở việc xây dựng một flow đủ chặt chẽ: thu thập dữ liệu từ tenant, kiểm tra theo baseline, nhóm các finding, và cuối cùng chuyển thành kế hoạch remediation có thể thực thi.

Với môi trường có nhiều tenant, nhiều role, nhiều app, và nhiều điều kiện bảo mật khác nhau, nếu chỉ dùng cách thủ công, rất dễ bỏ sót các điểm quan trọng như MFA cho admin, quyền Global Admin, consent ứng dụng, hoặc nguy cơ sign-in bất thường. Chính vì vậy, tôi và team đã xây dựng một flow audit tự động để giảm tải công việc, tăng khả năng lặp lại và giúp mọi người cùng nhìn thấy "những điểm đỏ" trong tenant.

> Tóm tắt nhanh: Flow này giúp thu thập snapshot từ Microsoft 365, chạy engine audit, phân loại rủi ro theo mức độ nghiêm trọng, và chuyển output thành kế hoạch remediation rõ ràng bằng cách dùng agent review. Nói ngắn gọn: nó biến "dữ liệu thô" thành "hành động thực tế".

**Tải bộ project:** [Download MPV.zip](/downloads/MPV.zip) — gồm mã nguồn collector, audit engine, hướng dẫn và test. Gói tải xuống không chứa credential, snapshot tenant hoặc kết quả audit thực tế.

## Bối cảnh: vì sao mình tìm hiểu chuyện này

Khi làm việc với Microsoft 365, điều khó chịu nhất không phải là thiếu thông tin, mà là thông tin bị rải rác.

Một ngày, một tenant có thể có dữ liệu từ:

- danh tính người dùng
- Conditional Access
- baseline bảo mật
- app registrations và consent
- license và quyền
- log và metadata về tenant

Nhưng nếu không có một flow hợp nhất, các team sẽ phải tự mình gom từng nguồn dữ liệu, rồi đối chiếu bằng tay. Khi môi trường lớn, quy trình này trở nên rất dễ sai sót.

Vấn đề gốc rễ là: môi trường Microsoft 365 quá lớn, dữ liệu không nằm trong một nguồn duy nhất, và cần phải có một cách đánh giá theo chuẩn, chứ không chỉ là "cầm mắt xem". Từ đó, tôi quyết định xây dựng một flow có thể:

1. thu thập snapshot tự động
2. chuẩn hóa dữ liệu
3. chạy rule engine để đánh giá theo baseline
4. nhóm findings theo domain
5. chuyển sang remediation plan và báo cáo quản trị

## Quick Start: checklist 5 phút để chạy trên tenant thật

Nếu bạn muốn bắt đầu ngay mà không cần đọc toàn bộ bài, hãy làm theo checklist dưới đây.

### 1) Chuẩn bị môi trường

- Cài PowerShell 7+
- Cài module Microsoft.Graph.Authentication

```powershell
Install-Module Microsoft.Graph.Authentication -Scope CurrentUser -Force
```

- Kiểm tra bạn có quyền Tenant Admin hoặc quyền hợp lệ để tạo app registration và đọc metadata Graph.

### 2) Tạo App Registration và lưu secret

```powershell
pwsh -File .\Setup-AuditCredentials.ps1
```

Chạy xong, script sẽ yêu cầu bạn nhập:

- TenantId
- ClientId
- Client Secret

Sau đó, secret sẽ được lưu mã hóa trong thư mục `.audit-secrets` để bạn không phải nhập lại mỗi lần chạy.

### 3) Chạy collector toàn bộ

```powershell
pwsh -File .\Run-Collectors.ps1 -TenantId "<tenant-guid>" -ClientId "<app-client-id>" -Pseudonymize
```

Flow này sẽ tạo ra snapshot theo từng domain:

- `01-Identity.ps1`
- `02-ConditionalAccess.ps1`
- `03-SecurityBaseline.ps1`
- `04-Apps.ps1`
- `05-Licenses.ps1`

### 4) Chạy audit engine

```powershell
cd .\audit-engine
python .\run_audit.py --snapshots ..\snapshots\<tenant-guid>\<run-id>\combined-run --out out
```

Output sẽ nằm ở:

```text
audit-engine/out/<run-id>/
```

Bạn sẽ thấy các file như:

- `findings.json`
- `results.json`
- `run.json`
- `snapshot.json`

### 5) Review findings

Mở file `findings.json` và ưu tiên xem các mục:

- `fail` trước
- `warning` sau
- `evidence`, `affected`, `risk`, `remediation`

### 6) Chuyển thành action plan

Sau khi có findings, hãy gắn cho mỗi item:

- owner
- mức độ ưu tiên
- thời gian xử lý
- kiểm tra lại sau khi fix

Nếu bạn làm đúng theo 6 bước trên, bạn đã có một flow audit có thể chạy lại lặp đi lặp lại trên tenant thật.

## Ý nghĩa của bài toán: không cần "đọc nhiều", cần "quyết định đúng"

Trước khi xây dựng flow này, tôi đã thử rất nhiều cách: đọc Azure Portal, check từng policy, xem report trực tiếp, hoặc dùng các script rời rạc. Tuy nhiên, các cách đó đều có một điểm chung: thiếu sự thống nhất.

Một hệ thống audit hiệu quả cần đáp ứng 4 tiêu chí:

- có thể chạy lặp lại nhiều lần
- có thể kiểm chứng bằng evidence
- có thể phân loại rủi ro
- có thể đưa ra hành động cụ thể cho team vận hành

Nói cách khác, chúng ta không cần chỉ "biết có lỗi", mà cần biết:

- lỗi nằm ở đâu
- mức độ nghiêm trọng là bao nhiêu
- ai sẽ xử lý
- phải ưu tiên giải quyết theo thứ tự nào

## Kiến trúc flow mà mình đã xây dựng

Flow của chúng ta gồm 4 tầng chính:

| Tầng | Mục đích | Kết quả |
|---|---|---|
| Collector | Thu thập dữ liệu tenant | 5 file snapshot |
| Audit engine | Chạy rule và đánh giá | findings.json |
| Triage / Remediation | Phân loại rủi ro | P1/P2/P3 + action plan |
| Reporting | Tạo báo cáo cho lãnh đạo / team kỹ thuật | executive summary + technical summary |

### 1. Collector: thu thập snapshot từ tenant

Đầu tiên, chúng ta chạy các script theo từng domain:

- `01-Identity.ps1`
- `02-ConditionalAccess.ps1`
- `03-SecurityBaseline.ps1`
- `04-Apps.ps1`
- `05-Licenses.ps1`

Mỗi script sẽ export dữ liệu JSON vào folder snapshot. Một điểm quan trọng là các file này phải được gom thành một folder "combined" trước khi engine chạy. Đây là bước rất dễ bị nhầm nếu chưa biết thứ tự xử lý.

Mình đã chuẩn hóa flow bằng script `Run-Audit-Once.ps1` để:

- chạy collector
- chọn snapshot mới nhất
- gom 5 file vào một folder duy nhất
- gọi engine Python xử lý

### 2. Audit engine: đánh giá dựa trên rule

Sau khi có dữ liệu snapshot, engine Python sẽ đọc các file và chạy hàng chục rule theo domain. Output cuối cùng là `findings.json`, trong đó chỉ còn các findings ở trạng thái:

- `fail`
- `warning`

Không phải toàn bộ dữ liệu, mà chỉ những vấn đề có thể cần can thiệp. Đây là cách rất hiệu quả để tránh "rác thông tin" và giúp tầng LLM/agent làm việc với dữ liệu có cấu trúc.

### 3. Security analysis: nhóm theo domain và ưu tiên rủi ro

Ở giai đoạn này, output không còn là list thô nữa, mà đã có thể được phân loại:

- Identity
- Conditional Access
- Apps
- Licensing
- Baseline
- RBAC

Ví dụ, các finding thường gặp có thể là:

- tài khoản đặc quyền chưa bật MFA
- người dùng at-risk
- Global Admin vượt ngưỡng
- app registration có secret hết hạn
- consent ứng dụng quá rộng
- policy Conditional Access có exclusions không rõ nguyên nhân

Một quy trình triage hiệu quả sẽ gắn mỗi finding với:

- domain
- severity
- impact
- attack path
- remediation action
- owner
- effort

Điều này rất quan trọng, vì nếu không có bước này, team sẽ thấy rất nhiều "điểm đỏ" nhưng không biết đâu là ưu tiên.

### 4. Agent review: đưa findings thành hành động

Đây là bước nâng cấp mạnh nhất của flow.

Sau khi có output từ audit engine, mình dùng agent để thực hiện 4 vai trò:

- Analyzer: nhóm findings và xác định rủi ro ưu tiên
- Remediator: biến finding thành task hành động
- Reporter: viết executive summary và technical summary
- Reviewer: đối chiếu lại bằng chứng trước khi đưa ra kết luận

Như vậy, thay vì đọc từng finding và tự suy diễn, agent sẽ làm việc dựa trên dữ liệu có sẵn, nhưng vẫn giữ nguyên tắc: không suy đoán quá mức.

Điều này rất quan trọng trong môi trường bảo mật, vì cần phải phân biệt rõ:

- gì là fact
- gì là interpretation
- gì là inferred conclusion

## Một ví dụ thực tế từ flow này

Để người đọc dễ hình dung, mình sẽ lấy một vài finding điển hình có thể xuất hiện từ flow đang chạy:

- `ID-001`: Tài khoản đặc quyền chưa đăng ký MFA
- `ID-006`: Có user đang ở trạng thái at-risk
- `ID-002`: Tỷ lệ MFA người dùng dưới baseline
- `BL-001`: Số lượng Global Admin vượt khuyến nghị
- `APP-006`: Tenant-wide grant với quyền delegated rủi ro cao

Mỗi finding nếu nhìn riêng lẻ có vẻ "đơn lẻ", nhưng khi ghép lại, nó cho thấy một mô hình rất rõ:

- mật khẩu hoặc phishing có thể dẫn đến user compromise
- MFA chưa được triển khai rộng
- admin roles quá rộng và không được JIT hóa
- grant app quá rộng làm tăng bề mặt tấn công
- tenant đang đứng trước nguy cơ privilege escalation và data exposure

Đây chính là lý do vì sao flow này không chỉ là "báo cáo kỹ thuật", mà còn là "công cụ quyết định".

## Vì sao flow này hiệu quả hơn cách thủ công

### 1. Tốc độ

Team không còn mất thời gian ghép dữ liệu từ nhiều nơi. Tất cả đều chạy theo một flow chuẩn.

### 2. Tính lặp lại

Nếu chạy lại sau 1 tuần, người ta có thể so sánh sự thay đổi và rút ra tiến độ.

### 3. Dễ review bằng evidence

Mỗi finding đều có `evidence`, `source`, và `risk`. Việc review trở nên dễ dàng hơn rất nhiều.

### 4. Dễ chuyển thành hành động

Không còn "biết có vấn đề nhưng không biết phải làm thế nào".

Chúng ta chuyển được kết quả vào các task như:

- bật MFA bắt buộc
- review at-risk users
- giảm số lượng Global Admin
- thu hồi grant app không cần thiết
- áp dụng PIM cho quyền đặc quyền

## Có nên dùng agent trong flow này không?

Câu trả lời là: có, nếu dùng đúng cách.

Agent không nên thay thế việc review của người vận hành. Nó nên đóng vai trò như một "trợ lý phân tích":

- gom findings
- nhóm theo domain
- sắp xếp ưu tiên
- đề xuất hành động
- viết bản tóm tắt cho lãnh đạo và team kỹ thuật

Điểm mạnh nhất của phương pháp này là nó giữ được tính "có căn cứ", vì agent được yêu cầu:

- chỉ dùng evidence từ findings
- không suy đoán quá mức
- phân biệt rõ fact và inferred conclusion
- nếu thiếu chứng cứ thì nói rõ

Đó là điều rất quan trọng trong môi trường bảo mật. Không để AI viết "báo cáo đẹp" nhưng thiếu tính thực tế.

<div class="callout">
  <span>💡</span>
  <div><b>Tip:</b> Flow audit hiệu quả không cần phức tạp đến mức "AI làm toàn bộ". Nói đúng hơn, nó là sự kết hợp giữa dữ liệu định lượng, rule engine và review mang tính chuyên môn.</div>
</div>

## Những lưu ý khi triển khai lại flow này

Đừng nghĩ flow này chỉ là "runnable script". Nó có giá trị nhất khi bạn áp dụng đúng nguyên tắc sau:

- Chia dữ liệu theo domain: không nên nhìn tenant như một khối thống nhất
- Giữ nguyên evidence: mỗi finding phải có nguồn và số liệu rõ ràng
- Phân biệt fail/warning: không gộp tất cả cùng một mức độ hành động
- Có chiến lược PRIORITY: không xử lý cùng lúc quá nhiều thứ
- Review bởi người có quyền: cuối cùng, team phụ trách mới là người quyết định hành động

## Kết luận

Từ một bài toán rất "thủ công" là "đọc tenant, rà soát bảo mật, rồi tự suy đoán", mình đã chuyển sang một flow dựa trên data + rule + triage + remediation.

Điểm khác biệt là: chúng ta không chỉ báo cáo "vấn đề có gì", mà còn có khả năng nói rõ "vấn đề ở đâu, nguy hiểm thế nào, và phải sửa theo thứ tự nào".

Đây chính là điều mà một team IT/security thật sự cần: một process có thể chạy lặp đi lặp lại, dựa trên dữ liệu, và đưa ra quyết định ngay trong vài giờ thay vì vài ngày.

Nếu bạn đang quản trị Microsoft 365 hoặc đang triển khai bảo mật cho doanh nghiệp, mình khuyên bạn nên bắt đầu bằng cùng một flow: thu thập snapshot → chạy audit → triage findings → build remediation plan.

Đó là cách tốt nhất để xoay "thông tin rải rác" thành "hành động có chiều hướng".

Bạn đã từng gặp tình huống tương tự chưa? Bạn đang dùng cách nào để review tenant Microsoft 365 của mình? Hãy chia sẻ trong phần bình luận để cùng nhau cải thiện flow này.

---

## Phần triển khai copy-ready: các script chính để chạy lại flow

Dưới đây là các script chính mà bạn có thể copy trực tiếp để triển khai lại flow audit trên tenant Microsoft 365. Mỗi phần được viết theo đúng cách mà project hiện tại đang sử dụng.

### 1) `Run-Audit-Once.ps1`

```powershell
# Tham khảo trong project gốc; script orchestrates collectors + engine
#Requires -Version 7.0
[CmdletBinding()]
param(
    [string]$TenantId,
    [string]$ClientId,
    [string]$OutRoot = (Join-Path $PSScriptRoot 'snapshots'),
    [string]$AuditDir = (Join-Path $PSScriptRoot 'audit-engine'),
    [switch]$Pseudonymize,
    [switch]$SkipSignInLogs,
    [switch]$IncludeNonInteractive,
    [int]$StaleDays = 90
)

Import-Module (Join-Path $PSScriptRoot 'AuditCommon.psm1') -Force -ErrorAction Stop

$ErrorActionPreference = 'Stop'

if (-not $TenantId) {
    $saved = Get-AuditSavedCredentials -ErrorAction SilentlyContinue
    if ($saved) { $TenantId = $saved.TenantId }
}
if (-not $ClientId) {
    $saved = Get-AuditSavedCredentials -ErrorAction SilentlyContinue
    if ($saved) { $ClientId = $saved.ClientId }
}

if (-not $TenantId -or -not $ClientId) {
    throw 'Thiếu TenantId hoặc ClientId. Hãy truyền tham số hoặc chạy Setup-AuditCredentials.ps1 trước.'
}

if (-not $env:M365_CLIENT_SECRET) {
    $saved = Get-AuditSavedCredentials -ErrorAction SilentlyContinue
    if ($saved -and $saved.ClientSecret) {
        $env:M365_CLIENT_SECRET = $saved.ClientSecret
    }
}

if (-not $env:M365_CLIENT_SECRET) {
    $env:M365_CLIENT_SECRET = Read-Host 'Client secret' -MaskInput
}

Write-Host '== Bước 1: Sinh snapshot mới == ' -ForegroundColor Green
& (Join-Path $PSScriptRoot 'Run-Collectors.ps1') `
    -TenantId $TenantId `
    -ClientId $ClientId `
    -OutRoot $OutRoot `
    -Pseudonymize:$Pseudonymize `
    -SkipSignInLogs:$SkipSignInLogs `
    -IncludeNonInteractive:$IncludeNonInteractive `
    -StaleDays $StaleDays

$tenantFolder = Join-Path $OutRoot $TenantId
$latestRun = (Get-ChildItem -Path $tenantFolder -Directory | Sort-Object Name -Descending | Select-Object -First 1).FullName
if (-not $latestRun) {
    throw "Không tìm thấy folder snapshot nào trong $tenantFolder"
}

$combined = Join-Path $tenantFolder 'combined-run'
New-Item -ItemType Directory -Force -Path $combined | Out-Null

$files = @(
    '01_identity.json',
    '02_conditional_access.json',
    '03_security_baseline.json',
    '04_apps.json',
    '05_licenses.json'
)

foreach ($f in $files) {
    $src = Join-Path $latestRun $f
    if (-not (Test-Path $src)) {
        throw "Thiếu file snapshot: $src"
    }
    Copy-Item -Path $src -Destination $combined -Force
}

Write-Host '== Bước 2: Đã gom 5 file JSON vào folder duy nhất == ' -ForegroundColor Green
Write-Host "Folder đầu vào: $combined"

Push-Location $AuditDir
try {
    Write-Host '== Bước 3: Chạy run_audit.py == ' -ForegroundColor Green
    python .\run_audit.py --snapshots $combined --out out
}
finally {
    Pop-Location
}

```

### 2) `AuditCommon.psm1`

```powershell
# Module chung chứa Graph auth, retry, pseudonymize, credential handling, snapshot export
#Requires -Version 7.0
<#
  AuditCommon.psm1 - hàm dùng chung cho các collector.
  Nguyên tắc: CHỈ gọi GET (read-only). Không ghi bất cứ thứ gì vào tenant.
  Yêu cầu: module Microsoft.Graph.Authentication (v2.x)
           Install-Module Microsoft.Graph.Authentication -Scope CurrentUser -Force
#>

function Import-AuditGraphModule {
    $moduleName = 'Microsoft.Graph.Authentication'
    $paths = @()
    foreach ($p in ($env:PSModulePath -split ';')) {
        if ($p) { $paths += $p }
    }
    $extra = @(
        (Join-Path $HOME 'Documents\PowerShell\Modules'),
        (Join-Path $HOME 'OneDrive - Home Credit International a.s\Documents\PowerShell\Modules')
    )
    foreach ($p in $extra) { if ($p -and -not ($paths -contains $p)) { $paths += $p } }

    foreach ($base in $paths) {
        $candidate = Join-Path $base $moduleName
        if (Test-Path $candidate) {
            $psd1 = Get-ChildItem -Path $candidate -Filter '*.psd1' -Recurse -File | Select-Object -First 1
            if ($psd1) {
                Import-Module $psd1.FullName -Force -ErrorAction Stop
                return
            }
        }
    }

    try {
        Import-Module $moduleName -Force -ErrorAction Stop
        return
    }
    catch {
        Write-Error "Thiếu module Microsoft.Graph.Authentication. Hãy chạy: Install-Module Microsoft.Graph.Authentication -Scope CurrentUser -Force; rồi chạy lại script."
        throw
    }
}

Import-AuditGraphModule

$script:State = @{
    TenantId         = $null
    OutDir           = $null
    Pseudonymize     = $false
    AliasMap         = @{}
    AliasCount       = @{}
    Errors           = [System.Collections.Generic.List[object]]::new()
    UserCache        = $null
    SignInActivityOk = $false
    LastTruncated    = $false
}

function Get-AuditCredentialFilePath {
    $folder = Join-Path $PSScriptRoot '.audit-secrets'
    $null = New-Item -ItemType Directory -Path $folder -Force -ErrorAction SilentlyContinue
    return Join-Path $folder 'm365-audit-credentials.json'
}

function Protect-AuditSecret {
    param([Parameter(Mandatory)][string]$PlainText)
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($PlainText)
    $protected = [System.Security.Cryptography.ProtectedData]::Protect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
    return [Convert]::ToBase64String($protected)
}

function Unprotect-AuditSecret {
    param([Parameter(Mandatory)][string]$ProtectedBase64)
    try {
        $bytes = [Convert]::FromBase64String($ProtectedBase64)
        $plain = [System.Security.Cryptography.ProtectedData]::Unprotect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
        return [System.Text.Encoding]::UTF8.GetString($plain)
    }
    catch {
        throw "Không đọc được secret đã mã hóa. Có thể do user profile khác hoặc file bị hỏng. $_"
    }
}

function Save-AuditCredentials {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$TenantId,
        [Parameter(Mandatory)][string]$ClientId,
        [Parameter(Mandatory)][securestring]$ClientSecret
    )

    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($ClientSecret)
    try {
        $plain = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    }
    finally {
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }

    $cfg = [ordered]@{
        tenantId   = $TenantId
        clientId   = $ClientId
        secret     = Protect-AuditSecret -PlainText $plain
        updatedAt  = [datetime]::UtcNow.ToString('o')
        encrypted  = $true
    }

    $path = Get-AuditCredentialFilePath
    $cfg | ConvertTo-Json -Depth 4 | Set-Content -Path $path -Encoding utf8
    Write-Host "Đã lưu credential mã hóa cho tenant $TenantId tại $path" -ForegroundColor Green
    return $path
}

function Get-AuditSavedCredentials {
    $path = Get-AuditCredentialFilePath
    if (-not (Test-Path $path)) { return $null }

    try {
        $obj = Get-Content -Raw -Path $path | ConvertFrom-Json
        if (-not $obj -or -not $obj.clientId -or -not $obj.tenantId -or -not $obj.secret) {
            return $null
        }
        return [pscustomobject]@{
            TenantId = [string]$obj.tenantId
            ClientId = [string]$obj.clientId
            Secret = [string]$obj.secret
        }
    }
    catch {
        Write-Warning "Không đọc được file credential đã lưu ở $path. Hãy chạy lại Setup-AuditCredentials.ps1."
        return $null
    }
}

function Get-AuditSecretFromStore {
    $saved = Get-AuditSavedCredentials
    if (-not $saved) { return $null }

    $plain = Unprotect-AuditSecret -ProtectedBase64 $saved.Secret
    return (ConvertTo-SecureString -String $plain -AsPlainText -Force)
}

#region ---------- Kết nối ----------
function Connect-AuditGraph {
    <# Kết nối Graph bằng app registration + client secret.
       Secret lấy từ:
       1) tham số -ClientSecret
       2) biến môi trường M365_CLIENT_SECRET
       3) file đã lưu mã hóa ở thư mục /MPV/.audit-secrets
       4) hỏi nhập nếu chưa có gì cả và lưu lại để lần sau không hỏi nữa #>
    [CmdletBinding()]
    param(
        [string]$TenantId,
        [string]$ClientId,
        [securestring]$ClientSecret
    )

    $saved = Get-AuditSavedCredentials
    if (-not $TenantId -and $saved) { $TenantId = $saved.TenantId }
    if (-not $ClientId -and $saved) { $ClientId = $saved.ClientId }

    if (-not $ClientSecret -and $saved) {
        $ClientSecret = Get-AuditSecretFromStore
    }

    if (-not $TenantId -or -not $ClientId) {
        throw 'Thiếu TenantId hoặc ClientId. Hãy truyền tham số, hoặc chạy Setup-AuditCredentials.ps1 một lần để lưu credential.'
    }

    if (-not $ClientSecret) {
        if ($env:M365_CLIENT_SECRET) {
            $ClientSecret = ConvertTo-SecureString $env:M365_CLIENT_SECRET -AsPlainText -Force
        }
        else {
            $ClientSecret = Read-Host "Client secret của app $ClientId" -AsSecureString
            Save-AuditCredentials -TenantId $TenantId -ClientId $ClientId -ClientSecret $ClientSecret | Out-Null
        }
    }

    $cred = [System.Management.Automation.PSCredential]::new($ClientId, $ClientSecret)
    Connect-MgGraph -TenantId $TenantId -ClientSecretCredential $cred -NoWelcome -ErrorAction Stop | Out-Null
    $script:State.TenantId  = $TenantId
    $script:State.UserCache = $null
    Get-MgContext
}

function Test-AuditPermission {
    <# Cảnh báo sớm nếu token thiếu quyền (chỉ mang tính gợi ý). #>
    param([string[]]$Required)
    $ctx = Get-MgContext
    $granted = @($ctx.Scopes)
    if ($granted.Count -eq 0 -or -not $Required) { return }
    $missing = @($Required | Where-Object { $_ -notin $granted })
    if ($missing.Count -gt 0) {
        Write-Warning ("Token có thể thiếu quyền: " + ($missing -join ', ') + " (một số endpoint có thể trả 403)")
    }
}

function Initialize-AuditRun {
    param(
        [Parameter(Mandatory)][string]$OutDir,
        [switch]$Pseudonymize
    )
    New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
    $script:State.OutDir       = (Resolve-Path $OutDir).Path
    $script:State.Pseudonymize = [bool]$Pseudonymize
    $ctx = Get-MgContext
    if ($ctx -and -not $script:State.TenantId) { $script:State.TenantId = $ctx.TenantId }
}

function Start-AuditCollector {
    <# Gọi ở đầu mỗi collector: đảm bảo đã kết nối, chuẩn bị thư mục, reset danh sách lỗi. #>
    [CmdletBinding()]
    param(
        [string]$TenantId,
        [string]$ClientId,
        [string]$OutDir,
        [switch]$Pseudonymize,
        [string[]]$Permissions
    )

    $saved = Get-AuditSavedCredentials
    if (-not $TenantId -and $saved) { $TenantId = $saved.TenantId }
    if (-not $ClientId -and $saved) { $ClientId = $saved.ClientId }

    if (-not (Get-MgContext)) {
        if (-not $TenantId -or -not $ClientId) {
            throw 'Chưa kết nối Graph: cần truyền -TenantId và -ClientId, hoặc chạy Setup-AuditCredentials.ps1 để lưu credential một lần.'
        }
        $null = Connect-AuditGraph -TenantId $TenantId -ClientId $ClientId
    }
    if (-not $OutDir) {
        $tid = if ($TenantId) { $TenantId } else { $script:State.TenantId }
        $OutDir = Join-Path (Get-Location) ("snapshots/{0}/{1}" -f $tid, (Get-Date -Format 'yyyyMMdd-HHmmss'))
    }
    Initialize-AuditRun -OutDir $OutDir -Pseudonymize:$Pseudonymize
    $script:State.Errors.Clear()
    Test-AuditPermission -Required $Permissions
}
#endregion

#region ---------- Gọi Graph an toàn ----------
function Get-AuditHttpStatus {
    param($ErrorRecord)
    $ex = $ErrorRecord.Exception
    try { if ($ex.Response -and $ex.Response.StatusCode) { return [int]$ex.Response.StatusCode } } catch {}
    try { if ($ex.StatusCode) { return [int]$ex.StatusCode } } catch {}
    $text = "$($ErrorRecord.ErrorDetails.Message) $($ex.Message)"
    if ($text -match '\b(400|401|403|404|429|500|502|503|504)\b') { return [int]$Matches[1] }
    return $null
}

function Get-AuditErrorDetail {
    param($ErrorRecord)
    $msg = $ErrorRecord.ErrorDetails.Message
    if (-not $msg) { $msg = $ErrorRecord.Exception.Message }
    $code = $null
    $text = $msg
    try {
        $j = $msg | ConvertFrom-Json -ErrorAction Stop
        if ($j.error) { $code = $j.error.code; $text = $j.error.message }
    }
    catch {}
    [pscustomobject]@{ Code = $code; Message = $text }
}

function Add-AuditError {
    param([string]$Name, [string]$Uri, $ErrorRecord)
    $d      = Get-AuditErrorDetail $ErrorRecord
    $status = Get-AuditHttpStatus $ErrorRecord
    $probe  = "$($d.Code) $($d.Message)"
    $hint   = 'other'
    if ($probe -match 'NonPremium|premium|licen[sc]e') { $hint = 'license' }
    elseif ($status -eq 403 -or $probe -match 'Authorization_RequestDenied|Insufficient privileges|Forbidden') { $hint = 'permission' }
    elseif ($status -eq 404) { $hint = 'not_found' }
    $script:State.Errors.Add([pscustomobject]@{
            name        = $Name
            endpoint    = $Uri
            http_status = $status
            code        = $d.Code
            message     = $d.Message
            hint        = $hint
        })
    Write-Warning "[$Name] HTTP $status ($hint) - $($d.Code)"
}

function Invoke-GraphWithRetry {
    param(
        [Parameter(Mandatory)][string]$Uri,
        [hashtable]$Headers,
        [int]$MaxRetry = 5
    )
    $attempt = 0
    while ($true) {
        try {
            $p = @{ Method = 'GET'; Uri = $Uri; OutputType = 'Hashtable'; ErrorAction = 'Stop' }
            if ($Headers) { $p.Headers = $Headers }
            return Invoke-MgGraphRequest @p
        }
        catch {
            $attempt++
            $status = Get-AuditHttpStatus $_
            if ($status -in 429, 502, 503, 504 -and $attempt -le $MaxRetry) {
                $wait = [math]::Min(60, [math]::Pow(2, $attempt))
                try {
                    $ra = $_.Exception.Response.Headers.RetryAfter
                    if ($ra -and $ra.Delta) { $wait = [math]::Max($wait, $ra.Delta.TotalSeconds) }
                }
                catch {}
                Write-Verbose "HTTP $status - thử lại sau $wait giây (lần $attempt)"
                Start-Sleep -Seconds $wait
                continue
            }
            throw
        }
    }
}

function Invoke-GraphPaged {
    <# Đi theo @odata.nextLink. Trả về mảng (dùng: $x = Invoke-GraphPaged ...). #>
    param(
        [Parameter(Mandatory)][string]$Uri,
        [hashtable]$Headers,
        [int]$MaxPages = 0
    )
    $script:State.LastTruncated = $false
    $items = [System.Collections.Generic.List[object]]::new()
    $next = $Uri
    $page = 0
    while ($next) {
        $resp = Invoke-GraphWithRetry -Uri $next -Headers $Headers
        $page++
        if ($null -ne $resp.value) { foreach ($v in @($resp.value)) { $items.Add($v) } }
        $next = $resp.'@odata.nextLink'
        if ($next -and $MaxPages -gt 0 -and $page -ge $MaxPages) {
            $script:State.LastTruncated = $true
            break
        }
    }
    return , $items.ToArray()
}

function Get-AuditLastTruncated { return [bool]$script:State.LastTruncated }

function Invoke-GraphSafe {
    <# Bọc lỗi: thất bại -> ghi vào danh sách errors của snapshot và trả $null.
       -Paged thành công luôn trả mảng (có thể rỗng), nên kiểm tra  $null -eq $kq  để biết có lỗi. #>
    param(
        [Parameter(Mandatory)][string]$Uri,
        [Parameter(Mandatory)][string]$Name,
        [switch]$Paged,
        [int]$MaxPages = 0,
        [hashtable]$Headers
    )
    try {
        if ($Paged) {
            $r = Invoke-GraphPaged -Uri $Uri -Headers $Headers -MaxPages $MaxPages
            return , $r
        }
        return (Invoke-GraphWithRetry -Uri $Uri -Headers $Headers)
    }
    catch {
        Add-AuditError -Name $Name -Uri $Uri -ErrorRecord $_
        return $null
    }
}

function Select-AuditSingle {
    <# Một số endpoint trả object, số khác trả {value:[...]} - hàm này lấy phần tử đầu. #>
    param($Response)
    if ($null -eq $Response) { return $null }
    if ($Response -is [System.Collections.IDictionary] -and $Response.ContainsKey('value')) {
        return @($Response['value'])[0]
    }
    return $Response
}
#endregion

#region ---------- Tiện ích ----------
function ConvertTo-AuditArray {
    <# Luôn trả về mảng (null -> mảng rỗng). #>
    param($Value)
    if ($null -eq $Value) { return , @() }
    return , @($Value)
}

function Get-AuditCount {
    param($Value)
    if ($null -eq $Value) { return 0 }
    return @($Value).Count
}

function Get-AuditUniqueCount {
    <# Đếm giá trị duy nhất của khóa $Key trong danh sách hashtable (không dùng Select-Object vì hashtable không có property thật). #>
    param($Items, [string]$Key)
    return @($Items | ForEach-Object { $_[$Key] } | Where-Object { $null -ne $_ } | Sort-Object -Unique).Count
}

function ConvertTo-AuditUtcDate {
    param($Value)
    if ($null -eq $Value -or "$Value" -eq '') { return $null }
    if ($Value -is [datetime]) { return $Value.ToUniversalTime() }
    try {
        return ([datetimeoffset]::Parse([string]$Value, [cultureinfo]::InvariantCulture,
                [System.Globalization.DateTimeStyles]::AssumeUniversal)).UtcDateTime
    }
    catch { return $null }
}

function Get-AuditDaysFrom {
    param($Date)
    $d = ConvertTo-AuditUtcDate $Date
    if (-not $d) { return $null }
    return [int][math]::Floor(([datetime]::UtcNow - $d).TotalDays)
}
#endregion

#region ---------- Pseudonymize ----------
function Get-AuditAlias {
    <# Khi bật -Pseudonymize: thay UPN/tên bằng user_0001... để không đưa PII vào LLM.
       Bảng ánh xạ lưu cục bộ ở _alias_map.json (Export-AuditAliasMap). #>
    param([string]$Value, [string]$Type = 'user')
    if (-not $script:State.Pseudonymize -or [string]::IsNullOrEmpty($Value)) { return $Value }
    $key = "$Type|$($Value.ToLowerInvariant())"
    if (-not $script:State.AliasMap.ContainsKey($key)) {
        if (-not $script:State.AliasCount.ContainsKey($Type)) { $script:State.AliasCount[$Type] = 0 }
        $script:State.AliasCount[$Type]++
        $script:State.AliasMap[$key] = '{0}_{1:D4}' -f $Type, $script:State.AliasCount[$Type]
    }
    return $script:State.AliasMap[$key]
}

function Export-AuditAliasMap {
    if (-not $script:State.Pseudonymize -or $script:State.AliasMap.Count -eq 0) { return }
    $rows = foreach ($k in $script:State.AliasMap.Keys) {
        $type, $val = $k -split '\|', 2
        [pscustomobject]@{ alias = $script:State.AliasMap[$k]; type = $type; value = $val }
    }
    $path = Join-Path $script:State.OutDir '_alias_map.json'
    $rows | Sort-Object alias | ConvertTo-Json | Out-File -FilePath $path -Encoding utf8
    Write-Warning "Đã ghi $path - file này chứa PII gốc, KHÔNG gửi cho LLM."
}
#endregion

#region ---------- Users (dùng chung, có cache) ----------
function Get-AuditUsers {
    [CmdletBinding()]
    param([switch]$Refresh)
    if ($script:State.UserCache -and -not $Refresh) { return , $script:State.UserCache }

    $base = 'id,displayName,userPrincipalName,mail,userType,accountEnabled,createdDateTime,onPremisesSyncEnabled,assignedLicenses'
    # signInActivity cần Entra ID P1 + AuditLog.Read.All, và $top tối đa 500
    $users = Invoke-GraphSafe -Name 'users+signInActivity' -Paged -Uri ('/v1.0/users?$select={0},signInActivity&$top=500' -f $base)
    if ($null -ne $users) {
        $script:State.SignInActivityOk = $true
    }
    else {
        $script:State.SignInActivityOk = $false
        $users = Invoke-GraphSafe -Name 'users' -Paged -Uri ('/v1.0/users?$select={0}&$top=999' -f $base)
    }
    if ($null -eq $users) { $users = @() }
    $script:State.UserCache = $users
    return , $users
}

function Test-AuditSignInActivity { return [bool]$script:State.SignInActivityOk }

function ConvertTo-AuditUserRecord {
    param([Parameter(Mandatory)]$User)
    $last = $null
    if ($User.signInActivity) {
        $last = ConvertTo-AuditUtcDate $User.signInActivity.lastSuccessfulSignInDateTime
        if (-not $last) { $last = ConvertTo-AuditUtcDate $User.signInActivity.lastSignInDateTime }
    }
    $created  = ConvertTo-AuditUtcDate $User.createdDateTime
    $upnAlias = Get-AuditAlias $User.userPrincipalName 'user'
    $display  = if ($script:State.Pseudonymize) { $upnAlias } else { $User.displayName }
    [ordered]@{
        id                      = $User.id
        upn                     = $upnAlias
        display_name            = $display
        user_type               = $User.userType
        account_enabled         = [bool]$User.accountEnabled
        created                 = if ($created) { $created.ToString('o') } else { $null }
        days_since_created      = if ($created) { [int][math]::Floor(([datetime]::UtcNow - $created).TotalDays) } else { $null }
        synced_from_onprem      = [bool]$User.onPremisesSyncEnabled
        license_count           = Get-AuditCount $User.assignedLicenses
        sku_ids                 = @($User.assignedLicenses | ForEach-Object { $_.skuId })
        last_sign_in            = if ($last) { $last.ToString('o') } else { $null }
        days_since_last_sign_in = if ($last) { [int][math]::Floor(([datetime]::UtcNow - $last).TotalDays) } else { $null }
    }
}
#endregion

#region ---------- Ghi snapshot ----------
function Save-AuditSnapshot {
    param(
        [Parameter(Mandatory)][string]$Domain,
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)]$Data,
        [string[]]$Sources = @(),
        $Summary,
        [string[]]$Notes = @()
    )
    $snap = [ordered]@{
        schema_version = '1.0'
        domain         = $Domain
        collector      = $Name
        tenant_id      = $script:State.TenantId
        collected_at   = [datetime]::UtcNow.ToString('o')
        pseudonymized  = $script:State.Pseudonymize
        sources        = $Sources
        notes          = $Notes
        errors         = @($script:State.Errors)
        summary        = $Summary
        data           = $Data
    }
    $path = Join-Path $script:State.OutDir "$Name.json"
    $snap | ConvertTo-Json -Depth 20 | Out-File -FilePath $path -Encoding utf8
    [pscustomobject]@{
        Name       = $Name
        File       = $path
        ErrorCount = $script:State.Errors.Count
        Summary    = $Summary
    }
}
#endregion

Export-ModuleMember -Function Connect-AuditGraph, Test-AuditPermission, Initialize-AuditRun, Start-AuditCollector,
Get-AuditCredentialFilePath, Save-AuditCredentials, Get-AuditSavedCredentials, Get-AuditSecretFromStore,
Invoke-GraphWithRetry, Invoke-GraphPaged, Invoke-GraphSafe, Get-AuditLastTruncated, Select-AuditSingle,
ConvertTo-AuditArray, Get-AuditCount, Get-AuditUniqueCount, ConvertTo-AuditUtcDate, Get-AuditDaysFrom,
Get-AuditAlias, Export-AuditAliasMap,
Get-AuditUsers, Test-AuditSignInActivity, ConvertTo-AuditUserRecord,
Save-AuditSnapshot

```

### 3) `Setup-AuditCredentials.ps1`

```powershell
# Tạo / lưu credential cho app registration và tenant
#Requires -Version 7.0
[CmdletBinding()]
param()

Import-Module (Join-Path $PSScriptRoot 'AuditCommon.psm1') -Force -ErrorAction Stop

$tenantId = Read-Host 'Tenant ID'
$clientId = Read-Host 'Client ID'
$clientSecret = Read-Host 'Client secret (sẽ được mã hóa và lưu local)' -AsSecureString

Save-AuditCredentials -TenantId $tenantId -ClientId $clientId -ClientSecret $clientSecret | Out-Null

Write-Host "" 
Write-Host 'Đã lưu credential mã hóa thành công.' -ForegroundColor Green
Write-Host "File: $((Get-AuditCredentialFilePath))" -ForegroundColor Green
Write-Host 'Bây giờ bạn có thể chạy mọi file trong thư mục /MPV mà không cần nhập lại.' -ForegroundColor Green

```

### 4) `01-Identity.ps1` đến `05-Licenses.ps1`

```powershell
# Collector theo từng domain:
# 01-Identity.ps1
#Requires -Version 7.0
<#
.SYNOPSIS
  Collector 1 - Identity: users, guests, tài khoản bất hoạt, thông tin tenant, security defaults,
  chính sách guest/tạo app, risky users.
.NOTES
  Quyền Graph (Application, read-only): User.Read.All, AuditLog.Read.All, Organization.Read.All,
  Domain.Read.All, Policy.Read.All, IdentityRiskyUser.Read.All
  signInActivity và riskyUsers cần Entra ID P1/P2 - thiếu license sẽ ghi vào mục "errors" (hint=license).
#>
[CmdletBinding()]
param(
    [string]$TenantId,
    [string]$ClientId,
    [string]$OutDir,
    [int]$StaleDays = 90,
    [switch]$Pseudonymize
)
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'AuditCommon.psm1') -ErrorAction Stop
Start-AuditCollector -TenantId $TenantId -ClientId $ClientId -OutDir $OutDir -Pseudonymize:$Pseudonymize `
    -Permissions 'User.Read.All', 'AuditLog.Read.All', 'Organization.Read.All', 'Domain.Read.All', 'Policy.Read.All', 'IdentityRiskyUser.Read.All'

Write-Host '[01] Identity collector...' -ForegroundColor Cyan

# ---- Thông tin tenant / policy ----
$org         = Select-AuditSingle (Invoke-GraphSafe -Name 'organization' -Uri '/v1.0/organization')
$domains     = Invoke-GraphSafe -Name 'domains' -Paged -Uri '/v1.0/domains'
$secDefaults = Invoke-GraphSafe -Name 'securityDefaults' -Uri '/v1.0/policies/identitySecurityDefaultsEnforcementPolicy'
$authz       = Select-AuditSingle (Invoke-GraphSafe -Name 'authorizationPolicy' -Uri '/v1.0/policies/authorizationPolicy')
$riskyUri    = '/v1.0/identityProtection/riskyUsers?$filter=' + [uri]::EscapeDataString("riskState eq 'atRisk'") + '&$top=500'
$risky       = Invoke-GraphSafe -Name 'riskyUsers' -Paged -Uri $riskyUri

# ---- Users ----
$rawUsers = Get-AuditUsers
$users    = @($rawUsers | ForEach-Object { ConvertTo-AuditUserRecord $_ })
$signInOk = Test-AuditSignInActivity

$members = @($users | Where-Object { $_.user_type -eq 'Member' })
$guests  = @($users | Where-Object { $_.user_type -eq 'Guest' })

function Test-Stale($u, [int]$days) {
    # Bất hoạt = đang bật và (đăng nhập cuối > N ngày, hoặc chưa từng đăng nhập mà tài khoản đã tạo > N ngày)
    if (-not $u.account_enabled) { return $false }
    if ($null -ne $u.days_since_last_sign_in) { return ($u.days_since_last_sign_in -gt $days) }
    return ($null -ne $u.days_since_created -and $u.days_since_created -gt $days)
}

$staleMembers = @(); $staleGuests = @()
if ($signInOk) {
    $staleMembers = @($members | Where-Object { Test-Stale $_ $StaleDays })
    $staleGuests  = @($guests  | Where-Object { Test-Stale $_ $StaleDays })
}

$riskyRecords = @()
if ($null -ne $risky) {
    $riskyRecords = @($risky | ForEach-Object {
            [ordered]@{
                id         = $_.id
                upn        = Get-AuditAlias $_.userPrincipalName 'user'
                risk_level = $_.riskLevel
                risk_state = $_.riskState
                risk_last_updated = $_.riskLastUpdatedDateTime
            }
        })
}

# ---- Tổng hợp (facts, KHÔNG phải findings - rules engine sẽ đánh giá sau) ----
$summary = [ordered]@{
    total_users                  = $users.Count
    members                      = $members.Count
    guests                       = $guests.Count
    enabled_users                = @($users | Where-Object { $_.account_enabled }).Count
    disabled_users               = @($users | Where-Object { -not $_.account_enabled }).Count
    synced_from_onprem           = @($users | Where-Object { $_.synced_from_onprem }).Count
    cloud_only_members           = @($members | Where-Object { -not $_.synced_from_onprem }).Count
    sign_in_activity_available   = $signInOk
    stale_days_threshold         = $StaleDays
    stale_enabled_members        = $staleMembers.Count
    stale_enabled_guests         = $staleGuests.Count
    disabled_with_licenses       = @($users | Where-Object { -not $_.account_enabled -and $_.license_count -gt 0 }).Count
    risky_users_at_risk          = if ($null -ne $risky) { $riskyRecords.Count } else { $null }
    security_defaults_enabled    = $secDefaults.isEnabled
    guest_invite_policy          = $authz.allowInvitesFrom
    guest_user_role_id           = $authz.guestUserRoleId
    users_can_create_apps        = $authz.defaultUserRolePermissions.allowedToCreateApps
    users_can_create_tenants     = $authz.defaultUserRolePermissions.allowedToCreateTenants
    users_can_create_security_groups = $authz.defaultUserRolePermissions.allowedToCreateSecurityGroups
    block_msol_powershell        = $authz.blockMsolPowerShell
    onprem_sync_enabled          = $org.onPremisesSyncEnabled
    onprem_last_sync             = $org.onPremisesLastSyncDateTime
}

$data = [ordered]@{
    organization = if ($org) {
        [ordered]@{
            id                 = $org.id
            display_name       = $org.displayName
            created            = $org.createdDateTime
            onprem_sync        = $org.onPremisesSyncEnabled
            onprem_last_sync   = $org.onPremisesLastSyncDateTime
        }
    } else { $null }
    domains = if ($null -ne $domains) {
        @($domains | ForEach-Object {
                [ordered]@{
                    id                              = $_.id
                    is_verified                     = $_.isVerified
                    is_default                      = $_.isDefault
                    authentication_type             = $_.authenticationType
                    password_validity_period_days   = $_.passwordValidityPeriodInDays
                    password_notification_window_days = $_.passwordNotificationWindowInDays
                }
            })
    } else { $null }
    security_defaults    = $secDefaults
    authorization_policy = if ($authz) {
        [ordered]@{
            allow_invites_from                          = $authz.allowInvitesFrom
            guest_user_role_id                          = $authz.guestUserRoleId
            allowed_to_use_sspr                         = $authz.allowedToUseSSPR
            allow_email_verified_users_to_join          = $authz.allowEmailVerifiedUsersToJoinOrganization
            block_msol_powershell                       = $authz.blockMsolPowerShell
            default_user_role_permissions               = $authz.defaultUserRolePermissions
        }
    } else { $null }
    risky_users = $riskyRecords
    users       = $users
}

$notes = @(
    'days_since_last_sign_in dùng lastSuccessfulSignInDateTime (nếu có) rồi tới lastSignInDateTime; cần Entra P1.',
    'Tài khoản chưa từng đăng nhập: chỉ tính là bất hoạt khi đã tạo quá StaleDays ngày.',
    'Tài khoản dịch vụ/shared mailbox có thể bị tính là bất hoạt - cần người rà soát.'
)
$result = Save-AuditSnapshot -Domain 'Identity' -Name '01_identity' -Data $data -Summary $summary -Notes $notes `
    -Sources @('/v1.0/organization', '/v1.0/domains', '/v1.0/users', '/v1.0/policies/authorizationPolicy',
    '/v1.0/policies/identitySecurityDefaultsEnforcementPolicy', '/v1.0/identityProtection/riskyUsers')
Write-Host ("    -> {0} users, {1} guests, {2} lỗi/cảnh báo" -f $summary.total_users, $summary.guests, $result.ErrorCount)
$result

# 02-ConditionalAccess.ps1
#Requires -Version 7.0
<#
.SYNOPSIS
  Collector 2 - Conditional Access: policy thô + các "facts" suy ra (MFA, block legacy auth, risk,
  device compliance, guests, exclusions), named locations, authentication strengths.
.NOTES
  Quyền Graph (Application, read-only): Policy.Read.All
  Cần Entra ID P1 để đọc Conditional Access (thiếu license -> mục errors, hint=license).
#>
[CmdletBinding()]
param(
    [string]$TenantId,
    [string]$ClientId,
    [string]$OutDir,
    [switch]$Pseudonymize
)
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'AuditCommon.psm1') -ErrorAction Stop
Start-AuditCollector -TenantId $TenantId -ClientId $ClientId -OutDir $OutDir -Pseudonymize:$Pseudonymize `
    -Permissions 'Policy.Read.All'

Write-Host '[02] Conditional Access collector...' -ForegroundColor Cyan

$GLOBAL_ADMIN_TEMPLATE_ID = '62e90394-69f5-4237-9190-012177145e10'

$policies  = Invoke-GraphSafe -Name 'conditionalAccessPolicies' -Paged -Uri '/v1.0/identity/conditionalAccess/policies'
$locations = Invoke-GraphSafe -Name 'namedLocations' -Paged -Uri '/v1.0/identity/conditionalAccess/namedLocations'
$strengths = Invoke-GraphSafe -Name 'authenticationStrengths' -Paged -Uri '/v1.0/policies/authenticationStrengthPolicies'

function Get-PolicyFacts {
    param($p)
    $c = $p.conditions
    $g = $p.grantControls
    $s = $p.sessionControls

    $builtIn     = ConvertTo-AuditArray $g.builtInControls
    $clientTypes = ConvertTo-AuditArray $c.clientAppTypes
    $incUsers    = ConvertTo-AuditArray $c.users.includeUsers
    $incRoles    = ConvertTo-AuditArray $c.users.includeRoles
    $incApps     = ConvertTo-AuditArray $c.applications.includeApplications
    $userActions = ConvertTo-AuditArray $c.applications.includeUserActions
    $exclUsers   = ConvertTo-AuditArray $c.users.excludeUsers
    $exclGroups  = ConvertTo-AuditArray $c.users.excludeGroups
    $exclRoles   = ConvertTo-AuditArray $c.users.excludeRoles
    $userRisk    = ConvertTo-AuditArray $c.userRiskLevels
    $signInRisk  = ConvertTo-AuditArray $c.signInRiskLevels
    $exclLoc     = ConvertTo-AuditArray $c.locations.excludeLocations
    $incLoc      = ConvertTo-AuditArray $c.locations.includeLocations
    $platforms   = ConvertTo-AuditArray $c.platforms.includePlatforms

    $blocks      = ('block' -in $builtIn)
    $legacyTypes = (('exchangeActiveSync' -in $clientTypes) -or ('other' -in $clientTypes))
    $modernTypes = (('browser' -in $clientTypes) -or ('mobileAppsAndDesktopClients' -in $clientTypes))

    [ordered]@{
        id                         = $p.id
        name                       = $p.displayName
        state                      = $p.state   # enabled | disabled | enabledForReportingButNotEnforced
        created                    = $p.createdDateTime
        modified                   = $p.modifiedDateTime
        targets_all_users          = ('All' -in $incUsers)
        targets_guests             = [bool]$c.users.includeGuestsOrExternalUsers
        targets_directory_roles    = ($incRoles.Count -gt 0)
        include_roles_count        = $incRoles.Count
        targets_global_admin       = ($GLOBAL_ADMIN_TEMPLATE_ID -in $incRoles)
        targets_all_apps           = ('All' -in $incApps)
        targets_user_actions       = $userActions
        protects_security_info_registration = ('urn:user:registersecurityinfo' -in $userActions)
        client_app_types           = $clientTypes
        platforms_included         = $platforms
        requires_mfa               = (('mfa' -in $builtIn) -or [bool]$g.authenticationStrength)
        authentication_strength    = $g.authenticationStrength.displayName
        blocks_access              = $blocks
        blocks_legacy_auth         = ($blocks -and $legacyTypes -and -not $modernTypes)
        requires_compliant_device  = ('compliantDevice' -in $builtIn)
        requires_hybrid_joined     = ('domainJoinedDevice' -in $builtIn)
        requires_approved_or_compliant_app = (('approvedApplication' -in $builtIn) -or ('compliantApplication' -in $builtIn))
        requires_password_change   = ('passwordChange' -in $builtIn)
        grant_operator             = $g.operator   # OR = chỉ cần đáp ứng 1 control
        user_risk_levels           = $userRisk
        sign_in_risk_levels        = $signInRisk
        uses_risk_conditions       = (($userRisk.Count + $signInRisk.Count) -gt 0)
        excluded_users_count       = $exclUsers.Count
        excluded_groups_count      = $exclGroups.Count
        excluded_roles_count       = $exclRoles.Count
        has_exclusions             = (($exclUsers.Count + $exclGroups.Count + $exclRoles.Count) -gt 0)
        includes_locations         = $incLoc
        excludes_locations         = $exclLoc
        excludes_trusted_locations = ('AllTrusted' -in $exclLoc)
        uses_device_filter         = [bool]$c.devices.deviceFilter
        sign_in_frequency_enabled  = [bool]$s.signInFrequency.isEnabled
        persistent_browser_mode    = $s.persistentBrowser.mode
    }
}

$facts = @()
if ($null -ne $policies) { $facts = @($policies | ForEach-Object { Get-PolicyFacts $_ }) }
$enabled = @($facts | Where-Object { $_.state -eq 'enabled' })

$summary = [ordered]@{
    policies_total                 = $facts.Count
    policies_enabled               = $enabled.Count
    policies_report_only           = @($facts | Where-Object { $_.state -eq 'enabledForReportingButNotEnforced' }).Count
    policies_disabled              = @($facts | Where-Object { $_.state -eq 'disabled' }).Count
    mfa_all_users_all_apps         = (@($enabled | Where-Object { $_.targets_all_users -and $_.targets_all_apps -and $_.requires_mfa -and -not $_.blocks_access }).Count -gt 0)
    mfa_covers_admin_roles         = (@($enabled | Where-Object { $_.requires_mfa -and -not $_.blocks_access -and ($_.targets_directory_roles -or $_.targets_all_users) }).Count -gt 0)
    mfa_for_guests                 = (@($enabled | Where-Object { $_.requires_mfa -and ($_.targets_guests -or $_.targets_all_users) }).Count -gt 0)
    legacy_auth_blocked_all_users  = (@($enabled | Where-Object { $_.blocks_legacy_auth -and $_.targets_all_users }).Count -gt 0)
    security_info_registration_protected = (@($enabled | Where-Object { $_.protects_security_info_registration }).Count -gt 0)
    sign_in_risk_policy_enabled    = (@($enabled | Where-Object { $_.sign_in_risk_levels.Count -gt 0 }).Count -gt 0)
    user_risk_policy_enabled       = (@($enabled | Where-Object { $_.user_risk_levels.Count -gt 0 }).Count -gt 0)
    device_compliance_required     = (@($enabled | Where-Object { $_.requires_compliant_device -or $_.requires_hybrid_joined }).Count -gt 0)
    enabled_policies_with_exclusions = @($enabled | Where-Object { $_.has_exclusions }).Count
    enabled_policies_using_or_operator = @($enabled | Where-Object { $_.grant_operator -eq 'OR' -and $_.requires_mfa }).Count
    named_locations_count          = if ($null -ne $locations) { $locations.Count } else { $null }
}

$locRecords = $null
if ($null -ne $locations) {
    $locRecords = @($locations | ForEach-Object {
            [ordered]@{
                id           = $_.id
                name         = $_.displayName
                type         = ($_.'@odata.type' -replace '^#microsoft\.graph\.', '')
                is_trusted   = $_.isTrusted
                countries    = $_.countriesAndRegions
                ip_range_count = (Get-AuditCount $_.ipRanges)
            }
        })
}
$strRecords = $null
if ($null -ne $strengths) {
    $strRecords = @($strengths | ForEach-Object {
            [ordered]@{
                id                    = $_.id
                name                  = $_.displayName
                policy_type           = $_.policyType
                allowed_combinations  = $_.allowedCombinations
            }
        })
}

$data = [ordered]@{
    facts                   = $facts
    policies_raw            = $policies
    named_locations         = $locRecords
    authentication_strengths = $strRecords
}
$notes = @(
    'facts là dữ kiện suy ra từ policy, KHÔNG phải kết luận. Rules engine sẽ đánh giá.',
    'Policy "All users" thường loại trừ break-glass - collector không tự xác định được break-glass; cần người xác nhận.',
    'Policy report-only hoặc disabled kéo dài là điểm cần rà soát.',
    'includeRoles chứa roleTemplateId, đối chiếu tên role ở snapshot 03.'
)
$result = Save-AuditSnapshot -Domain 'ConditionalAccess' -Name '02_conditional_access' -Data $data -Summary $summary -Notes $notes `
    -Sources @('/v1.0/identity/conditionalAccess/policies', '/v1.0/identity/conditionalAccess/namedLocations', '/v1.0/policies/authenticationStrengthPolicies')
Write-Host ("    -> {0} policy ({1} enabled), {2} lỗi/cảnh báo" -f $summary.policies_total, $summary.policies_enabled, $result.ErrorCount)
$result

# 03-SecurityBaseline.ps1
#Requires -Version 7.0
<#
.SYNOPSIS
  Collector 3 - Security baseline: đăng ký MFA, legacy authentication (sign-in thực tế),
  gán admin role (+ PIM nếu có), authentication methods policy, Microsoft Secure Score.
.NOTES
  Quyền Graph (Application, read-only): Reports.Read.All, AuditLog.Read.All, RoleManagement.Read.Directory,
  Directory.Read.All, Policy.Read.All, SecurityEvents.Read.All, User.Read.All
  Cần Entra ID P1 (reports/sign-in logs), P2/Governance (PIM eligible) - thiếu sẽ ghi vào mục errors.
  Sign-in log chỉ lưu ~30 ngày. Giá trị clientAppType có thể cần chỉnh theo tenant (-LegacyProtocols).
#>
[CmdletBinding()]
param(
    [string]$TenantId,
    [string]$ClientId,
    [string]$OutDir,
    [int]$LookbackDays = 7,
    [int]$MaxPagesPerProtocol = 5,
    [string[]]$LegacyProtocols = @('Exchange ActiveSync', 'IMAP4', 'POP3', 'SMTP', 'Authenticated SMTP',
        'MAPI Over HTTP', 'Other clients', 'Exchange Web Services'),
    [switch]$IncludeNonInteractive,
    [switch]$SkipSignInLogs,
    [switch]$Pseudonymize
)
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'AuditCommon.psm1') -ErrorAction Stop
Start-AuditCollector -TenantId $TenantId -ClientId $ClientId -OutDir $OutDir -Pseudonymize:$Pseudonymize `
    -Permissions 'Reports.Read.All', 'AuditLog.Read.All', 'RoleManagement.Read.Directory', 'Policy.Read.All', 'SecurityEvents.Read.All', 'Directory.Read.All'

Write-Host '[03] Security baseline collector...' -ForegroundColor Cyan

# =====================================================================
# A) MFA registration
# =====================================================================
$weakMethods = @('mobilePhone', 'alternateMobilePhone', 'officePhone', 'email')
$regRaw = Invoke-GraphSafe -Name 'userRegistrationDetails' -Paged -Uri '/v1.0/reports/authenticationMethods/userRegistrationDetails?$top=999'
$reg = @()
if ($null -ne $regRaw) {
    $reg = @(foreach ($r in $regRaw) {
            $methods = ConvertTo-AuditArray $r.methodsRegistered
            $nonWeak = @($methods | Where-Object { $_ -notin $weakMethods })
            [ordered]@{
                id                      = $r.id
                upn                     = Get-AuditAlias $r.userPrincipalName 'user'
                user_type               = $r.userType
                is_admin                = [bool]$r.isAdmin
                is_mfa_registered       = [bool]$r.isMfaRegistered
                is_mfa_capable          = [bool]$r.isMfaCapable
                is_sspr_registered      = [bool]$r.isSsprRegistered
                is_passwordless_capable = [bool]$r.isPasswordlessCapable
                default_mfa_method      = $r.defaultMfaMethod
                methods                 = $methods
                only_weak_methods       = ($methods.Count -gt 0 -and $nonWeak.Count -eq 0)
            }
        })
}
$regById = @{}
foreach ($r in $reg) { $regById[$r.id] = $r }

$mfaTotal = $reg.Count
$mfaDone  = @($reg | Where-Object { $_.is_mfa_registered }).Count
$mfaSummary = [ordered]@{
    available                 = ($null -ne $regRaw)
    users_total               = $mfaTotal
    mfa_registered            = $mfaDone
    mfa_registered_pct        = if ($mfaTotal -gt 0) { [math]::Round(100.0 * $mfaDone / $mfaTotal, 1) } else { $null }
    mfa_capable               = @($reg | Where-Object { $_.is_mfa_capable }).Count
    passwordless_capable      = @($reg | Where-Object { $_.is_passwordless_capable }).Count
    users_only_weak_methods   = @($reg | Where-Object { $_.only_weak_methods }).Count
    admins_total              = @($reg | Where-Object { $_.is_admin }).Count
    admins_without_mfa        = @($reg | Where-Object { $_.is_admin -and -not $_.is_mfa_registered }).Count
    sspr_registered           = @($reg | Where-Object { $_.is_sspr_registered }).Count
}

# =====================================================================
# B) Legacy authentication - sign-in thực tế thành công trong N ngày
# =====================================================================
$legacy = [ordered]@{ performed = $false; lookback_days = $LookbackDays; by_protocol = @(); top_users = @() }
if (-not $SkipSignInLogs) {
    $legacy.performed = $true
    $since = [datetime]::UtcNow.AddDays(-$LookbackDays).ToString("yyyy-MM-dd'T'HH:mm:ss'Z'")
    $modes = @('interactive')
    if ($IncludeNonInteractive) { $modes += 'nonInteractive' }

    $allEvents = [System.Collections.Generic.List[object]]::new()
    $byProto   = [System.Collections.Generic.List[object]]::new()

    foreach ($mode in $modes) {
        $root = '/v1.0/auditLogs/signIns'
        $filterParts = @("createdDateTime ge $since")
        if ($mode -eq 'nonInteractive') {
            $root = '/beta/auditLogs/signIns'   # non-interactive chỉ có ở beta
            $filterParts += "signInEventTypes/any(t: t eq 'nonInteractiveUser')"
        }
        $filter = ($filterParts -join ' and ')
        $uri = '{0}?$filter={1}&$select=createdDateTime,userPrincipalName,appDisplayName,clientAppUsed,status&$top=100' -f $root, [uri]::EscapeDataString($filter)
        $ev = Invoke-GraphSafe -Name "signIns[$mode]" -Paged -MaxPages $MaxPagesPerProtocol -Uri $uri
        $truncated = Get-AuditLastTruncated
        if ($null -eq $ev) { continue }

        $successful = @($ev | Where-Object { $_.status -and $_.status.errorCode -eq 0 })

        foreach ($proto in $LegacyProtocols) {
            $filtered = @($successful | Where-Object { $_.clientAppUsed -eq $proto })
            foreach ($e in $filtered) {
                $allEvents.Add([pscustomobject]@{ proto = $proto; mode = $mode; upn = $e.userPrincipalName; app = $e.appDisplayName })
            }
            $users = @($filtered | ForEach-Object { $_.userPrincipalName } | Sort-Object -Unique)
            $byProto.Add([ordered]@{
                    protocol       = $proto
                    mode           = $mode
                    events_sampled = $filtered.Count
                    truncated      = $truncated   # true = còn nhiều hơn số sự kiện đã lấy
                    distinct_users = $users.Count
                    top_apps       = @($filtered | Group-Object { $_.appDisplayName } | Sort-Object Count -Descending | Select-Object -First 5 |
                            ForEach-Object { [ordered]@{ app = $_.Name; count = $_.Count } })
                })
        }
    }
    $legacy.by_protocol = @($byProto)
    $legacy.top_users = @($allEvents | Group-Object upn | Sort-Object Count -Descending | Select-Object -First 20 | ForEach-Object {
            [ordered]@{
                upn       = Get-AuditAlias $_.Name 'user'
                events    = $_.Count
                protocols = @($_.Group | ForEach-Object { $_.proto } | Sort-Object -Unique)
            }
        })
    $legacy.total_events_sampled = $allEvents.Count
    $legacy.distinct_users       = @($allEvents | ForEach-Object { $_.upn } | Sort-Object -Unique).Count
}

# =====================================================================
# C) Admin roles
# =====================================================================
$privilegedNames = @('Global Administrator', 'Privileged Role Administrator', 'Privileged Authentication Administrator',
    'Security Administrator', 'Exchange Administrator', 'SharePoint Administrator', 'User Administrator',
    'Application Administrator', 'Cloud Application Administrator', 'Conditional Access Administrator',
    'Authentication Administrator', 'Helpdesk Administrator', 'Intune Administrator', 'Teams Administrator',
    'Hybrid Identity Administrator', 'Billing Administrator', 'Compliance Administrator')

$roleDefs = Invoke-GraphSafe -Name 'roleDefinitions' -Paged -Uri '/v1.0/roleManagement/directory/roleDefinitions'
$assign   = Invoke-GraphSafe -Name 'roleAssignments' -Paged -Uri '/v1.0/roleManagement/directory/roleAssignments?$expand=principal'
$elig     = Invoke-GraphSafe -Name 'roleEligibilitySchedules' -Paged -Uri '/v1.0/roleManagement/directory/roleEligibilitySchedules?$expand=principal'
$inst     = Invoke-GraphSafe -Name 'roleAssignmentScheduleInstances' -Paged -Uri '/v1.0/roleManagement/directory/roleAssignmentScheduleInstances?$expand=principal'

$defMap = @{}
if ($null -ne $roleDefs) {
    foreach ($d in $roleDefs) {
        $defMap[$d.id] = @{ name = $d.displayName; privileged = ([bool]$d.isPrivileged -or ($d.displayName -in $privilegedNames)) }
    }
}
$userById = @{}
foreach ($u in (Get-AuditUsers)) { $userById[$u.id] = $u }

function New-RoleRecord {
    param($Item, [string]$Kind)
    $pr   = $Item.principal
    $type = ("$($pr.'@odata.type')" -replace '^#microsoft\.graph\.', '')
    $def  = $defMap[$Item.roleDefinitionId]
    $rec  = [ordered]@{
        kind            = $Kind      # active | eligible
        role            = $def.name
        is_privileged   = [bool]$def.privileged
        role_definition_id = $Item.roleDefinitionId
        principal_id    = $Item.principalId
        principal_type  = $type
        directory_scope = $Item.directoryScopeId
        member_type     = $Item.memberType
        assignment_type = $Item.assignmentType
        end_date_time   = if ($Item.endDateTime) { $Item.endDateTime } else { $Item.scheduleInfo.expiration.endDateTime }
    }
    if ($type -eq 'user') {
        $u = $userById[$Item.principalId]
        $rec.upn                = Get-AuditAlias $pr.userPrincipalName 'user'
        $rec.account_enabled    = if ($u) { [bool]$u.accountEnabled } else { $null }
        $rec.user_type          = if ($u) { $u.userType } else { $null }
        $rec.synced_from_onprem = if ($u) { [bool]$u.onPremisesSyncEnabled } else { $null }
        $rec.mfa_registered     = if ($regById.ContainsKey($Item.principalId)) { $regById[$Item.principalId].is_mfa_registered } else { $null }
    }
    else {
        $rec.name = $pr.displayName
    }
    $rec
}

# Ưu tiên schedule instances (phân biệt Assigned vs Activated, có endDateTime); không có thì dùng roleAssignments
$activeSource = if ($null -ne $inst -and $inst.Count -gt 0) { $inst } else { $assign }
$activeUsingInstances = ($null -ne $inst -and $inst.Count -gt 0)
$active   = @(); if ($null -ne $activeSource) { $active = @($activeSource | ForEach-Object { New-RoleRecord $_ 'active' }) }
$eligible = @(); if ($null -ne $elig) { $eligible = @($elig | ForEach-Object { New-RoleRecord $_ 'eligible' }) }

$activeUsers   = @($active | Where-Object { $_.principal_type -eq 'user' })
$privActive    = @($activeUsers | Where-Object { $_.is_privileged })
$gaActive      = @($activeUsers | Where-Object { $_.role -eq 'Global Administrator' })
$gaEligible    = @($eligible | Where-Object { $_.principal_type -eq 'user' -and $_.role -eq 'Global Administrator' })
$permanentGA   = @($gaActive | Where-Object { $_.assignment_type -eq 'Assigned' -and -not $_.end_date_time })

$byRole = @(foreach ($grp in ($active | Group-Object { $_.role } | Sort-Object Count -Descending)) {
        $rn = $grp.Name
        [ordered]@{ role = $rn; active = $grp.Count; eligible = @($eligible | Where-Object { $_.role -eq $rn }).Count }
    })

$roles = [ordered]@{
    assignments_source                = if ($activeUsingInstances) { 'roleAssignmentScheduleInstances' } else { 'roleAssignments' }
    pim_eligible_data_available       = ($null -ne $elig)
    active_assignments_total          = $active.Count
    eligible_assignments_total        = $eligible.Count
    global_admin_active_users         = Get-AuditUniqueCount $gaActive 'principal_id'
    global_admin_permanent_users      = if ($activeUsingInstances) { Get-AuditUniqueCount $permanentGA 'principal_id' } else { $null }
    global_admin_eligible_users       = Get-AuditUniqueCount $gaEligible 'principal_id'
    privileged_active_users           = Get-AuditUniqueCount $privActive 'principal_id'
    privileged_users_without_mfa      = Get-AuditUniqueCount @($privActive | Where-Object { $_.mfa_registered -eq $false }) 'principal_id'
    privileged_guest_users            = Get-AuditUniqueCount @($privActive | Where-Object { $_.user_type -eq 'Guest' }) 'principal_id'
    privileged_disabled_accounts      = Get-AuditUniqueCount @($privActive | Where-Object { $_.account_enabled -eq $false }) 'principal_id'
    privileged_onprem_synced_accounts = Get-AuditUniqueCount @($privActive | Where-Object { $_.synced_from_onprem -eq $true }) 'principal_id'
    roles_held_by_service_principals  = @($active | Where-Object { $_.principal_type -eq 'servicePrincipal' }).Count
    roles_held_by_groups              = @($active | Where-Object { $_.principal_type -eq 'group' }).Count
    by_role                           = $byRole
}

# =====================================================================
# D) Authentication methods policy + E) Secure Score
# =====================================================================
$amp = Invoke-GraphSafe -Name 'authenticationMethodsPolicy' -Uri '/v1.0/policies/authenticationMethodsPolicy'
$authMethods = $null
if ($amp) {
    $cfgs = ConvertTo-AuditArray $amp.authenticationMethodConfigurations
    $authMethods = [ordered]@{
        registration_campaign_state = $amp.registrationEnforcement.authenticationMethodsRegistrationCampaign.state
        methods = @($cfgs | ForEach-Object { [ordered]@{ id = $_.id; state = $_.state } })
    }
}

$score = Select-AuditSingle (Invoke-GraphSafe -Name 'secureScore' -Uri '/v1.0/security/secureScores?$top=1')
$secureScore = $null
if ($score) {
    $ctrls = ConvertTo-AuditArray $score.controlScores
    $secureScore = [ordered]@{
        created_at    = $score.createdDateTime
        current_score = $score.currentScore
        max_score     = $score.maxScore
        pct           = if ($score.maxScore) { [math]::Round(100.0 * $score.currentScore / $score.maxScore, 1) } else { $null }
        enabled_services = $score.enabledServices
        average_comparative_scores = $score.averageComparativeScores
        control_scores = @($ctrls | ForEach-Object { [ordered]@{ name = $_.controlName; category = $_.controlCategory; score = $_.score } })
    }
}

# =====================================================================
$summary = [ordered]@{
    mfa                  = $mfaSummary
    legacy_auth          = [ordered]@{
        sign_in_logs_checked = $legacy.performed
        events_sampled       = $legacy.total_events_sampled
        distinct_users       = $legacy.distinct_users
    }
    admin_roles          = [ordered]@{
        global_admin_active_users    = $roles.global_admin_active_users
        global_admin_permanent_users = $roles.global_admin_permanent_users
        privileged_users_without_mfa = $roles.privileged_users_without_mfa
        privileged_guest_users       = $roles.privileged_guest_users
        privileged_onprem_synced_accounts = $roles.privileged_onprem_synced_accounts
    }
    secure_score_pct     = if ($secureScore) { $secureScore.pct } else { $null }
}
$data = [ordered]@{
    mfa_registration       = [ordered]@{ summary = $mfaSummary; users = $reg }
    legacy_auth            = $legacy
    admin_roles            = [ordered]@{ summary = $roles; active = $active; eligible = $eligible }
    authentication_methods_policy = $authMethods
    secure_score           = $secureScore
}
$notes = @(
    'is_mfa_registered chỉ cho biết user đã đăng ký MFA, KHÔNG chứng minh MFA được bắt buộc - đối chiếu với snapshot 02.',
    'legacy_auth chỉ lấy mẫu sign-in thành công trong LookbackDays (mặc định 7) và tối đa MaxPagesPerProtocol trang/giao thức; truncated=true nghĩa là còn nhiều hơn.',
    'Mặc định chỉ quét sign-in interactive (v1.0). Legacy protocol thường là non-interactive: thêm -IncludeNonInteractive (beta) để đầy đủ hơn.',
    'Nếu roleAssignmentScheduleInstances lỗi (thiếu license), admin_roles dùng roleAssignments và không phân biệt được permanent/time-bound.',
    'Chưa mở rộng nhóm (group) giữ role: principal_type=group cần đọc members riêng.'
)
$result = Save-AuditSnapshot -Domain 'SecurityBaseline' -Name '03_security_baseline' -Data $data -Summary $summary -Notes $notes `
    -Sources @('/v1.0/reports/authenticationMethods/userRegistrationDetails', '/v1.0/auditLogs/signIns',
    '/v1.0/roleManagement/directory/*', '/v1.0/policies/authenticationMethodsPolicy', '/v1.0/security/secureScores')
Write-Host ("    -> MFA {0}% | GA active: {1} | admin không MFA: {2} | {3} lỗi/cảnh báo" -f `
        $mfaSummary.mfa_registered_pct, $roles.global_admin_active_users, $roles.privileged_users_without_mfa, $result.ErrorCount)
$result

# 04-Apps.ps1
#Requires -Version 7.0
<#
.SYNOPSIS
  Collector 4 - Apps: app registration + hạn secret/cert, quyền Application đã cấp (Graph/Exchange/SharePoint),
  service principal bên thứ ba, delegated consent (tenant-wide / per-user), chính sách user consent.
.NOTES
  Quyền Graph (Application, read-only): Application.Read.All, Directory.Read.All, Policy.Read.All,
  Organization.Read.All, AuditLog.Read.All (cho báo cáo hoạt động service principal - beta, tùy chọn)
  Chỉ đọc quyền Application cấp cho 4 resource API phổ biến (Graph, Exchange Online, SharePoint, Azure AD Graph).
#>
[CmdletBinding()]
param(
    [string]$TenantId,
    [string]$ClientId,
    [string]$OutDir,
    [int]$ExpiringWithinDays = 30,
    [int]$LongLivedSecretDays = 730,
    [int]$InactiveDays = 90,
    [switch]$SkipSpSignInActivity,
    [switch]$Pseudonymize
)
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'AuditCommon.psm1') -ErrorAction Stop
Start-AuditCollector -TenantId $TenantId -ClientId $ClientId -OutDir $OutDir -Pseudonymize:$Pseudonymize `
    -Permissions 'Application.Read.All', 'Directory.Read.All', 'Policy.Read.All', 'Organization.Read.All'

Write-Host '[04] Apps collector...' -ForegroundColor Cyan

# ---- Danh sách quyền rủi ro cao (tên quyền, áp dụng cho cả Application và Delegated) ----
$HighRiskApplication = @(
    'Directory.ReadWrite.All', 'RoleManagement.ReadWrite.Directory', 'Application.ReadWrite.All',
    'AppRoleAssignment.ReadWrite.All', 'User.ReadWrite.All', 'Group.ReadWrite.All',
    'Mail.ReadWrite', 'Mail.Send', 'Mail.Read', 'MailboxSettings.ReadWrite',
    'Files.ReadWrite.All', 'Files.Read.All', 'Sites.FullControl.All', 'Sites.ReadWrite.All',
    'Policy.ReadWrite.ConditionalAccess', 'DeviceManagementConfiguration.ReadWrite.All',
    'DeviceManagementManagedDevices.ReadWrite.All', 'DeviceManagementRBAC.ReadWrite.All',
    'full_access_as_app', 'Exchange.ManageAsApp', 'Chat.ReadWrite.All', 'Calendars.ReadWrite'
)
$HighRiskDelegated = @(
    'Directory.AccessAsUser.All', 'Directory.ReadWrite.All', 'User.ReadWrite.All',
    'Mail.ReadWrite', 'Mail.Send', 'Files.ReadWrite.All', 'Sites.FullControl.All',
    'full_access_as_user', 'EWS.AccessAsUser.All', 'RoleManagement.ReadWrite.Directory'
)
$MicrosoftOwnerTenants = @('f8cdef31-a31e-4b4a-93e4-5f571e91255a', '72f988bf-86f1-41af-91ab-2d7cd011db47')

$Resources = [ordered]@{
    'Microsoft Graph'            = '00000003-0000-0000-c000-000000000000'
    'Exchange Online'            = '00000002-0000-0ff1-ce00-000000000000'
    'SharePoint Online'          = '00000003-0000-0ff1-ce00-000000000000'
    'Azure AD Graph (deprecated)' = '00000002-0000-0000-c000-000000000000'
}

# ---- Lấy dữ liệu ----
$org = Select-AuditSingle (Invoke-GraphSafe -Name 'organization' -Uri '/v1.0/organization')
$tenantGuid = if ($org) { $org.id } else { $TenantId }

$appSelect = 'id,appId,displayName,createdDateTime,signInAudience,publisherDomain,verifiedPublisher,passwordCredentials,keyCredentials,requiredResourceAccess'
$apps = Invoke-GraphSafe -Name 'applications' -Paged -Uri ('/v1.0/applications?$select={0}&$top=999' -f $appSelect)
$spSelect = 'id,appId,displayName,servicePrincipalType,accountEnabled,appOwnerOrganizationId,signInAudience,tags,verifiedPublisher'
$sps = Invoke-GraphSafe -Name 'servicePrincipals' -Paged -Uri ('/v1.0/servicePrincipals?$select={0}&$top=999' -f $spSelect)
if ($null -eq $apps) { $apps = @() }
if ($null -eq $sps)  { $sps = @() }

$spById = @{}; $spByAppId = @{}
foreach ($sp in $sps) { $spById[$sp.id] = $sp; $spByAppId[$sp.appId] = $sp }

# ---- Map id -> tên quyền cho từng resource + quyền Application đã được cấp ----
$idMap = @{}                                   # resourceAppId -> (id -> value)
$grantsByPrincipal = @{}                       # principalId(SP) -> list "Resource:Role"
foreach ($resName in $Resources.Keys) {
    $resAppId = $Resources[$resName]
    $resSp = $spByAppId[$resAppId]
    if (-not $resSp) { continue }
    $detail = Invoke-GraphSafe -Name "resource[$resName]" -Uri ('/v1.0/servicePrincipals/{0}?$select=id,appRoles,oauth2PermissionScopes' -f $resSp.id)
    if ($detail) {
        $m = @{}
        foreach ($r in (ConvertTo-AuditArray $detail.appRoles))               { $m[$r.id] = $r.value }
        foreach ($sc in (ConvertTo-AuditArray $detail.oauth2PermissionScopes)) { $m[$sc.id] = $sc.value }
        $idMap[$resAppId] = $m
    }
    $assigned = Invoke-GraphSafe -Name "appRoleAssignedTo[$resName]" -Paged -Uri ('/v1.0/servicePrincipals/{0}/appRoleAssignedTo?$top=999' -f $resSp.id)
    if ($null -ne $assigned) {
        foreach ($a in $assigned) {
            if ($a.principalType -ne 'ServicePrincipal') { continue }
            $roleName = if ($idMap[$resAppId] -and $idMap[$resAppId][$a.appRoleId]) { $idMap[$resAppId][$a.appRoleId] } else { "$($a.appRoleId)" }
            if (-not $grantsByPrincipal.ContainsKey($a.principalId)) {
                $grantsByPrincipal[$a.principalId] = [System.Collections.Generic.List[object]]::new()
            }
            $grantsByPrincipal[$a.principalId].Add([ordered]@{ resource = $resName; role = $roleName; granted = $a.createdDateTime })
        }
    }
}

# ---- Hoạt động đăng nhập của service principal (beta, tùy chọn) ----
$spActivity = @{}
if (-not $SkipSpSignInActivity) {
    $act = Invoke-GraphSafe -Name 'servicePrincipalSignInActivities(beta)' -Paged -Uri '/beta/reports/servicePrincipalSignInActivities?$top=999'
    if ($null -ne $act) {
        foreach ($x in $act) {
            $dates = @(
                $x.lastSignInActivity.lastSignInDateTime,
                $x.delegatedClientSignInActivity.lastSignInDateTime,
                $x.delegatedResourceSignInActivity.lastSignInDateTime,
                $x.applicationAuthenticationClientSignInActivity.lastSignInDateTime,
                $x.applicationAuthenticationResourceSignInActivity.lastSignInDateTime
            ) | ForEach-Object { ConvertTo-AuditUtcDate $_ } | Where-Object { $_ }
            if ($dates) { $spActivity[$x.appId] = ($dates | Sort-Object -Descending | Select-Object -First 1) }
        }
    }
}
$activityAvailable = ($spActivity.Count -gt 0)

# ---- App registrations ----
$now = [datetime]::UtcNow
function ConvertTo-CredRecord($c, [string]$type) {
    $end   = ConvertTo-AuditUtcDate $c.endDateTime
    $start = ConvertTo-AuditUtcDate $c.startDateTime
    [ordered]@{
        type           = $type
        key_id         = $c.keyId
        name           = $c.displayName
        start          = if ($start) { $start.ToString('o') } else { $null }
        end            = if ($end) { $end.ToString('o') } else { $null }
        days_to_expiry = if ($end) { [int][math]::Floor(($end - $now).TotalDays) } else { $null }
        lifetime_days  = if ($end -and $start) { [int][math]::Floor(($end - $start).TotalDays) } else { $null }
    }
}

$appRecords = @(foreach ($a in $apps) {
        $creds = @()
        foreach ($s in (ConvertTo-AuditArray $a.passwordCredentials)) { $creds += ConvertTo-CredRecord $s 'secret' }
        foreach ($k in (ConvertTo-AuditArray $a.keyCredentials))      { $creds += ConvertTo-CredRecord $k 'certificate' }
        $secrets = @($creds | Where-Object { $_.type -eq 'secret' })
        $certs   = @($creds | Where-Object { $_.type -eq 'certificate' })

        # Quyền khai báo trong manifest
        $reqApp = @(); $reqDel = @()
        foreach ($rra in (ConvertTo-AuditArray $a.requiredResourceAccess)) {
            $map = $idMap[$rra.resourceAppId]
            foreach ($ra in (ConvertTo-AuditArray $rra.resourceAccess)) {
                $nm = if ($map -and $map[$ra.id]) { $map[$ra.id] } else { "$($rra.resourceAppId):$($ra.id)" }
                if ($ra.type -eq 'Role') { $reqApp += $nm } else { $reqDel += $nm }
            }
        }
        # Quyền Application đã thực sự được cấp (admin consent)
        $sp = $spByAppId[$a.appId]
        $granted = @(); if ($sp -and $grantsByPrincipal.ContainsKey($sp.id)) { $granted = @($grantsByPrincipal[$sp.id]) }
        $grantedHigh = @($granted | Where-Object { $_.role -in $HighRiskApplication })
        $lastAct = if ($activityAvailable -and $spActivity.ContainsKey($a.appId)) { $spActivity[$a.appId] } else { $null }
        $daysIdle = if ($lastAct) { [int][math]::Floor(($now - $lastAct).TotalDays) } else { $null }

        [ordered]@{
            id                       = $a.id
            app_id                   = $a.appId
            name                     = $a.displayName
            created                  = $a.createdDateTime
            sign_in_audience         = $a.signInAudience
            verified_publisher       = [bool]$a.verifiedPublisher.verifiedPublisherId
            secrets_count            = $secrets.Count
            certificates_count       = $certs.Count
            has_no_credentials       = ($creds.Count -eq 0)
            uses_secret_only         = ($secrets.Count -gt 0 -and $certs.Count -eq 0)
            has_expired_credential   = (@($creds | Where-Object { $null -ne $_.days_to_expiry -and $_.days_to_expiry -lt 0 }).Count -gt 0)
            has_expiring_credential  = (@($creds | Where-Object { $null -ne $_.days_to_expiry -and $_.days_to_expiry -ge 0 -and $_.days_to_expiry -le $ExpiringWithinDays }).Count -gt 0)
            has_long_lived_secret    = (@($secrets | Where-Object { $null -ne $_.lifetime_days -and $_.lifetime_days -gt $LongLivedSecretDays }).Count -gt 0)
            credentials              = $creds
            requested_application_permissions = $reqApp
            requested_delegated_permissions   = $reqDel
            granted_application_roles         = $granted
            granted_high_risk_roles           = @($grantedHigh | ForEach-Object { "{0}:{1}" -f $_.resource, $_.role })
            has_granted_high_risk_role        = ($grantedHigh.Count -gt 0)
            last_sign_in_activity    = if ($lastAct) { $lastAct.ToString('o') } else { $null }
            days_since_last_activity = $daysIdle
            inactive_with_credentials = ($activityAvailable -and $creds.Count -gt 0 -and ($null -eq $daysIdle -or $daysIdle -gt $InactiveDays))
        }
    })

# ---- Service principals (tóm tắt + bên thứ ba) ----
$spRecords = @(foreach ($sp in $sps) {
        if ($sp.servicePrincipalType -ne 'Application') { continue }
        $owner = $sp.appOwnerOrganizationId
        $isThirdParty = ($owner -and $owner -ne $tenantGuid -and $owner -notin $MicrosoftOwnerTenants)
        if (-not $isThirdParty) { continue }
        $g = @(); if ($grantsByPrincipal.ContainsKey($sp.id)) { $g = @($grantsByPrincipal[$sp.id]) }
        [ordered]@{
            id                    = $sp.id
            app_id                = $sp.appId
            name                  = $sp.displayName
            owner_tenant_id       = $owner
            account_enabled       = $sp.accountEnabled
            verified_publisher    = [bool]$sp.verifiedPublisher.verifiedPublisherId
            granted_application_roles = @($g | ForEach-Object { "{0}:{1}" -f $_.resource, $_.role })
            granted_high_risk_roles   = @($g | Where-Object { $_.role -in $HighRiskApplication } | ForEach-Object { "{0}:{1}" -f $_.resource, $_.role })
        }
    })

# ---- Delegated consent ----
$grants = Invoke-GraphSafe -Name 'oauth2PermissionGrants' -Paged -Uri '/v1.0/oauth2PermissionGrants'
$tenantWide = @(); $perUser = @()
if ($null -ne $grants) {
    $tenantWide = @(foreach ($g in ($grants | Where-Object { $_.consentType -eq 'AllPrincipals' })) {
            $sp = $spById[$g.clientId]
            $scopes = @(("$($g.scope)" -split '\s+') | Where-Object { $_ })
            $owner = $sp.appOwnerOrganizationId
            [ordered]@{
                client_sp_id    = $g.clientId
                client_name     = $sp.displayName
                client_app_id   = $sp.appId
                third_party     = [bool]($owner -and $owner -ne $tenantGuid -and $owner -notin $MicrosoftOwnerTenants)
                scopes          = $scopes
                high_risk_scopes = @($scopes | Where-Object { $_ -in $HighRiskDelegated })
            }
        })
    $perUserGroups = $grants | Where-Object { $_.consentType -eq 'Principal' } | Group-Object { $_.clientId }
    $perUser = @(foreach ($grp in $perUserGroups) {
            $sp = $spById[$grp.Name]
            $scopes = @($grp.Group | ForEach-Object { "$($_.scope)" -split '\s+' } | Where-Object { $_ } | Sort-Object -Unique)
            [ordered]@{
                client_sp_id     = $grp.Name
                client_name      = $sp.displayName
                users_consented  = $grp.Count
                scopes           = $scopes
                high_risk_scopes = @($scopes | Where-Object { $_ -in $HighRiskDelegated })
            }
        })
}

# ---- Chính sách consent / tạo app ----
$authz = Select-AuditSingle (Invoke-GraphSafe -Name 'authorizationPolicy' -Uri '/v1.0/policies/authorizationPolicy')
$adminConsent = Invoke-GraphSafe -Name 'adminConsentRequestPolicy' -Uri '/v1.0/policies/adminConsentRequestPolicy'
$grantPolicies = ConvertTo-AuditArray $authz.defaultUserRolePermissions.permissionGrantPoliciesAssigned
$consentMode = 'unknown'
if ($authz) {
    if ($grantPolicies.Count -eq 0) { $consentMode = 'users_cannot_consent' }
    elseif (@($grantPolicies | Where-Object { $_ -match 'legacy' }).Count -gt 0) { $consentMode = 'users_can_consent_to_any_app (legacy)' }
    elseif (@($grantPolicies | Where-Object { $_ -match 'low' }).Count -gt 0) { $consentMode = 'users_can_consent_low_risk_verified_publishers' }
    else { $consentMode = 'custom' }
}

# ---- Tổng hợp ----
$summary = [ordered]@{
    app_registrations_total             = $appRecords.Count
    apps_with_expired_credential        = @($appRecords | Where-Object { $_.has_expired_credential }).Count
    apps_with_credential_expiring_soon  = @($appRecords | Where-Object { $_.has_expiring_credential }).Count
    expiring_window_days                = $ExpiringWithinDays
    apps_with_long_lived_secret         = @($appRecords | Where-Object { $_.has_long_lived_secret }).Count
    apps_using_secret_only              = @($appRecords | Where-Object { $_.uses_secret_only }).Count
    apps_without_credentials            = @($appRecords | Where-Object { $_.has_no_credentials }).Count
    apps_with_high_risk_application_roles = @($appRecords | Where-Object { $_.has_granted_high_risk_role }).Count
    apps_inactive_with_credentials      = if ($activityAvailable) { @($appRecords | Where-Object { $_.inactive_with_credentials }).Count } else { $null }
    sp_activity_data_available          = $activityAvailable
    service_principals_total            = $sps.Count
    third_party_service_principals      = $spRecords.Count
    third_party_unverified_publisher    = @($spRecords | Where-Object { -not $_.verified_publisher }).Count
    third_party_with_high_risk_roles    = @($spRecords | Where-Object { $_.granted_high_risk_roles.Count -gt 0 }).Count
    tenant_wide_delegated_grants        = $tenantWide.Count
    tenant_wide_grants_with_high_risk_scopes = @($tenantWide | Where-Object { $_.high_risk_scopes.Count -gt 0 }).Count
    per_user_consented_apps             = $perUser.Count
    per_user_consented_apps_high_risk   = @($perUser | Where-Object { $_.high_risk_scopes.Count -gt 0 }).Count
    user_consent_mode                   = $consentMode
    users_can_create_apps               = $authz.defaultUserRolePermissions.allowedToCreateApps
    admin_consent_workflow_enabled      = $adminConsent.isEnabled
}

$data = [ordered]@{
    app_registrations         = $appRecords
    third_party_service_principals = $spRecords
    delegated_grants_tenant_wide   = $tenantWide
    delegated_grants_per_user      = $perUser
    consent_policy = [ordered]@{
        user_consent_mode              = $consentMode
        permission_grant_policies      = $grantPolicies
        users_can_create_apps          = $authz.defaultUserRolePermissions.allowedToCreateApps
        admin_consent_request_policy   = $adminConsent
    }
    high_risk_application_roles_list = $HighRiskApplication
    high_risk_delegated_scopes_list  = $HighRiskDelegated
}
$notes = @(
    'Chỉ phân tích quyền Application cấp cho Graph, Exchange Online, SharePoint Online, Azure AD Graph; resource API khác chưa được quét.',
    'Danh sách "high risk" là heuristic, có thể chỉnh trong script - cần người đánh giá theo ngữ cảnh.',
    'Chưa kiểm tra owner của từng app (cần 1 call/app); có thể thêm sau nếu tenant nhỏ.',
    'last_sign_in_activity dùng endpoint beta; nếu lỗi, các chỉ số "inactive" sẽ là null (không kết luận).',
    'Secret của app KHÔNG bao giờ được đọc (Graph không trả giá trị secret), chỉ có metadata và ngày hết hạn.'
)
$result = Save-AuditSnapshot -Domain 'Apps' -Name '04_apps' -Data $data -Summary $summary -Notes $notes `
    -Sources @('/v1.0/applications', '/v1.0/servicePrincipals', '/v1.0/servicePrincipals/{id}/appRoleAssignedTo',
    '/v1.0/oauth2PermissionGrants', '/v1.0/policies/authorizationPolicy', '/v1.0/policies/adminConsentRequestPolicy',
    '/beta/reports/servicePrincipalSignInActivities')
Write-Host ("    -> {0} app, {1} hết hạn, {2} sắp hết hạn, {3} có quyền rủi ro cao, {4} lỗi/cảnh báo" -f `
        $summary.app_registrations_total, $summary.apps_with_expired_credential, $summary.apps_with_credential_expiring_soon,
    $summary.apps_with_high_risk_application_roles, $result.ErrorCount)
$result

# 05-Licenses.ps1
#Requires -Version 7.0
<#
.SYNOPSIS
  Collector 5 - Licenses: SKU đã mua/đã gán/còn trống, license trên tài khoản bất hoạt/bị vô hiệu/guest,
  người dùng giữ nhiều SKU chồng lấp.
.NOTES
  Quyền Graph (Application, read-only): User.Read.All, Organization.Read.All (hoặc LicenseAssignment.Read.All),
  AuditLog.Read.All (signInActivity - cần Entra P1).
  Script KHÔNG tính tiền (giá thay đổi theo hợp đồng) - chỉ đếm số lượng để lên kế hoạch tối ưu.
#>
[CmdletBinding()]
param(
    [string]$TenantId,
    [string]$ClientId,
    [string]$OutDir,
    [int]$StaleDays = 90,
    [switch]$Pseudonymize
)
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'AuditCommon.psm1') -ErrorAction Stop
Start-AuditCollector -TenantId $TenantId -ClientId $ClientId -OutDir $OutDir -Pseudonymize:$Pseudonymize `
    -Permissions 'User.Read.All', 'Organization.Read.All', 'AuditLog.Read.All'

Write-Host '[05] License collector...' -ForegroundColor Cyan

# Tên thân thiện cho các SKU phổ biến (không có trong map thì dùng skuPartNumber)
$friendly = @{
    'SPE_E3' = 'Microsoft 365 E3'; 'SPE_E5' = 'Microsoft 365 E5'; 'SPE_F1' = 'Microsoft 365 F3'
    'ENTERPRISEPACK' = 'Office 365 E3'; 'ENTERPRISEPREMIUM' = 'Office 365 E5'; 'STANDARDPACK' = 'Office 365 E1'
    'O365_BUSINESS_ESSENTIALS' = 'Microsoft 365 Business Basic'; 'O365_BUSINESS_PREMIUM' = 'Microsoft 365 Business Standard'
    'SPB' = 'Microsoft 365 Business Premium'; 'EMS' = 'Enterprise Mobility + Security E3'; 'EMSPREMIUM' = 'Enterprise Mobility + Security E5'
    'AAD_PREMIUM' = 'Entra ID P1'; 'AAD_PREMIUM_P2' = 'Entra ID P2'; 'POWER_BI_PRO' = 'Power BI Pro'
    'FLOW_FREE' = 'Power Automate Free'; 'POWER_BI_STANDARD' = 'Power BI (free)'
    'WINDOWS_STORE' = 'Windows Store for Business'; 'INTUNE_A' = 'Intune Plan 1'
    'Microsoft_365_Copilot' = 'Microsoft 365 Copilot'; 'TEAMS_EXPLORATORY' = 'Teams Exploratory'
}

$skus = Invoke-GraphSafe -Name 'subscribedSkus' -Paged -Uri '/v1.0/subscribedSkus'
if ($null -eq $skus) { $skus = @() }

$rawUsers = Get-AuditUsers
$users    = @($rawUsers | ForEach-Object { ConvertTo-AuditUserRecord $_ })
$signInOk = Test-AuditSignInActivity

function Test-StaleUser($u, [int]$days) {
    if (-not $u.account_enabled) { return $false }
    if ($null -ne $u.days_since_last_sign_in) { return ($u.days_since_last_sign_in -gt $days) }
    return ($null -ne $u.days_since_created -and $u.days_since_created -gt $days)
}

$skuName = @{}      # skuId -> friendly/partNumber
foreach ($s in $skus) {
    $skuName[$s.skuId] = if ($friendly.ContainsKey($s.skuPartNumber)) { $friendly[$s.skuPartNumber] } else { $s.skuPartNumber }
}
$licensed = @($users | Where-Object { $_.license_count -gt 0 })

# ---- Từng SKU ----
$skuRecords = @(foreach ($s in $skus) {
        $assigned = @($licensed | Where-Object { $s.skuId -in $_.sku_ids })
        $enabledUnits = [int]$s.prepaidUnits.enabled
        $consumed     = [int]$s.consumedUnits
        $plans        = ConvertTo-AuditArray $s.servicePlans
        $inactive     = @(); if ($signInOk) { $inactive = @($assigned | Where-Object { Test-StaleUser $_ $StaleDays }) }
        [ordered]@{
            sku_id             = $s.skuId
            sku_part_number    = $s.skuPartNumber
            name               = $skuName[$s.skuId]
            status             = $s.capabilityStatus
            purchased_units    = $enabledUnits
            suspended_units    = [int]$s.prepaidUnits.suspended
            warning_units      = [int]$s.prepaidUnits.warning
            consumed_units     = $consumed
            available_units    = ($enabledUnits - $consumed)
            utilization_pct    = if ($enabledUnits -gt 0) { [math]::Round(100.0 * $consumed / $enabledUnits, 1) } else { $null }
            assigned_users_seen = $assigned.Count
            assigned_to_inactive_users = if ($signInOk) { $inactive.Count } else { $null }
            assigned_to_disabled_users = @($assigned | Where-Object { -not $_.account_enabled }).Count
            assigned_to_guests         = @($assigned | Where-Object { $_.user_type -eq 'Guest' }).Count
            service_plans_count = (Get-AuditCount $s.servicePlans)
            service_plans      = @($plans | ForEach-Object { $_.servicePlanName })
        }
    })

# ---- Danh sách cần xem xét thu hồi license (chỉ user có cờ) ----
$flagged = @(foreach ($u in $licensed) {
        $reasons = @()
        if (-not $u.account_enabled)                                  { $reasons += 'account_disabled' }
        if ($signInOk -and (Test-StaleUser $u $StaleDays))             { $reasons += "inactive_over_${StaleDays}_days" }
        if ($u.user_type -eq 'Guest')                                  { $reasons += 'guest_with_license' }
        if ($reasons.Count -eq 0) { continue }
        [ordered]@{
            id                      = $u.id
            upn                     = $u.upn
            user_type               = $u.user_type
            account_enabled         = $u.account_enabled
            days_since_last_sign_in = $u.days_since_last_sign_in
            licenses                = @($u.sku_ids | ForEach-Object { $skuName[$_] })
            reasons                 = $reasons
        }
    })

# ---- Chồng lấp SKU (user giữ >= 2 SKU) ----
$multi = @($licensed | Where-Object { $_.sku_ids.Count -ge 2 })
$combos = @($multi | Group-Object { (@($_.sku_ids | ForEach-Object { $skuName[$_] }) | Sort-Object) -join ' + ' } |
        Sort-Object Count -Descending | Select-Object -First 15 |
        ForEach-Object { [ordered]@{ combination = $_.Name; users = $_.Count } })

$totalPurchased = ($skuRecords | ForEach-Object { $_.purchased_units } | Measure-Object -Sum).Sum
$summary = [ordered]@{
    skus_total                    = $skuRecords.Count
    users_total                   = $users.Count
    licensed_users                = $licensed.Count
    unlicensed_enabled_members    = @($users | Where-Object { $_.account_enabled -and $_.user_type -eq 'Member' -and $_.license_count -eq 0 }).Count
    sign_in_activity_available    = $signInOk
    stale_days_threshold          = $StaleDays
    licensed_inactive_users       = if ($signInOk) { @($licensed | Where-Object { Test-StaleUser $_ $StaleDays }).Count } else { $null }
    licensed_disabled_users       = @($licensed | Where-Object { -not $_.account_enabled }).Count
    licensed_guests               = @($licensed | Where-Object { $_.user_type -eq 'Guest' }).Count
    users_with_multiple_skus      = $multi.Count
    purchased_units_all_skus      = $totalPurchased
    available_units_paid_skus     = (@($skuRecords | Where-Object { $_.purchased_units -gt 0 -and $_.available_units -gt 0 } | ForEach-Object { $_.available_units }) | Measure-Object -Sum).Sum
    skus_with_low_utilization     = @($skuRecords | Where-Object { $null -ne $_.utilization_pct -and $_.purchased_units -ge 5 -and $_.utilization_pct -lt 80 }).Count
    skus_suspended_or_warning     = @($skuRecords | Where-Object { $_.suspended_units -gt 0 -or $_.warning_units -gt 0 -or $_.status -ne 'Enabled' }).Count
}

$data = [ordered]@{
    skus                      = $skuRecords
    licenses_to_review        = $flagged
    multi_sku_combinations    = $combos
}
$notes = @(
    'Chỉ đếm số lượng, không tính tiền; ghép với bảng giá/hợp đồng của khách ở bước báo cáo.',
    'purchased_units dựa trên prepaidUnits.enabled; trial và license miễn phí có thể làm số liệu "available" gây hiểu nhầm.',
    'License gán qua group không phân biệt trực tiếp/qua group ở bản này (cần licenseAssignmentStates).',
    'Chồng lấp SKU (ví dụ E3 + E5) có thể là chủ ý (add-on); cần người xác nhận trước khi thu hồi.',
    'Chưa phân tích việc dùng thực tế từng service plan (ví dụ tính năng E5 có dùng không) - hướng mở rộng.'
)
$result = Save-AuditSnapshot -Domain 'Licenses' -Name '05_licenses' -Data $data -Summary $summary -Notes $notes `
    -Sources @('/v1.0/subscribedSkus', '/v1.0/users')
Write-Host ("    -> {0} SKU, {1} user có license, {2} cần xem xét, {3} lỗi/cảnh báo" -f `
        $summary.skus_total, $summary.licensed_users, $flagged.Count, $result.ErrorCount)
$result

```

### 5) `audit-engine/run_audit.py`

```bash
#python .\run_audit.py --snapshots .\snapshots\<tenant-guid>\<run-id>\combined-run --out out
#!/usr/bin/env python3
"""Rules engine: đọc thư mục snapshot của collector -> run.json, snapshot.json, results.json, findings.json.

Ví dụ:
  python run_audit.py --snapshots ../snapshots/<tenant-id>/<run> --out out
  python run_audit.py --snapshots ... --fail-on High     # exit code 2 nếu còn finding fail >= High (dùng cho CI)
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from engine import ENGINE_VERSION, RULESET_VERSION
from engine.model import SEV_RANK, SEVERITIES
from engine.registry import RULES
from engine.runner import build_findings, evaluate, summarize
from engine.snapshot import Snapshot
import engine.rules  # noqa: F401  (đăng ký rule)


def now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def write(path: Path, obj):
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--snapshots", required=True, help="Thư mục chứa 01_identity.json ... 05_licenses.json")
    ap.add_argument("--out", default="out", help="Thư mục gốc ghi kết quả")
    ap.add_argument("--tenant-name", help="Ghi đè tên tenant trong báo cáo")
    ap.add_argument("--fail-on", choices=SEVERITIES, help="Exit 2 nếu có finding status=fail với severity >= mức này")
    args = ap.parse_args(argv)

    started = now()
    snap = Snapshot(args.snapshots, tenant_name=args.tenant_name)
    for p in snap.problems:
        print(f"[!] {p}", file=sys.stderr)
    if snap.fatal_problems:
        print("Dừng: snapshot không nhất quán.", file=sys.stderr)
        return 1

    manifest = snap.manifest or {}
    run_id = manifest.get("run_id") or Path(args.snapshots).name
    results = evaluate(snap, RULES)
    findings = build_findings(results, snap, run_id)
    stats = summarize(results)

    gaps = stats["by_status"].get("unknown", 0) > 0 or bool(snap.problems)
    run = {
        "run_id": run_id,
        "tenant_id": snap.tenant_id,
        "tenant_name": snap.tenant_name,
        "started_at": started,
        "finished_at": now(),
        "status": "completed_with_gaps" if gaps else "completed",
        "engine_version": ENGINE_VERSION,
        "ruleset_version": RULESET_VERSION,
        "rules_total": len(RULES),
        "pseudonymized": snap.pseudonymized,
        "collector": {   # lấy từ _manifest.json của Run-Collectors.ps1 (nếu có)
            "started_at": manifest.get("started_at"), "finished_at": manifest.get("finished_at"),
            "graph_sdk_version": manifest.get("graph_sdk_version"), "powershell_version": manifest.get("powershell_version"),
            "consent_scopes": manifest.get("consent_scopes"),
            "collectors": manifest.get("collectors"),
        },
        "inputs": {s.filename: {"sha256": s.sha256, "collected_at": s.collected_at} for s in snap.sources.values() if s.present},
        "problems": snap.problems,
        "stats": stats,
    }

    out = Path(args.out) / run_id
    out.mkdir(parents=True, exist_ok=True)
    clean = [{k: v for k, v in r.items() if k != "_rule"} for r in results]
    write(out / "run.json", run)
    write(out / "snapshot.json", snap.to_dict(run_id))
    write(out / "results.json", clean)
    write(out / "findings.json", {"run_id": run_id, "tenant_id": snap.tenant_id, "findings": findings})

    # ---- Hiển thị ----
    print(f"\n== {snap.tenant_name} | run {run_id} | {run['status']} ==")
    print(f"Rules: {stats['rules_total']} | " + ", ".join(f"{k}={v}" for k, v in sorted(stats["by_status"].items())))
    print(f"Coverage (đã đánh giá được): {stats['coverage_pct']}%")
    print("Findings mở:", ", ".join(f"{k}={v}" for k, v in stats["open_by_severity"].items() if v) or "không có")
    for f in findings:
        print(f"  [{f['severity']:<8}] {f['status']:<7} {f['id']:<8} {f['title']}")
    gaps_list = [r for r in clean if r["status"] == "unknown"]
    if gaps_list:
        print("\nCần xử lý để có kết luận (unknown):")
        for r in gaps_list:
            print(f"  {r['rule_id']:<8} {r['detail']}")
    print(f"\nĐã ghi: {out}")

    if args.fail_on:
        limit = SEV_RANK[args.fail_on]
        if any(f["status"] == "fail" and SEV_RANK[f["severity"]] >= limit for f in findings):
            return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

```

## Cấu trúc project đầy đủ

```text
MPV/
├── AuditCommon.psm1
├── Setup-AuditCredentials.ps1
├── Run-Collectors.ps1
├── Run-Audit-Once.ps1
├── 01-Identity.ps1
├── 02-ConditionalAccess.ps1
├── 03-SecurityBaseline.ps1
├── 04-Apps.ps1
├── 05-Licenses.ps1
├── README.md
├── .audit-secrets/
│   └── m365-audit-credentials.json
├── snapshots/
│   └── <tenant-id>/
│       └── <run-id>/
│           ├── 01_identity.json
│           ├── 02_conditional_access.json
│           ├── 03_security_baseline.json
│           ├── 04_apps.json
│           ├── 05_licenses.json
│           └── _manifest.json
├── audit-engine/
│   ├── run_audit.py
│   ├── README.md
│   ├── engine/
│   │   ├── __init__.py
│   │   ├── model.py
│   │   ├── registry.py
│   │   ├── runner.py
│   │   ├── snapshot.py
│   │   └── rules/
│   │       ├── __init__.py
│   │       ├── identity.py
│   │       ├── conditional_access.py
│   │       ├── baseline.py
│   │       ├── apps.py
│   │       └── licenses.py
│   └── out/
│       └── <run-id>/
│           ├── findings.json
│           ├── results.json
│           ├── run.json
│           └── snapshot.json
└── .vscode/
    └── launch.json
```

## Lưu ý triển khai

- `AuditCommon.psm1` chứa logic kết nối Graph, lưu secret được mã hóa, pseudonymize, retry 429/5xx và export snapshot.
- `Setup-AuditCredentials.ps1` cho phép cấu hình app registration một lần và không cần nhập secret mỗi lần chạy.
- `01-Identity.ps1` đến `05-Licenses.ps1` là các collector theo từng tầng dữ liệu. Nếu thiếu file nào, flow sẽ không triage được tenant đầy đủ.
- `audit-engine/run_audit.py` và file rule trong `engine/rules/` là lớp đánh giá, biến "facts" thành "finding" kèm mức độ rủi ro.

---

<!--
Phần cuối bài (nút Chia sẻ LinkedIn, Facebook, Copy link, khung tác giả, bài trước/sau)
 và Mục lục bên phải được layout tự thêm vào, không cần viết trong file này.
-->