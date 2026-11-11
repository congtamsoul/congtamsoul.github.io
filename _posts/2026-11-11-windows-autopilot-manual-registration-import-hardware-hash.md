---
layout: post
title: "Đăng ký Windows Autopilot thủ công: từ hardware hash đến Intune"
seo_title: "Windows Autopilot: import hardware hash vào Intune"
description: "Hướng dẫn đăng ký Windows Autopilot Hybrid Join thủ công: lấy hardware hash tại OOBE, kiểm tra CSV, import vào Intune, gán profile và xử lý lỗi thường gặp."
date: 2026-11-11
author: "Tam Nguyen"
reading_time: 9
topic: windows
thumb_label: "WINDOWS AUTOPILOT"
image: /images/photo/41.jpg
tags:
  - Windows
  - Intune
  - Windows Autopilot
  - Hybrid Join
card_tags:
  - Intune
  - Autopilot
summary: "Lấy hardware hash tại OOBE, import CSV vào Intune và chờ profile Assigned trước khi triển khai Windows Autopilot Hybrid Join."
redirect_from:
  - /posts/windows-autopilot-import-hardware-hash-intune.html
---

Trong công việc quản lý Intune, một tình huống cần xử lý là thiết bị Windows đã đến bước thiết lập ban đầu nhưng chưa được đăng ký vào Windows Autopilot. Với môi trường vẫn cần kết nối Active Directory tại chỗ, quy trình không chỉ dừng ở việc đưa máy lên Intune: thiết bị phải có kết nối phù hợp, được gán đúng profile và hoàn tất các bước thiết lập dành cho người dùng. Bài này tập trung vào luồng **Windows Autopilot Hybrid Join**, với user đã có license Intune và thiết bị đang ở màn hình *Out-of-Box Experience* (OOBE).

> **Tóm tắt nhanh:** Mở PowerShell tại OOBE, dùng `Get-WindowsAutopilotInfo` xuất hardware hash thành CSV, sau đó import vào Intune. Kiểm tra đúng **Serial Number**, **Group Tag**, **Assigned Profile** và trạng thái **Assigned** trước khi restart để bắt đầu enrollment. Import hardware hash là bước đăng ký Autopilot, chưa phải hoàn tất quản lý thiết bị trong Intune.

## 1. Bối cảnh và điều kiện cần

Bài viết chuyển quy trình đăng ký thủ công thành các bước để IT có thể thực hiện khi thiết bị chưa có sẵn trong Autopilot. Phạm vi là **Hybrid Join**, không phải hướng dẫn cấu hình toàn bộ hạ tầng Autopilot từ đầu.

### Chuẩn bị thiết bị và kết nối

Theo quy trình nguồn, cần chuẩn bị:

- Thiết bị Windows Pro x64, đang ở OOBE.
- Kết nối Internet.
- Kết nối mạng đến **Active Directory Domain Controller tại chỗ**.
- **TPM 2.0**.
- Recovery image để phục vụ khôi phục khi cần.
- User được gán license có **Microsoft Intune**, ví dụ EMS E3 hoặc Microsoft 365 F3/E3/E5 theo tài liệu nguồn.

Tài liệu gốc liệt kê Windows 10 từ phiên bản 1909 và Windows 11. Đây là thông tin của quy trình nguồn, **không phải khuyến nghị sử dụng phiên bản Windows cũ cho triển khai mới**. Khi áp dụng, hãy đối chiếu phiên bản hệ điều hành được doanh nghiệp phê duyệt và còn được hỗ trợ.

### Các điểm cần kiểm tra

| Thành phần | Cần xác nhận | Ý nghĩa trong quy trình |
|---|---|---|
| User | Đã được gán license Intune | Đáp ứng điều kiện enrollment |
| Mạng | Có Internet và kết nối đến AD tại chỗ | Phù hợp luồng Hybrid Join |
| Group Tag | Đúng nhóm triển khai của thiết bị | Tránh áp dụng nhầm cấu hình |
| Deployment profile | Đã được gán cho thiết bị | Có cấu hình để tiếp tục OOBE |
| Recovery image | Đã chuẩn bị | Có phương án khôi phục |

Bài viết không đưa ra số lượng thiết bị triển khai vì tài liệu nguồn không cung cấp quy mô cụ thể.

## 2. Lấy hardware hash tại OOBE

Tại màn hình OOBE:

1. Nhấn **Shift + F10** để mở Command Prompt. Một số thiết bị cần **Fn + Shift + F10**.
2. Nhập `powershell` để chuyển sang PowerShell.
3. Chạy các lệnh sau để cài script và xuất hardware hash.

```powershell
# Su dung TLS 1.2 khi tai script
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# Tao thu muc luu CSV
New-Item -ItemType Directory -Path "C:\Temp" -Force
Set-Location -Path "C:\Temp"

# Them duong dan script vao PATH cua phien hien tai
$env:Path += ";C:\Program Files\WindowsPowerShell\Scripts"

# Chi thay doi execution policy trong phien PowerShell hien tai
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned

# Cai script thu thap thong tin Autopilot
Install-Script -Name Get-WindowsAutopilotInfo

# THAY Group Tag vi du bang gia tri da duoc phe duyet trong tenant
Get-WindowsAutopilotInfo -GroupTag "SITE-A" -OutputFile AutoPilotHash.csv -Append
```

File kết quả nằm tại:

```text
C:\Temp\AutoPilotHash.csv
```

**`SITE-A` chỉ là giá trị minh họa**, đã thay cho Group Tag nội bộ trong tài liệu nguồn. Không sử dụng nguyên giá trị này nếu tenant chưa có cấu hình tương ứng.

Group Tag cần được chọn đúng ngay từ đầu vì quy trình nguồn dùng tag để phân biệt nhóm thiết bị theo địa điểm triển khai. Không nên chọn một tag bất kỳ chỉ để hoàn thành bước xuất CSV.

### Lưu ý khi OOBE khởi động lại nhiều lần

Tài liệu nguồn lưu ý rằng OOBE có thể chuyển sang chế độ recovery sau nhiều lần restart. Dấu hiệu là **ngôn ngữ, khu vực và bàn phím xuất hiện cùng một trang**, thay vì từng trang riêng biệt.

Tài liệu có nhắc đến giá trị theo dõi số lần thử OOBE tại:

```text
HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\UserOOBE
```

Nguồn đề cập đưa giá trị đếm về `1`, nhưng **không nêu rõ tên value và kiểu dữ liệu**. Vì vậy, bài này không bổ sung lệnh sửa registry dựa trên phỏng đoán. Nếu gặp tình huống này, cần xác minh chi tiết trước khi chỉnh sửa.

## 3. Kiểm tra CSV trước khi import

CSV đúng định dạng giúp tránh lỗi import và giảm thời gian xử lý lại.

| Trường | Yêu cầu theo tài liệu nguồn |
|---|---|
| Device Serial Number | Bắt buộc |
| Windows Product ID | Bắt buộc với partner upload; tùy chọn với admin import trực tiếp |
| Hardware Hash | Bắt buộc |
| Group Tag | Tùy chọn trong định dạng CSV; cần chọn đúng nếu quy trình dùng tag |
| Assigned User | Tùy chọn; nếu điền phải dùng UPN hợp lệ |

Header cần giữ đúng chữ hoa, chữ thường:

```csv
Device Serial Number,Windows Product ID,Hardware Hash,Group Tag,Assigned User
```

Theo tài liệu nguồn, một file có thể chứa tối đa **500 dòng thiết bị**. Các yêu cầu khác gồm:

- Không thêm cột ngoài định dạng quy định.
- Không dùng dấu ngoặc kép.
- Dùng định dạng văn bản ANSI theo hướng dẫn nguồn, không dùng Unicode.
- Giữ nguyên cách viết header.
- Dùng **Notepad** hoặc trình soạn thảo văn bản thuần để kiểm tra file.

> **Lưu ý:** Không mở, chỉnh sửa rồi lưu lại CSV bằng Excel. Tài liệu nguồn cảnh báo thao tác này có thể tạo file không dùng được để import vào Intune.

Nếu điền `Assigned User`, cần kiểm tra **toàn bộ UPN**, không chỉ domain. Theo nguồn, bước upload chỉ kiểm tra tính hợp lệ của domain, không xác minh từng UPN có tồn tại hoặc đúng người dùng hay không. Gán sai có thể khiến thiết bị không truy cập được cho đến khi bỏ assignment không hợp lệ.

## 4. Import và chờ profile Assigned

### Chuyển CSV sang máy quản trị

Trong quy trình nguồn, thiết bị tại OOBE bị giới hạn kết nối nên IT chuyển CSV qua file share nội bộ rồi import bằng máy quản trị.

Có thể mở File Explorer từ PowerShell:

```powershell
explorer
```

Sau đó:

1. Mở `C:\Temp`.
2. Copy `AutoPilotHash.csv` đến vị trí trao đổi file được doanh nghiệp cho phép.
3. Đăng nhập khi hệ thống yêu cầu.
4. Trên máy quản trị, lấy file CSV để thực hiện import.

Địa chỉ file server nội bộ không được đưa vào bài viết. Hãy dùng vị trí được phê duyệt trong môi trường của bạn.

### Import vào Intune

1. Mở **Intune admin center**.
2. Theo đường dẫn trong tài liệu nguồn: `Devices` → `Enrollment` → `Windows Autopilot devices`.
3. Chọn **Import** và upload file CSV.
4. Chờ quá trình import hoàn tất; thao tác có thể mất vài phút.
5. Chọn **Sync**.
6. Chọn **Refresh** cho đến khi thiết bị xuất hiện.

### Kiểm tra trước khi restart

| Thuộc tính | Cần kiểm tra |
|---|---|
| Serial Number | Đúng thiết bị đang triển khai |
| Group Tag | Đúng nhóm triển khai |
| Profile Status | **Assigned** |
| Assigned Profile | Đúng deployment profile dự kiến |

**Không chỉ kiểm tra thiết bị đã xuất hiện trong danh sách.** Theo quy trình nguồn, cần chờ enrollment profile được gán rồi mới restart máy để tiếp tục.

## 5. Enrollment và xác minh tài khoản

Sau khi import hoàn tất và profile đã được gán:

1. Restart thiết bị để quay lại OOBE.
2. Đăng nhập bằng tài khoản công ty của người sử dụng máy.
3. Theo dõi **Enrollment Status Page (ESP)**.
4. Khi thiết bị restart và quay lại màn hình đăng nhập, nhập lại thông tin tài khoản.

Tài liệu nguồn ghi nhận ba giai đoạn:

| Giai đoạn | Thời gian tham khảo trong quy trình nguồn | Ghi chú |
|---|---|---|
| Device preparation | Khoảng 5 phút | Chuẩn bị thiết bị |
| Device setup | Khoảng 25 phút | Có restart |
| Account setup | Khoảng 30 phút | Tiếp tục chạy nền sau restart theo cấu hình được mô tả |

Các mốc này là **tham khảo của môi trường nguồn**, không phải cam kết thời gian cho mọi tenant. Tương tự, việc Account setup chạy nền là hành vi được ghi nhận trong quy trình này, không nên mặc định áp dụng cho mọi cấu hình ESP.

Theo tài liệu, sau khi đăng nhập lại, user có thể sử dụng máy và truy cập các ứng dụng, website Microsoft 365 trong lúc Account setup tiếp tục chạy nền.

### Xác minh tài khoản

Sau khoảng **30 phút**, thực hiện bước được nêu trong quy trình:

1. Mở thanh tìm kiếm Windows.
2. Tìm `Verify your account`.
3. Hoàn tất xác minh tài khoản.
4. Nếu không xuất hiện mục xác minh sau khoảng thời gian này, restart thiết bị rồi kiểm tra lại theo hướng dẫn nguồn.

Đây là bước cần đưa vào checklist bàn giao của môi trường đang áp dụng quy trình, thay vì chỉ dừng ở việc user đã vào được desktop.

## 6. Những lỗi cần xử lý

Các lỗi dưới đây được liệt kê trong tài liệu nguồn. Bài viết không bổ sung log giả hoặc khẳng định đây là những lỗi tác giả đã trực tiếp gặp.

### ZtdDeviceAssignedToAnotherTenant

**Triệu chứng:** Hardware hash khớp với thiết bị đã đăng ký ở tenant khác.

**Xử lý:** Đối chiếu serial number trong CSV và thông tin đăng ký thiết bị. Không nhầm lỗi này với trường hợp thiết bị đã có trong tenant hiện tại. Tài liệu nguồn không cung cấp đầy đủ quy trình gỡ đăng ký ở tenant khác, nên bài này không tự bổ sung thao tác chuyển tenant.

### ZtdDeviceAlreadyAssigned

**Triệu chứng:** Hardware hash khớp với thiết bị đã đăng ký trong tenant hiện tại.

**Xử lý:** Tìm serial number trong `Windows Autopilot devices`. Nếu thiết bị đã có, không import lại. Nếu không tìm thấy, kiểm tra lại thông tin rồi thực hiện import lại theo hướng dẫn nguồn.

### InvalidZtdHardwareHash

**Triệu chứng:** Một hoặc nhiều trường trong hardware hash không hợp lệ hoặc bị trống.

**Kiểm tra:** Tài liệu yêu cầu có thông tin manufacturer và serial number, đồng thời cung cấp lệnh:

```powershell
Get-CimInstance Win32_BaseBoard | Select-Object Manufacturer, SerialNumber
```

Lệnh này hiển thị thông tin **bo mạch chủ** theo đúng lớp `Win32_BaseBoard` được dùng trong nguồn. Không nên tự coi mọi giá trị serial trả về là serial hệ thống hoặc bằng chứng rằng hardware hash đã hợp lệ.

## 7. Kết luận

Đăng ký Autopilot thủ công cần kiểm soát ba điểm: **hardware hash hợp lệ, Group Tag đúng và profile đã Assigned**. Với Hybrid Join, kết nối đến AD tại chỗ và bước xác minh tài khoản sau enrollment cũng cần được giữ trong checklist. Trước lần triển khai tiếp theo, hãy chuẩn hóa checklist từ OOBE đến bàn giao và thử trên một thiết bị trước khi áp dụng rộng hơn. Team bạn thường vướng ở bước import CSV, chờ profile hay ESP?
