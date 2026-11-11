---
layout: post
title: "Triển khai Win32 app bằng Intune: đóng gói, detection và assignment"
seo_title: "Deploy Win32 app trên Intune: hướng dẫn từng bước"
description: "Hướng dẫn triển khai Win32 app trên Intune: đóng gói intunewin, cấu hình lệnh cài và gỡ, requirements, detection, dependencies, supersedence và assignment."
date: 2026-11-11
author: "Tam Nguyen"
reading_time: 10
topic: windows
thumb_label: "INTUNE WIN32 APP"
image: /images/photo/42.jpg
tags:
  - Microsoft 365
  - Intune
  - Windows
  - Win32 app
card_tags:
  - Intune
  - Win32 app
summary: "Đóng gói chỉ là bước đầu: triển khai Win32 app cần đúng lệnh cài/gỡ, requirements, detection và nhóm assignment."
redirect_from:
  - /posts/trien-khai-win32-app-intune.html
---

Khi quản lý thiết bị Windows bằng Intune, nhu cầu không chỉ là đưa một bộ cài xuống máy: IT còn phải xác định máy nào đủ điều kiện, ứng dụng đã cài thành công hay chưa, và khi nào cần cập nhật hoặc gỡ bỏ. Một gói cài chạy được khi thao tác trực tiếp chưa đủ để bảo đảm triển khai hàng loạt đúng kết quả. Bài viết này tập trung vào môi trường thiết bị Windows đã enroll Intune, có Internet và cần triển khai ứng dụng Win32 bằng một quy trình thống nhất.

> **Tóm tắt nhanh:** Dùng Microsoft Win32 Content Prep Tool để đóng gói bộ cài thành `.intunewin`, sau đó tạo `Windows app (Win32)` trong Intune. Cấu hình đủ lệnh cài/gỡ, requirements, detection và assignment trước khi tạo app. Điểm cần kiểm tra kỹ là **detection rule**: chạy xong installer không đồng nghĩa Intune đã nhận diện ứng dụng là được cài đặt.

## 1. Bối cảnh và điều kiện cần

Win32 app giúp IT triển khai ứng dụng tùy chỉnh cho thiết bị được quản lý, thay vì cài thủ công từng máy. Theo tài liệu triển khai, ứng dụng được phân phối thông qua **Microsoft Intune Management Extension (IME)**; thành phần này được cài tự động khi một PowerShell script hoặc Win32 app được assign cho user hoặc thiết bị qua Intune.

Trước khi bắt đầu, chuẩn bị:

- Thiết bị Windows đã **enroll Intune**.
- Kết nối Internet.
- Bộ cài ứng dụng và các file cần thiết.
- Công cụ **Microsoft Win32 Content Prep Tool**, thường gọi theo tên file `IntuneWinAppUtil.exe`.
- Tài khoản quản trị được phép tạo và cấu hình ứng dụng trong Intune.

Tài liệu nguồn liệt kê Windows 10 từ phiên bản 1607, các edition Enterprise, Pro hoặc Education, và giới hạn **30 GB mỗi ứng dụng**. Đây là các thông số ghi trong tài liệu nguồn, không phải khuyến nghị triển khai hệ điều hành cũ. Khi áp dụng thực tế, cần đối chiếu hệ điều hành và giới hạn dịch vụ được hỗ trợ tại thời điểm triển khai.

Bài viết dùng **Google Telegram MSI** làm ví dụ như tài liệu gốc. Tên file, phiên bản và product code cần lấy từ bộ cài thực tế, không sao chép máy móc giữa các phiên bản.

## 2. Đóng gói thành intunewin

Microsoft Win32 Content Prep Tool chuyển các file cài đặt ứng dụng Win32 sang định dạng `.intunewin` để upload lên Intune.

### Chuẩn bị source

1. Tải công cụ từ kho [Microsoft Win32 Content Prep Tool](https://github.com/Microsoft/Microsoft-Win32-Content-Prep-Tool).
2. Tải bộ cài ứng dụng cần triển khai.
3. Đặt bộ cài và các file liên quan vào thư mục source.
4. Mở **Command Prompt bằng quyền Administrator** và chuyển đến thư mục chứa `IntuneWinAppUtil.exe`.

Ví dụ cấu trúc thư mục:

```text
C:\Temp\Installers\
    Telegram.msi
```

### Chạy công cụ

```cmd
IntuneWinAppUtil.exe -c "C:\Temp\Installers" -s "Telegram.msi" -o "C:\Temp"
```

| Tham số | Ý nghĩa |
|---|---|
| `-c` | Thư mục source chứa bộ cài và file liên quan |
| `-s` | File setup chính |
| `-o` | Thư mục xuất gói `.intunewin` |

Giữ file `.intunewin` để upload ở bước tiếp theo. Kích thước đầu ra phụ thuộc bộ cài; con số khoảng 72 MB trong ví dụ nguồn không phải kích thước cố định của mọi gói Telegram.

> **Tip:** Nếu dùng PowerShell wrapper, cần đưa cả script và các file script gọi đến vào source trước khi đóng gói. Việc cấu hình lệnh `-File` trong Intune không tự tạo nội dung cho script.

## 3. Tạo app và cấu hình Program

### Upload và điền App information

1. Đăng nhập **Intune admin center** bằng tài khoản quản trị.
2. Theo đường dẫn trong tài liệu: `Apps` → `All apps` → `Add`.
3. Chọn `Windows app (Win32)`.
4. Chọn `Select app package file`, upload `.intunewin` rồi xác nhận.

Các trường cần chú ý:

| Trường | Nội dung |
|---|---|
| Name | Tên app hiển thị trong Company Portal; nên đặt tên duy nhất |
| Description | Mô tả chức năng và hướng dẫn cần thiết cho user |
| Publisher | Nhà phát hành |
| Category | Nhóm ứng dụng để user dễ tìm |
| Show this as a featured app | Đưa app lên vị trí nổi bật trong Company Portal nếu cần |
| Information URL / Privacy URL | Liên kết thông tin và quyền riêng tư, nếu có |
| Developer / Owner / Notes | Thông tin phục vụ quản lý nội bộ |
| Logo | Biểu tượng hiển thị cùng app |

Phần mô tả hỗ trợ một số kiểu Markdown theo tài liệu, **không hỗ trợ HTML**. Tài liệu cũng lưu ý rằng nếu hai app trùng tên, chỉ một app xuất hiện trong Company Portal.

### Install command và Uninstall command

Dùng lệnh phù hợp với **đúng loại installer**. Các ví dụ dưới đây là các lựa chọn thay thế, không phải chạy tất cả cho cùng một app.

**Ví dụ MSI:**

```cmd
msiexec /i "Telegram.msi" /qn
```

Lệnh gỡ dùng product code thực tế của ứng dụng:

```cmd
msiexec /x "{PRODUCT-CODE-CUA-BO-CAI}" /qn
```

`{PRODUCT-CODE-CUA-BO-CAI}` là placeholder, **phải thay trước khi sử dụng**. Bài viết không giữ GUID của phiên bản Telegram trong tài liệu gốc để tránh dùng nhầm.

**Ví dụ EXE trong tài liệu:**

```cmd
"Telegram.exe" /silent /install
```

Không mặc định `/silent /install` dùng được cho mọi EXE. Tài liệu đề xuất kiểm tra các tùy chọn installer bằng `/?` hoặc `-help` khi bộ cài hỗ trợ.

Ví dụ lệnh gỡ Telegram EXE trong nguồn có đường dẫn phụ thuộc phiên bản:

```cmd
"%ProgramFiles%\Google\Telegram\Application\<APPLICATION_VERSION>\Installer\setup.exe" --uninstall --system-level --multi-install --force-uninstall
```

Cần thay `<APPLICATION_VERSION>` và kiểm tra đúng đường dẫn trước khi áp dụng.

**Ví dụ gọi PowerShell script:**

```cmd
%SystemRoot%\Sysnative\WindowsPowerShell\v1.0\powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File .\install_Telegram.ps1
```

```cmd
%SystemRoot%\Sysnative\WindowsPowerShell\v1.0\powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File .\uninstall_Telegram.ps1
```

Đây chỉ là **lệnh gọi script**, không phải nội dung script cài/gỡ hoàn chỉnh. Các file `.ps1` phải tồn tại trong gói và đã được kiểm thử.

### Các thiết lập Program khác

- **Installation time required:** thời gian chờ installer hoàn tất. Tài liệu ghi mặc định 60 phút, tối đa 1.440 phút; vượt thời gian cấu hình sẽ bị báo thất bại.
- **Install behavior:** chọn `System` hoặc `User`. Quy trình nguồn khuyến nghị `System`; vẫn cần chọn theo thiết kế bộ cài và phạm vi ứng dụng.
- **Allow available uninstall:** quyết định có cho user gỡ app từ Company Portal hay không, không phải cơ chế ngăn mọi cách gỡ ứng dụng trên Windows.

## 4. Phân biệt Requirements và Detection

Hai phần này dễ bị cấu hình lẫn nhau nhưng có mục đích khác nhau:

| Thành phần | Câu hỏi cần trả lời |
|---|---|
| Requirements | Thiết bị có đáp ứng điều kiện để triển khai ứng dụng không? |
| Detection | Ứng dụng đã hiện diện trên thiết bị theo tiêu chí cấu hình chưa? |

### Requirements: điều kiện triển khai

Cấu hình theo yêu cầu ứng dụng:

- `Operating system architecture`.
- `Minimum operating system`.
- Dung lượng trống, RAM, số logical processor và tốc độ CPU nếu cần.
- Additional requirement rules dựa trên **File**, **Registry** hoặc **Script**.

Với file rule, xác định path, tên file/folder và thuộc tính cần so sánh. Với registry rule, xác định key, value và kiểu so sánh.

Với script requirement, tài liệu mô tả việc đánh giá **STDOUT khi script trả exit code 0**, rồi so sánh kết quả theo output data type đã chọn. Không nhầm cơ chế này với detection script.

Các lựa chọn khác gồm chạy script theo credentials người đang đăng nhập, kiểm tra chữ ký và chọn ngữ cảnh 32-bit hoặc 64-bit.

### Detection: xác nhận ứng dụng đã cài

Tài liệu yêu cầu ít nhất một detection rule và đưa ra các lựa chọn:

| Kiểu | Dữ liệu kiểm tra | Điểm cần chú ý |
|---|---|---|
| MSI | MSI product code; có thể kiểm tra thêm version | Dùng đúng product code của bộ cài |
| File | File/folder, ngày, version hoặc size | Đúng path và tiêu chí phát hiện |
| Registry | Key/value, string, integer hoặc version | Đúng registry view 32-bit/64-bit |
| Custom script | PowerShell script | Cần đúng exit code và STDOUT |

Đối với file hoặc registry, lựa chọn `Associated with a 32-bit app on 64-bit clients` ảnh hưởng ngữ cảnh kiểm tra. Nếu cấu hình sai, rule có thể tìm ở vị trí không tương ứng với ứng dụng đã cài.

### Điều kiện của custom detection script

Theo tài liệu, ứng dụng được phát hiện khi script đồng thời:

1. Trả **exit code `0`**.
2. Ghi một chuỗi ra **STDOUT**.

Chỉ `exit 0` mà không có output là chưa đủ. Tài liệu cũng đề cập agent đọc STDERR, STDOUT và exit code; cần kiểm soát cả thông báo lỗi khi kiểm thử script.

Tài liệu khuyến nghị lưu script bằng **UTF-8 BOM**. Cấu hình thêm ngữ cảnh chạy 32-bit/64-bit và kiểm tra chữ ký theo yêu cầu môi trường.

> **Lưu ý:** Detection rule cần phản ánh kết quả thực sự muốn quản lý. Kiểm tra file tồn tại và kiểm tra đúng phiên bản là hai tiêu chí khác nhau; hãy chọn tiêu chí phù hợp trước khi triển khai rộng.

## 5. Dependencies, Supersedence và Assignment

### Dependencies: cài thành phần phụ thuộc trước

`Dependencies` dùng cho ứng dụng phải được cài **trước app hiện tại**. Đây là phần tùy chọn; chỉ cấu hình khi có quan hệ phụ thuộc thực tế.

### Supersedence: cập nhật hoặc thay thế app

Trong bước `Supersedence`:

1. Chọn `Add`.
2. Chọn ứng dụng cũ cần được app hiện tại cập nhật hoặc thay thế.
3. Cấu hình `Uninstall previous version` cho từng app.

| Tình huống | Hướng xử lý theo tài liệu |
|---|---|
| Installer mới tự cập nhật app cũ | Không cần gửi lệnh gỡ riêng; tắt `Uninstall previous version` |
| Cần gỡ app cũ để thay bằng app khác | Bật `Uninstall previous version` nếu thiết kế triển khai yêu cầu |

Tài liệu nguồn nêu giới hạn 10 ứng dụng được cập nhật hoặc thay thế, bao gồm các quan hệ tham chiếu trong chuỗi. Không nên chỉ đếm số app trực tiếp được thêm ở một màn hình nếu đang thiết kế quan hệ nhiều tầng.

### Scope tags

Kiểm tra `Scope tags` trước khi hoàn tất. Tài liệu có bước này nhưng không mô tả mô hình RBAC cụ thể; bài viết không tự đặt tên tag hoặc vai trò quản trị cho môi trường của bạn.

### Assignments: chọn đúng mục đích

| Loại assignment | Kết quả theo tài liệu |
|---|---|
| Required | Cài ứng dụng trên thiết bị thuộc nhóm được chọn |
| Available for enrolled devices | User chủ động cài từ Company Portal |
| Uninstall | Gỡ ứng dụng trên thiết bị thuộc nhóm được chọn |

Thực hiện:

1. Chọn loại assignment.
2. Chọn `Add group` và nhóm user hoặc thiết bị phù hợp với kịch bản.
3. Kiểm tra chế độ `Included` hoặc `Excluded`.
4. Cấu hình `End user notifications`, `Availability` và `Installation deadline` nếu cần.
5. Chọn `Delivery optimization priority` theo chế độ tải nền hoặc foreground của assignment.

Không coi `Required`, `Available` và `Uninstall` là ba nhãn tương đương. Đây là ba mục đích triển khai khác nhau, cần rà soát trước khi gán nhóm.

## 6. Các điểm dễ sai và checklist kiểm tra

Tài liệu nguồn không cung cấp nhật ký sự cố hoặc log thực tế. Vì vậy, phần này là **checklist phòng tránh rút ra từ các thiết lập trong quy trình**, không phải lời kể về lỗi tác giả đã trực tiếp gặp.

| Biểu hiện cần kiểm tra | Thiết lập cần đối chiếu | Cách phòng tránh |
|---|---|---|
| Installer chạy nhưng app chưa được nhận diện | Detection rule | Kiểm tra đúng MSI code, file, version hoặc registry |
| Detection script chưa nhận diện app | Exit code, STDOUT và lỗi script | Kiểm tra đủ điều kiện, không chỉ `exit 0` |
| App không đáp ứng điều kiện triển khai | Requirements | Đối chiếu OS, architecture và additional rules |
| Quá trình cài vượt thời gian chờ | Installation time required | Đặt thời gian phù hợp với bộ cài đã thử nghiệm |
| Lệnh gỡ không đúng phiên bản | Uninstall command | Không giữ nguyên GUID hoặc path của ví dụ |
| Cài/gỡ không đúng đối tượng dự kiến | Assignments | Rà soát nhóm, loại assignment và include/exclude |

### Review + create

Trước khi chọn `Create`, kiểm tra:

- [ ] Source và file `.intunewin` đúng phiên bản.
- [ ] Tên app, publisher, description và logo rõ ràng.
- [ ] Lệnh cài và gỡ khớp bộ cài thực tế.
- [ ] Script được gọi đã có trong gói.
- [ ] Install behavior và timeout phù hợp.
- [ ] Requirements đúng kiến trúc và hệ điều hành.
- [ ] Detection phản ánh đúng trạng thái cần kiểm tra.
- [ ] Dependencies và supersedence không bị cấu hình nhầm.
- [ ] Scope tags và nhóm assignment đã được rà soát.
- [ ] Thông báo, lịch khả dụng và deadline phù hợp.

Sau đó chọn `Review + create`, kiểm tra lại cấu hình và tạo ứng dụng.

## 7. Kết luận

Đóng gói `.intunewin` là bước đầu, còn chất lượng triển khai phụ thuộc vào **Program, Requirements, Detection và Assignments**. Dependencies và supersedence giúp quản lý quan hệ giữa các app, nhưng chỉ nên cấu hình khi đã rõ cách installer hoạt động. Trước khi triển khai rộng, hãy dùng checklist trên để kiểm thử cài, nhận diện và gỡ trên nhóm pilot. Trong quy trình của bạn, phần nào thường tốn thời gian nhất: đóng gói, detection hay xử lý phiên bản cũ?
