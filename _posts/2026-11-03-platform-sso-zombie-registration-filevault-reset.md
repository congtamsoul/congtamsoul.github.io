---
layout: post
title: "Platform SSO \"zombie registration\": reset password bằng FileVault Recovery Key làm hỏng SSO toàn bộ M365 trên Mac"
seo_title: "Platform SSO lỗi sau khi reset password bằng FileVault"
description: "Reset password macOS bằng FileVault Recovery Key khiến Platform SSO rơi vào zombie registration, lỗi -25300, toàn bộ app M365 mất SSO. Root cause và cách xử lý."
date: 2026-11-03
author: "Tam Nguyen"
reading_time: 9
topic: macos
thumb_label: "MACOS · PLATFORM SSO"
image: /images/photo/6.jpg
tags:
  - macOS
  - Intune
  - Platform SSO
  - Microsoft Entra ID
  - Troubleshooting
card_tags:
  - macOS
  - Platform SSO
summary: "Một lần reset password bằng FileVault Recovery Key làm Teams, Outlook, Company Portal cùng mất SSO. Đây là root cause thật và cách đưa máy về bình thường."
redirect_from:
  - /posts/platform-sso-zombie-registration-filevault-reset.html
---

Một buổi sáng, ticket gửi lên rất ngắn: *"Sau khi reset password MacBook, em không đăng nhập được Teams, Outlook, Company Portal. Web thì vẫn vào bình thường."* User quên password local, helpdesk đã dùng **FileVault Recovery Key** để đặt password mới. Máy mở lên được, nhưng mọi app Microsoft 365 trên desktop đồng loạt báo lỗi. Môi trường của mình là MacBook corporate enroll qua Automated Device Enrollment, quản lý bằng Intune, dùng **Platform SSO (PSSO)** với phương thức `UserSecureEnclaveKey`, kèm Kerberos SSO extension cho tài nguyên on-prem.

> **Tóm tắt nhanh:** Reset password bằng FileVault Recovery Key làm login keychain cũ không mở được. Dữ liệu đăng ký và SSO token của PSSO nằm trong keychain đó, nên máy rơi vào trạng thái *zombie registration*: Entra vẫn thấy thiết bị đã đăng ký, nhưng máy không còn lấy được token (log lỗi `-25300`). Cách xử lý: thử **Repair** PSSO trước; nếu không được, **exclude rồi assign lại** profile PSSO trong Intune để buộc máy đăng ký lại từ đầu.

## Triệu chứng: mọi app M365 "chết" cùng lúc

Điểm đặc trưng là lỗi không nằm ở một app, mà ở **tất cả app dùng chung broker SSO**:

| Ứng dụng | Hiện tượng |
|---|---|
| Microsoft Teams | `Something went wrong`, không đăng nhập được |
| Company Portal | `Company Portal temporarily unavailable` |
| Outlook, Excel, Word | Liên tục hỏi đăng nhập rồi thất bại |
| Trình duyệt (web M365) | **Vẫn đăng nhập bình thường** |
| Kerberos SSO extension | Vẫn báo signed in, network và credential OK |

Web vẫn chạy và Kerberos vẫn ổn nghĩa là **mạng, tài khoản Entra và credential AD đều không có vấn đề**. Thứ hỏng nằm ở luồng SSO trên chính chiếc Mac.

## Bối cảnh: keychain, Secure Enclave và PSSO liên quan gì nhau

Để hiểu lỗi, cần nắm 3 mảnh ghép:

- **Login keychain** — được mã hóa bằng chính *password đăng nhập macOS*. Bình thường hai password này luôn trùng nhau, nên keychain tự mở khi user login.
- **FileVault Recovery Key** — mở khóa ổ đĩa và cho phép đặt password mới, nhưng **không biết password cũ**. Vì vậy nó không thể giải mã lại login keychain.
- **Platform SSO với `UserSecureEnclaveKey`** — khóa ký nằm trong Secure Enclave, nhưng **trạng thái đăng ký phía user và SSO token được lưu trong keychain**. Password local *không* đồng bộ với password Entra.

Theo [tài liệu của Apple về keychain password](https://support.apple.com/guide/keychain-access/kyca2429/mac), khi password user và password keychain không còn khớp, keychain không tự mở. Nếu không nhập được password cũ, user chỉ còn cách để macOS tạo một keychain mới, trống.

### Chuyện gì xảy ra khi reset bằng Recovery Key

1. macOS đổi password đăng nhập, nhưng login keychain vẫn khóa bằng password cũ.
2. Keychain cũ bị đổi tên thành `login_renamed_1.keychain-db`, một `login.keychain-db` mới, rỗng được tạo ra.
3. Dữ liệu đăng ký và token của PSSO, khóa Workplace Join, MSAL cache đều nằm lại trong keychain cũ.
4. PSSO vẫn có `registrationCompleted: true`, Entra vẫn thấy device đã đăng ký, nhưng máy **không tìm thấy** dữ liệu cần thiết để lấy token.

Đó chính là **zombie registration**: còn "xác" đăng ký, nhưng không còn "hồn" để xác thực.

## Bằng chứng trong log: lỗi `-25300`

Mình thu log Platform SSO trong lúc lỗi và lọc theo mã `-25300`. Kết quả có **55 dòng**, trong đó 54 dòng thuộc luồng PSSO:

| Message | Số dòng | Thành phần |
|---|---:|---|
| `Keychain entry not found` | 27 | `POKeychainHelper` |
| `SSO Tokens not found on keychain` | 23 | `POConfigurationManager` |
| `Error retrieving tokens for token received` | 3 | `POConfigurationManager` |
| `SSO tokens not found.` | 1 | `POConfigurationManager` |
| `Removing keychain entry returned -25300` | 1 | `KerberosExtension` |

`-25300` là `errSecItemNotFound`, nghĩa là **truy vấn keychain không tìm thấy item phù hợp**. Nó không có nghĩa keychain bị khóa hay Secure Enclave hỏng, mà là PSSO không thấy token của mình trong keychain hiện tại. Khớp hoàn toàn với kịch bản ở trên.

Lệnh `app-sso platform -s` cho thêm một bằng chứng quan trọng:

```json
"loginType"          : "POLoginTypeUserSecureEnclaveKey (2)",
"lastLoginDate"      : "2026-08-20T13:42:34Z",
"loginFrequency"     : 64800,
"offlineGracePeriod" : "0 hours"
```

Policy yêu cầu xác thực lại mỗi **18 giờ** (`64800` giây), nhưng lần login PSSO thành công gần nhất cách đó **33 ngày**. Thiết bị đã mất khả năng làm mới token suốt hơn một tháng, chỉ là user chưa để ý cho tới khi mọi thứ hết hạn.

### Lệnh thu log để tự kiểm tra

Chạy bằng user bị ảnh hưởng, **không dùng `sudo`**:

```bash
# Trạng thái đăng ký Platform SSO
app-sso platform -s | grep -iE "registrationCompleted|state|lastLoginDate|loginType"

# Keychain hiện có, tìm file login_renamed_* 
ls -la ~/Library/Keychains/

# Đếm lỗi -25300 trong unified log 1 giờ gần nhất
log show --last 1h --predicate 'subsystem == "com.apple.AppSSO"' --info | grep -c -- "-25300"
```

## Cách xử lý: từ nhẹ đến mạnh

### Cách 1: User còn nhớ password cũ

Đây là trường hợp tốt nhất, không mất gì cả. Khi macOS hỏi password keychain, nhập **password local trước khi reset**. Hoặc đồng bộ thủ công:

```bash
# Nhập password cũ trước, sau đó password mới
security set-keychain-password ~/Library/Keychains/login.keychain-db
```

Lưu ý: nếu file cũ đã thành `login_renamed_1`, bạn đang nhập password cũ cho keychain **mới**, nên sẽ luôn báo sai. Khi đó dùng **Keychain Access → File → Add Keychain**, chọn file `login_renamed_1.keychain-db` rồi unlock bằng password cũ.

### Cách 2: Repair Platform SSO ngay trên máy

Trên macOS 14 trở lên:

1. Mở **System Settings → Users & Groups → Network Account Server**.
2. Bấm **Edit**, rồi **Repair**.
3. User đi lại luồng đăng ký (đăng nhập Entra và MFA).

Kiểm tra lại bằng `app-sso platform -s`: `lastLoginDate` phải nhảy sang thời điểm hiện tại.

### Cách 3: Exclude rồi assign lại profile PSSO trong Intune

Đây là cách mình đã **kiểm chứng thành công** trên máy bị lỗi khi Repair không đủ, vì `app-sso platform --register` không làm gì nếu máy "nghĩ" mình vẫn đang registered.

1. Tạo một group tạm, thêm thiết bị lỗi vào.
2. Trong Intune, mở profile **Platform SSO** → **Assignments** → thêm group tạm vào **Excluded groups**. Nếu máy có cert Wi-Fi kênh User, làm tương tự với profile cert.
3. Trên Mac: **Company Portal → Check status** để sync. Xác nhận profile đã gỡ:
   ```bash
   profiles list -all | grep -i "extensiblesso\|platform"
   ```
4. **Restart** máy.
5. Gỡ thiết bị khỏi group exclude, sync lại.
6. Hoàn tất popup đăng ký Platform SSO bằng tài khoản Entra.

<div class="callout warn">
  <span>⚠️</span>
  <div><b>Lưu ý</b>Không chọn <code>Reset Default Keychains</code> hay xóa file <code>login_renamed_*</code> khi chưa backup. Keychain cũ còn chứa mật khẩu Wi-Fi, certificate cá nhân và credential khác. Nếu sau này user nhớ ra password cũ, đó là đường duy nhất để lấy lại dữ liệu.</div>
</div>

## So sánh các cách reset password local

| Cách reset | Keychain cũ | PSSO sau reset | Ghi chú |
|---|---|---|---|
| User tự đổi trong **System Settings** (biết password cũ) | Được re-encrypt | Bình thường | Luồng chuẩn, nên hướng dẫn user dùng |
| **FileVault Recovery Key** | Không mở được, bị đổi tên | Zombie registration | Nên rotate Recovery Key sau khi dùng |
| Admin (LAPS) reset qua `sysadminctl` | Không mở được | Zombie registration | Cần admin có **Secure Token**, không lộ Recovery Key |
| Máy **không** có PSSO, reset bằng Recovery Key | Không mở được | Không áp dụng | App 365 hỏi đăng nhập lại, nhưng xác thực thành công |

Dòng cuối là kết quả mình test đối chứng: không có PSSO thì reset password chỉ gây phiền (đăng nhập lại), còn có PSSO thì **xác thực thất bại** cho tới khi đăng ký lại.

## Những lỗi mình đã gặp

- **Nghĩ rằng "password mã hóa" là một password khác** — keychain dùng đúng chuỗi password đăng nhập. Nhập password cũ mà vẫn báo sai thường do đang nhập vào keychain mới, hoặc bộ gõ Telex đang bật làm biến đổi ký tự. Chuyển sang bàn phím **ABC** trước khi nhập.
- **Chạy `app-sso platform --register` và chờ phép màu** — lệnh không làm gì vì máy vẫn thấy `registrationCompleted: true`. Phải gỡ profile để xóa trạng thái đăng ký cũ.
- **Tưởng thêm setting trong profile PSSO sẽ ngăn được lỗi** — không có setting nào trong profile chặn được việc mất keychain khi reset bằng Recovery Key. Đổi sang phương thức `Password` chỉ để né lỗi là thay đổi cả mô hình xác thực, không phải bản sửa.
- **Quên cert Wi-Fi kênh User** — cert SCEP/PKCS kênh User nằm trong login keychain, nên cũng mất private key. Sau khi sửa PSSO, user vẫn không vào được Wi-Fi 802.1X cho tới khi cấp lại cert. Cân nhắc chuyển cert Wi-Fi sang kênh Device.

<div class="callout">
  <span>💡</span>
  <div><b>Tip</b>Đưa bước kiểm tra <code>app-sso platform -s</code> và cấp lại cert Wi-Fi vào SOP reset password của helpdesk. Một lần reset bằng Recovery Key luôn đi kèm một lần "đăng ký lại PSSO".</div>
</div>

## Kết luận

Platform SSO với Secure Enclave rất tiện: user mở máy bằng Touch ID là có SSO cho mọi app M365. Nhưng chính vì ít khi gõ password local, user **dễ quên nó**, và mỗi lần helpdesk phải reset bằng FileVault Recovery Key là một lần máy rơi vào zombie registration. Lỗi này là hệ quả của cách macOS bảo vệ keychain, không phải do cấu hình Intune sai.

Việc nên làm ngay: viết runbook gồm 3 bước *Repair → exclude/assign lại PSSO → cấp lại cert*, và hướng dẫn user đổi password qua System Settings khi còn nhớ password cũ.

Bạn đã gặp zombie registration trên Mac chưa, và team bạn xử lý bằng Repair hay redeploy profile? Chia sẻ ở phần bình luận nhé.
