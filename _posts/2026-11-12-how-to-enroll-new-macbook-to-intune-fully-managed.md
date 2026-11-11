---
layout: post
title: "How to enroll MacBook mới vào Intune dạng Fully Managed qua Apple Business Manager"
seo_title: "Enroll MacBook mới vào Intune qua Apple Business Manager"
description: "Các bước enroll MacBook mới vào Intune dạng Fully Managed qua Apple Business Manager: Apple Configurator trên iOS, gán MDM server, Sync token và xử lý lỗi Failed to add Mac."
date: 2026-11-12
author: "Tam Nguyen"
reading_time: 5
topic: macos
thumb_label: "MACOS"
image: /images/photo/39.jpg
tags:
  - macOS
  - Intune
  - Apple Business Manager
card_tags:
  - macOS
  - Intune
summary: "Enroll MacBook mới vào Intune dạng Fully Managed qua ABM: iOS quét Mac, System Admin gán MDM server, Intune admin Sync token, rồi restart Mac."
redirect_from:
  - /posts/how-to-enroll-new-macbook-to-intune.html
---

Mỗi lần có MacBook mới, câu hỏi quen thuộc của team EUS là: "Máy này enroll vào Intune thế nào để thành máy công ty quản lý hoàn toàn?" Câu trả lời là enroll dạng **Fully Managed qua Apple Business Manager (ABM)**. Khác với Windows chỉ cần một máy, quy trình này **cần nhiều thiết bị cùng tương tác**: một thiết bị iOS của admin/EUS, chính chiếc MacBook cần enroll, cổng Apple Business Manager và Intune admin center. Mình viết lại các bước này thành hướng dẫn để ai trong team cũng làm theo được.

**Tóm tắt nhanh:** Dùng **Apple Configurator** trên iOS để quét màn hình setup của Mac và thêm máy vào ABM. System Admin gán MDM server trong ABM, Intune admin bấm **Sync** enrollment program token. Cuối cùng restart Mac là máy được thêm vào Intune.

## Điều kiện cần

Trước khi bắt đầu, cần chuẩn bị đủ 3 thứ:

- **Tài khoản Apple Business Manager** — thường là email công ty.
- **App Apple Configurator** — cài trên thiết bị iOS.
- **Quyền admin trên Intune** — để Sync enrollment program token.

Quy trình gồm 4 phần, mỗi phần do một vai trò thực hiện:

| Phần | Thực hiện trên | Người thực hiện |
|---|---|---|
| Chuẩn bị Apple Configurator | Thiết bị iOS | Admin / EUS |
| Thêm Mac vào ABM | MacBook + thiết bị iOS | Admin / EUS |
| Gán MDM server | Apple Business Manager | System Admin |
| Sync token và restart Mac | Intune admin center, MacBook | Intune admin; restart thì không cần quyền admin |

## Trên thiết bị iOS của admin/EUS

1. Cài app **Apple Configurator**.
2. Mở app → đăng nhập bằng **Apple ID do Apple Business Manager cấp** (thường là email công ty).
3. Vào **Settings** → kết nối thiết bị iOS với một **Wi-Fi hotspot khác mạng công ty**.
4. Bình thường, màn hình chính của app là màn hình **Scan**.

## Trên MacBook cần enroll

1. Bật MacBook.
2. Kết nối Wi-Fi và **Activate Mac** nếu máy yêu cầu.
3. Chọn ngôn ngữ: **English**.
4. **Để nguyên ở bước này, không bấm Continue.**
5. Trên thiết bị iOS ở phần trước, mở Apple Configurator, đặt sát MacBook.
6. Màn hình Mac tự hiện thông báo **Add this Mac to Your Organization**.
7. Dùng thiết bị iOS quét mã (trông giống một "đám mây hạt bụi") để thêm máy.
8. MacBook được thêm vào Apple Business Manager.

<div class="callout danger">
  <span>⛔</span>
  <div><b>Nguy hiểm</b>Sau khi Mac được thêm vào Apple Business Manager, để nguyên máy, <b>không Restart MacOS ở bước này</b>. Chỉ restart sau khi đã hoàn tất phần gán MDM server và Sync trên Intune.</div>
</div>

## Gán MDM server trên Apple Business Manager

Các bước dưới đây do **System Admin** thực hiện.

1. Mở [Apple Business Manager](https://business.apple.com/).
2. Vào **Devices** → **Search** → nhập **Serial Number**.
3. Kiểm tra trường **MDM Server**. Nếu máy chưa có MDM server, cần gán thủ công theo các bước tiếp theo. Nếu đã có, bỏ qua các bước 4–7.
4. Ở góc trên bên phải, bấm **…** → chọn **Edit MDM Server**.
5. Chọn MDM server của công ty → **Continue**.
6. **Confirm**.
7. **Close** → **Done**.

<div class="callout">
  <span>💡</span>
  <div><b>Tip</b>Luôn kiểm tra trường <code>MDM Server</code> trước. Nếu máy đã có MDM server, chuyển thẳng sang phần Sync trên Intune.</div>
</div>

## Sync token trên Intune và restart Mac

Các bước dưới đây do **Intune admin** thực hiện.

1. Vào `Devices` → `macOS` → `Enrollment` → `Enrollment program tokens`.
2. Chọn token MDM server của công ty.
3. Bấm **Sync**, chờ khoảng **2 phút** → **Refresh**. Portal sẽ hiện thiết bị mới.

## Những lỗi mình đã gặp

**Lỗi "Failed to add Mac"** — nếu Mac báo lỗi này, cần enroll lại thiết bị:

1. Bấm **Restart** trên màn hình lỗi.
2. **Activate Mac** → **Restart**.
3. Enroll lại từ bước đầu tiên trên MacBook.

## Kết luận

Enroll MacBook mới vào Intune qua ABM gồm 4 phần rõ ràng: iOS quét Mac vào ABM → System Admin gán MDM server → Intune admin Sync token → restart Mac. Hai điểm quan trọng nhất là **không bấm Continue** ở màn hình chọn ngôn ngữ và **không restart Mac** trước khi Sync xong. Việc tiếp theo bạn nên làm: lưu hướng dẫn này cho team EUS và thống nhất ai là người xác nhận đã Sync trước khi restart máy.

Team bạn đang enroll MacBook theo cách nào? Bạn đã từng gặp lỗi "Failed to add Mac" chưa? Chia sẻ ở phần bình luận nhé!

<!--
Phần cuối bài (nút Chia sẻ LinkedIn, Facebook, Copy link, khung tác giả, bài trước/sau)
và Mục lục bên phải được layout tự thêm vào, không cần viết trong file này.
Xem trước trên máy: bundle exec jekyll serve --unpublished (chỉ cần khi bài còn published: false).
-->
