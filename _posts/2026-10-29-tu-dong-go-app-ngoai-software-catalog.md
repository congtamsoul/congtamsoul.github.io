layout: post
title: "Tự động gỡ phần mềm ngoài Software Catalog: từ SentinelOne, Power BI, Power Automate đến Intune và AppLocker"
seo_title: "Tự động gỡ app ngoài Software Catalog bằng Intune"
description: "Quy trình tự động phát hiện app không được phép từ SentinelOne, so sánh với Software Catalog, gửi mail user, gỡ bằng Intune và chặn cài lại bằng AppLocker."
date: 2026-10-29
author: "Tam Nguyen"
reading_time: 12
topic: security
thumb_label: "APP GOVERNANCE"
tags:
  - Intune
  - Power Automate
  - Power BI
  - AppLocker
  - SentinelOne
card_tags:
  - Intune
  - AppLocker
summary: "Quy trình end-to-end: quét app bằng SentinelOne, so với Software Catalog, báo user, gỡ qua Intune và chặn cài lại bằng AppLocker."
redirect_from:
  - /posts/tu-dong-go-app-ngoai-software-catalog.html
---

Mỗi tháng, License Team gửi cho mình một file Excel vài nghìn dòng: app nào, trên máy nào, ai đang dùng, và "cái này có trong Catalog không?". Với khoảng **2.000 máy Windows**, việc VLOOKUP tay, hỏi từng user rồi gỡ từng máy là không thể theo kịp. Chưa kể gỡ xong tuần sau user lại cài lại. Bài này chia sẻ cách mình biến toàn bộ quy trình đó thành một chuỗi tự động: **phát hiện → so sánh → thông báo → gỡ → chặn cài lại**.

> **Tóm tắt nhanh:** SentinelOne quét app trên mọi máy, Power BI hiển thị, Power Automate lấy dữ liệu và so với Software Catalog của License Team. App ngoài Catalog được đưa vào một script uninstall dùng chung, đóng gói `.intunewin` và deploy qua Intune, kèm email báo trước cho user. Cuối cùng, app đó được thêm vào AppLocker để user không cài lại được.

## Bối cảnh: vì sao cần tự động hóa

Quy trình làm tay trước đây có ba vấn đề:

- **Chậm** — so sánh inventory với Catalog mất nhiều giờ, mỗi lần lại phải sửa cột mapping tên app.
- **Không đo được** — gỡ 100 app trên 50 máy, nhưng không biết bao nhiêu lần gỡ thành công.
- **Không bền** — gỡ xong mà không chặn thì user cài lại ngay.

Mục tiêu là một quy trình mà IT chỉ cần **duyệt**, còn lại để hệ thống chạy.

## Kiến trúc tổng thể

| Bước | Thành phần | Việc làm | Đầu ra |
|---|---|---|---|
| 1 | **SentinelOne** | Quét app đã cài trên toàn bộ endpoint | Application inventory |
| 2 | **Power BI** | Hiển thị inventory, làm nguồn dữ liệu chung | Dataset `All Apps` |
| 3 | **Power Automate** | Lấy `App Name`, `App Brand`, `Device Name`, `User Name` | Mảng dữ liệu thô + file backup |
| 4 | **Software Catalog** | File Excel Online do License Team quản lý | Danh sách app được phép |
| 5 | **Power Automate** | So sánh theo cặp `App Name` + `App Brand` | Danh sách app ngoài Catalog |
| 6 | **License Team** | Duyệt: gỡ, hay thêm vào Catalog / ngoại lệ | Danh sách đã duyệt |
| 7 | **Outlook** | Gửi mail báo user trước khi gỡ | Email theo từng user |
| 8 | **Script + IntuneWinAppUtil** | Đưa tên app vào script uninstall, đóng gói | File `.intunewin` |
| 9 | **Intune** | Upload Win32 app, assign cho nhóm máy cần gỡ | Kết quả gỡ theo từng máy |
| 10 | **AppLocker** | Thêm Deny rule cho app vừa gỡ | User không cài lại được |
| 11 | **Power BI** | Theo dõi tỷ lệ gỡ thành công | Dashboard |

<!-- ===== CHÈN ẢNH SƠ ĐỒ FLOW VÀO ĐÂY ===== -->
![Sơ đồ quy trình tự động gỡ phần mềm ngoài Software Catalog](/images/tu-dong-go-app-ngoai-software-catalog/flow.png){: width="720"}
*Hình 1: luồng end-to-end từ SentinelOne đến AppLocker.*

## Bước 1-3: Lấy dữ liệu app từ SentinelOne qua Power BI

SentinelOne đã có sẵn inventory app trên mọi máy, nên mình không cần agent quét riêng. Dữ liệu được đưa vào Power BI, và Power Automate đọc lại từ dataset bằng action **Run a query against a dataset**.

### DAX query lấy 4 trường cần thiết

```dax
EVALUATE
SELECTCOLUMNS (
    'S1_Applications',
    "App Name",    'S1_Applications'[Name],
    "App Brand",   'S1_Applications'[Publisher],
    "Device Name", 'S1_Applications'[Endpoint Name],
    "User Name",   'S1_Applications'[Last Logged In User]
)
```

<div class="callout warn">
  <span>⚠️</span>
  <div><b>Lưu ý</b>Action <code>Run a query against a dataset</code> có giới hạn số dòng trả về cho mỗi lần query. Với inventory lớn, hãy lọc bớt ngay trong DAX (ví dụ bỏ app của Microsoft, driver hệ thống) hoặc chia query theo nhóm máy, và tách flow lớn thành nhiều flow con.</div>
</div>

Mình cũng lưu một bản **full backup** của dữ liệu thô ra SharePoint mỗi lần chạy, để khi có tranh luận "máy em đâu có app đó" thì vẫn có bằng chứng.

## Bước 4-5: So sánh với Software Catalog

Software Catalog là file Excel Online do License Team quản lý, tối thiểu có hai cột `App Name` và `App Brand`. Power Automate đọc bằng action **List rows present in a table**.

### Không dùng Apply to each để so sánh

Lặp từng dòng inventory rồi lại lặp từng dòng Catalog sẽ chạy hàng giờ. Cách nhanh hơn là tạo **khóa so sánh** rồi dùng **Filter array**:

1. **Select** trên Catalog để tạo mảng khóa:

```text
toLower(trim(concat(item()?['App Name'], '|', item()?['App Brand'])))
```

2. **Filter array** trên inventory, giữ lại dòng **không** nằm trong mảng khóa:

```text
@not(contains(body('Select_Catalog_Keys'), toLower(trim(concat(item()?['[App Name]'], '|', item()?['[App Brand]'])))))
```

Lưu ý: dữ liệu trả về từ Power BI có tên cột dạng `[App Name]`, có dấu ngoặc vuông.

3. Xuất kết quả ra file **Compared file** (CSV/Excel) cho License Team duyệt.

### Bài toán tên app không khớp

Đây là phần mất thời gian nhất. Cùng một phần mềm nhưng tên trong SentinelOne khác tên trong Catalog, ví dụ `.NET SDK x64` và `.NET Core`, hay `Zoom Workplace` và `Zoom`. Mình xử lý bằng một **bảng mapping** đặt cạnh Catalog, quy tên trong inventory về tên chuẩn trước khi so sánh. Bảng này nhỏ dần theo thời gian vì License Team bổ sung tên chuẩn vào Catalog.

### Script / flow của mình

<!-- ===== DÁN EXPRESSION / CẤU HÌNH FLOW SO SÁNH VÀO ĐÂY ===== -->

```text
# Power Automate - Compare Inventory vs Software Catalog
# >>> Dán expression / Peek code của flow vào đây <<<
```

## Bước 6-7: License Team duyệt và gửi mail cho user

Không phải app nào ngoài Catalog cũng phải gỡ. License Team duyệt từng app với một trong ba quyết định:

| Quyết định | Hành động tiếp theo |
|---|---|
| **Uninstall** | Đưa vào danh sách gỡ, gửi mail user, deploy script |
| **Add to Catalog** | Cập nhật Software Catalog, lần chạy sau tự hết |
| **Exception** | Giữ lại cho user/máy cụ thể, ghi lý do và thời hạn |

Sau khi có danh sách **Uninstall**, flow gom theo `User Name` để **mỗi user chỉ nhận một email**, liệt kê tất cả app trên máy của họ:

```text
Subject: [IT Notice] Phần mềm không được phép trên máy {Device Name} sẽ được gỡ bỏ

Chào anh/chị {User Name},

Theo chính sách phần mềm của công ty, các ứng dụng sau trên máy {Device Name}
không nằm trong Software Catalog và sẽ được tự động gỡ bỏ sau {N} ngày làm việc:

- {App Name} ({App Brand})

Nếu anh/chị cần sử dụng phần mềm này cho công việc, vui lòng tạo ticket
yêu cầu cấp phép trước ngày {Deadline}.

Trân trọng,
IT Team
```

<!-- ===== DÁN FLOW GỬI MAIL / TEMPLATE EMAIL CỦA BẠN VÀO ĐÂY ===== -->

## Bước 8-9: Script uninstall dùng chung và deploy qua Intune

### Thiết kế script "zero-config"

Lúc đầu mình phải khai báo `ProcessMap` và `ServiceMap` cho từng app. Cách đó không chạy được với automation, vì danh sách app thay đổi mỗi tháng. Bản hiện tại chỉ có **một chỗ duy nhất cần sửa** là `$AppNameList`. Phần còn lại script tự tìm:

1. Đọc registry Uninstall (64-bit, 32-bit và hive của từng user) để lấy `InstallLocation`, `UninstallString`, `DisplayIcon` → ra **thư mục cài đặt thật**.
2. Kill process có `.Path` nằm trong thư mục đó, không đoán theo tên.
3. Stop và xóa service có `PathName` trỏ vào thư mục đó.
4. Chạy uninstaller thật: MSI dùng `msiexec /x {ProductCode}`, EXE dùng `QuietUninstallString` hoặc tham số silent phù hợp.
5. Dọn thư mục còn sót, nhưng chỉ khi qua được hàm kiểm tra an toàn.
6. Verify lại registry và thư mục, trả exit code cho Intune.

### Script của mình

<!-- ===== DÁN SCRIPT UNINSTALL VÀO ĐÂY ===== -->

```powershell
###################################################################
# Universal Application Cleanup Script - AUTO-DISCOVER
# Chi can them ten app vao $AppNameList
# Run as SYSTEM, 64-bit PowerShell
###################################################################

# >>> Dán script vào đây <<<
```

### Power Automate đưa tên app vào script

Flow thay khối `$AppNameList` trong file template bằng danh sách đã duyệt, rồi lưu thành file `.ps1` mới trên SharePoint:

```powershell
$AppNameList = @(
    "Telegram Desktop*",
    "Viber*",
    "FileZilla Client*"
    # Power Automate sinh danh sách ở đây
)
```

### Đóng gói và upload lên Intune

```powershell
# Đóng gói .intunewin
.\IntuneWinAppUtil.exe -c "C:\Packages\AppCleanup" -s "App_Cleanup.ps1" -o "C:\Packages\Output" -q
```

Cấu hình Win32 app:

| Mục | Giá trị |
|---|---|
| Install command | `%windir%\sysnative\WindowsPowerShell\v1.0\powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\App_Cleanup.ps1` |
| Install behavior | System |
| Return codes | `0` Success, `3010` Soft reboot, `1` Failed |
| Detection | Script kiểm tra không còn app nào trong `$AppNameList` trong registry Uninstall |
| Assignment | Required, cho nhóm thiết bị cần gỡ |

<!-- ===== DÁN DETECTION SCRIPT VÀO ĐÂY ===== -->

```powershell
# Detection script - exit 0 + STDOUT khi không còn app nào trong danh sách

# >>> Dán script vào đây <<<
```

Nếu muốn tự động luôn bước upload, có thể dùng module cộng đồng `IntuneWin32App` (`Add-IntuneWin32App`) hoặc Microsoft Graph. Mình vẫn để bước upload là **thao tác có người duyệt**, vì đây là điểm cuối cùng trước khi script chạy trên máy thật.

<div class="callout danger">
  <span>⛔</span>
  <div><b>Nguy hiểm</b>Luôn chạy script với <code>$DryRun = $true</code> trên 5-10 máy pilot và đọc log trước khi gỡ thật. Một wildcard sai như <code>*LINE*</code> hay <code>Hyper</code> có thể khớp với <code>Online</code>, <code>Baseline</code> hay <code>Hyper-V</code> và xóa nhầm thành phần hệ thống trên hàng nghìn máy.</div>
</div>

## Bước 10: Thêm app vào AppLocker để chặn cài lại

Gỡ xong mà không chặn thì sớm muộn user cũng cài lại. Mình thêm **Publisher Deny rule** cho mỗi app đã gỡ. Môi trường của mình có hai kênh:

- **Máy domain (GPO):** GitLab pipeline đọc file Excel chứa rule, validate, rồi apply vào GPO AppLocker.
- **Máy chỉ quản lý bằng Intune:** cập nhật XML trong profile Custom OMA-URI `./Vendor/MSFT/AppLocker/ApplicationLaunchRestrictions/...`.

### Thông tin một rule

| Trường | Ví dụ |
|---|---|
| Name | Block Logseq |
| PublisherName | `O=LOGSEQ, INC., L=NEW YORK, S=NEW YORK, C=US` |
| ProductName | `LOGSEQ` |
| BinaryName | `*` |
| Action | Deny |
| Type | Exe |
| UserOrGroupSid | SID của nhóm áp dụng |
| Description | Mã ticket + lý do |

Lấy thông tin Publisher từ file exe trên một máy còn app:

```powershell
Get-AppLockerFileInformation -Path "C:\Path\To\App.exe" | Select-Object -ExpandProperty Publisher
```

### Pipeline của mình

<!-- ===== DÁN .gitlab-ci.yml VÀ SCRIPT APPLY APPLOCKER VÀO ĐÂY ===== -->

```yaml
# .gitlab-ci.yml - AppLocker rule automation (validate -> dry-run -> apply)

# >>> Dán pipeline vào đây <<<
```

```powershell
# Apply-AppLockerRules.ps1
# Đọc Excel -> validate -> backup policy -> add/update rule -> verify

# >>> Dán script vào đây <<<
```

Khi ghi vào GPO, mình đọc toàn bộ policy hiện tại, sửa đúng các rule cần thay đổi rồi ghi lại bằng `Set-AppLockerPolicy -Ldap`. Pipeline luôn **backup policy trước khi ghi** và không xóa các rule không nằm trong file input.

### Kiểm tra AppLocker đã có hiệu lực trên máy

```powershell
# Service bắt buộc phải chạy
Get-Service AppIDSvc

# Policy từ Intune (CSP) đã xuống máy chưa
Get-CimClass -Namespace root\cimv2\mdm\dmmap | Where-Object CimClassName -match 'AppLocker' | Select-Object CimClassName

# Policy hiệu lực (GPO)
Get-AppLockerPolicy -Effective -Xml | Select-String 'Logseq'

# Event 8004 = đã chặn, 8002 = cho phép, 8003 = audit
Get-WinEvent -LogName 'Microsoft-Windows-AppLocker/EXE and DLL' -MaxEvents 200 | Where-Object Id -eq 8004 | Select-Object TimeCreated, Message
```

## Bước 11: Theo dõi tỷ lệ gỡ thành công

Chạy script xong chưa phải là xong. Mình theo dõi ít nhất **hai chu kỳ quét** tiếp theo của SentinelOne:

| Chỉ số | Cách tính |
|---|---|
| Tổng số lượt cần gỡ | Số cặp app + máy trong danh sách Uninstall |
| Gỡ thành công | Cặp app + máy không còn xuất hiện ở lần quét sau |
| Tỷ lệ thành công | Thành công / Tổng |
| Còn sót | Nhóm theo app để tìm app mà script chưa xử lý được |

Ví dụ: 100 lượt gỡ trên 50 máy, sau lần quét đầu còn 12 lượt sót, và 9 trong số đó là cùng một app portable. Đó là tín hiệu cần bổ sung xử lý cho app đó, chứ không phải chạy lại cả script.

## Những lỗi mình đã gặp

| Lỗi | Triệu chứng | Nguyên nhân gốc | Cách xử lý |
|---|---|---|---|
| Script không gỡ được gì | Log báo không tìm thấy app nào | Dùng `-eq "7-Zip*"`, mà `-eq` không hiểu wildcard | Dùng `-like` |
| Script crash ngay khi deploy | Intune báo Failed, log trống | Dùng toán tử `? :` (chỉ có từ PowerShell 7), nhưng Intune chạy Windows PowerShell 5.1 | Thay bằng `if/else` |
| Bỏ sót app 64-bit | Máy còn app nhưng script báo không có | Intune chạy PowerShell 32-bit, registry bị chuyển sang `WOW6432Node` | Gọi PowerShell qua `sysnative`, script tự thoát nếu chạy 32-bit |
| User mất taskbar | Explorer bị tắt sau khi gỡ app có menu chuột phải | Restart Manager tắt `explorer.exe` để giải phóng shell extension và không mở lại | Thêm `MSIRESTARTMANAGERCONTROL=Disable REBOOT=ReallySuppress` cho `msiexec` |
| Script treo đến khi Intune timeout | Log dừng ở dòng "Installer type: MSI" | Uninstaller hiện prompt ẩn trong Session 0, hoặc đang có MSI khác chạy | Đặt timeout cho mọi tiến trình, kiểm tra `_MSIExecute` trước khi chạy |
| Khớp nhầm tên ngắn | `Hyper` khớp `Hyper-V`, `bat` khớp `Battery` | So khớp substring | So khớp anchored: đúng tên, hoặc tên + khoảng trắng / dấu ngoặc / dấu gạch |
| Driver không gỡ được | STMicroelectronics, PL23XX vẫn còn | Tên trong registry có chèn thêm chuỗi khác, driver nằm trong DriverStore | Dùng `pnputil /delete-driver oemXX.inf /uninstall`, không xóa DriverStore bằng tay |
| App portable vẫn bị quét ra | Rclone, Pandoc, uv... còn trong inventory | Không có registry Uninstall | Dọn theo thư mục đã biết, chỉ báo cáo (không tự xóa) file tìm thấy khi quét toàn ổ |

Ba nguyên tắc an toàn mình rút ra:

- **Không xóa trực tiếp registry `Installer\Products`** của MSI. Hãy để `msiexec /x` tự dọn, nếu không Windows Installer sẽ hỏng khả năng repair và update.
- **Không quét toàn ổ đĩa rồi xóa theo tên.** Có một danh sách thư mục được bảo vệ (`C:\Windows`, `System32`, `ProgramData\Microsoft`, `Common Files`, `WindowsApps`, thư mục gốc của ổ) và chặn mọi đường dẫn quá nông.
- **Lấy `DisplayName` đầy đủ** từ inventory thay vì gõ tay. Tên càng chính xác, wildcard càng ít, rủi ro càng thấp.

## Kết luận

Gỡ phần mềm không được phép không khó. Cái khó là làm đều đặn, có bằng chứng và không để tái diễn. Khi ghép SentinelOne, Power BI, Power Automate, Intune và AppLocker thành một chuỗi, IT chỉ còn hai việc là duyệt danh sách và đọc báo cáo. Nếu bạn muốn bắt đầu, hãy làm bước so sánh với Software Catalog trước. Chỉ riêng bước này đã tiết kiệm cho License Team nhiều giờ mỗi tháng.

Bạn đang quản lý phần mềm ngoài danh mục ở công ty mình theo cách nào: chặn trước, gỡ sau, hay cả hai?

<!--
Phần cuối bài (nút Chia sẻ LinkedIn, Facebook, Copy link, khung tác giả, bài trước/sau)
và Mục lục bên phải được layout tự thêm vào, không cần viết trong file này.
Xem trước trên máy: bundle exec jekyll serve --unpublished (chỉ cần khi bài còn published: false).
-->
