layout: post
title: "Bộ lệnh Terminal cơ bản khi quản lý MacBook bằng Intune: sync, log, profile, app, quyền admin"
seo_title: "Lệnh Terminal quản lý MacBook bằng Intune"
description: "Tổng hợp lệnh Terminal cho System Admin và Helpdesk quản lý MacBook bằng Intune: re-sync, đọc log, kiểm tra enrollment, profile, bundle ID, quarantine, quyền admin."
date: 2026-10-29
author: "Tam Nguyen"
reading_time: 9
topic: macos
thumb_label: "MACOS + INTUNE"
tags:
  - macOS
  - Intune
  - Company Portal
  - Terminal
card_tags:
  - macOS
  - Intune
summary: "Cheat sheet lệnh Terminal cho Helpdesk khi xử lý MacBook quản lý bằng Intune: sync, log, profile, app và quyền admin."
redirect_from:
  - /posts/lenh-co-ban-quan-ly-macbook-intune.html
---

Helpdesk quen với Windows thường "đứng hình" khi nhận ticket MacBook: app trên Company Portal cứ treo ở trạng thái *Installing*, policy đã assign mà máy không nhận, user cần quyền admin để cài phần mềm, hay file `.pkg` không mở được vì bị macOS chặn. Ở môi trường có vài trăm MacBook quản lý bằng Intune, phần lớn các ticket này đều xử lý được bằng **vài lệnh Terminal**. Bài này là cheat sheet mình dùng hằng ngày, sắp xếp theo đúng thứ tự xử lý sự cố.

> **Tóm tắt nhanh:** Khi MacBook không nhận policy hoặc app, hãy restart Intune agent để ép sync, rồi đọc log trong `/Library/Logs/Microsoft/Intune`. Kiểm tra loại enrollment và profile bằng lệnh `profiles`, lấy bundle ID app bằng `defaults read`, gỡ quarantine bằng `xattr`, và quản lý quyền admin bằng `dscl` / `dseditgroup`.

## Bối cảnh: hai thành phần cần biết

Trên MacBook, Intune hoạt động qua hai kênh khác nhau. Biết lệnh nào tác động tới kênh nào sẽ giúp xử lý đúng chỗ:

| Thành phần | Phụ trách | Ví dụ |
|---|---|---|
| **MDM (framework của Apple)** | Configuration profile, cert, Wi-Fi, FileVault, restriction | Process `mdmclient`, log `com.apple.ManagedClient` |
| **Intune agent (Microsoft)** | Shell script, app PKG/DMG, custom attribute | Process `IntuneMdmAgent`, log trong `/Library/Logs/Microsoft/Intune` |
| **Company Portal** | Giao diện cho user cài app, đăng ký thiết bị | App `Company Portal.app` |

Hầu hết lệnh dưới đây cần quyền admin. Chuyển hẳn sang root cho phiên làm việc:

```bash
sudo -s
```

Nhớ gõ `exit` khi xong để quay lại user thường.

## 1. Re-sync Intune và Company Portal

### Kiểm tra agent đang chạy

```bash
ps aux | grep IntuneMdmAgent
```

### Ép agent sync lại

Kill agent, macOS sẽ tự khởi động lại và agent check-in lại với Intune:

```bash
sudo killall IntuneMdmAgent
```

Có thể kết hợp với nút **Check Settings** trong Company Portal (*Devices → chọn máy → Check Settings*) để đồng bộ phía MDM.

### Reset hoàn toàn khi app bị treo ở "Installing"

Dừng Company Portal, dừng Intune agent, xóa cache và package đang tải dở, rồi khởi động lại agent:

```bash
sudo pkill -9 -f IntuneMdmAgent; sudo pkill -9 -f IntuneMdmDaemon; pkill -9 -f "Company Portal"; sudo rm -rf "/Library/Application Support/Microsoft/IntuneAgent/Cache/"* "/Library/Application Support/Microsoft/IntuneAgent/Packages/"*; sudo launchctl kickstart -k system/com.microsoft.intune.agent
```

Kiểm tra lại:

```bash
ps aux | egrep "Intune|Company Portal|installer"
```

<div class="callout warn">
  <span>⚠️</span>
  <div><b>Lưu ý</b>Trước khi xóa cache, kiểm tra không có tiến trình <code>installer</code> nào đang chạy. Kill giữa lúc một PKG đang cài có thể để lại app cài dở, và lần sau phải gỡ tay rồi cài lại.</div>
</div>

## 2. Đọc log Intune và MDM

### Log của Intune agent

```bash
ls -lt /Library/Logs/Microsoft/Intune
```

Các file `IntuneMDMDaemon*.log` ghi lại việc tải, cài app và chạy shell script. Xem trực tiếp phần cuối:

```bash
tail -n 200 /Library/Logs/Microsoft/Intune/IntuneMDMDaemon*.log
```

Log của Company Portal theo từng user nằm trong `~/Library/Logs/Company Portal`.

### Log MDM của macOS

```bash
log show --last 1h --predicate 'subsystem == "com.apple.ManagedClient"'
```

Đổi `1h` thành `30m`, `1d`... tùy khoảng thời gian cần xem.

### Xem log bằng giao diện

Mở **Console.app**. Đây là công cụ tương đương *Event Viewer* trên Windows: chọn máy ở cột trái, gõ `ManagedClient` hoặc `Intune` vào ô tìm kiếm, rồi bấm **Start streaming** và tái hiện lỗi.

## 3. Kiểm tra enrollment và profile

### Máy enroll theo kiểu nào

```bash
profiles status -type enrollment
```

| Kết quả | Ý nghĩa |
|---|---|
| `Enrolled via DEP: Yes` | Máy enroll qua Automated Device Enrollment (ABM/ADE) |
| `MDM enrollment: Yes (User Approved)` | Enroll thủ công, user đã approve MDM profile |
| `MDM enrollment: No` | Máy chưa enroll hoặc đã mất MDM profile |

Máy enroll qua ADE mới nhận được đầy đủ các tính năng như Platform SSO, Bootstrap token, và các setting supervised.

### Liệt kê profile đã cài

```bash
sudo profiles -P
```

Hoặc xem chi tiết đầy đủ:

```bash
sudo profiles show -type configuration
```

### Xóa một profile cụ thể

```bash
sudo profiles remove -identifier <profile-identifier>
```

`<profile-identifier>` lấy từ kết quả `profiles -P`. Profile do Intune đẩy xuống thường **không xóa được** bằng lệnh này (profile được đánh dấu non-removable). Cách đúng là gỡ assignment trên Intune hoặc retire máy.

### Script của mình


```bash
#!/bin/zsh
# Check_Enrollment.sh

```

## 4. Xóa MDM profile bằng Recovery Mode (bước cuối cùng)

Dùng khi máy bị kẹt MDM profile cũ, không retire được, không enroll lại được. Đây là cách "đập đi làm lại", chỉ dùng khi các cách khác đã thất bại.

1. Khởi động vào **Recovery Mode**: Apple Silicon giữ nút nguồn; Intel giữ `Cmd + R`.
2. Mở **Utilities → Terminal**, tắt SIP:

```bash
csrutil disable
```

3. Reboot về macOS bình thường, mở Terminal:

```bash
sudo -s
cd /var/db/ConfigurationProfiles
rm -rf *
mkdir Settings
touch Settings/.profilesAreInstalled
```

4. Reboot, vào lại **Recovery Mode**, bật lại SIP:

```bash
csrutil enable
```

5. Reboot, sau đó enroll lại máy qua Company Portal.

<div class="callout danger">
  <span>⛔</span>
  <div><b>Nguy hiểm</b>Lệnh <code>rm -rf *</code> xóa <b>toàn bộ</b> configuration profile trên máy, bao gồm Wi-Fi, VPN, chứng chỉ và các cấu hình bảo mật. Phải chắc chắn đang đứng đúng thư mục <code>/var/db/ConfigurationProfiles</code> trước khi chạy, và <b>luôn bật lại SIP</b> sau khi làm xong. Máy để SIP tắt là máy mất một lớp bảo vệ quan trọng. Trước khi làm, xóa bản ghi thiết bị cũ trên Intune để tránh enroll trùng.</div>
</div>

## 5. Làm việc với app: bundle ID, version, quarantine

### Lấy bundle ID và version

Bundle ID cần dùng khi tạo detection rule cho app PKG/DMG trên Intune, hoặc khi cấu hình PPPC và các rule chặn app.

```bash
# Cách 1: theo tên app
osascript -e 'id of app "Google Chrome"'

# Cách 2: đọc trực tiếp Info.plist
defaults read /Applications/Figma.app/Contents/Info CFBundleIdentifier

# Version của app
defaults read /Applications/Figma.app/Contents/Info CFBundleShortVersionString
```

<div class="callout">
  <span>💡</span>
  <div><b>Tip</b>Khi tạo app PKG trên Intune, version trong detection rule phải khớp với <code>CFBundleShortVersionString</code> thực tế sau khi cài. Nếu không khớp, Company Portal sẽ báo cài thất bại dù app đã cài xong, và tiếp tục cài lại ở lần sync sau.</div>
</div>

### Gỡ quarantine cho file PKG bị chặn

File tải từ Internet được macOS gắn thuộc tính `com.apple.quarantine`. Gatekeeper có thể chặn mở file nếu không có chữ ký hợp lệ.

```bash
# 1. Xem thuộc tính mở rộng của file
ls -l@ /path/to/yourfile.pkg

# 2. Gỡ quarantine
xattr -d com.apple.quarantine /path/to/yourfile.pkg

# 3. Kiểm tra lại (không còn com.apple.quarantine là được)
xattr /path/to/yourfile.pkg

# 4. Cài đặt bằng dòng lệnh
sudo installer -pkg /path/to/yourfile.pkg -target /
```

Chỉ gỡ quarantine cho file có **nguồn tin cậy**, đã được team bảo mật duyệt. Đây là cơ chế bảo vệ của macOS, không nên dùng để vượt qua chính sách phần mềm của công ty.

## 6. Quản lý quyền admin của tài khoản

### Liệt kê và kiểm tra

```bash
# Danh sách tài khoản trên máy
dscl . -list /Users

# Một tài khoản có trong group admin không
groups <username>

# Danh sách thành viên group admin
dscl . -read /Groups/admin GroupMembership
```

### Cấp quyền admin

```bash
sudo dscl . -append /Groups/admin GroupMembership <username>
```

### Gỡ quyền admin hàng loạt

Script dưới đây gỡ tất cả tài khoản khỏi group admin, **trừ** `root` và tài khoản admin của IT. Có thể deploy qua Intune dưới dạng *Shell script*.

```bash
#!/bin/sh

LADM=$(dscl . -read Groups/admin GroupMembership | cut -c 18-)

for user in $LADM
do
    if [ "$user" != "root" ] && [ "$user" != "<it-admin-account>" ]
    then
        dseditgroup -o edit -d $user -t user admin
        if [ $? = 0 ]; then echo "Removed user $user from admin group"; fi
    else
        echo "$user remains as Admin"
    fi
done
```

Thay `<it-admin-account>` bằng tên tài khoản admin cục bộ của IT. **Kiểm tra kỹ dòng này trước khi deploy**: nếu sai tên, máy sẽ không còn tài khoản admin nào ngoài root.

### Script của mình


```bash
#!/bin/sh
# Remove_Local_Admin.sh

```

## 7. Mở file share trên MacBook

User chuyển từ Windows sang thường hỏi cách mở thư mục chia sẻ:

1. Mở **Finder**.
2. Menu **Go → Connect to Server** (hoặc `Cmd + K`).
3. Nhập địa chỉ server theo dạng:

```text
smb://<file-server-name>/<share-name>
```

4. Đăng nhập bằng tài khoản công ty, có thể bấm **+** để lưu server vào danh sách yêu thích.

Mở nhanh bằng Terminal:

```bash
open "smb://<file-server-name>/<share-name>"
```

## Bảng tra nhanh

| Nhu cầu | Lệnh |
|---|---|
| Chuyển sang root | `sudo -s` |
| Kiểm tra Intune agent | `ps aux \| grep IntuneMdmAgent` |
| Ép sync Intune | `sudo killall IntuneMdmAgent` |
| Log Intune | `/Library/Logs/Microsoft/Intune` |
| Log MDM 1 giờ qua | `log show --last 1h --predicate 'subsystem == "com.apple.ManagedClient"'` |
| Loại enrollment | `profiles status -type enrollment` |
| Liệt kê profile | `sudo profiles -P` |
| Bundle ID | `osascript -e 'id of app "Tên App"'` |
| Version app | `defaults read /Applications/<App>.app/Contents/Info CFBundleShortVersionString` |
| Gỡ quarantine | `xattr -d com.apple.quarantine <file>` |
| Cài PKG | `sudo installer -pkg <file> -target /` |
| Kiểm tra quyền admin | `groups <username>` |
| Cấp quyền admin | `sudo dscl . -append /Groups/admin GroupMembership <username>` |
| Xem log dạng GUI | `Console.app` |

## Những lỗi mình đã gặp

| Lỗi | Triệu chứng | Nguyên nhân gốc | Cách xử lý |
|---|---|---|---|
| App treo ở "Installing" | Company Portal không tiến triển nhiều giờ | Package tải dở trong cache của agent | Kill agent, xóa `Cache` và `Packages`, kickstart agent |
| App cài xong vẫn báo lỗi | Company Portal báo Failed, cài lại liên tục | Version trong detection rule không khớp version thực tế | Đọc `CFBundleShortVersionString`, sửa detection trên Intune |
| PKG không mở được | macOS báo không xác minh được nhà phát triển | File bị gắn `com.apple.quarantine` | `xattr -d`, rồi cài bằng `installer` |
| Không xóa được profile | `profiles remove` báo lỗi | Profile do MDM cài, bị đánh dấu non-removable | Gỡ assignment trên Intune hoặc retire máy |
| Không enroll lại được | Company Portal báo máy đã được quản lý | MDM profile cũ còn kẹt | Xóa bản ghi trên Intune, xóa profile qua Recovery Mode |
| Máy mất hết admin | Không cài được gì, kể cả IT | Script gỡ admin sai tên tài khoản loại trừ | Kiểm tra kỹ tên tài khoản, test trên máy pilot trước |

## Kết luận

Phần lớn ticket MacBook trên Intune xoay quanh ba việc: ép sync, đọc log, và kiểm tra profile. Nắm vững nhóm lệnh này, Helpdesk có thể tự xử lý trước khi escalate, và System Admin có đủ thông tin để tìm nguyên nhân gốc. Hãy lưu bảng tra nhanh ở trên vào tài liệu nội bộ của team, và luôn thử các thao tác nguy hiểm như xóa profile hay gỡ admin trên máy test trước.

Lệnh Terminal nào bạn dùng nhiều nhất khi hỗ trợ MacBook?

<!--
Phần cuối bài (nút Chia sẻ LinkedIn, Facebook, Copy link, khung tác giả, bài trước/sau)
và Mục lục bên phải được layout tự thêm vào, không cần viết trong file này.
Xem trước trên máy: bundle exec jekyll serve --unpublished (chỉ cần khi bài còn published: false).
-->
