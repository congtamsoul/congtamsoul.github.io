layout: post
title: "Các cách tạo Intune app cho MacBook: đóng gói script thành PKG, chuyển DMG sang PKG và nơi app được cài"
seo_title: "Các loại Intune app cho MacBook: PKG, DMG, script"
description: "Hướng dẫn tạo Intune app cho macOS: đóng gói shell script thành PKG bằng pkgbuild, chuyển DMG sang PKG bằng productbuild và các đường dẫn app thường được cài."
date: 2026-10-29
author: "Tam Nguyen"
reading_time: 8
topic: macos
thumb_label: "MACOS APPS"
tags:
  - macOS
  - Intune
  - PKG
  - App Deployment
card_tags:
  - macOS
  - Intune
summary: "Chọn đúng loại Intune app cho MacBook, đóng gói shell script thành PKG, chuyển DMG sang PKG và biết app nằm ở đâu sau khi cài."
redirect_from:
  - /posts/cac-loai-intune-app-cho-macbook.html
---

Lần đầu deploy app cho MacBook qua Intune, mình gặp ngay hai câu hỏi: phần mềm chỉ có file `.dmg` thì upload kiểu gì, và muốn chạy một script gỡ phần mềm thì làm sao để nó hiện trong Company Portal như một app bình thường? Trên Windows, mọi thứ gói gọn trong `.intunewin`. Trên macOS, mỗi loại file lại đi theo một con đường riêng. Bài này tổng hợp các loại Intune app cho MacBook, cách mình đóng gói script và DMG thành PKG, và những thư mục cần biết khi kiểm tra hoặc gỡ app.

> **Tóm tắt nhanh:** Intune có nhiều loại app cho macOS: PKG, DMG, LOB, app của Microsoft và app từ Apple Business Manager. Muốn deploy một shell script dưới dạng app, đóng gói bằng `pkgbuild` với script `postinstall`. Muốn đổi DMG sang PKG, copy file `.app` ra rồi dùng `productbuild --component`.

## Bối cảnh: các loại app macOS trên Intune

Trong **Intune admin center → Apps → macOS → Add**, bạn sẽ thấy nhiều lựa chọn. Chọn đúng loại ngay từ đầu giúp tránh lỗi cài đặt và lỗi detection về sau.

| Loại app | File đầu vào | Phù hợp khi |
|---|---|---|
| **macOS app (PKG)** | `.pkg` | Hầu hết phần mềm có sẵn file PKG, kể cả PKG chưa ký. Có thể thêm pre-install và post-install script |
| **macOS app (DMG)** | `.dmg` chứa file `.app` | Phần mềm chỉ phát hành dạng DMG kéo-thả |
| **Line-of-business app** | `.pkg` đã ký | PKG đã được ký bằng chứng chỉ *Developer ID Installer* |
| **Microsoft 365 Apps, Edge, Defender** | Không cần file | App của Microsoft, Intune tự tải bản mới nhất |
| **Volume-purchased app (ABM)** | Không cần file | App mua qua Apple Business Manager, đồng bộ về Intune |
| **Web link** | URL | Chỉ cần đặt shortcut tới một trang web |

Ngoài ra còn **Shell script** (*Devices → macOS → Scripts*). Script không hiển thị trong Company Portal và không có detection rule như app. Nếu muốn user tự bấm cài từ Company Portal, hoặc muốn theo dõi trạng thái như một app, hãy đóng gói script thành PKG như phần dưới.

<!-- ===== CHÈN ẢNH MÀN HÌNH CÁC LOẠI APP TRÊN INTUNE VÀO ĐÂY (TÙY CHỌN) ===== -->

## Cách 1: Đóng gói shell script thành PKG bằng pkgbuild

Ví dụ thực tế: mình cần gỡ Docker Desktop trên các MacBook không được phép dùng. Script `Uninstall_Docker.sh` đã có sẵn, việc còn lại là biến nó thành một PKG để deploy qua Intune.

### Cách PKG hoạt động

- PKG copy file `.sh` vào `/var/tmp`.
- Script `postinstall` (chạy với quyền root sau khi copy xong) gọi file `.sh`, rồi tự xóa file đó.

### Bước 1: Tạo cấu trúc thư mục

Tạo một thư mục cha, bên trong có hai thư mục con:

- `Content` chứa file script chính, ví dụ `Uninstall_Docker.sh`.
- `Scripts` chứa file `postinstall`.

![Cấu trúc thư mục khi đóng gói script thành PKG](/images/cac-loai-intune-app-cho-macbook/cau-truc-thu-muc-pkgbuild.png){: width="640"}
*Hình 1: thư mục Content chứa script chính, Scripts chứa postinstall, và file PKG được tạo ra.*

<div class="callout warn">
  <span>⚠️</span>
  <div><b>Lưu ý</b><code>postinstall</code> là file <b>không có đuôi</b>. Đặt tên đúng chính xác <code>postinstall</code> (chữ thường). Nếu đặt là <code>postinstall.sh</code>, macOS Installer sẽ không chạy file này.</div>
</div>

### Bước 2: Nội dung file postinstall

```bash
#!/bin/bash
/var/tmp/Uninstall_Docker.sh
sleep 2
rm -rf /var/tmp/Uninstall_Docker.sh
exit 0
```

### Bước 3: Script chính

<!-- ===== DÁN SCRIPT CỦA BẠN VÀO ĐÂY (ví dụ Uninstall_Docker.sh) ===== -->

```bash
#!/bin/bash
# Uninstall_Docker.sh
# Chạy với quyền root thông qua postinstall

# >>> Dán script vào đây <<<
```

### Bước 4: Cấp quyền thực thi

Cả hai file đều phải có quyền chạy, nếu không postinstall sẽ lỗi:

```bash
chmod +x Content/Uninstall_Docker.sh
chmod +x Scripts/postinstall
```

### Bước 5: Build PKG

Mở Terminal, `cd` vào thư mục cha, chuyển sang root rồi chạy `pkgbuild`:

```bash
sudo -s
pkgbuild --root Content --scripts Scripts --identifier com.company.uninstalldocker --install-location /var/tmp --version 1.0 Uninstall_Docker.pkg
```

| Tham số | Ý nghĩa |
|---|---|
| `--root Content` | Nội dung sẽ được copy vào máy |
| `--scripts Scripts` | Thư mục chứa `preinstall` / `postinstall` |
| `--identifier` | ID của package, dạng reverse-DNS, mỗi package một ID riêng |
| `--install-location /var/tmp` | Nơi copy nội dung trong `Content` |
| `--version` | Phiên bản package. Tăng số này mỗi lần sửa script |

Kết quả là file `Uninstall_Docker.pkg`. Upload lên Intune dưới dạng **macOS app (PKG)**.

### Kiểm tra PKG trước khi upload

```bash
# Xem danh sách file bên trong PKG
pkgutil --payload-files Uninstall_Docker.pkg

# Cài thử trên máy test
sudo installer -pkg Uninstall_Docker.pkg -target /

# Kiểm tra máy đã ghi nhận package chưa
pkgutil --pkgs | grep uninstalldocker
pkgutil --pkg-info com.company.uninstalldocker
```

Log cài đặt của macOS Installer nằm ở `/var/log/install.log`, hữu ích khi postinstall chạy lỗi:

```bash
grep -i "postinstall" /var/log/install.log | tail -n 50
```

<div class="callout">
  <span>💡</span>
  <div><b>Tip</b>PKG kiểu này không cài file <code>.app</code> nào vào <code>/Applications</code>. Trước khi assign hàng loạt, hãy cài thử một máy và kiểm tra trạng thái trên Company Portal và Intune có báo thành công không, để chắc rằng Intune nhận diện được package qua <code>--identifier</code> và <code>--version</code>.</div>
</div>

## Cách 2: Chuyển DMG sang PKG bằng productbuild

Intune đã hỗ trợ upload DMG trực tiếp (loại **macOS app (DMG)**). Tuy vậy, nhiều trường hợp vẫn nên chuyển sang PKG: muốn thêm pre/post-install script, muốn ký package, hoặc DMG có cấu trúc đặc biệt khiến cài trực tiếp không ổn định.

1. **Mount DMG:** double-click file `.dmg`, macOS sẽ mount thành một ổ đĩa ảo.
2. **Copy app:** trong ổ vừa mount, copy file `.app` vào `/Applications` (hoặc một thư mục khác).
3. **Eject DMG:** bấm biểu tượng eject trong Finder.
4. **Tạo PKG** bằng `productbuild`:

```bash
sudo productbuild --component /Applications/YourApp.app ~/Downloads/YourApp.pkg
```

Thay `/Applications/YourApp.app` bằng đường dẫn thật tới file `.app`, và `~/Downloads/YourApp.pkg` bằng nơi muốn lưu file PKG.

5. **Xác thực:** nhập mật khẩu admin khi được hỏi. File PKG sẽ được tạo ở đường dẫn đã chọn.
6. **(Tùy chọn, nên làm) Ký PKG:** trong môi trường doanh nghiệp, nên ký PKG bằng chứng chỉ *Developer ID Installer*. PKG đã ký có thể dùng cho loại **Line-of-business app** và không bị Gatekeeper cảnh báo.

```bash
productsign --sign "Developer ID Installer: <Company Name> (<TEAMID>)" ~/Downloads/YourApp.pkg ~/Downloads/YourApp-signed.pkg

# Kiểm tra chữ ký
pkgutil --check-signature ~/Downloads/YourApp-signed.pkg
```

### Lấy thông tin cho detection rule

Khi tạo app trên Intune, cần bundle ID và version của app:

```bash
defaults read /Applications/YourApp.app/Contents/Info CFBundleIdentifier
defaults read /Applications/YourApp.app/Contents/Info CFBundleShortVersionString
```

Version trong detection rule phải khớp version thực tế sau khi cài. Nếu không, Company Portal sẽ báo lỗi dù app đã cài xong, và tiếp tục cài lại ở lần sync sau.

### Script của mình

<!-- ===== DÁN SCRIPT PRE/POST-INSTALL CHO APP DMG/PKG CỦA BẠN VÀO ĐÂY ===== -->

```bash
#!/bin/bash
# Pre-install / Post-install script cho Intune macOS app (PKG)

# >>> Dán script vào đây <<<
```

## Những nơi app được cài trên macOS

Khi kiểm tra app đã cài hay chưa, hoặc khi viết script gỡ app sạch sẽ, đây là những thư mục cần xem:

| Đường dẫn | Chứa gì |
|---|---|
| `/Applications` | App cài cho toàn máy. Phần lớn app từ Intune nằm ở đây |
| `/Users/<username>/Applications` | App user tự cài chỉ cho riêng mình, không cần quyền admin |
| `/Users/<username>/Downloads` | App user tải về và chạy trực tiếp, chưa kéo vào Applications |
| `/Library/Application Support` | Dữ liệu và thành phần dùng chung của app cho toàn máy |
| `$HOME/Library/Application Support/` | Dữ liệu app của từng user |
| `$HOME/Library/Caches` | Cache của app theo user |
| `$HOME/Library/Preferences` | File cấu hình `.plist` của app theo user |

Tìm nhanh một app trên toàn bộ các vị trí trên:

```bash
APP="Docker"
ls -d /Applications/*"$APP"* /Users/*/Applications/*"$APP"* /Users/*/Downloads/*"$APP"* \
      "/Library/Application Support/"*"$APP"* /Users/*/Library/Application\ Support/*"$APP"* 2>/dev/null
```

Khi viết script gỡ app, nhớ dọn cả các thư mục trong `Library` của **từng user**, không chỉ của user đang đăng nhập. Script chạy qua Intune chạy bằng root, nên `$HOME` sẽ là `/var/root` chứ không phải thư mục của user. Hãy lặp qua `/Users/*`.

<div class="callout danger">
  <span>⛔</span>
  <div><b>Nguy hiểm</b>Không dùng wildcard quá rộng khi xóa trong <code>Library</code>, ví dụ <code>rm -rf ~/Library/Application\ Support/*Doc*</code> có thể xóa nhầm dữ liệu của app khác. Luôn in ra danh sách sẽ xóa và chạy thử trên máy test trước.</div>
</div>

## Những lỗi mình đã gặp

| Lỗi | Triệu chứng | Nguyên nhân gốc | Cách xử lý |
|---|---|---|---|
| postinstall không chạy | PKG cài xong nhưng script không thực thi | File đặt tên `postinstall.sh` hoặc thiếu quyền chạy | Đổi tên thành `postinstall`, `chmod +x` |
| Script báo "Permission denied" | Log trong `install.log` báo lỗi khi gọi `.sh` | File trong `Content` chưa được `chmod +x` | Cấp quyền trước khi chạy `pkgbuild` |
| Intune không cài lại sau khi sửa script | Máy vẫn chạy bản cũ | `--version` không đổi | Tăng version mỗi lần build lại |
| App cài xong vẫn báo Failed | Company Portal cài lại liên tục | Version trong detection không khớp version thật | Đọc `CFBundleShortVersionString`, sửa trên Intune |
| PKG bị Gatekeeper chặn | User không mở được PKG thủ công | PKG chưa ký, có thuộc tính quarantine | Ký PKG, hoặc deploy qua Intune thay vì gửi file cho user |
| Script gỡ app không dọn hết | App vẫn còn dữ liệu trong `Library` của user | Dùng `$HOME` khi chạy bằng root | Lặp qua `/Users/*` |

## Kết luận

Với MacBook, chọn đúng loại app trên Intune là một nửa công việc. PKG là định dạng linh hoạt nhất: dùng `pkgbuild` để đóng gói script, `productbuild` để chuyển DMG, và ký package khi deploy cho cả công ty. Hãy giữ một thư mục mẫu `Content` và `Scripts` trong kho tài liệu của team, lần sau chỉ cần thay script và build lại.

Bạn đang deploy app cho MacBook bằng loại nào nhiều nhất: PKG, DMG hay qua Apple Business Manager?

<!--
Phần cuối bài (nút Chia sẻ LinkedIn, Facebook, Copy link, khung tác giả, bài trước/sau)
và Mục lục bên phải được layout tự thêm vào, không cần viết trong file này.
Xem trước trên máy: bundle exec jekyll serve --unpublished (chỉ cần khi bài còn published: false).
-->
