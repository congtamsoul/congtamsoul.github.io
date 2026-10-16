---
# ===== HƯỚNG DẪN: copy cả file này, đổi tên file và sửa nội dung =====
# Tên file BẮT BUỘC theo dạng:  YYYY-MM-DD-slug-khong-dau.md   (ví dụ 2026-11-05-intune-autopilot-pre-provisioning.md)
# Xóa dòng "published: false" ở bài mới, nếu không bài sẽ không hiện trên site.
published: false

layout: post                       # giữ nguyên
title: "Tiêu đề bài viết: nêu rõ vấn đề hoặc kết quả"      # hiện ở đầu bài và trên card
seo_title: "Tiêu đề ngắn cho Google (≤ 60 ký tự)"         # tùy chọn; bỏ dòng này nếu muốn dùng title
description: "Mô tả 140-160 ký tự cho Google và khi chia sẻ lên Facebook/LinkedIn."
date: 2026-10-16                   # ngày đăng, phải trùng ngày trong tên file
author: "Tam Nguyen"
reading_time: 5                    # số phút đọc (khoảng 200 từ / phút)
topic: m365                        # m365 | windows | macos | security | dx | career  → quyết định mục và màu thumbnail
thumb_label: "MICROSOFT 365"       # chữ in trên thumbnail của card
tags:                              # hiện đầu bài
  - Microsoft 365
  - Intune
card_tags:                         # hiện trên card ở trang chủ (ngắn gọn, 1-2 tag)
  - Intune
summary: "Một câu tóm tắt hiện trên card ở trang chủ (≤ 160 ký tự)."
redirect_from:                     # đổi slug cho khớp tên file, bỏ ngày
  - /posts/mau-bai-viet-chuan.html
---

Đoạn mở bài: nêu một tình huống thật trong công việc để người đọc thấy vấn đề của chính họ. Nêu rõ quy mô môi trường (số thiết bị, license, ràng buộc) để tăng độ tin cậy. Mở bài không dùng tiêu đề `##`.

> **Tóm tắt nhanh:** câu trả lời ngắn gọn cho người đọc vội. Giữ trong 2-3 câu. Dòng này luôn đặt ngay sau mở bài.

## Bối cảnh: vì sao mình tìm hiểu chuyện này

Mỗi tiêu đề `##` sẽ tự động xuất hiện trong **Mục lục** ở cột bên phải, vì vậy hãy đặt tên ngắn, rõ nghĩa. Mỗi bài nên có 5-7 mục `##`.

Văn bản thường: viết **chữ đậm** để nhấn mạnh, *chữ nghiêng* cho thuật ngữ, và `code inline` cho tên lệnh, đường dẫn, tên setting. Link dùng cú pháp [chữ hiển thị](https://learn.microsoft.com).

### Tiêu đề con `###`

Dùng khi một mục lớn cần chia nhỏ. Mục `###` không xuất hiện trong Mục lục.

## Danh sách

Danh sách gạch đầu dòng, dùng khi các ý ngang hàng:

- Ý thứ nhất
- Ý thứ hai
- **Từ khóa** — giải thích ngắn gọn

Danh sách đánh số, dùng khi có thứ tự thực hiện:

1. Bước một
2. Bước hai
3. Bước ba

## Bảng so sánh

Dùng bảng khi so sánh nhiều đối tượng, dễ đọc hơn nhiều so với gạch đầu dòng dài.

| Cột 1 | Cột 2 | Ghi chú |
|---|---|---|
| Mục A | Giá trị A | Mô tả ngắn |
| Mục B | Giá trị B | Mô tả ngắn |
| Mục C | Giá trị C | Mô tả ngắn |

## Hình ảnh

Đặt ảnh vào thư mục `images/ten-bai-viet/` rồi chèn như sau. Phần `{: width="480"}` chỉnh chiều rộng ảnh (px), dòng ngay dưới là chú thích.

![Mô tả ảnh cho người dùng và Google](/images/ten-bai-viet/anh-1.jpg){: width="480"}
*Hình 1: chú thích ngắn cho ảnh.*

## Code và lệnh

Mỗi khối code tự có nút **Copy** ở góc phải. Ghi tên ngôn ngữ sau ba dấu backtick (`powershell`, `bash`, `json`, `yaml`...).

```powershell
# Chú thích ngắn cho lệnh
Connect-MgGraph -Scopes "Organization.Read.All"
Get-MgSubscribedSku | Select-Object SkuPartNumber, ConsumedUnits
```

## Khung nhấn mạnh (callout)

Có 3 loại khung. Dùng tiết kiệm, tối đa 2-3 khung mỗi bài.

<div class="callout">
  <span>💡</span>
  <div><b>Tip</b>Mẹo hữu ích hoặc thông tin bổ sung.</div>
</div>

<div class="callout warn">
  <span>⚠️</span>
  <div><b>Lưu ý</b>Cảnh báo về rủi ro, ví dụ: chạy thử trên nhóm pilot, ghi lại rollback plan.</div>
</div>

<div class="callout danger">
  <span>⛔</span>
  <div><b>Nguy hiểm</b>Thao tác không thể hoàn tác hoặc có thể làm mất dữ liệu.</div>
</div>

## Những lỗi mình đã gặp

- **Lỗi 1** — triệu chứng, nguyên nhân gốc, cách xử lý.
- **Lỗi 2** — kèm đoạn log thật, đã che thông tin nhạy cảm.
- **Lỗi 3** — cách phòng tránh cho lần sau.

## Kết luận

Chốt lại bằng 3-4 câu và một hành động cụ thể người đọc nên làm tiếp. Kết bài bằng một câu hỏi mở để khuyến khích bình luận và kết nối.

<!--
Phần cuối bài (nút Chia sẻ LinkedIn, Facebook, Copy link, khung tác giả, bài trước/sau)
và Mục lục bên phải được layout tự thêm vào, không cần viết trong file này.
Xem trước trên máy: bundle exec jekyll serve --unpublished (chỉ cần khi bài còn published: false).
-->
