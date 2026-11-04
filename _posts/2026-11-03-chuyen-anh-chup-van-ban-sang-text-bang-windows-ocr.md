---
layout: post
title: "Chuyển toàn bộ ảnh chụp văn bản trong một folder sang text bằng OCR có sẵn của Windows"
seo_title: "OCR hàng loạt ảnh sang text bằng PowerShell"
description: "Dùng PowerShell và Windows.Media.Ocr có sẵn trong Windows để chuyển hàng loạt ảnh chụp văn bản sang file text, không cần cài thêm phần mềm. Kèm script và các lỗi thường gặp."
date: 2026-11-03
author: "Tam Nguyen"
reading_time: 7
topic: windows
thumb_label: "WINDOWS · POWERSHELL"
image: /images/photo/8.jpg
tags:
  - Windows
  - PowerShell
  - OCR
  - Automation
card_tags:
  - PowerShell
  - OCR
summary: "Một script PowerShell dùng OCR có sẵn của Windows để biến cả folder ảnh chụp văn bản thành file text, không cần cài thêm gì."
redirect_from:
  - /posts/chuyen-anh-chup-van-ban-sang-text-bang-windows-ocr.html
---

Có những lúc mình có cả chục ảnh chụp văn bản, tài liệu, slide hoặc ghi chép trên giấy nhưng không muốn gõ lại từng dòng. Cách nhanh nhất là chụp lại màn hình hoặc quét tài liệu thành ảnh. Kết quả là một folder với nhiều file `IMG_0001.JPG`, `IMG_0002.JPG`... Gõ lại bằng tay thì mất thời gian và dễ sai. Bài này hướng dẫn chuyển cả folder ảnh sang text bằng **OCR có sẵn trong Windows 10/11**, chỉ với một script PowerShell, không cần cài phần mềm hay gửi tài liệu lên dịch vụ bên ngoài.

> **Tóm tắt nhanh:** Windows có sẵn bộ OCR `Windows.Media.Ocr`, gọi được từ **Windows PowerShell 5.1**. Script bên dưới duyệt mọi ảnh `.jpg/.jpeg/.png` trong folder, tạo một file `.txt` cho từng ảnh và một file `_ALL_TEXT.txt` gộp tất cả theo thứ tự tên file. OCR không giữ nguyên bố cục, nên bạn vẫn cần kiểm tra và định dạng lại nội dung sau khi chuyển.

## Bối cảnh: vì sao chọn OCR có sẵn của Windows

Có nhiều cách để lấy chữ từ ảnh, nhưng mình cần một cách thỏa 3 điều kiện:

- **Không cài thêm phần mềm** — máy công ty thường bị chặn cài đặt, xin quyền mất thời gian.
- **Xử lý hàng loạt** — chạy một lần cho cả folder, không phải mở từng ảnh.
- **Dữ liệu không rời khỏi máy** — ảnh chụp tài liệu nội bộ không nên đưa lên một trang OCR miễn phí trên mạng.

Từ Windows 10, Microsoft cung cấp API [Windows.Media.Ocr](https://learn.microsoft.com/uwp/api/windows.media.ocr) chạy hoàn toàn offline, dùng language pack đã cài trên máy. API này là WinRT, nhưng Windows PowerShell 5.1 gọi được trực tiếp, nên đáp ứng đủ cả 3 điều kiện.

## So sánh các cách chuyển ảnh sang text

| Cách | Hàng loạt | Giữ thụt dòng | Cài thêm | Phù hợp khi |
|---|---|---|---|---|
| **Script PowerShell + Windows OCR** | Có | Không | Không | Nhiều ảnh, dữ liệu nội bộ |
| PowerToys Text Extractor (`Win+Shift+T`) | Không | Không | PowerToys | Lấy nhanh text đang hiện trên màn hình |
| Snipping Tool → *Text Actions* | Không | Một phần | Không (Windows 11) | Chụp và copy từng vùng |
| Copilot / mô hình AI đọc ảnh | Theo lô nhỏ | Có | Không | Cần độ chính xác cao, nội dung phải dùng được ngay |
| Tesseract OCR | Có | Không | Có | Cần tùy biến sâu, chạy trên Linux |

Nếu ảnh chụp màn hình bằng điện thoại (nghiêng, chữ nhỏ, có thanh Dock), Windows OCR sẽ cho bản nháp khá tốt, nhưng bạn vẫn phải rà lại. Script này giúp bạn bỏ được phần gõ lại tốn thời gian nhất.

## Cách script hoạt động

Mỗi ảnh đi qua 5 bước, tất cả đều là lời gọi bất đồng bộ (async) của WinRT:

1. `StorageFile.GetFileFromPathAsync` — mở file ảnh.
2. `OpenAsync` — lấy stream đọc dữ liệu.
3. `BitmapDecoder.CreateAsync` — giải mã JPG/PNG.
4. `GetSoftwareBitmapAsync` — chuyển sang dạng bitmap mà OCR đọc được.
5. `OcrEngine.RecognizeAsync` — nhận dạng chữ và trả về từng dòng.

### Vì sao cần hàm `Await`

PowerShell không có từ khóa `await` như C#. Script dùng `WindowsRuntimeSystemExtensions.AsTask()` để đổi mỗi thao tác async của WinRT thành một `Task` của .NET, rồi gọi `.Wait()` để chờ kết quả. Hàm `Await` trong script gói phần này lại để dùng lại cho cả 5 bước.

## Script hoàn chỉnh

Đổi biến `$Folder` thành đường dẫn folder ảnh của bạn rồi chạy.

```powershell
$Folder = "E:\TaiLieu-Hinh-Anh"
$OutAll = Join-Path $Folder "_ALL_TEXT.txt"
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.IRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.SoftwareBitmap, Windows.Graphics, ContentType = WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime]
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($WinRtOp, [Type]$ResultType) {
    $task = $asTaskGeneric.MakeGenericMethod($ResultType).Invoke($null, @($WinRtOp))
    $task.Wait(-1) | Out-Null
    $task.Result
}
# OCR engine: ưu tiên en-US, fallback ngôn ngữ của user profile
$Engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new("en-US"))
if (-not $Engine) { $Engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages() }
if (-not $Engine) { throw "Không tạo được OCR engine. Cài English language pack (có OCR) trong Settings > Time & language > Language." }
Write-Host "OCR language: $($Engine.RecognizerLanguage.LanguageTag)" -ForegroundColor DarkCyan
"" | Set-Content $OutAll -Encoding UTF8
Get-ChildItem -Path "$Folder\*" -Include *.jpg,*.jpeg,*.png | Sort-Object Name | ForEach-Object {
    Write-Host "OCR: $($_.Name)" -ForegroundColor Cyan
    try {
        $file   = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($_.FullName)) ([Windows.Storage.StorageFile])
        $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
        $dec    = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
        $bmp    = Await ($dec.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
        $res    = Await ($Engine.RecognizeAsync($bmp)) ([Windows.Media.Ocr.OcrResult])
        $text   = ($res.Lines | ForEach-Object { $_.Text }) -join "`r`n"
        $text | Set-Content ([IO.Path]::ChangeExtension($_.FullName, ".txt")) -Encoding UTF8
        "`r`n# ===== $($_.Name) =====`r`n$text" | Add-Content $OutAll -Encoding UTF8
    }
    catch { Write-Host "   ERROR: $($_.Exception.Message)" -ForegroundColor Red }
    finally { if ($stream) { $stream.Dispose(); $stream = $null } }
}
Write-Host "DONE -> $OutAll" -ForegroundColor Green
```

### Cách chạy

1. Mở **Windows PowerShell** (`powershell.exe`), không dùng PowerShell 7 (`pwsh`).
2. Lưu script thành `OCR-Folder.ps1`, sửa `$Folder`.
3. Nếu bị chặn chạy script, cho phép tạm trong phiên hiện tại:
   ```powershell
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
   .\OCR-Folder.ps1
   ```
4. Mở `_ALL_TEXT.txt` trong Word, VS Code hoặc Notepad. Mỗi ảnh có một dòng đánh dấu `# ===== IMG_000x.JPG =====` để bạn biết đoạn text đến từ ảnh nào.

<div class="callout warn">
  <span>⚠️</span>
  <div><b>Lưu ý</b>Script chỉ chạy trên Windows PowerShell 5.1. PowerShell 7 dựa trên .NET mới, không còn nạp kiểu WinRT theo cú pháp <code>ContentType = WindowsRuntime</code>, nên sẽ báo lỗi ngay từ đầu.</div>
</div>

## Những lỗi mình đã gặp

Bản đầu tiên của script chạy lỗi liên tục. Đây là 2 lỗi chính và cách sửa:

- **`Unable to find type [Windows.Globalization.Language]`** — script chưa nạp kiểu WinRT này nên không tạo được `OcrEngine`. Biến `$Engine` bị null, mọi lệnh OCR phía sau đều hỏng. Cách sửa: thêm dòng nạp kiểu `[Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime]`, kèm `IRandomAccessStream` và `SoftwareBitmap`.
- **`Cannot convert ... Task`1[Windows.Storage.StorageFile] ... to type "System.Type"`** — lỗi này khó thấy nhất. Trong hàm `Await`, tham số tên `$T` được khai báo kiểu `[Type]`, còn bên trong lại có biến `$t` để giữ Task. **PowerShell không phân biệt chữ hoa, chữ thường trong tên biến**, nên `$t` và `$T` là một. Gán Task vào đó làm PowerShell cố đổi Task thành `Type` và báo lỗi. Các lỗi `null-valued expression` và `Invalid pointer` phía sau đều kéo theo từ lỗi này. Cách sửa: đổi tên thành `$task`, `$WinRtOp`, `$ResultType`.
- **Một ảnh lỗi kéo theo cả vòng lặp** — bọc từng ảnh trong `try/catch/finally` để ảnh hỏng chỉ báo `ERROR` rồi chạy tiếp, đồng thời luôn đóng stream.

<div class="callout">
  <span>💡</span>
  <div><b>Tip</b>Khi debug script PowerShell, đừng đặt tên biến chỉ khác nhau ở chữ hoa, chữ thường. Lỗi kiểu này không báo đúng chỗ gây ra, mà hiện ra ở những dòng phía sau.</div>
</div>

## Mẹo để OCR chính xác hơn

Chất lượng ảnh quyết định phần lớn kết quả:

- **Chụp thẳng, lấp đầy khung bằng vùng văn bản** — ảnh nghiêng làm sai ký tự và bỏ sót dòng nhiều nhất.
- **Phóng to chữ** trên màn hình hoặc tài liệu trước khi chụp (`Ctrl` + `+`), dùng nền sáng nếu có thể.
- **Tránh chụp thanh Dock, taskbar, tiêu đề cửa sổ** — OCR sẽ đọc cả những phần đó.
- **Nếu nội dung đang hiển thị trên chính máy**, dùng Snipping Tool hoặc PowerToys Text Extractor thay vì chụp bằng điện thoại.
- Sau khi chuyển, kiểm tra kỹ các ký tự dễ nhầm: `0`/`O`, `1`/`l`/`I`, dấu chấm/ dấu phẩy, dấu câu, và các chữ số trong số điện thoại hoặc mã tài liệu.

## Kết luận

Với vài chục dòng PowerShell, bạn có một công cụ OCR hàng loạt chạy offline, không cần cài đặt và không đưa dữ liệu ra ngoài. Kết quả chưa thay thế được việc copy văn bản trực tiếp, vì OCR không giữ nguyên bố cục và vẫn nhầm một số ký tự, nhưng nó loại bỏ phần gõ lại tốn thời gian nhất.

Hãy thử với folder ảnh của bạn, rồi mở `_ALL_TEXT.txt` bằng Word hoặc VS Code để rà lại và định dạng nội dung. Bạn thường chuyển văn bản từ ảnh bằng cách nào, và đã gặp ký tự nào hay bị OCR đọc sai nhất? Chia sẻ ở phần bình luận nhé.
