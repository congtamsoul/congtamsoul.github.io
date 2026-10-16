---
layout: post
title: "Windows Update trên ~2.000 máy: chuyện mình học được khi chuyển sang Intune Update Ring"
seo_title: "Windows Update trên 2.000 máy với Intune Update Ring"
description: "Cách dùng Windows Update for Business qua Intune để chia wave, bật Delivery Optimization và theo dõi báo cáo cho hơn 2.000 máy Windows, kèm những lỗi thực tế đã gặp."
date: 2026-10-16
author: "Tam Nguyen"
reading_time: 10
topic: m365
thumb_label: "MICROSOFT 365"
tags:
  - Microsoft 365
  - Intune
  - Windows Update
card_tags:
  - Intune
  - Windows Update
summary: "Chia máy thành nhiều wave, bật Delivery Optimization và theo dõi báo cáo để update không còn làm nghẽn mạng, máy được vá đúng hạn và người dùng ít bị làm phiền."
redirect_from:
  - /posts/windows-update-intune-update-ring.html
---

Sáng thứ Tư sau Patch Tuesday, đường truyền internet quốc tế của văn phòng bỗng chậm hẳn. Người dùng than Teams bị giật và mở SharePoint rất lâu. Bên Network nhìn biểu đồ thì thấy băng thông quốc tế tăng vọt, nhưng không biết chính xác traffic đó đến từ đâu. Cùng lúc, bên Security gửi danh sách máy vẫn chưa có bản vá tháng trước. Còn một số người dùng thì phàn nàn máy tự khởi động lại đúng lúc đang họp với khách hàng.

> **Tóm tắt nhanh:** chia máy thành nhiều wave, mỗi wave gắn một Update Ring riêng, bật Delivery Optimization để các máy chia sẻ bản cập nhật qua mạng LAN, và theo dõi tiến độ bằng báo cáo trên Intune. Nhờ vậy update không còn làm nghẽn mạng, máy được vá đúng hạn và người dùng ít bị làm phiền.

## Bối cảnh: ba vấn đề quen thuộc khi quản lý hàng nghìn máy

Nếu bạn quản lý vài trăm đến vài nghìn máy Windows, có lẽ bạn đã gặp ít nhất một trong ba vấn đề này: **update làm nghẽn mạng, máy không được vá đúng hạn, và người dùng bị làm phiền.**

Môi trường của mình là Home Credit Vietnam. Máy tính chia thành hai văn phòng chính và nhân viên làm việc ở hiện trường. Riêng văn phòng Phụ Nữ có khoảng 1.000 máy, văn phòng Hà Đô khoảng 800 máy, chưa tính các máy ở hiện trường. Cả hệ thống được quản lý bằng Microsoft Intune.

Bài này chia sẻ cách mình dùng Windows Update for Business qua Intune để quản lý update theo từng đợt, có kiểm soát và đo được kết quả.

## Windows Update for Business là gì?

Trước đây, việc update thường giống như "mở cổng cho tất cả cùng lúc". Mỗi máy tự lên Microsoft tải bản cập nhật, tự cài và tự khởi động lại. Với Intune, bạn quyết định được ba điều: **máy nào được update, update khi nào và update theo cách nào.**

Có ba loại chính sách bạn cần biết:

| Chính sách | Vai trò | Điểm đáng chú ý |
|---|---|---|
| Feature Update | Nâng cấp phiên bản Windows (23H2, 24H2, 25H2...) | "Chốt" phiên bản công ty muốn dùng, máy không tự nhảy lên bản mới khi IT chưa kiểm tra |
| Quality Update | Bản vá bảo mật hằng tháng | Có **Expedite** để ép máy cài ngay khi có lỗ hổng nghiêm trọng |
| Update Ring | Bộ luật điều phối | Số ngày hoãn, active hours, hạn chót, quyền tạm dừng, Pause / Resume / Uninstall |

**Feature Update** do Microsoft phát hành mỗi năm một lần. Chính sách này giữ máy ở đúng phiên bản bạn đã chọn.

**Quality Update** phát hành mỗi tháng. Tính năng đáng giá nhất là **Expedite**: nếu máy đang chạy bản vá cũ hơn mốc bạn chọn, Intune sẽ ép máy cài ngay mà không cần chờ chu kỳ bình thường. Khi có lỗ hổng nghiêm trọng, đây là "nút khẩn cấp" của bạn.

**Update Ring** là nơi bạn đặt số ngày hoãn update, giờ làm việc không được khởi động lại, hạn chót phải cài và việc người dùng có được tạm dừng update hay không. Bạn cũng có thể **Pause, Resume hoặc Uninstall** một bản update ngay trên Intune nếu phát hiện bản đó gây lỗi.

Ngoài ra còn có **Delivery Optimization**. Tính năng này cho phép một máy tải bản cập nhật từ cloud, sau đó các máy cùng mạng LAN chia sẻ cho nhau theo kiểu peer-to-peer. Nhờ vậy, không phải máy nào cũng phải ra internet tải lại cùng một file vài GB.

## Lợi ích thực tế

- **Không còn nghẽn mạng hàng loạt.** Máy được chia thành nhiều đợt (wave), kết hợp với Delivery Optimization nên lượng tải ra internet giảm đáng kể.
- **Phát hiện lỗi sớm.** Một nhóm nhỏ máy IT nhận bản update trước. Nếu có vấn đề, bạn có thể dừng lại trước khi ảnh hưởng đến hàng nghìn người dùng.
- **Người dùng ít bị làm phiền hơn.** Máy chỉ tự cài vào ngoài giờ làm việc và không tự khởi động lại trước hạn chót.
- **Có báo cáo rõ ràng.** Khi Security hỏi "bao nhiêu máy đã vá?", bạn có số liệu ngay trên Intune.

## Cách mình triển khai

**Điều kiện cần có:** thiết bị có license EMS (Enterprise Mobility + Security) và tài khoản của bạn có quyền admin trên Intune.

Mình chia máy theo nhóm AD hoặc Entra, mỗi nhóm gắn với một Update Ring riêng:

| Wave | Số máy | Hoãn Quality Update | Ghi chú |
|---|---|---|---|
| Wave 0 | 7 | 1 ngày | Máy của IT, là "chuột bạch" của cả hệ thống |
| Wave 1 | ~500 | 6 ngày | Một nửa văn phòng Phụ Nữ, cộng máy hiện trường |
| Wave 2 | ~400 | 7 ngày | Một nửa văn phòng Hà Đô |
| Wave 1-1 | còn lại | 8 ngày | Nửa còn lại của văn phòng Phụ Nữ |
| Wave 2-2 | còn lại | 9 ngày | Nửa còn lại của văn phòng Hà Đô |

Tất cả các nhóm đều hoãn Feature Update 30 ngày. Với cách sắp xếp này, mỗi ngày chỉ có một nhóm tải bản cập nhật, và các văn phòng được xen kẽ để không văn phòng nào chịu tải hai ngày liên tiếp.

### Các thiết lập chính trong Update Ring

- Servicing channel là General Availability.
- Máy tự cài vào giờ bảo trì.
- Active hours kéo dài từ 10 giờ sáng đến 4 giờ chiều.
- Người dùng không được tạm dừng update nhưng vẫn được chủ động bấm kiểm tra update.
- Hạn chót cho cả Feature Update và Quality Update là 1 ngày, kèm grace period 1 ngày.
- Máy không tự khởi động lại trước hạn chót.
- Có thể gỡ Feature Update trong vòng 2 ngày nếu phát hiện lỗi.
- Driver và các bản cập nhật sản phẩm Microsoft cũng được phép cài.

### Thiết lập Delivery Optimization

- Download mode là HTTP blended with peering behind the same NAT.
- Máy chỉ chia sẻ với các máy cùng subnet và không chia sẻ qua VPN.
- Máy chỉ chia sẻ khi pin còn từ 40% trở lên, RAM từ 4GB và ổ cứng từ 32GB.
- Cache được giữ 7 ngày.

## Cách kiểm tra trong tenant của bạn

**Bước 1: xem các chính sách hiện có.** Vào Intune admin center, mở Devices, rồi chọn Windows updates. Ở đây có ba tab: Update rings, Feature updates và Quality updates. Kiểm tra xem tenant của bạn đã có chính sách nào chưa, mỗi chính sách đang gán cho nhóm nào, và có nhóm nào bị trùng giữa hai ring không.

**Bước 2: kiểm tra trạng thái của một máy cụ thể.** Vào Devices, chọn tên máy, rồi mở Device configuration. Xem Update Ring của máy đó báo Succeeded, Error hay Conflict.

**Bước 3: xem báo cáo tổng thể.** Vào Reports, chọn Windows updates, mở tab Reports, rồi chọn Windows quality update distribution. Báo cáo này cho biết bao nhiêu máy đang ở bản vá nào.

**Bước 4: kiểm tra Delivery Optimization ngay trên máy người dùng.** Mở Settings, vào Windows Update, chọn Advanced options, rồi Delivery Optimization và Activity Monitor. Nếu thấy dữ liệu tải từ "PCs on your local network", nghĩa là peer-to-peer đang hoạt động.

**Bước 5: kiểm tra trên máy bằng lệnh.** Chạy `winver` để xem phiên bản và build hiện tại, sau đó dùng PowerShell để xem file nào đang được tải và chia sẻ:

```powershell
Get-DeliveryOptimizationStatus
```

<div class="callout">
  <span>💡</span>
  <div><b>Tip</b>Nếu cần chứng minh hiệu quả với cấp quản lý, hãy chụp lại số liệu băng thông và báo cáo patch compliance trước khi triển khai để có mốc so sánh.</div>
</div>

## Những lỗi mình đã gặp

- **Không đo được chính xác lượng traffic của Windows Update.** Bên Network chỉ thấy tổng băng thông internet quốc tế, không tách riêng được phần nào là Windows Update. Mình phải kết hợp hai cách: so sánh biểu đồ băng thông theo ngày của từng wave, và kiểm tra Activity Monitor trên vài máy mẫu.
- **Máy offline hoặc chỉ online trong thời gian ngắn thì không bao giờ update xong.** Chính sách đã gán và hạn chót đã qua, nhưng máy gần như không kết nối đủ lâu để tải và cài bản cập nhật. Feature Update đặc biệt cần nhiều thời gian hơn bản vá tháng. Những máy này cần được lọc riêng từ báo cáo và xử lý thủ công hoặc theo một luồng riêng.
- **Xung đột giữa WSUS hoặc GPO cũ và Intune.** Nếu máy vẫn nhận GPO trỏ về WSUS, máy có thể nghe theo WSUS thay vì Intune. Kết quả là chính sách hiển thị "thành công" nhưng máy vẫn không update. Trước khi chuyển sang Intune, hãy rà soát và gỡ các GPO Windows Update cũ, hoặc cấu hình rõ nguồn update cho từng loại bản cập nhật.
- **Quên sửa chính sách khi có bản mới.** Phiên bản trong Feature Update và mốc Expedite trong Quality Update đều phải cập nhật thủ công mỗi khi Microsoft phát hành bản mới. Nếu quên, máy sẽ đứng yên ở phiên bản cũ. Mình đã đặt lịch nhắc hằng tháng sau Patch Tuesday cho việc này.
- **Một máy nằm trong hai wave.** Khi máy thuộc hai nhóm được gán hai Update Ring khác nhau, Intune sẽ báo Conflict và máy không biết nên theo lịch nào. Hãy giữ các nhóm wave tách biệt hoàn toàn với nhau.
- **Đặt hạn chót quá ngắn thì người dùng sẽ phản ứng.** Hạn chót 1 ngày giúp tỷ lệ tuân thủ cao, nhưng người dùng cần được thông báo trước. Nếu không, họ sẽ bất ngờ khi máy yêu cầu khởi động lại.

<div class="callout warn">
  <span>⚠️</span>
  <div><b>Lưu ý</b>Hãy truyền thông trước mỗi đợt update, nhất là với Feature Update, và luôn thử trên nhóm pilot trước khi áp dụng diện rộng.</div>
</div>

## Kết luận

Windows Update for Business không khó, nhưng cần được lên kế hoạch. Hãy bắt đầu với một nhóm nhỏ, chia các đợt hợp lý, bật Delivery Optimization và theo dõi báo cáo. Khi đã ổn định, bạn sẽ không còn phải lo nghẽn mạng sau mỗi Patch Tuesday, và việc trả lời Security cũng chỉ mất vài phút.

Mỗi lần cập nhật đều đều, như mỗi ngày một giọt nước. Lâu dần, hệ thống của bạn sẽ luôn an toàn.
