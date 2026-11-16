---
layout: post
title: "GenAI, Copilot, AI Agent hay Agentic AI: phân biệt từ góc nhìn thực chiến của một IT System Admin"
seo_title: "Phân biệt GenAI, Copilot, AI Agent, Agentic AI"
description: "Phân biệt Traditional AI, GenAI, RAG, Copilot, AI Workflow, AI Agent, Agentic AI và Multi-Agent qua các ví dụ thật với Intune, Power Automate, Power BI."
date: 2026-11-16
author: "Tam Nguyen"
reading_time: 10
topic: dx
thumb_label: "AI FOR IT OPS"
image: /images/photo/43.jpg
tags:
  - AI
  - Copilot
  - AI Agent
  - Intune
  - Power Automate
card_tags:
  - AI Agent
  - Copilot
summary: "Phân biệt GenAI, Copilot, AI Agent và Agentic AI. Kèm ví dụ thực chiến với Intune, Power Automate và Power BI trong môi trường enterprise."
redirect_from:
  - /posts/ai-types-genai-copilot-agent-agentic-ai-cho-it-system-admin.html
---

Một buổi sáng, mình nhờ AI viết script PowerShell để force update Chrome. Buổi chiều, mình dùng Copilot tóm tắt meeting. Tối về, mình ngồi dựng một flow Power Automate gửi email cảnh báo các thiết bị Windows bị đặt sai tên. Cả ba việc đều được gọi là "dùng AI", nhưng thật ra chúng khác nhau rất xa. Trong môi trường enterprise mình đang vận hành, với hàng loạt thiết bị Windows và macOS quản lý bằng Intune và nhiều lớp security tooling, chọn sai loại AI có thể làm bạn mất cả tuần. Tệ hơn, nó có thể cấp cho máy quyền hành động vượt quá mức an toàn.

> **Tóm tắt nhanh:** GenAI *tạo nội dung*, Copilot *hỗ trợ con người làm việc*, AI Agent *dùng tool để thực hiện việc*, còn Agentic AI *tự lên kế hoạch, kiểm tra và thử lại cho tới khi đạt mục tiêu*. Hãy nhìn chúng theo hai trục: AI **làm được gì** và AI **được tự chủ tới đâu**.

Điểm quan trọng nhất từ góc nhìn business là: **AI không phải để thay người**, mà để **maximize capability của con người**. Một team IT không cần AI để làm mọi việc thay mình, mà cần AI để tăng tốc tri thức, rút ngắn thời gian khảo sát, giảm công việc lặp lại và giúp người làm tập trung vào quyết định, rủi ro và kiểm soát. Đó là lý do nhiều tổ chức thành công không bắt đầu bằng "AI hoá toàn bộ quy trình", mà bắt đầu bằng việc chọn đúng workflow để AI làm phần nặng nhất: xử lý dữ liệu, chuẩn hóa, đề xuất và tự động hóa các bước vô ích.

## Bối cảnh: vì sao mình tìm hiểu chuyện này

Công việc hằng ngày của mình là Intune, Microsoft 365, Windows và macOS, cộng thêm automation bằng PowerShell, Microsoft Graph, Power Automate và Power BI. Năm nay, chữ "AI" xuất hiện trong gần như mọi thứ: từ email vendor, roadmap Microsoft cho tới yêu cầu của sếp. Có một câu hỏi mình nghe nhiều nhất:

> "Mình có nên làm một AI Agent cho việc này không?"

Rất nhiều lần câu trả lời đúng là **không cần**: một flow automation bình thường là đủ. Cũng có những lúc thứ mình cần lại chính là agent. Để trả lời cho đúng, trước hết cần gọi đúng tên từng loại.

## Bản đồ các loại AI

| Loại | Bản chất | Bạn đưa vào | AI trả ra | Sản phẩm / model tiêu biểu |
|---|---|---|---|---|
| **Traditional AI / ML** | Dự đoán, phân loại | Dữ liệu | Nhãn, điểm rủi ro | SentinelOne, Defender for Endpoint, CrowdStrike, AI Builder, Azure ML |
| **Generative AI** | Tạo nội dung mới | Prompt | Text, code, ảnh | ChatGPT (GPT), Claude, Gemini, Grok, Llama, Mistral, DeepSeek, Qwen, Phi; DALL·E, Midjourney, Sora |
| **RAG** | Tìm dữ liệu trước rồi mới trả lời | Câu hỏi | Câu trả lời có nguồn | M365 Copilot (Graph grounding), Azure AI Search, NotebookLM, Perplexity |
| **Copilot** | Trợ lý tích hợp trong ứng dụng | Yêu cầu trong ngữ cảnh | Gợi ý, bản nháp | M365 Copilot, GitHub Copilot, Copilot in Intune/Power BI, Security Copilot, Gemini for Workspace, Cursor |
| **AI Workflow** | Luồng định sẵn, có thể kèm bước AI | Trigger | Kết quả theo logic cố định | Power Automate, Logic Apps, n8n, Zapier, Make, Google Apps Script |
| **AI Agent** | LLM + instructions + tools | Mục tiêu cụ thể | Hành động thật | Copilot Studio, Agent Builder, Azure AI Foundry Agent Service, OpenAI Agents SDK, Vertex AI Agent Builder |
| **Agentic AI** | Plan → Act → Verify → Retry | Một goal lớn | Goal được hoàn thành | Semantic Kernel, LangGraph, AutoGen, Claude Code, GitHub Copilot coding agent |
| **Multi-Agent** | Nhiều agent chuyên biệt phối hợp | Một quy trình | Quy trình chạy end-to-end | Copilot Studio multi-agent, AutoGen, CrewAI, LangGraph |

Đây **không phải** các thế hệ thay thế nhau. Một sản phẩm có thể thuộc nhiều nhóm cùng lúc. Ví dụ, M365 Copilot vừa là Copilot, vừa dùng RAG, vừa cho phép chạy agent bên trong.

## Từng loại AI qua công việc thực tế của mình

### Traditional AI: dùng hằng ngày mà ít ai để ý

EDR như SentinelOne hay DLP như Digital Guardian đều dựa vào mô hình phát hiện hành vi bất thường. Mỗi lần mình xử lý một *false positive*, hoặc một xung đột giữa DLP với deployment workflow, là mình đang làm việc với Traditional AI. Loại này không viết gì cho bạn. Nó chỉ phán đoán: *nguy hiểm* hay *an toàn*.

### Generative AI: công cụ năng suất số một

Đây là loại mình dùng nhiều nhất:

- Viết và tối ưu script uninstall app cho cả Windows lẫn macOS.
- Sửa script force update Chrome/Edge để chỉ chạy khi máy có cài trình duyệt.
- Viết lại các script retry upgrade Windows 24H2 → 25H2 cho thiết bị chỉ online trong thời gian ngắn.
- Sửa ngữ pháp cho ticket, email phê duyệt, comment Jira.
- Dùng OCR kết hợp GenAI để chuyển ảnh chụp code thành script sạch.

Giới hạn quan trọng nhất: **GenAI viết script, nhưng không chạy script**. Người chịu trách nhiệm test, deploy và rollback vẫn là bạn.

### RAG: khi câu trả lời phải đúng với *công ty mình*

Nếu hỏi một model chung chung "policy Remote Help là gì", bạn sẽ nhận được câu trả lời chung chung. RAG khác ở chỗ hệ thống tìm trong SharePoint, email, tài liệu nội bộ trước rồi mới trả lời. Mình dùng cách này để viết bài dựa trên trang SharePoint nội bộ, đồng thời đối chiếu với [Microsoft Learn](https://learn.microsoft.com) khi troubleshoot Platform SSO hay Conditional Access.

### Copilot: con người vẫn cầm lái

```text
Human → Copilot → gợi ý → Human quyết định
```

M365 Copilot giúp tóm tắt meeting và soạn email. GitHub Copilot gợi ý code. Copilot trong Power BI hỗ trợ viết DAX. Điểm chung: **Copilot đề xuất, con người duyệt**.

## Automation chưa phải là Agent

Đây là chỗ nhiều người nhầm nhất. Mình làm một Power BI dashboard theo dõi thiết bị Windows bị đặt sai tên, kèm một flow Power Automate tự động gửi email cho EUS Team vào ngày 1 hằng tháng:

```text
Schedule (ngày 1, 10:00)
  → Query dữ liệu device
  → Lọc device sai naming rule
  → Gửi email danh sách Device Name / Expected Prefix / Primary User
```

Flow này rất hữu ích nhưng **không phải AI Agent**. Logic do mình định nghĩa sẵn: A → B → C. Các flow onboarding/offboarding hay hệ thống booking bằng Google Form + Sheets + Calendar cũng vậy.

| Tiêu chí | Automation Workflow | AI Agent |
|---|---|---|
| Ai quyết định bước tiếp theo? | Người thiết kế flow | LLM, dựa trên goal và kết quả |
| Xử lý dữ liệu "lạ" | Dễ fail nếu ngoài rule | Có thể suy luận |
| Tính dự đoán được | Rất cao | Thấp hơn, cần guardrail |
| Phù hợp khi | Quy trình ổn định, rõ ràng | Dữ liệu lộn xộn, cần phán đoán |

<div class="callout">
  <span>💡</span>
  <div><b>Tip</b>Các flow Power Automate, script Graph và runbook bạn đã có chính là <i>tool layer</i>. Khi làm agent, bạn không bỏ chúng đi. Agent sẽ gọi lại chúng.</div>
</div>

## AI Agent đầu tiên của mình: chuẩn hóa tên ứng dụng

Bài toán: export danh sách ứng dụng không nằm trong Software Catalog, nghĩa là các app không được phép dùng. Dữ liệu rất lộn xộn:

```text
Opera Installer        Opera Software AS
Opera Installer-2      Opera Software AS
Karabiner-Core-Service Fumihiko Takayama
Karabiner-Elements     Fumihiko Takayama
```

Viết regex cho mọi trường hợp gần như không thể. Vì vậy mình dùng **Copilot Agent Builder**. Công cụ này không cần license Copilot Studio. Agent được cấu hình như sau:

1. **Instructions:** quy tắc gom tên (bỏ hậu tố `-2`, `Installer`, các service con...), kèm nhiều ví dụ thật.
2. **Input:** giữ nguyên file `.xlsx`, agent đọc từng dòng.
3. **Output:** thêm 2 cột `Unified_App_Name` và `App_Type` vào chính file ban đầu.

Đây là đúng nghĩa của agent: **có mục tiêu, có instructions, tự suy luận trên dữ liệu không theo khuôn mẫu**. Bài học lớn nhất của mình là chất lượng agent phụ thuộc gần như hoàn toàn vào **instructions và ví dụ**, chứ không phụ thuộc vào model.

## Agentic AI và Multi-Agent: bước tiếp theo

Lấy bài toán upgrade Windows 24H2 → 25H2 làm ví dụ. Hiện tại mình đang ghép nhiều mảnh rời: Intune app tự chạy Windows Update khi máy bật, email nhắc user mở laptop, rồi theo dõi thủ công. Một hệ thống agentic sẽ chỉ nhận goal *"100% thiết bị lên 25H2"* và tự xử lý vòng lặp:

```text
Goal → Query device chưa upgrade → Kiểm tra online?
     → Trigger upgrade → Verify version
     → Fail? → Retry / nhắc user / tạo Jira escalate
     → Báo cáo Power BI
```

Khi quy trình lớn hơn, ta chia việc cho nhiều agent chuyên biệt:

```text
Orchestrator Agent
 ├── Intune Agent     (device, app, compliance)
 ├── Security Agent   (findings từ EDR, vulnerability scan)
 ├── Naming Agent     (device name, Autopilot group tag)
 ├── Jira Agent       (tạo / cập nhật ticket)
 └── Reporting Agent  (Power BI, email tổng hợp)
```

Ý tưởng cho công việc cá nhân cũng tương tự: Meeting Agent tóm tắt → Jira Agent tạo task → Reminder Agent nhắc deadline → Email Agent tổng hợp inbox mỗi sáng.

<div class="callout warn">
  <span>⚠️</span>
  <div><b>Lưu ý</b>Agent càng tự chủ thì càng cần guardrail: least privilege cho service principal/app registration, RBAC rõ ràng, audit log, human approval cho thao tác rủi ro cao (wipe, retire, xóa group) và luôn chạy pilot group trước.</div>
</div>

<div class="callout danger">
  <span>⛔</span>
  <div><b>Nguy hiểm</b>Đừng cấp quyền <code>DeviceManagementManagedDevices.PrivilegedOperations.All</code> cho một agent đang thử nghiệm. Chỉ cần một lần suy luận sai là có thể wipe nhầm thiết bị thật.</div>
</div>

## Những lỗi mình đã gặp

- **Dùng AI cho việc mà rule là đủ:** có những lần mình định dùng LLM để lọc device sai tên. Thực ra một biểu thức so sánh prefix trong Power BI vừa nhanh hơn, rẻ hơn, vừa ổn định 100%. Bài học: rule rõ ràng thì dùng automation.
- **Tin script AI viết mà không test:** script uninstall chạy đúng trên máy test nhưng fail trên một phần thiết bị do khác đường dẫn cài đặt. Cách xử lý: luôn thêm detection, logging, và chạy trên pilot group trước.
- **Instructions agent quá chung chung:** agent chuẩn hóa app gom sai nhiều nhóm cho đến khi mình bổ sung các ví dụ thật như Opera và Karabiner. Cách phòng tránh: đưa 5–10 ví dụ biên khó vào instructions.
- **Đổi tên file/nguồn dữ liệu làm flow "gãy âm thầm":** sau khi đổi tên file Google Sheet và script, flow booking vẫn gửi mail nhưng không tạo lịch Calendar nữa. Workflow hay agent đều cần monitoring và cảnh báo khi một bước fail.

## Kết luận

GenAI, Copilot, AI Agent và Agentic AI không phải các buzzword thay thế nhau. Chúng là những mức tự chủ khác nhau của AI. Với IT System Admin, lộ trình thực tế nhất là: **Automation → AI Workflow → AI Agent → Agentic / Multi-Agent IT Ops**. Phần khó nhất (tools, script, Graph API, flow) có lẽ bạn đã có sẵn. Nhưng điểm quyết định không phải ở công nghệ, mà ở cách nó nâng **capability của con người**: AI giúp bạn xử lý lượng dữ liệu lớn hơn, đưa ra đề xuất nhanh hơn và tập trung thời gian vào quyết định chiến lược, kiểm soát rủi ro và leadership.

Nói ngắn gọn: **AI không làm thay người, nó giúp người làm mạnh hơn**. Vì vậy, câu hỏi nên đặt ra không phải "AI có thay thế team mình không?" mà là "Trong quy trình nào, AI giúp team mình làm nhiều việc chất lượng hơn, nhanh hơn và an toàn hơn?"

Còn bạn thì sao: quy trình nào trong công việc IT của bạn đáng được "giao" cho một AI Agent nhất?

<!--
Phần cuối bài (nút Chia sẻ LinkedIn, Facebook, Copy link, khung tác giả, bài trước/sau)
và Mục lục bên phải được layout tự thêm vào, không cần viết trong file này.
-->
