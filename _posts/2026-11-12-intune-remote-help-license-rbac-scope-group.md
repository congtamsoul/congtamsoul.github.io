---
layout: post
title: "Intune Remote Help: license, RBAC tối thiểu, Scope Group và quyền — triển khai thực tế từ A đến Z"
seo_title: "Intune Remote Help: License, RBAC và Scope Group"
description: "Triển khai Intune Remote Help với EMS E3: kiểm tra license, enable tenant, tạo Intune role tối thiểu, cấu hình Scope Group, deploy app và 2 cách bắt đầu phiên hỗ trợ."
date: 2026-11-12
author: "Tam Nguyen"
reading_time: 9
topic: m365
thumb_label: "INTUNE"
image: /images/photo/40.jpg
tags:
  - Microsoft 365
  - Intune
  - Remote Help
  - RBAC
card_tags:
  - Intune
  - Remote Help
summary: "License EMS E3, role Intune tối thiểu, Scope Group đúng và app trên cả 2 máy: 4 điều kiện để Intune Remote Help chạy được ngay lần đầu."
redirect_from:
  - /posts/intune-remote-help-license-rbac-scope-group.html
---

Helpdesk gọi điện: *"Anh ơi, em không mở được file, anh vô máy em xem giúp."* Bạn mở Intune, bấm **Begin a remote assistance session**, máy user hiện thông báo, user bấm Allow… rồi màn hình cứ xoay **Connecting** mãi và báo lỗi thiếu quyền. Đó chính là trải nghiệm của mình khi pilot **Intune Remote Help** cho một môi trường vài nghìn thiết bị Windows và macBook, toàn bộ user dùng license **EMS E3**, quyền Intune được quản lý tập trung bởi team global và chia theo *scope tag* từng quốc gia. Tính năng thì đã enable, role cũng đã tạo, nhưng phải mất vài vòng ticket mới connect được phiên đầu tiên.

**Tóm tắt nhanh:** Remote Help chỉ chạy khi đủ 4 điều kiện: **(1)** cả IT (helper) và user (sharer) đều có license bao gồm Remote Help (EMS E3 đã có sẵn), **(2)** Remote Help được enable ở Tenant admin, **(3)** IT được gán Intune role có đủ quyền tối thiểu, với Scope Group chứa cả IT và user cần hỗ trợ, **(4)** app Remote Help được cài trên cả máy IT và máy user. Thiếu bất kỳ điều kiện nào, phiên sẽ không kết nối được.

## Bối cảnh: vì sao mình tìm hiểu

Trước đây helpdesk dùng công cụ remote của bên thứ ba. Mỗi lần cần hỗ trợ thì phải đọc ID/password qua điện thoại, khó kiểm soát ai đã vào máy nào, và không gắn với danh tính Entra ID. Remote Help giải quyết được các vấn đề đó:

- **Xác thực bằng Entra ID** — cả helper và sharer đều phải đăng nhập bằng tài khoản công ty, không hỗ trợ được người ngoài tenant.
- **RBAC của Intune** — quy định ai được hỗ trợ ai, và được làm gì (chỉ xem, điều khiển, hay elevation).
- **Cảnh báo compliance** — helper thấy cảnh báo nếu máy user đang non-compliant trước khi kết nối.
- **Audit** — xem lịch sử phiên trong Intune và audit log.

Theo [tài liệu Microsoft](https://learn.microsoft.com/en-us/intune/remote-help/), Remote Help mặc định **không được enable** cho tenant, và khi bật thì áp dụng cho toàn tenant. Phần phân quyền chi tiết hoàn toàn nằm ở RBAC, nên đây là chỗ dễ sai nhất.

## Điều kiện 1: License cho cả IT và user

Đây là điều kiện hay bị bỏ qua nhất: **license phải có ở cả hai phía**, không chỉ user được hỗ trợ.

| Đối tượng | Vai trò trong phiên | Yêu cầu license |
|---|---|---|
| IT / Helpdesk | *Helper* — người hỗ trợ | Cần license có service plan Remote Help (EMS E3) |
| User | *Sharer* — người chia sẻ màn hình | Cần license có service plan Remote Help (EMS E3) |
| Tài khoản admin riêng (cloud-only) | Helper | **Cũng phải được gán license**, nếu không sẽ fail |

Trong tenant của mình, gói **Enterprise Mobility + Security E3** đã có sẵn service plan *Remote help* (inherited từ group license). Bảng so sánh gói Microsoft 365 cũng đánh dấu *Microsoft Intune Remote Help* có trong EMS E3.

<div class="callout">
  <span>💡</span>
  <div><b>Tip</b>Đừng chỉ dựa vào bảng so sánh. Hãy kiểm tra service plan thực tế trên chính tài khoản helper và user, vì cách đóng gói license có thể khác nhau theo hợp đồng và thay đổi theo thời gian.</div>
</div>

Kiểm tra nhanh bằng Microsoft Graph PowerShell:

```powershell
# Kiểm tra service plan Remote Help của 1 tài khoản (helper hoặc user)
Connect-MgGraph -Scopes "User.Read.All"
$upn = "helper.account@contoso.com"
Get-MgUserLicenseDetail -UserId $upn |
    Select-Object -ExpandProperty ServicePlans |
    Where-Object { $_.ServicePlanName -match "REMOTE" } |
    Select-Object ServicePlanName, ProvisioningStatus
```

Nếu kết quả trống hoặc `ProvisioningStatus` không phải `Success`, tài khoản đó chưa dùng được Remote Help. Lưu ý: license mới gán có thể mất từ **30 phút đến 8 giờ** mới có hiệu lực ([Microsoft Learn](https://learn.microsoft.com/en-us/intune/remote-help/deploy)).

## Điều kiện 2: Enable Remote Help ở Tenant admin

1. Vào **Intune admin center** → `Tenant administration` → `Remote Help`.
2. Chọn tab **Settings** → **Configure**.
3. `Enable Remote Help` = **Enabled**.
4. `Allow Remote Help to unenrolled devices` = để **Disabled**, trừ khi có nhu cầu được phê duyệt.
5. `Disable chat` = tùy chính sách (mặc định chat được bật).
6. **Save**.

Ở môi trường nhiều quốc gia dùng chung tenant, bước này thường do team global thực hiện. Bạn chỉ cần xác nhận trạng thái **Enabled** là được.

## Điều kiện 3: Intune role tối thiểu và Scope Group

Đây là phần quyết định phiên có kết nối được hay không. Thay vì dùng role rộng như *Intune Administrator* hay role quản trị quốc gia, hãy tạo **custom role** chỉ dành cho Remote Help.

### Tạo custom role

`Tenant administration` → `Roles` → `All roles` → **Create** → *Intune role*.

| Nhóm quyền | Quyền | Giá trị | Ghi chú |
|---|---|---|---|
| Remote Help app | `View screen` | Yes | Chỉ xem màn hình user |
| Remote Help app | `Take full control` | Yes | Điều khiển chuột/bàn phím, user vẫn phải đồng ý |
| Remote Help app | `Elevation` | Yes / No | Cho phép thao tác trên UAC prompt. Chỉ bật khi đã được Security duyệt |
| Remote assistance connectors | `Read` | **Yes** | **Bắt buộc** — để helper kiểm tra Remote Help đã được cấu hình cho tenant |
| Remote tasks | `Offer remote assistance` | **Yes** | **Bắt buộc** — để helper bắt đầu phiên hỗ trợ |

Hai dòng cuối là hai quyền mình bị thiếu ở lần test đầu: role ban đầu chỉ có 3 quyền nhóm *Remote Help app*, kết quả là phiên luôn fail.

<div class="callout warn">
  <span>⚠️</span>
  <div><b>Lưu ý</b>Nếu helper bắt đầu phiên từ trang thiết bị trong Intune (cách 1 bên dưới), helper cũng phải <b>thấy được thiết bị</b> trong portal. Nếu tài khoản helper chỉ có duy nhất role này, hãy kiểm tra thêm quyền đọc thiết bị (<code>Managed devices</code> → <code>Read</code>). Quyền Elevation cho phép helper thao tác với quyền admin trên máy user, chỉ bật khi đã có phê duyệt của Security.</div>
</div>

### Assignment: Members, Scope Groups, Scope tags

Trong tab **Assignments** của role, có 3 phần cần hiểu đúng:

| Thành phần | Ý nghĩa | Cấu hình khuyến nghị |
|---|---|---|
| **Members (Groups)** | Ai được dùng role này (helper) | Group IT: helpdesk, EUS, system team. Ví dụ `RH-Helpers-IT` |
| **Scope Groups** | Role được áp dụng lên user/thiết bị nào | Group chứa **tất cả IT và user có EMS E3** nằm trong danh sách cần hỗ trợ. Ví dụ `RH-Scope-EMS-E3` |
| **Scope tags** | Giới hạn đối tượng Intune theo tag | Tag của quốc gia/đơn vị bạn quản lý, phải khớp với tag của thiết bị |

Vì sao Scope Group nên chứa **cả IT lẫn user**? Vì Remote Help kiểm tra quyền trên **người được hỗ trợ**: nếu user không nằm trong Scope Group của role, helper sẽ không có quyền với user đó dù license và role đều đúng. Đưa cả IT vào giúp các thành viên IT hỗ trợ lẫn nhau và test được ngay trên máy của team.

Cách làm thực tế: dùng group đang được gán license EMS E3 (group-based licensing) làm Scope Group. Như vậy user nào có license thì tự động nằm trong scope, không phải duy trì danh sách riêng.

```powershell
# Kiểm tra user cần hỗ trợ có nằm trong Scope Group không
Connect-MgGraph -Scopes "GroupMember.Read.All","User.Read.All"
$group = Get-MgGroup -Filter "displayName eq 'RH-Scope-EMS-E3'"
$user  = Get-MgUser -UserId "user.a@contoso.com"
Get-MgGroupMember -GroupId $group.Id -All |
    Where-Object { $_.Id -eq $user.Id } |
    ForEach-Object { "OK: user nằm trong Scope Group" }
```

## Điều kiện 4: Deploy app Remote Help cho máy IT và user

App Remote Help phải được cài trên **cả máy helper và máy sharer**. Với Windows, cách mình dùng là đóng gói *Win32 app*:

1. Tải installer từ `aka.ms/downloadremotehelp`, đổi tên thành `remotehelpinstaller.exe`.
2. Đóng gói bằng *Microsoft Win32 Content Prep Tool*:

```powershell
IntuneWinAppUtil.exe -c .\Input -s remotehelpinstaller.exe -o .\Output
```

3. Tạo app trong `Apps` → `Windows` → `Add` → *Windows app (Win32)* với cấu hình:

| Mục | Giá trị |
|---|---|
| Install command | `remotehelpinstaller.exe /quiet acceptTerms=1` |
| Uninstall command | `remotehelpinstaller.exe /uninstall /quiet acceptTerms=1` |
| Install behavior | System |
| Detection rule | File: `C:\Program Files\Remote Help` — `RemoteHelp.exe` — File or folder exists |
| Assignment | **Required** cho group IT và group user cần hỗ trợ |

Với macOS, tải gói `.pkg` Remote Help từ trang [Deploy Remote Help](https://learn.microsoft.com/en-us/intune/remote-help/deploy) và tạo app *macOS app (PKG)*. Ngoài ra, nếu tenant có *Enterprise App Catalog*, bạn có thể thêm Remote Help từ catalog thay vì tự đóng gói.

<div class="callout">
  <span>💡</span>
  <div><b>Tip</b>Assign app theo cùng group với Scope Group (ví dụ group license EMS E3). Như vậy "ai có license" = "ai trong scope" = "ai có app", tránh trường hợp user có quyền nhưng chưa có app.</div>
</div>

## 2 cách bắt đầu phiên Remote Help

### Cách 1: IT bấm remote action từ Intune

1. Vào `Devices` → `All devices` → chọn thiết bị của user.
2. Bấm `...` → `Remote actions` → **Begin a remote assistance session**.
3. Panel Remote Help hiện **Sent notification to user's device** → bấm **Open Remote Help** để mở app phía IT.
4. User nhận thông báo từ *Microsoft Intune Management Extension*, bấm **Open Remote Help**, kiểm tra thông tin helper (tên, công ty, domain đã xác minh) rồi chọn cho phép xem màn hình hoặc điều khiển.

Cách này nhanh vì user không phải nhập gì. Nếu máy user đang bật *Do not disturb*, thông báo có thể không hiện; khi đó hướng dẫn user tự mở app Remote Help hoặc kiểm tra Notification Center ([Microsoft Learn](https://learn.microsoft.com/en-us/intune/remote-help/start-session)).

### Cách 2: IT tạo security code, user nhập vào

1. IT mở app **Remote Help** trên máy mình, đăng nhập bằng tài khoản công ty.
2. Ở mục *Give help*, chọn **Get a security code**.
3. Gửi code cho user qua điện thoại hoặc Teams.
4. User mở app **Remote Help**, đăng nhập, nhập code ở mục *Get help* → **Submit**.
5. User kiểm tra thông tin helper và chọn **Allow** (xem màn hình hoặc điều khiển).

| Tiêu chí | Cách 1: Từ Intune | Cách 2: Security code |
|---|---|---|
| Người chủ động | IT | IT tạo code, user nhập |
| Thao tác của user | Bấm thông báo → Allow | Mở app → nhập code → Allow |
| Phù hợp khi | User không rành máy tính | Thông báo không hiện, hoặc IT không có quyền xem thiết bị trên portal |
| Yêu cầu thêm | Helper thấy được thiết bị trong Intune | Code chỉ có hiệu lực trong thời gian ngắn |

## Những lỗi mình đã gặp

**Lỗi 1: Bấm Allow xong vẫn "Connecting" rồi fail vì thiếu quyền.** Role ban đầu chỉ có 3 quyền nhóm *Remote Help app* (View screen, Take full control, Elevation). Nguyên nhân gốc: thiếu `Remote assistance connectors - Read` và `Remote tasks - Offer remote assistance`. Cách xử lý: bổ sung 2 quyền này vào custom role. Nếu role do team khác quản lý, hãy ghi rõ 2 quyền này trong ticket ngay từ đầu để đỡ mất một vòng phê duyệt.

**Lỗi 2: Tài khoản admin riêng không có license.** Mình dùng tài khoản admin cloud-only (dạng `xx-adm-...`) để làm helper, nhưng tài khoản này không được gán EMS E3, vì thói quen là tài khoản admin không cần license. Remote Help thì kiểm tra license của **cả helper**. Có 2 hướng: gán license cho tài khoản admin, hoặc cho IT dùng tài khoản thường (đã có license) và thêm tài khoản đó vào group Members của role.

**Lỗi 3: Scope Group chỉ có group test.** Khi tạo role assignment, Scope Group bắt buộc phải có ít nhất một group, nên ban đầu chỉ add tạm một group test. User thật không nằm trong group này nên không hỗ trợ được. Cách xử lý: thay bằng group license EMS E3 (chứa cả IT và user).

**Lỗi 4: Đổi quyền xong test ngay vẫn fail.** Thay đổi role, group, license cần thời gian để đồng bộ. Mình đã chờ đến hôm sau mới test lại. Cách phòng tránh: sau khi đổi cấu hình, đăng xuất và đăng nhập lại app Remote Help, chờ ít nhất 30 phút đến vài giờ trước khi kết luận cấu hình sai.

<div class="callout warn">
  <span>⚠️</span>
  <div><b>Lưu ý</b>Trước khi mở rộng, hãy chạy pilot với một nhóm nhỏ IT và user, ghi lại kết quả theo từng điều kiện (license, role, scope, app). Khi có lỗi, đối chiếu 4 điều kiện này sẽ nhanh hơn rất nhiều so với đọc log.</div>
</div>

## Kết luận

Intune Remote Help không khó, nhưng nó kiểm tra quyền ở nhiều lớp: **license ở cả hai phía**, **tenant đã enable**, **role đủ quyền tối thiểu với Scope Group đúng**, và **app có trên cả hai máy**. Nắm được 4 điều kiện này thì phiên đầu tiên sẽ connect được ngay, không mất vài vòng ticket như mình. Việc tiếp theo bạn nên làm: mở role Remote Help trong tenant của mình, kiểm tra đã có `Remote assistance connectors - Read` và `Remote tasks - Offer remote assistance` chưa, và Scope Group có thật sự chứa user cần hỗ trợ không.

Team bạn đang dùng Remote Help hay vẫn dùng công cụ remote bên thứ ba? Bạn có bật quyền Elevation cho helpdesk không? Chia sẻ ở phần bình luận nhé!

<!--
Phần cuối bài (nút Chia sẻ LinkedIn, Facebook, Copy link, khung tác giả, bài trước/sau)
và Mục lục bên phải được layout tự thêm vào, không cần viết trong file này.
Xem trước trên máy: bundle exec jekyll serve --unpublished (chỉ cần khi bài còn published: false).
-->
