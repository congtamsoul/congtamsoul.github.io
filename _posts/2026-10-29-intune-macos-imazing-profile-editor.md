layout: post
title: "Quản lý MacBook bằng Intune: mở rộng cấu hình với iMazing Profile Editor"
seo_title: "Intune quản lý macOS với iMazing Profile Editor"
description: "Khi Intune chưa có sẵn setting cho macOS, dùng iMazing Profile Editor tạo file .mobileconfig, upload vào Intune Custom profile và áp cho nhóm MacBook."
date: 2026-10-29
author: "Tam Nguyen"
reading_time: 8
topic: macos
thumb_label: "MACOS"
tags:
  - macOS
  - Intune
  - iMazing Profile Editor
  - Configuration Profile
card_tags:
  - macOS
  - Intune
summary: "Intune chưa có setting bạn cần cho MacBook? Tạo .mobileconfig bằng iMazing Profile Editor và deploy qua Intune Custom profile."
redirect_from:
  - /posts/intune-macos-imazing-profile-editor.html
---

Công ty mình quản lý cả Windows lẫn MacBook trên cùng một Intune tenant. Với Windows, gần như setting nào cũng có trong Settings catalog. Với MacBook thì khác: khi cần chặn user tự tạo tài khoản local, cố định Dock, hiện một icon trên menu bar hay đặt hình nền công ty, mình thường không tìm thấy setting tương ứng, hoặc có nhưng thiếu tùy chọn. Các giải pháp chuyên cho Apple như Jamf hay Kandji làm rất tốt phần này, nhưng không phải công ty nào cũng muốn thêm một MDM thứ hai chỉ vì vài chục MacBook. Bài này chia sẻ cách mình lấp khoảng trống đó bằng **iMazing Profile Editor** và **Intune Custom profile**.

> **Tóm tắt nhanh:** Dùng iMazing Profile Editor (miễn phí) để chọn payload macOS cần cấu hình, rồi lưu thành file `.mobileconfig`. Trong Intune, tạo profile **Templates → Custom**, upload file đó và assign cho group MacBook. Hãy luôn kiểm tra Settings catalog trước, chỉ dùng Custom profile khi Intune chưa hỗ trợ.

## Bối cảnh: Intune và macOS

Intune quản lý macOS theo các mức sau:

| Cách cấu hình | Khi nào dùng |
|---|---|
| **Settings catalog** | Lựa chọn đầu tiên. Microsoft bổ sung setting macOS thường xuyên |
| **Templates** (Device features, Restrictions, Endpoint protection...) | Một số cấu hình cũ chưa chuyển sang Settings catalog |
| **Shell script** | Việc không thể làm bằng profile: chạy lệnh, cài file, sửa cấu hình người dùng |
| **Templates → Custom** (`.mobileconfig`) | Payload Apple có hỗ trợ nhưng Intune chưa có giao diện, hoặc thiếu key bạn cần |

So với Jamf hay Kandji, điểm yếu của Intune là **độ phủ setting** và **giao diện cho các payload ít phổ biến**. Nhưng bản chất mọi MDM đều đẩy cùng một thứ xuống Mac: **configuration profile theo chuẩn của Apple**. Chỉ cần tạo đúng profile, Intune cũng đẩy được.

## iMazing Profile Editor là gì

**iMazing Profile Editor** là ứng dụng miễn phí của DigiDNA, chạy trên macOS và Windows. Ứng dụng có giao diện để soạn configuration profile mà không phải viết XML tay:

- Có gần như đầy đủ **payload của Apple**, kèm mô tả từng key và phiên bản macOS hỗ trợ.
- Có thêm **preference domain của nhiều ứng dụng bên thứ ba** (Microsoft Office, Edge, Chrome, Zoom...).
- Kiểm tra lỗi kiểu dữ liệu trước khi lưu, giảm rủi ro profile bị Mac từ chối.

## Bước 1: Tạo file mobileconfig bằng iMazing Profile Editor

1. **Mở ứng dụng** và tạo profile mới.
2. Vào mục **General** và điền thông tin:
   - **Payload Display Name**: tên hiển thị trên Mac, ví dụ `Company - Block Create User`.
   - **Payload Identifier**: dạng reverse-DNS duy nhất, ví dụ `com.company.blockcreateuser`.
   - **Payload Scope**: `System` để áp cho toàn máy.
   - **Target**: `macOS`.
3. **Chọn tính năng cần cấu hình** trong danh sách payload bên trái, bấm **Add** rồi điền giá trị. Ví dụ:
   - **Restrictions**: chặn một số thao tác của user.
   - **Dock**: cố định ứng dụng và vị trí Dock.
   - **Control Center**: hiện hoặc ẩn các icon trên menu bar.
   - **Login Items**: ứng dụng tự mở khi user đăng nhập.
   - **Desktop**: đặt hình nền.
4. **File → Save As** để lưu thành file `.mobileconfig`.

<!-- ===== CHÈN ẢNH CHỤP MÀN HÌNH iMAZING PROFILE EDITOR VÀO ĐÂY ===== -->
![Tab General trong iMazing Profile Editor](/images/intune-macos-imazing-profile-editor/imazing-general.png){: width="640"}
*Hình 1: điền Payload Name, Scope và Target trong mục General.*

![Chọn payload cần cấu hình](/images/intune-macos-imazing-profile-editor/imazing-payload.png){: width="640"}
*Hình 2: thêm payload và điền giá trị.*

<div class="callout warn">
  <span>⚠️</span>
  <div><b>Lưu ý</b>Để file ở dạng <b>chưa ký (unsigned)</b> khi upload lên Intune. Mỗi profile nên chỉ chứa một nhóm chức năng liên quan, để khi cần sửa hoặc gỡ không ảnh hưởng đến các cấu hình khác.</div>
</div>

### Nội dung file mobileconfig của mình

<!-- ===== DÁN NỘI DUNG FILE .MOBILECONFIG VÀO ĐÂY ===== -->

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- >>> Dán nội dung profile vào đây <<< -->
</dict>
</plist>
```

## Bước 2: Upload lên Intune bằng Custom profile

1. Vào **Intune admin center → Devices → macOS → Configuration → Create → New policy**.
2. **Profile type**: chọn **Templates**, sau đó chọn **Custom**.
3. Đặt tên profile theo quy ước của team, ví dụ `MacOS - Hardening - Block Create User`.
4. Trong **Configuration settings**:
   - **Custom configuration profile name**: tên hiển thị trên Mac.
   - **Deployment channel**: **Device channel** cho cấu hình áp toàn máy (tương ứng với Scope `System` trong iMazing).
   - **Configuration profile file**: upload file `.mobileconfig` vừa tạo. Intune hiển thị lại nội dung XML để bạn kiểm tra.
5. **Assignments**: chọn group MacBook.
6. **Scope tags**: chọn nếu tenant có phân quyền theo vùng.
7. **Review + create**.

<!-- ===== CHÈN ẢNH CHỤP MÀN HÌNH PROFILE TRÊN INTUNE VÀO ĐÂY ===== -->
![Custom configuration profile cho macOS trên Intune](/images/intune-macos-imazing-profile-editor/intune-custom-profile.png){: width="640"}
*Hình 3: Custom profile đã assign cho group MacBook, phần Configuration settings hiển thị nội dung file mobileconfig.*

<div class="callout">
  <span>💡</span>
  <div><b>Tip</b>Assign trước cho một group <b>pilot</b> gồm vài MacBook của IT. Khi đã kiểm tra trên máy thật, mới mở rộng sang group toàn bộ MacBook.</div>
</div>

## Bước 3: Kiểm tra profile trên MacBook

### Trên giao diện

Mở **System Settings → General → Device Management** (bản macOS cũ hơn: **System Preferences → Profiles**) và kiểm tra profile đã xuất hiện.

### Bằng Terminal

```bash
# Liệt kê toàn bộ profile đã cài
sudo profiles show -all

# Chỉ xem tên và identifier
sudo profiles list -all

# Xem giá trị cấu hình đã được áp (thay domain theo payload)
sudo defaults read "/Library/Managed Preferences/com.apple.dock"

# Log của quá trình cài profile
log show --predicate 'subsystem == "com.apple.ManagedClient"' --last 1h

# Ép Mac đồng bộ với Intune: mở Company Portal, chọn thiết bị, bấm Check settings
```

### Trên Intune

Mở profile, vào **Device status** hoặc **Per setting status**. Nếu có máy báo **Error**, xem chi tiết lỗi trên từng thiết bị. Thông thường đó là lỗi định dạng XML hoặc payload không hỗ trợ trên phiên bản macOS của máy đó.

## Những lỗi mình đã gặp

| Lỗi | Triệu chứng | Nguyên nhân gốc | Cách xử lý |
|---|---|---|---|
| Upload file bị từ chối | Intune báo file không hợp lệ | File đã được ký, hoặc XML sai định dạng | Lưu lại dạng unsigned, kiểm tra bằng `plutil -lint file.mobileconfig` |
| Profile cài nhưng không có tác dụng | Mac có profile nhưng setting không đổi | Sai Scope (User/System) hoặc sai Deployment channel | Scope `System` đi với Device channel; Scope `User` đi với User channel |
| Hai profile xung đột | Setting nhảy qua lại | Cùng một payload được cấu hình ở Settings catalog và Custom profile | Mỗi setting chỉ quản lý ở một nơi |
| Payload không áp trên một số máy | Báo Error trên máy chạy macOS cũ | Key chỉ hỗ trợ từ phiên bản macOS mới hơn | Xem phiên bản hỗ trợ trong iMazing, dùng filter theo OS version khi assign |
| Hình nền hoặc login item không áp | Profile cài thành công nhưng không thấy kết quả | Profile chỉ trỏ tới đường dẫn, file ảnh hoặc app chưa có trên máy | Đẩy file hoặc app xuống trước bằng shell script hoặc app deployment |
| Sửa profile nhưng máy không nhận | Giá trị cũ vẫn còn | Đổi Payload Identifier khi sửa, Mac coi là profile mới | Giữ nguyên Identifier, chỉ sửa nội dung rồi upload lại |

## Kết luận

Intune có thể chưa sâu bằng Jamf hay Kandji ở mảng macOS, nhưng với iMazing Profile Editor, gần như mọi payload Apple hỗ trợ đều có thể đưa lên Intune qua Custom profile. Quy trình đơn giản: kiểm tra Settings catalog trước, chỉ dùng Custom profile cho phần còn thiếu, và luôn thử trên nhóm pilot. Bạn có thể bắt đầu bằng một profile nhỏ, như cố định Dock hoặc hiện icon trên menu bar, để quen với quy trình.

Bạn đang quản lý MacBook bằng Intune hay một MDM chuyên cho Apple, và setting nào bạn thấy Intune còn thiếu nhất?

<!--
Phần cuối bài (nút Chia sẻ LinkedIn, Facebook, Copy link, khung tác giả, bài trước/sau)
và Mục lục bên phải được layout tự thêm vào, không cần viết trong file này.
Xem trước trên máy: bundle exec jekyll serve --unpublished (chỉ cần khi bài còn published: false).
-->
