---
layout: post
title: "Tự động approve bản vá hàng tháng trên WSUS theo từng wave"
seo_title: "WSUS auto approval patch theo wave bằng PowerShell"
description: "Cách tự động approve bản vá Patch Tuesday trên WSUS theo wave: pilot trước, sau đó mở rộng theo cụm máy, giúp chặn kịp bản update lỗi và đồng bộ phiên bản."
date: 2026-11-10
author: "Tam Nguyen"
reading_time: 8
topic: windows
thumb_label: "WSUS AUTO APPROVAL"
image: /images/photo/34.jpg
tags:
  - Windows Server
  - WSUS
  - Windows Update
  - PowerShell
card_tags:
  - WSUS
  - Patching
summary: "Tự động approve bản vá Patch Tuesday trên WSUS theo từng wave: pilot trước, rồi mở rộng theo cụm máy, chặn kịp bản update lỗi."
redirect_from:
  - /posts/wsus-auto-approval-patch-theo-wave.html
---

Thứ Ba tuần thứ hai mỗi tháng, Microsoft phát hành bản vá mới (**Patch Tuesday**). Nếu approve thủ công trên WSUS, admin phải nhớ ngày, chọn đúng loại update rồi approve cho từng group. Chỉ cần quên một tháng hoặc approve nhầm cho toàn bộ máy là rủi ro tăng lên. Ngược lại, bật **Automatic Approval Rule** mặc định có thể khiến bản vá chưa được kiểm chứng đi đến nhiều máy cùng lúc.

**Tóm tắt nhanh:** dùng PowerShell chạy hằng ngày bằng Task Scheduler và tính lịch dựa trên ngày Patch Tuesday thực tế. Wave 0 nhận update mới trước; sau thời gian pilot, script copy approvals sang Wave 1 rồi Wave 2, Wave 3 và nhóm Unassigned. Nếu phát hiện bản vá lỗi, dừng trước lần copy tiếp theo để không mở rộng approval đó.

## Bối cảnh: vì sao cần approve theo wave

Mục tiêu của mình khi chia wave:

- **Chặn kịp bản update lỗi** — pilot trên nhóm nhỏ trước, dành vài ngày phát hiện sự cố trước khi mở rộng.
- **Đồng bộ phiên bản** — wave sau nhận đúng các update đã approve ở wave trước, không tự tìm update mới giữa các đợt.
- **Không phụ thuộc trí nhớ** — script tự tính lịch Patch Tuesday mỗi tháng.
- **Giới hạn phạm vi** — chỉ approve sản phẩm và classification đã chọn; không vô tình đưa Feature Upgrade xuống máy.

## Phạm vi update được tự động approve

| Thành phần | Điều kiện ví dụ trong script | Ghi chú |
|---|---|---|
| Product (Category) | `Windows 1*`, `Microsoft Edge`, `*.NET*` | Windows 10/11, Edge và .NET; xác nhận tên Category trên WSUS thực tế |
| Classification | Tất cả ngoại trừ `Upgrades` | Không tự approve Feature Upgrade |
| Thời gian | Arrived kể từ Patch Tuesday của tháng hiện tại | Không phụ thuộc ngày chạy trước đó |
| Trạng thái | `NotApproved`, có máy `NotInstalled`, bỏ optional updates | Giảm khả năng approve lại hoặc approve nội dung ngoài ý muốn |

Hãy kiểm tra danh sách Category và Classification trên WSUS của bạn trước khi bật automation. Tên hiển thị có thể khác theo sản phẩm và đồng bộ metadata.

## Lịch triển khai theo wave

Script tính ngày Patch Tuesday (thứ Ba thứ hai trong tháng) rồi dùng mốc tương đối:

| Wave | Ngày chạy | Hành động | Đối tượng |
|---|---|---|---|
| Wave 0 | Patch Tuesday + 1 ngày | Approve update mới | Pilot (IT, máy test) |
| Wave 1 | Patch Tuesday + 6 ngày | Copy approval từ Wave 0 | Nhóm mở rộng đầu tiên |
| Wave 2, 3 và Unassigned | Patch Tuesday + 8 ngày | Copy approval từ Wave 1 | Cụm máy theo location và nhóm chưa phân bổ |

Khoảng cách giữa Wave 0 và Wave 1 cho khoảng **5 ngày theo dõi**. Nếu phát hiện bản vá lỗi, hãy Decline hoặc gỡ approval của bản đó khỏi Wave 0 trước khi chạy bước copy. Không copy các approvals đáng ngờ sang wave tiếp theo.

Các mốc này là ví dụ; điều chỉnh theo quy trình kiểm thử, lịch bảo trì và ngày triển khai thực tế của tổ chức.

## Script hoạt động như thế nào

### Wave 0: approve bằng PoshWSUS

Script kết nối WSUS qua HTTPS port `8531`, lấy Category và Classification mong muốn, lọc update mới chưa approve và gọi `Approve-PSWSUSUpdate -Action Install` cho group `Clients - Wave 0 - Full`.

### Wave tiếp theo: copy approvals

Hàm `Copy-WsusGroupApprovals` từ module nội bộ `Copy_Approval_WSUS_nonMS.ps1` copy approvals từ group nguồn sang group đích. Như vậy wave sau nhận đúng bộ update đã được duyệt ở wave trước, kể cả khi WSUS đồng bộ thêm update mới trong thời gian chờ.

### Chạy tự động

Tạo Scheduled Task trên WSUS server chạy hằng ngày, ví dụ 08:00, dưới tài khoản có quyền truy cập WSUS và thư mục script:

```powershell
powershell.exe -ExecutionPolicy Bypass -NoProfile -File "C:\Scripts\WSUS_Auto_Approval.ps1"
```

Ngày không trùng các mốc trong script thì không thực hiện thao tác. Bật lịch sử Task Scheduler và theo dõi log; nếu server tắt hoặc task lỗi đúng ngày wave, **không mặc định chạy bù mà chưa kiểm tra trạng thái update và approvals**.

## Chuẩn bị WSUS và GPO

1. Tạo computer group trên WSUS: `Clients - Wave 0 - Full` đến `Clients - Wave 3 - Full`.
2. Bật client-side targeting tại **Options → Computers → Use Group Policy or registry settings on computers**.
3. Tạo GPO cho từng wave với **Enable client-side targeting** trỏ đúng tên WSUS group; link vào OU phù hợp hoặc lọc theo AD group.
4. Cài module PoshWSUS và đặt `Copy_Approval_WSUS_nonMS.ps1` tại `C:\Scripts\`.
5. Tắt Automatic Approval Rule mặc định hoặc rà soát để tránh approve trùng ngoài quy trình wave.
6. Chạy thử với nhóm pilot nhỏ và xác nhận approval trên WSUS trước khi bật Scheduled Task cho production.

## Những lỗi mình đã gặp

- **Wave chạy trước Patch Tuesday** — tính “thứ Tư tuần thứ hai” riêng không đảm bảo là sau Patch Tuesday; tùy lịch tháng, nó có thể rơi trước ngày phát hành. Tính từ ngày Patch Tuesday bằng `AddDays(1)`, `AddDays(6)` và `AddDays(8)`.
- **Lỗi parse ngày** — ghép chuỗi như `'M/1/yyyy'` phụ thuộc locale của server. Dùng `[datetime]::new($year, $month, 1)` để tạo ngày không phụ thuộc định dạng vùng.
- **Task bỏ lỡ ngày chạy** — kiểm tra lịch sử Task Scheduler, trạng thái task và log. Trước khi chạy bù, xác minh wave trước đã được kiểm tra và quyết định rõ có nên tiếp tục mở rộng hay không.
- **Update đã approve nhưng máy không nhận** — máy có thể nằm sai group do GPO client-side targeting chưa áp dụng. Kiểm tra `gpresult /r` và giá trị `TargetGroup` trên client.
- **Kết nối WSUS thất bại** — với HTTPS `8531`, FQDN phải khớp certificate và máy chạy script phải tin cậy chuỗi chứng thư.

## Kết luận

Với một script chạy theo lịch, mình không cần nhớ ngày Patch Tuesday hay approve thủ công từng group. Bản vá đi theo lộ trình pilot → mở rộng, có khoảng thời gian để phát hiện và chặn update lỗi. Hãy xác minh ngày chạy, danh sách update và group đích trên pilot trước khi bật automation production. Bạn đang approve bản vá WSUS theo cách nào — thủ công, Automatic Approval Rule hay script?

## Full script

> Đổi `$FQDN`, tên WSUS groups và module copy approvals theo môi trường. Kiểm thử trên WSUS lab hoặc nhóm pilot trước khi chạy production. Script bên dưới chạy theo đúng ngày đã định; nếu bỏ lỡ mốc, cần kiểm tra thủ công trước khi chạy bước tiếp theo.

```powershell
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

function Get-PatchTuesday {
    param([datetime]$ReferenceDate = (Get-Date))

    $monthStart = [datetime]::new(
        $ReferenceDate.Year,
        $ReferenceDate.Month,
        1
    )
    $daysUntilTuesday = (
        [int][DayOfWeek]::Tuesday - [int]$monthStart.DayOfWeek + 7
    ) % 7
    $firstTuesday = $monthStart.AddDays($daysUntilTuesday)

    # Patch Tuesday is the second Tuesday of the month.
    return $firstTuesday.AddDays(7).Date
}

$FQDN = "wsus.contoso.local"
$Port = 8531
$SecureConnection = $true
$Wave0Group = "Clients - Wave 0 - Full"
$Wave1Group = "Clients - Wave 1 - Full"
$Wave2Group = "Clients - Wave 2 - Full"
$Wave3Group = "Clients - Wave 3 - Full"
$UnassignedGroup = "Unassigned Computers"

$ScriptDirectory = "C:\Scripts"
$LogDirectory = Join-Path $ScriptDirectory "Logs"
New-Item -Path $LogDirectory -ItemType Directory -Force | Out-Null
$LogFile = Join-Path $LogDirectory (
    "WSUS_Auto_Approval_{0:yyyy-MM}.log" -f (Get-Date)
)
Start-Transcript -Path $LogFile -Append

try {
    $PatchTuesday = Get-PatchTuesday
    $Wave0Date = $PatchTuesday.AddDays(1).Date
    $Wave1Date = $PatchTuesday.AddDays(6).Date
    $Wave2Date = $PatchTuesday.AddDays(8).Date
    $Today = (Get-Date).Date

    Write-Output "Patch Tuesday: $PatchTuesday"
    Write-Output "Today: $Today"

    if ($Today -eq $Wave0Date) {
        Import-Module PoshWSUS -ErrorAction Stop
        Connect-PSWSUSServer `
            -WsusServer $FQDN `
            -Port $Port `
            -SecureConnection:$SecureConnection

        $Categories = @(
            Get-PSWSUSCategory |
                Where-Object {
                    $_.Title -like "Windows 1*" -or
                    $_.Title -match "Microsoft Edge" -or
                    $_.Title -like "*.NET*"
                }
        )
        $Classifications = @(
            Get-PSWSUSClassification |
                Where-Object { $_.Title -notlike "Upgrades" }
        )
        $Wave0 = Get-PSWSUSGroup -Name $Wave0Group

        if (-not $Wave0) {
            throw "WSUS group not found: $Wave0Group"
        }

        $Updates = @(
            Get-PSWSUSUpdate `
                -FromArrivalDate $PatchTuesday `
                -ApprovedState NotApproved `
                -IncludedInstallationState NotInstalled `
                -ExcludeOptionalUpdates `
                -Category $Categories `
                -Classification $Classifications
        )

        Write-Output "New updates selected for Wave 0: $($Updates.Count)"
        if ($Updates.Count -gt 0) {
            $Updates | Approve-PSWSUSUpdate -Group $Wave0 -Action Install
        }
    }
    elseif ($Today -eq $Wave1Date) {
        Import-Module (Join-Path $ScriptDirectory "Copy_Approval_WSUS_nonMS.ps1") `
            -Force -ErrorAction Stop

        Copy-WsusGroupApprovals `
            -WsusServerFqdn $FQDN `
            -WsusServerPort $Port `
            -WsusServerSecureConnect $SecureConnection `
            -SourceGroupName $Wave0Group `
            -TargetGroupName $Wave1Group
    }
    elseif ($Today -eq $Wave2Date) {
        Import-Module (Join-Path $ScriptDirectory "Copy_Approval_WSUS_nonMS.ps1") `
            -Force -ErrorAction Stop

        foreach ($TargetGroup in @($Wave2Group, $Wave3Group, $UnassignedGroup)) {
            Copy-WsusGroupApprovals `
                -WsusServerFqdn $FQDN `
                -WsusServerPort $Port `
                -WsusServerSecureConnect $SecureConnection `
                -SourceGroupName $Wave1Group `
                -TargetGroupName $TargetGroup
        }
    }
    else {
        Write-Output "No approval wave is scheduled for today."
    }
}
catch {
    Write-Error "WSUS auto-approval failed: $_"
    throw
}
finally {
    Stop-Transcript
}
```
