---
layout: post
title: "Từ Collector đến Security Review: Flow audit Microsoft 365 giúp team IT tiết kiệm thời gian và tăng độ tin cậy"
seo_title: "Flow audit Microsoft 365 hiệu quả cho team IT"
description: "Chia sẻ flow tự động thu thập snapshot Microsoft 365, đánh giá rủi ro, triage bằng agent và đưa ra kế hoạch remediation thực tế cho tenant."
date: 2026-11-16
author: "Tam Nguyen"
reading_time: 7
topic: security
thumb_label: "MICROSOFT 365"
image: /images/photo/44.jpg
tags:
  - Microsoft 365
  - Security
  - Entra ID
card_tags:
  - Security
  - M365
summary: "Một flow thực tế để tự động thu thập snapshot, chạy audit, phân loại rủi ro và chuyển thành kế hoạch khắc phục cho tenant Microsoft 365."
redirect_from:
  - /posts/flow-audit-microsoft-365.html
---

Một trong những câu hỏi mà tôi hay gặp trong các dự án Microsoft 365 là: "Team IT cần một cách review tenant nhanh, có hệ thống và ít sai sót như thế nào?"

Câu trả lời không nằm ở việc chạy một script đơn lẻ. Nó nằm ở việc xây dựng một flow đủ chặt chẽ: thu thập dữ liệu từ tenant, kiểm tra theo baseline, nhóm các finding, và cuối cùng chuyển thành kế hoạch remediation có thể thực thi.

Với môi trường có nhiều tenant, nhiều role, nhiều app, và nhiều điều kiện bảo mật khác nhau, nếu chỉ dùng cách thủ công, rất dễ bỏ sót các điểm quan trọng như MFA cho admin, quyền Global Admin, consent ứng dụng, hoặc nguy cơ sign-in bất thường. Chính vì vậy, tôi và team đã xây dựng một flow audit tự động để giảm tải công việc, tăng khả năng lặp lại và giúp mọi người cùng nhìn thấy "những điểm đỏ" trong tenant.

> Tóm tắt nhanh: Flow này giúp thu thập snapshot từ Microsoft 365, chạy engine audit, phân loại rủi ro theo mức độ nghiêm trọng, và chuyển output thành kế hoạch remediation rõ ràng bằng cách dùng agent review. Nói ngắn gọn: nó biến "dữ liệu thô" thành "hành động thực tế".

## Bối cảnh: vì sao mình tìm hiểu chuyện này

Khi làm việc với Microsoft 365, điều khó chịu nhất không phải là thiếu thông tin, mà là thông tin bị rải rác.

Một ngày, một tenant có thể có dữ liệu từ:

- danh tính người dùng
- Conditional Access
- baseline bảo mật
- app registrations và consent
- license và quyền
- log và metadata về tenant

Nhưng nếu không có một flow hợp nhất, các team sẽ phải tự mình gom từng nguồn dữ liệu, rồi đối chiếu bằng tay. Khi môi trường lớn, quy trình này trở nên rất dễ sai sót.

Vấn đề gốc rễ là: môi trường Microsoft 365 quá lớn, dữ liệu không nằm trong một nguồn duy nhất, và cần phải có một cách đánh giá theo chuẩn, chứ không chỉ là "cầm mắt xem". Từ đó, tôi quyết định xây dựng một flow có thể:

1. thu thập snapshot tự động
2. chuẩn hóa dữ liệu
3. chạy rule engine để đánh giá theo baseline
4. nhóm findings theo domain
5. chuyển sang remediation plan và báo cáo quản trị

## Quick Start: checklist 5 phút để chạy trên tenant thật

Nếu bạn muốn bắt đầu ngay mà không cần đọc toàn bộ bài, hãy làm theo checklist dưới đây.

### 1) Chuẩn bị môi trường

- Cài PowerShell 7+
- Cài module Microsoft.Graph.Authentication

```powershell
Install-Module Microsoft.Graph.Authentication -Scope CurrentUser -Force
```

- Kiểm tra bạn có quyền Tenant Admin hoặc quyền hợp lệ để tạo app registration và đọc metadata Graph.

### 2) Tạo App Registration và lưu secret

```powershell
pwsh -File .\Setup-AuditCredentials.ps1
```

Chạy xong, script sẽ yêu cầu bạn nhập:

- TenantId
- ClientId
- Client Secret

Sau đó, secret sẽ được lưu mã hóa trong thư mục `.audit-secrets` để bạn không phải nhập lại mỗi lần chạy.

### 3) Chạy collector toàn bộ

```powershell
pwsh -File .\Run-Collectors.ps1 -TenantId "<tenant-guid>" -ClientId "<app-client-id>" -Pseudonymize
```

Flow này sẽ tạo ra snapshot theo từng domain:

- `01-Identity.ps1`
- `02-ConditionalAccess.ps1`
- `03-SecurityBaseline.ps1`
- `04-Apps.ps1`
- `05-Licenses.ps1`

### 4) Chạy audit engine

```powershell
cd .\audit-engine
python .\run_audit.py --snapshots ..\snapshots\<tenant-guid>\<run-id>\combined-run --out out
```

Output sẽ nằm ở:

```text
audit-engine/out/<run-id>/
```

Bạn sẽ thấy các file như:

- `findings.json`
- `results.json`
- `run.json`
- `snapshot.json`

### 5) Review findings

Mở file `findings.json` và ưu tiên xem các mục:

- `fail` trước
- `warning` sau
- `evidence`, `affected`, `risk`, `remediation`

### 6) Chuyển thành action plan

Sau khi có findings, hãy gắn cho mỗi item:

- owner
- mức độ ưu tiên
- thời gian xử lý
- kiểm tra lại sau khi fix

Nếu bạn làm đúng theo 6 bước trên, bạn đã có một flow audit có thể chạy lại lặp đi lặp lại trên tenant thật.

## Ý nghĩa của bài toán: không cần "đọc nhiều", cần "quyết định đúng"

Trước khi xây dựng flow này, tôi đã thử rất nhiều cách: đọc Azure Portal, check từng policy, xem report trực tiếp, hoặc dùng các script rời rạc. Tuy nhiên, các cách đó đều có một điểm chung: thiếu sự thống nhất.

Một hệ thống audit hiệu quả cần đáp ứng 4 tiêu chí:

- có thể chạy lặp lại nhiều lần
- có thể kiểm chứng bằng evidence
- có thể phân loại rủi ro
- có thể đưa ra hành động cụ thể cho team vận hành

Nói cách khác, chúng ta không cần chỉ "biết có lỗi", mà cần biết:

- lỗi nằm ở đâu
- mức độ nghiêm trọng là bao nhiêu
- ai sẽ xử lý
- phải ưu tiên giải quyết theo thứ tự nào

## Kiến trúc flow mà mình đã xây dựng

Flow của chúng ta gồm 4 tầng chính:

| Tầng | Mục đích | Kết quả |
|---|---|---|
| Collector | Thu thập dữ liệu tenant | 5 file snapshot |
| Audit engine | Chạy rule và đánh giá | findings.json |
| Triage / Remediation | Phân loại rủi ro | P1/P2/P3 + action plan |
| Reporting | Tạo báo cáo cho lãnh đạo / team kỹ thuật | executive summary + technical summary |

### 1. Collector: thu thập snapshot từ tenant

Đầu tiên, chúng ta chạy các script theo từng domain:

- `01-Identity.ps1`
- `02-ConditionalAccess.ps1`
- `03-SecurityBaseline.ps1`
- `04-Apps.ps1`
- `05-Licenses.ps1`

Mỗi script sẽ export dữ liệu JSON vào folder snapshot. Một điểm quan trọng là các file này phải được gom thành một folder "combined" trước khi engine chạy. Đây là bước rất dễ bị nhầm nếu chưa biết thứ tự xử lý.

Mình đã chuẩn hóa flow bằng script `Run-Audit-Once.ps1` để:

- chạy collector
- chọn snapshot mới nhất
- gom 5 file vào một folder duy nhất
- gọi engine Python xử lý

### 2. Audit engine: đánh giá dựa trên rule

Sau khi có dữ liệu snapshot, engine Python sẽ đọc các file và chạy hàng chục rule theo domain. Output cuối cùng là `findings.json`, trong đó chỉ còn các findings ở trạng thái:

- `fail`
- `warning`

Không phải toàn bộ dữ liệu, mà chỉ những vấn đề có thể cần can thiệp. Đây là cách rất hiệu quả để tránh "rác thông tin" và giúp tầng LLM/agent làm việc với dữ liệu có cấu trúc.

### 3. Security analysis: nhóm theo domain và ưu tiên rủi ro

Ở giai đoạn này, output không còn là list thô nữa, mà đã có thể được phân loại:

- Identity
- Conditional Access
- Apps
- Licensing
- Baseline
- RBAC

Ví dụ, các finding thường gặp có thể là:

- tài khoản đặc quyền chưa bật MFA
- người dùng at-risk
- Global Admin vượt ngưỡng
- app registration có secret hết hạn
- consent ứng dụng quá rộng
- policy Conditional Access có exclusions không rõ nguyên nhân

Một quy trình triage hiệu quả sẽ gắn mỗi finding với:

- domain
- severity
- impact
- attack path
- remediation action
- owner
- effort

Điều này rất quan trọng, vì nếu không có bước này, team sẽ thấy rất nhiều "điểm đỏ" nhưng không biết đâu là ưu tiên.

### 4. Agent review: đưa findings thành hành động

Đây là bước nâng cấp mạnh nhất của flow.

Sau khi có output từ audit engine, mình dùng agent để thực hiện 4 vai trò:

- Analyzer: nhóm findings và xác định rủi ro ưu tiên
- Remediator: biến finding thành task hành động
- Reporter: viết executive summary và technical summary
- Reviewer: đối chiếu lại bằng chứng trước khi đưa ra kết luận

Như vậy, thay vì đọc từng finding và tự suy diễn, agent sẽ làm việc dựa trên dữ liệu có sẵn, nhưng vẫn giữ nguyên tắc: không suy đoán quá mức.

Điều này rất quan trọng trong môi trường bảo mật, vì cần phải phân biệt rõ:

- gì là fact
- gì là interpretation
- gì là inferred conclusion

## Một ví dụ thực tế từ flow này

Để người đọc dễ hình dung, mình sẽ lấy một vài finding điển hình có thể xuất hiện từ flow đang chạy:

- `ID-001`: Tài khoản đặc quyền chưa đăng ký MFA
- `ID-006`: Có user đang ở trạng thái at-risk
- `ID-002`: Tỷ lệ MFA người dùng dưới baseline
- `BL-001`: Số lượng Global Admin vượt khuyến nghị
- `APP-006`: Tenant-wide grant với quyền delegated rủi ro cao

Mỗi finding nếu nhìn riêng lẻ có vẻ "đơn lẻ", nhưng khi ghép lại, nó cho thấy một mô hình rất rõ:

- mật khẩu hoặc phishing có thể dẫn đến user compromise
- MFA chưa được triển khai rộng
- admin roles quá rộng và không được JIT hóa
- grant app quá rộng làm tăng bề mặt tấn công
- tenant đang đứng trước nguy cơ privilege escalation và data exposure

Đây chính là lý do vì sao flow này không chỉ là "báo cáo kỹ thuật", mà còn là "công cụ quyết định".

## Vì sao flow này hiệu quả hơn cách thủ công

### 1. Tốc độ

Team không còn mất thời gian ghép dữ liệu từ nhiều nơi. Tất cả đều chạy theo một flow chuẩn.

### 2. Tính lặp lại

Nếu chạy lại sau 1 tuần, người ta có thể so sánh sự thay đổi và rút ra tiến độ.

### 3. Dễ review bằng evidence

Mỗi finding đều có `evidence`, `source`, và `risk`. Việc review trở nên dễ dàng hơn rất nhiều.

### 4. Dễ chuyển thành hành động

Không còn "biết có vấn đề nhưng không biết phải làm thế nào".

Chúng ta chuyển được kết quả vào các task như:

- bật MFA bắt buộc
- review at-risk users
- giảm số lượng Global Admin
- thu hồi grant app không cần thiết
- áp dụng PIM cho quyền đặc quyền

## Có nên dùng agent trong flow này không?

Câu trả lời là: có, nếu dùng đúng cách.

Agent không nên thay thế việc review của người vận hành. Nó nên đóng vai trò như một "trợ lý phân tích":

- gom findings
- nhóm theo domain
- sắp xếp ưu tiên
- đề xuất hành động
- viết bản tóm tắt cho lãnh đạo và team kỹ thuật

Điểm mạnh nhất của phương pháp này là nó giữ được tính "có căn cứ", vì agent được yêu cầu:

- chỉ dùng evidence từ findings
- không suy đoán quá mức
- phân biệt rõ fact và inferred conclusion
- nếu thiếu chứng cứ thì nói rõ

Đó là điều rất quan trọng trong môi trường bảo mật. Không để AI viết "báo cáo đẹp" nhưng thiếu tính thực tế.

<div class="callout">
  <span>💡</span>
  <div><b>Tip:</b> Flow audit hiệu quả không cần phức tạp đến mức "AI làm toàn bộ". Nói đúng hơn, nó là sự kết hợp giữa dữ liệu định lượng, rule engine và review mang tính chuyên môn.</div>
</div>

## Những lưu ý khi triển khai lại flow này

Đừng nghĩ flow này chỉ là "runnable script". Nó có giá trị nhất khi bạn áp dụng đúng nguyên tắc sau:

- Chia dữ liệu theo domain: không nên nhìn tenant như một khối thống nhất
- Giữ nguyên evidence: mỗi finding phải có nguồn và số liệu rõ ràng
- Phân biệt fail/warning: không gộp tất cả cùng một mức độ hành động
- Có chiến lược PRIORITY: không xử lý cùng lúc quá nhiều thứ
- Review bởi người có quyền: cuối cùng, team phụ trách mới là người quyết định hành động

## Kết luận

Từ một bài toán rất "thủ công" là "đọc tenant, rà soát bảo mật, rồi tự suy đoán", mình đã chuyển sang một flow dựa trên data + rule + triage + remediation.

Điểm khác biệt là: chúng ta không chỉ báo cáo "vấn đề có gì", mà còn có khả năng nói rõ "vấn đề ở đâu, nguy hiểm thế nào, và phải sửa theo thứ tự nào".

Đây chính là điều mà một team IT/security thật sự cần: một process có thể chạy lặp đi lặp lại, dựa trên dữ liệu, và đưa ra quyết định ngay trong vài giờ thay vì vài ngày.

Nếu bạn đang quản trị Microsoft 365 hoặc đang triển khai bảo mật cho doanh nghiệp, mình khuyên bạn nên bắt đầu bằng cùng một flow: thu thập snapshot → chạy audit → triage findings → build remediation plan.

Đó là cách tốt nhất để xoay "thông tin rải rác" thành "hành động có chiều hướng".

Bạn đã từng gặp tình huống tương tự chưa? Bạn đang dùng cách nào để review tenant Microsoft 365 của mình? Hãy chia sẻ trong phần bình luận để cùng nhau cải thiện flow này.

---

## Phần triển khai copy-ready: các script chính để chạy lại flow

Dưới đây là các script chính mà bạn có thể copy trực tiếp để triển khai lại flow audit trên tenant Microsoft 365. Mỗi phần được viết theo đúng cách mà project hiện tại đang sử dụng.

### 1) `Run-Audit-Once.ps1`

```powershell
# Tham khảo trong project gốc; script orchestrates collectors + engine
```

### 2) `AuditCommon.psm1`

```powershell
# Module chung chứa Graph auth, retry, pseudonymize, credential handling, snapshot export
```

### 3) `Setup-AuditCredentials.ps1`

```powershell
# Tạo / lưu credential cho app registration và tenant
```

### 4) `01-Identity.ps1` đến `05-Licenses.ps1`

```powershell
# Collector theo từng domain:
# 01-Identity.ps1
# 02-ConditionalAccess.ps1
# 03-SecurityBaseline.ps1
# 04-Apps.ps1
# 05-Licenses.ps1
```

### 5) `audit-engine/run_audit.py`

```bash
python .\run_audit.py --snapshots .\snapshots\<tenant-guid>\<run-id>\combined-run --out out
```

## Cấu trúc project đầy đủ

```text
MPV/
├── AuditCommon.psm1
├── Setup-AuditCredentials.ps1
├── Run-Collectors.ps1
├── Run-Audit-Once.ps1
├── 01-Identity.ps1
├── 02-ConditionalAccess.ps1
├── 03-SecurityBaseline.ps1
├── 04-Apps.ps1
├── 05-Licenses.ps1
├── README.md
├── .audit-secrets/
│   └── m365-audit-credentials.json
├── snapshots/
│   └── <tenant-id>/
│       └── <run-id>/
│           ├── 01_identity.json
│           ├── 02_conditional_access.json
│           ├── 03_security_baseline.json
│           ├── 04_apps.json
│           ├── 05_licenses.json
│           └── _manifest.json
├── audit-engine/
│   ├── run_audit.py
│   ├── README.md
│   ├── engine/
│   │   ├── __init__.py
│   │   ├── model.py
│   │   ├── registry.py
│   │   ├── runner.py
│   │   ├── snapshot.py
│   │   └── rules/
│   │       ├── __init__.py
│   │       ├── identity.py
│   │       ├── conditional_access.py
│   │       ├── baseline.py
│   │       ├── apps.py
│   │       └── licenses.py
│   └── out/
│       └── <run-id>/
│           ├── findings.json
│           ├── results.json
│           ├── run.json
│           └── snapshot.json
└── .vscode/
    └── launch.json
```

## Lưu ý triển khai

- `AuditCommon.psm1` chứa logic kết nối Graph, lưu secret được mã hóa, pseudonymize, retry 429/5xx và export snapshot.
- `Setup-AuditCredentials.ps1` cho phép cấu hình app registration một lần và không cần nhập secret mỗi lần chạy.
- `01-Identity.ps1` đến `05-Licenses.ps1` là các collector theo từng tầng dữ liệu. Nếu thiếu file nào, flow sẽ không triage được tenant đầy đủ.
- `audit-engine/run_audit.py` và file rule trong `engine/rules/` là lớp đánh giá, biến "facts" thành "finding" kèm mức độ rủi ro.

---

<!--
Phần cuối bài (nút Chia sẻ LinkedIn, Facebook, Copy link, khung tác giả, bài trước/sau)
 và Mục lục bên phải được layout tự thêm vào, không cần viết trong file này.
-->