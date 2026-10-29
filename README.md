# congtamsoul — Personal Tech Blog

Blog cá nhân (GitHub Pages + Jekyll) về Microsoft 365, Windows, macOS, endpoint security,
chuyển đổi số và phát triển bản thân. Bài viết viết bằng Markdown.

## Cấu trúc

```
├── _config.yml             # Cấu hình Jekyll (url, permalink /posts/:title/, plugin)
├── _layouts/
│   ├── default.html        # <head>, SEO/OG/JSON-LD, header, footer, script
│   ├── post.html           # Bố cục bài viết: tag, byline, TOC, share, author box, bài trước/sau
│   └── topic.html          # Trang liệt kê bài theo chủ đề
├── _includes/
│   ├── header.html
│   ├── footer.html
│   ├── post-card.html      # Card bài viết (trang chủ + trang chủ đề)
│   ├── post-nav.html       # Link bài cũ hơn / mới hơn cuối bài
│   └── post-date.html      # Định dạng ngày "03 Th10, 2026"
├── _data/topics.yml        # Danh sách 6 chủ đề (key, tên, icon, mô tả)
├── topics/<key>.html       # Mỗi chủ đề một trang: /topics/<key>/
├── _posts/
│   └── YYYY-MM-DD-slug.md  # Mỗi bài một file Markdown
├── assets/
│   ├── styles.css
│   └── main.js             # Theme toggle, mobile nav, filter, TOC, progress bar, nút Copy
├── images/<slug>/          # Ảnh của từng bài (tạo khi cần)
└── index.html              # Trang chủ, card bài viết tự sinh từ _posts
```

## Viết bài mới

Tạo `_posts/YYYY-MM-DD-ten-bai-viet.md` rồi commit/push. Front matter:

```yaml
---
layout: post
title: "Tiêu đề bài viết"
description: "Mô tả SEO (meta description)"
date: 2026-10-03
author: "Nguyễn Công Tâm"
reading_time: 6               # số phút đọc, hiển thị ở byline và card
topic: career                 # m365 | windows | macos | security | career | dx (dùng cho bộ lọc)
thumb_label: "AI"             # chữ trên thumbnail card (mặc định theo topic)
tags:                         # tag ở đầu bài
  - Career
  - AI
card_tags:                    # tuỳ chọn: tag ở card trang chủ (mặc định = tags)
  - AI
summary: "Mô tả ngắn ở card"   # tuỳ chọn (mặc định = description)
seo_title: "..."              # tuỳ chọn: <title>/og:title khác với tiêu đề bài
---
```

- Mục lục bên phải tự sinh từ các heading `##`.
- Ảnh: `![mô tả]({{ '/images/ten-bai-viet/anh-01.png' | relative_url }})`.
- Callout dùng HTML trực tiếp trong Markdown:

```html
<div class="callout warn">
  <span>⚠️</span>
  <div><b>Lưu ý</b>Nội dung callout.</div>
</div>
```

  Class: `callout`, `callout warn`, `callout danger`.
- Bài mới có ngày trong tương lai sẽ không được build.
- Danh sách bài sắp xếp theo `date` từ mới đến cũ. Nếu có nhiều bài cùng ngày, thêm giờ (`date: 2026-10-03 14:30`) để xác định bài nào mới hơn.
- Muốn thêm chủ đề mới: thêm vào `_data/topics.yml` và tạo `topics/<key>.html` (copy từ file có sẵn).

## Chạy thử local

```bash
gem install bundler jekyll
jekyll serve
# mở http://localhost:4000
```

## Deploy

Settings → Pages → Source: Deploy from a branch → `main` / (root). GitHub Pages tự build Jekyll khi push.

## Bình luận, lượt xem và feedback

- Bình luận dùng Giscus. Bật Discussions cho repository, cài ứng dụng Giscus, sau đó điền `repo_id` và `category_id` trong `_config.yml`. Mục bình luận chỉ hiện ở bài viết khi cả hai giá trị đã được cấu hình.
- Lượt xem dùng GoatCounter. Tạo site tại GoatCounter rồi đặt `domain` trong `_config.yml` (chỉ tên miền, ví dụ `ten-site.goatcounter.com`). GoatCounter sẽ ghi nhận lượt xem; lượt xem từng bài và danh sách 3 bài đọc nhiều nhất trang chủ lấy từ bộ đếm công khai.
- Thêm feedback thật vào `_data/testimonials.yml` theo mẫu dưới đây. Mục “Người đọc nói gì” chỉ hiển thị khi có nội dung và tối đa 3 lời chia sẻ.

```yaml
- quote: "Nội dung nhận xét đã được người gửi đồng ý công khai."
  name: "Tên người gửi"
  role: "Vai trò hoặc mối quan hệ"
```

## Cần thay trước khi public

- Thêm `og:image` (1200×630) để link đẹp khi share
