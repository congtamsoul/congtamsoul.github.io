# tamnguyen.dev — Personal Tech Blog

Static site (HTML + CSS + JS thuần, không cần build tool) cho blog cá nhân về
Microsoft 365, Windows, macOS, endpoint security, chuyển đổi số và phát triển bản thân.

## Cấu trúc

```
tamnc-blog/
├── index.html              # Trang chủ: hero, danh sách bài, chủ đề, about, newsletter
├── assets/
│   ├── styles.css          # Toàn bộ style + design tokens (dark/light)
│   └── main.js             # Theme toggle, mobile nav, filter, TOC, progress bar
├── posts/
│   └── bai-viet-mau.html   # Template bài viết (copy file này cho mỗi bài mới)
└── README.md
```

## Chạy thử local

```bash
cd tamnc-blog
python3 -m http.server 8000
# mở http://localhost:8000
```

## Deploy miễn phí lên GitHub Pages

```bash
git init
git add .
git commit -m "init blog"
git branch -M main
git remote add origin https://github.com/<user>/<user>.github.io.git
git push -u origin main
```

Vào **Settings → Pages → Source: main / (root)**. Site chạy tại `https://<user>.github.io`.
Gắn domain riêng: thêm file `CNAME` chứa domain, rồi trỏ DNS về GitHub Pages.

Cách khác không cần Git: kéo thả cả thư mục vào <https://app.netlify.com/drop>.

## Viết bài mới

1. Copy `posts/bai-viet-mau.html` → `posts/ten-bai-viet.html` (slug không dấu, dùng gạch ngang).
2. Sửa `<title>`, `<meta name="description">`, `<link rel="canonical">`, JSON-LD.
3. Viết nội dung trong `<div class="prose">`. Mục lục tự sinh từ các thẻ `<h2>`.
4. Thêm một `<article class="post-card">` vào `index.html`, đặt đúng `data-cat`
   (`m365`, `windows`, `macos`, `security`, `career`, `dx`) để bộ lọc hoạt động.

## Cần thay trước khi public

- `your-handle` trong link LinkedIn / GitHub
- `hello@tamnguyen.dev` → email thật
- `https://tamnguyen.dev` trong canonical & Open Graph
- Endpoint form newsletter trong `main.js` (Buttondown / Substack / Mailchimp / Formspree)
- Thêm `og:image` (1200×630) để link đẹp khi share LinkedIn

## Thành phần có sẵn

| Component | Class |
|---|---|
| Card bài viết | `.post-card` + `.post-thumb.<m365\|win\|mac\|sec\|growth\|dx>` |
| Nút | `.btn.btn-primary`, `.btn.btn-ghost` |
| Chip lọc | `.chip` |
| Callout | `.callout`, `.callout.warn`, `.callout.danger` |
| Code block | `<pre><code>` (tự có nút Copy) |
| Trích dẫn | `<blockquote>` |
| Mục lục | `.toc` + `<ul id="tocList">` (tự sinh) |
