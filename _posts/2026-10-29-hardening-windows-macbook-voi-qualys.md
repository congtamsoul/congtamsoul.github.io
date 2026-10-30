layout: post
title: "Hardening Windows và MacBook với Qualys: từ báo cáo CIS Benchmark đến cấu hình Intune và đo kết quả"
seo_title: "Hardening Windows, MacBook với Qualys và Intune"
description: "Dùng Qualys Policy Compliance và CIS Benchmark để tìm cấu hình yếu trên Windows, MacBook, ưu tiên mục Urgent/Critical, vá bằng Intune và chứng minh điểm bảo mật tăng."
date: 2026-10-29
author: "Tam Nguyen"
reading_time: 11
topic: security
thumb_label: "HARDENING CONTROL"
tags:
  - Qualys
  - Hardening
  - CIS Benchmark
  - Intune
  - Security
card_tags:
  - Qualys
  - Hardening
summary: "Quét máy bằng Qualys theo CIS Benchmark, xử lý mục Urgent/Critical trước bằng Intune, pilot theo phase và scan lại để đo điểm bảo mật tăng."
redirect_from:
  - /posts/hardening-windows-macbook-voi-qualys.html
---

Lần đầu chạy Qualys scan theo bộ CIS Benchmark cho một chiếc laptop Windows 11 24H2 "chuẩn công ty", mình khá bất ngờ: máy đã join domain, đã quản lý bằng Intune, đã có EDR, vậy mà chỉ đạt **24.83%**, tức **72 trên 290** control. Có 213 control bị đánh Failed, trong đó có những mục rất nặng như UAC bị tắt, Windows Firewall profile Domain đang Off, Credential Guard chưa bật. Chiếc máy đó không có gì đặc biệt, nó là ảnh chụp của cả fleet. Bài này chia sẻ cách mình biến một báo cáo hàng trăm dòng thành kế hoạch Hardening Control có ưu tiên, có phê duyệt, có pilot, và quan trọng nhất là **có số liệu chứng minh kết quả**.

> **Tóm tắt nhanh:** Qualys Cloud Agent quét máy Windows và MacBook theo bộ tiêu chuẩn CIS cho từng OS và phiên bản. Xuất báo cáo, lọc các control **Urgent/Critical đang Failed**, map từng control sang setting Intune (Settings Catalog, Endpoint Security, OMA-URI). Lấy phê duyệt của Security và lãnh đạo IT, pilot theo phase, rồi scan lại để so sánh tỷ lệ Passed trước và sau.

## Qualys là gì?

**Qualys** là nền tảng bảo mật trên cloud. Trên mỗi máy tính (Windows, macOS, Linux) chỉ cần cài một agent nhẹ là **Qualys Cloud Agent**. Agent thu thập cấu hình và gửi về cloud để phân tích, nên máy làm việc từ xa vẫn được scan mà không cần ở trong mạng công ty.

Hai module hay dùng nhất với endpoint:

| Module | Trả lời câu hỏi | Ví dụ phát hiện |
|---|---|---|
| **VMDR** (Vulnerability Management) | Máy đang có **lỗ hổng phần mềm** nào? | Thiếu bản vá Windows, Chrome phiên bản cũ có CVE |
| **Policy Compliance** | Máy đang **cấu hình** có đúng tiêu chuẩn không? | UAC tắt, firewall Off, SMB không ký số |

Bài này tập trung vào **Policy Compliance**, tức *Hardening Control*. Điểm mạnh của Qualys là có sẵn các bộ đánh giá theo chuẩn **CIS Benchmark** cho từng hệ điều hành và từng phiên bản lớn: Windows 11 theo từng feature update, macOS theo từng major version. Báo cáo mình dùng làm ví dụ là bộ *CIS Microsoft Intune for Windows 11 Benchmark v3.0.1*. Bộ này viết riêng cho máy quản lý bằng Intune, nên phần Remediation của mỗi control đều có sẵn đường dẫn GPO và **OMA-URI** cho Intune.

<div class="callout">
  <span>💡</span>
  <div><b>Tip</b>Khi Microsoft ra feature update mới (ví dụ 24H2 lên 25H2) hoặc Apple ra macOS major mới, hãy kiểm tra Qualys đã có bộ benchmark cho phiên bản đó chưa. Dùng nhầm bộ benchmark cũ sẽ ra kết quả Failed hoặc Error cho những setting đã đổi tên hay không còn tồn tại.</div>
</div>

## Bối cảnh: đọc báo cáo Qualys thế nào

Phần Summary của báo cáo cho bức tranh tổng quan:

| Chỉ số | Giá trị trong báo cáo mẫu |
|---|---|
| Policy | CIS Microsoft Intune for Windows 11 Benchmark v3.0.1 |
| OS | Windows 11 Pro 24H2 |
| Tổng số control được đánh giá | 290 |
| **Passed** | **72 (24.83%)** |
| Failed | 213 (73.45%) |
| Error | 5 (1.72%) |

Mỗi control có các trường quan trọng sau:

- **Criticality**: mức độ nghiêm trọng, gồm `URGENT (5)`, `CRITICAL (4)`, `SERIOUS (3)`, `MEDIUM (2)`, `MINIMAL (1)`.
- **Status**: `Passed`, `Failed` hoặc `Error`.
- **Remediation**: cách sửa, gồm đường dẫn GPO và OMA-URI cho Intune.
- **Evidence**: registry key Qualys đã đọc, giá trị mong đợi và giá trị thực tế. Đây là phần giúp mình biết chính xác cần đổi gì.

Các control bị `Error` thường là setting Qualys không đọc được, ví dụ setting Defender quản lý qua MDM. Nên kiểm tra riêng, không tính chung với Failed.

## Bước 1: Lọc và ưu tiên control cần xử lý

Không ai xử lý được 213 control trong một lần. Mình lọc theo thứ tự:

1. **Failed** + **URGENT (5)**
2. **Failed** + **CRITICAL (4)**
3. Gom các control cùng nhóm để xử lý trong cùng một policy Intune: UAC, Firewall, Defender ASR, SMB/NTLM, User Rights, Audit Policy...
4. Đánh giá **tác động tới người dùng** cho từng nhóm. Nhóm nào ít rủi ro làm trước.

Mình tách riêng một sheet **Urgent** trong file báo cáo, thêm cột *Where is?* để ghi control đó đã được đưa vào policy test nào trên Intune. Cách này giúp theo dõi mục nào đã xử lý, mục nào còn treo.

### Ví dụ các control ưu tiên cao từ báo cáo thật

| Control | Mức độ | Giá trị hiện tại | Mong đợi | Rủi ro |
|---|---|---|---|---|
| UAC: Run all administrators in Admin Approval Mode (`EnableLUA`) | CRITICAL | `0` – UAC tắt | `1` | Mọi tiến trình chạy với quyền admin đầy đủ, malware không gặp rào cản nào |
| UAC: Elevation prompt for administrators (`ConsentPromptBehaviorAdmin`) | CRITICAL | `0` – Elevate without prompting | `2` – Prompt for consent on secure desktop | Nâng quyền âm thầm không cần hỏi |
| Windows Firewall: Firewall state (Domain) | CRITICAL | `Off` | `On` | Máy không có tường lửa khi ở mạng công ty, dễ bị lây lan ngang |
| Credential Guard (`LsaCfgFlags`) | URGENT | `0` – Disabled | `1` – Enabled with UEFI lock | Hash và ticket đăng nhập trong LSASS có thể bị đánh cắp |
| Hypervisor-protected Code Integrity (HVCI) | URGENT | Not Configured | Enabled with UEFI lock | Driver độc hại có thể chạy ở kernel |
| Allow Print Spooler to accept client connections | URGENT | Not Configured | Disabled | Mở đường tấn công từ xa qua Print Spooler |
| Access this computer from the network | URGENT | Có `Everyone`, `Users`, `Backup Operators` | Chỉ `Administrators`, `Remote Desktop Users` | Quá nhiều đối tượng được truy cập máy qua mạng |
| WDigest Authentication | CRITICAL | Not Configured | Disabled | Mật khẩu dạng plaintext có thể nằm trong bộ nhớ |
| SMB client: Digitally sign communications (always) | CRITICAL | Disabled | Enabled | Dễ bị tấn công man-in-the-middle, relay |
| LAN Manager authentication level | CRITICAL | `3` – NTLMv2 only | `5` – Refuse LM & NTLM | Vẫn chấp nhận giao thức xác thực yếu |
| ASR: Block credential stealing from LSASS | CRITICAL | Not Configured | Block | Công cụ dump credential không bị chặn |
| ASR: Block Office apps from creating child processes | CRITICAL | Not Configured | Block | Macro Office có thể khởi chạy payload |
| Offer Remote Assistance (unsolicited) | CRITICAL | Enabled | Disabled | Có thể bị điều khiển từ xa ngoài quy trình |

Danh sách này cho thấy một điều: phần lớn rủi ro lớn nằm ở **vài nhóm cấu hình cốt lõi** (UAC, Firewall, VBS/Credential Guard, ASR, xác thực mạng). Xử lý đúng các nhóm này sẽ kéo điểm lên nhanh và giảm rủi ro thật, không chỉ để đẹp báo cáo.

## Bước 2: Map control sang cấu hình Intune

Phần Remediation của Qualys đã có OMA-URI, nhưng mình ưu tiên dùng cấu hình có giao diện trước, OMA-URI sau cùng:

| Thứ tự ưu tiên | Loại cấu hình Intune | Dùng cho |
|---|---|---|
| 1 | **Endpoint security** (Firewall, Attack Surface Reduction, Account protection, Antivirus) | Firewall, ASR rules, Credential Guard, Defender |
| 2 | **Settings Catalog** | Local Policies Security Options, User Rights, Device Guard, Audit, phần lớn control còn lại |
| 3 | **Security Baseline** | Áp một lần nhiều setting theo khuyến nghị của Microsoft, sau đó tinh chỉnh |
| 4 | **Custom OMA-URI** | Setting chưa có trong Settings Catalog |

### Ví dụ mapping

| Control | Cấu hình trong Intune |
|---|---|
| UAC (`EnableLUA`, `ConsentPromptBehaviorAdmin`) | Settings Catalog → Local Policies Security Options → User Account Control |
| Firewall Domain/Private/Public | Endpoint security → Firewall |
| Credential Guard, HVCI | Endpoint security → Account protection, hoặc Settings Catalog → Device Guard |
| ASR rules | Endpoint security → Attack surface reduction |
| SMB signing, LAN Manager level | Settings Catalog → Local Policies Security Options → Microsoft Network Client / Network Security |
| Access this computer from the network | Settings Catalog → User Rights → `AccessFromNetwork` |
| Print Spooler client connections | Settings Catalog → Printers |

### Cấu hình của mình

<!-- ===== DÁN BẢNG MAPPING / EXPORT POLICY INTUNE (JSON) VÀO ĐÂY ===== -->

```json
// Export cấu hình Hardening Control từ Intune (Graph: deviceManagement/configurationPolicies)

// >>> Dán JSON vào đây <<<
```

<div class="callout warn">
  <span>⚠️</span>
  <div><b>Lưu ý</b>Đừng áp nguyên bộ CIS một cách máy móc. Một số khuyến nghị có thể xung đột với vận hành thực tế: ví dụ CIS yêu cầu hoãn feature update tối thiểu 180 ngày, trong khi chiến lược patch của công ty có thể khác. Những control như vậy nên đưa vào danh sách <b>Exception</b> có lý do và được Security phê duyệt, thay vì để Failed mãi trong báo cáo.</div>
</div>

## Bước 3: Phối hợp và phê duyệt

Hardening Control thay đổi hành vi của **mọi** máy trong công ty, nên đây không phải việc một mình team System Admin quyết định. Quy trình mình áp dụng:

| Bên liên quan | Vai trò |
|---|---|
| **System Admin / Endpoint team** | Phân tích báo cáo, đề xuất cấu hình, đánh giá tác động, triển khai trên Intune |
| **Security team** | Xác nhận mức ưu tiên, phê duyệt cấu hình và các ngoại lệ (exception) |
| **Lãnh đạo IT** | Phê duyệt kế hoạch, lịch triển khai và rủi ro ảnh hưởng người dùng |
| **Helpdesk** | Nắm trước các thay đổi, chuẩn bị kịch bản hỗ trợ user |
| **Chủ ứng dụng nghiệp vụ** | Kiểm thử ứng dụng của mình trên máy pilot |

Hồ sơ trình phê duyệt nên có:

1. Điểm hiện tại và mục tiêu sau khi hardening.
2. Danh sách control sẽ xử lý theo từng phase, kèm mức độ và rủi ro nếu không xử lý.
3. Tác động dự kiến tới người dùng và ứng dụng.
4. Kế hoạch pilot, tiêu chí để chuyển sang phase tiếp theo.
5. **Rollback plan** cho từng nhóm cấu hình.
6. Danh sách exception đề xuất, kèm lý do.

## Bước 4: Test, pilot theo phase và triển khai

| Phase | Nhóm máy | Mục tiêu |
|---|---|---|
| **Phase 0 – Test** | Máy test của IT | Kiểm tra setting áp đúng, Qualys đọc được, không lỗi hệ thống |
| **Phase 1 – Pilot IT** | Máy của team IT | Phát hiện ảnh hưởng tới công cụ quản trị, remote support |
| **Phase 2 – Pilot nghiệp vụ** | Một nhóm nhỏ ở mỗi phòng ban | Phát hiện ảnh hưởng tới ứng dụng nghiệp vụ, máy in, file share |
| **Phase 3 – Toàn công ty** | Tất cả thiết bị | Triển khai dần theo nhóm, theo dõi ticket Helpdesk |

Mỗi phase nên kéo dài đủ để gặp các tình huống thực tế (đăng nhập, in ấn, VPN, họp online, cập nhật ứng dụng) trước khi mở rộng. Dùng **group riêng cho từng phase** và **cùng một policy**, chỉ thêm group vào assignment, để không phải duy trì nhiều bản cấu hình khác nhau.

<div class="callout danger">
  <span>⛔</span>
  <div><b>Nguy hiểm</b>Credential Guard và HVCI ở chế độ <b>Enabled with UEFI lock</b> không thể tắt từ xa bằng cách gỡ policy, phải thao tác trực tiếp trên từng máy. Hãy pilot ở chế độ <b>without lock</b> trước, chỉ chuyển sang UEFI lock khi đã chắc chắn tương thích. Tương tự, đổi <code>LmCompatibilityLevel</code> lên 5 hay xóa <code>Everyone</code> khỏi <i>Access this computer from the network</i> có thể làm hỏng kết nối tới hệ thống cũ, cần kiểm thử kỹ.</div>
</div>

### Kiểm tra nhanh trên máy Windows sau khi áp policy

```powershell
# UAC
Get-ItemProperty 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Policies\System' |
  Select-Object EnableLUA, ConsentPromptBehaviorAdmin, ConsentPromptBehaviorUser

# Firewall các profile
Get-NetFirewallProfile | Select-Object Name, Enabled, DefaultInboundAction

# Credential Guard / HVCI đang chạy chưa (2 = Credential Guard, 3 = HVCI)
Get-CimInstance -ClassName Win32_DeviceGuard -Namespace root\Microsoft\Windows\DeviceGuard |
  Select-Object VirtualizationBasedSecurityStatus, SecurityServicesConfigured, SecurityServicesRunning

# ASR rules và trạng thái (1 = Block, 2 = Audit)
$p = Get-MpPreference
for ($i = 0; $i -lt $p.AttackSurfaceReductionRules_Ids.Count; $i++) {
    "{0} = {1}" -f $p.AttackSurfaceReductionRules_Ids[$i], $p.AttackSurfaceReductionRules_Actions[$i]
}

# SMB signing và LAN Manager level
Get-SmbClientConfiguration | Select-Object RequireSecuritySignature, EnableSecuritySignature
Get-ItemProperty 'HKLM:\System\CurrentControlSet\Control\Lsa' | Select-Object LmCompatibilityLevel

# Đồng bộ policy Intune ngay
Get-ScheduledTask | Where-Object TaskName -eq 'PushLaunch' | Start-ScheduledTask
```

### Với MacBook

Qualys cũng có bộ CIS Benchmark cho từng phiên bản macOS. Các control thường gặp là FileVault, Gatekeeper, firewall, khóa màn hình, cập nhật tự động, và được vá bằng **Settings Catalog** hoặc **Endpoint security** cho macOS trên Intune.

```bash
# FileVault
fdesetup status

# Gatekeeper
spctl --status

# System Integrity Protection
csrutil status

# Application Firewall
/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate

# Profile cấu hình từ Intune đã xuống máy chưa
sudo profiles show -type configuration | grep -i -E "name|identifier"
```

### Script của mình

<!-- ===== DÁN SCRIPT KIỂM TRA / REMEDIATION CỦA BẠN VÀO ĐÂY ===== -->

```powershell
# Hardening_Check.ps1
# Kiểm tra nhanh các control ưu tiên sau khi áp policy Intune

# >>> Dán script vào đây <<<
```

## Bước 5: Scan lại và chứng minh kết quả

Đây là bước nhiều người bỏ qua, nhưng lại là bước quan trọng nhất khi báo cáo với lãnh đạo. Sau khi triển khai xong mỗi phase, chạy lại Qualys scan với **cùng một bộ policy** và so sánh.

Cách tính:

$$\text{Compliance (\%)} = \frac{\text{Passed}}{\text{Tổng số control được đánh giá}} \times 100$$

Với báo cáo trước khi hardening: 72 / 290 = **24.83%**.

### Bảng kết quả

<!-- ===== ĐIỀN SỐ LIỆU SAU KHI SCAN LẠI ===== -->

| Thời điểm | Passed | Failed | Error | Compliance | Mức tăng |
|---|---|---|---|---|---|
| Trước hardening | 72 | 213 | 5 | 24.83% | – |
| Sau Phase 1 | `___` | `___` | `___` | `___%` | `+___` điểm % |
| Sau Phase 3 (toàn công ty) | `___` | `___` | `___` | `___%` | `+___` điểm % |

Nên trình bày thêm hai góc nhìn:

- **Theo mức độ:** số control Urgent và Critical còn Failed trước và sau. Lãnh đạo quan tâm "rủi ro lớn đã đóng chưa" hơn là tổng điểm.
- **Theo thiết bị:** tỷ lệ máy đạt ngưỡng compliance mục tiêu, để thấy hardening đã phủ toàn bộ fleet chứ không chỉ vài máy mẫu.

<!-- ===== CHÈN ẢNH SO SÁNH TRƯỚC / SAU VÀO ĐÂY ===== -->
![So sánh điểm Qualys trước và sau hardening](/images/hardening-windows-macbook-voi-qualys/before-after.png){: width="720"}
*Hình 1: tỷ lệ control Passed trước và sau khi triển khai Hardening Control.*

<div class="callout">
  <span>💡</span>
  <div><b>Tip</b>Khi so sánh, hãy chú ý cả <b>mức tăng tuyệt đối</b> (điểm %) và <b>mức tăng tương đối</b>. Ví dụ đi từ 24.83% lên 60% là tăng khoảng 35 điểm %, nhưng tương đương gấp khoảng 2,4 lần. Ghi rõ đang dùng cách nào để tránh hiểu nhầm.</div>
</div>

## Những điểm cần lưu ý

| Vấn đề | Vì sao xảy ra | Cách xử lý |
|---|---|---|
| Control vẫn Failed dù đã cấu hình | Policy chưa xuống máy, hoặc Qualys đọc ở registry path khác (GPO và MDM ghi vào hai nơi khác nhau) | Kiểm tra phần Evidence trong báo cáo để biết Qualys đọc key nào, sync lại Intune rồi scan lại |
| Control bị Error | Qualys không đọc được setting quản lý qua MDM, thường gặp với Defender | Xác minh trực tiếp trên máy, ghi chú riêng thay vì tính là Failed |
| GPO và Intune xung đột | Máy Hybrid joined nhận cả GPO và MDM, GPO có thể ghi đè | Xác định một nguồn quản lý duy nhất cho mỗi nhóm setting |
| User không còn quyền nâng cấp tự cài phần mềm | Bật lại UAC và đổi hành vi prompt | Thông báo trước, chuẩn bị quy trình cài phần mềm qua Company Portal |
| Hệ thống cũ không kết nối được | Bật SMB signing, nâng LAN Manager level, chặn NTLM | Liệt kê hệ thống cũ trước khi áp, pilot với chủ ứng dụng |
| Báo cáo dùng sai benchmark | Máy đã lên phiên bản OS mới nhưng policy Qualys vẫn là bản cũ | Cập nhật policy Qualys theo phiên bản OS hiện tại |

## Kết luận

Hardening không phải là bật hết mọi setting trong CIS Benchmark. Đó là quá trình **ưu tiên đúng, triển khai an toàn và đo được kết quả**. Qualys cho biết máy đang ở đâu so với tiêu chuẩn. Intune giúp đưa cấu hình xuống hàng loạt thiết bị. Phê duyệt của Security và lãnh đạo IT đảm bảo mọi thay đổi đều có trách nhiệm và kế hoạch rollback. Nếu bạn đang bắt đầu, hãy chạy một bản scan cho máy chuẩn của công ty, lọc riêng các control Urgent và Critical đang Failed, và dùng đó làm danh sách việc đầu tiên.

Ở công ty bạn, điểm Policy Compliance hiện tại là bao nhiêu, và nhóm control nào đang khó xử lý nhất?

<!--
Phần cuối bài (nút Chia sẻ LinkedIn, Facebook, Copy link, khung tác giả, bài trước/sau)
và Mục lục bên phải được layout tự thêm vào, không cần viết trong file này.
Xem trước trên máy: bundle exec jekyll serve --unpublished (chỉ cần khi bài còn published: false).
-->
