---
layout: post
title: "ITIL 4 Foundation: Toàn bộ kiến thức nền tảng cần nắm"
seo_title: "ITIL 4 Foundation: Tổng hợp kiến thức nền tảng"
description: "Tổng hợp ITIL 4 Foundation bằng tiếng Việt, từ Value, Service, SVS, Guiding Principles đến Service Value Chain và các ITIL Practices quan trọng."
date: 2026-11-24
author: "Tam Nguyen"
reading_time: 28
topic: career
thumb_label: "ITIL 4 FOUNDATION"
image: /images/photo/46.jpg
tags:
  - ITIL 4
  - ITIL Foundation
  - IT Service Management
  - ITSM
  - Service Management
card_tags:
  - ITIL 4
  - ITSM
summary: "Hệ thống toàn bộ kiến thức nền tảng ITIL 4: Value, Service, SVS, Guiding Principles, Service Value Chain và ITIL Practices."
redirect_from:
  - /posts/itil-4-foundation-toan-bo-kien-thuc.html
---

Khi làm System Administration hay IT Operations, mình thường tập trung vào phần kỹ thuật: hệ thống có hoạt động không, Incident đã được xử lý chưa, deployment có thành công không, thiết bị có compliant hay không. Nhưng khi học **ITIL 4 Foundation**, mình nhận ra một góc nhìn lớn hơn: mục tiêu cuối cùng không phải chỉ là vận hành công nghệ, mà là tạo ra **Value** thông qua **Service**.

Bài viết này là ghi chú tổng hợp của mình về ITIL 4 Foundation. Mình trình bày bằng tiếng Việt để dễ hiểu, nhưng cố ý giữ lại những keyword ITIL quan trọng bằng tiếng Anh như **Value, Service, Product, Outcome, Output, Utility, Warranty, Incident, Problem, Change, Service Value System...** để khi đọc tài liệu hoặc gặp câu hỏi trong kỳ thi có thể nhận ra ngay.

> **Tóm tắt nhanh:** ITIL 4 nhìn Service Management như một hệ thống tạo **Value**. Muốn hiểu ITIL Foundation, hãy nắm chắc chuỗi logic: **Value → Service → Four Dimensions → Service Value System → Guiding Principles → Service Value Chain → Practices → Continual Improvement**.

## 1. Nền tảng của Service Management

### Service Management

**Service Management** là tập hợp các năng lực chuyên biệt của tổ chức nhằm tạo **Value** cho khách hàng dưới hình thức **Services**.

Điểm quan trọng ở đây là ITIL không coi IT chỉ là hệ thống, server, application hay network. Thứ khách hàng thực sự quan tâm là **Value** nhận được từ Service.

Ví dụ, IT Operations có thể cung cấp:

- Laptop.
- Microsoft 365.
- Microsoft Intune.
- VPN.
- Service Desk.
- Endpoint Security.

Nhưng người dùng không thực sự cần "Intune" hoặc "VPN" chỉ vì bản thân công nghệ đó tồn tại. Người dùng cần:

> Có thể làm việc an toàn, ổn định và truy cập được tài nguyên cần thiết.

Đó mới là **Outcome** mà Service đang hỗ trợ.

### Value

**Value** là lợi ích, tính hữu dụng và mức độ quan trọng mà một bên liên quan cảm nhận được.

**Thứ nhất, Value mang tính chủ quan.** Một Service có thể có Value rất cao đối với một nhóm người dùng nhưng thấp đối với nhóm khác.

**Thứ hai, Value được co-created.** ITIL 4 không xem Value là thứ Service Provider đơn phương "sản xuất" rồi giao cho khách hàng. **Service Provider và Service Consumer cùng tham gia vào quá trình tạo Value.**

### Organization và Stakeholder

**Organization** có thể là một cá nhân hoặc một nhóm người có chức năng, trách nhiệm, quyền hạn và các mối quan hệ nhằm đạt được mục tiêu chung.

Các **Stakeholders** có thể bao gồm:

- Employees
- Customers
- Users
- Sponsors
- Partners
- Suppliers
- Investors
- Shareholders
- Regulators
- Social groups

Vì vậy, Value không nhất thiết chỉ dành cho Customer.

## 2. Service, Product và Value

### Service

**Service** là phương tiện hỗ trợ việc co-create Value bằng cách giúp Customer đạt được **Outcomes** mong muốn mà Customer không phải tự quản lý toàn bộ **Costs** và **Risks** cụ thể.

> Customer quan tâm tới kết quả, không nhất thiết muốn tự xây dựng và quản lý tất cả những thứ phía sau kết quả đó.

Ví dụ với Microsoft 365: người dùng muốn gửi email, họp Teams, làm việc với tài liệu và cộng tác. Người dùng không muốn tự xây Exchange Server, hệ thống HA, storage, patching và toàn bộ infrastructure cần thiết. Service Provider quản lý một phần complexity, Cost và Risk đó.

### Product

**Product** là một cấu hình các resources của tổ chức được thiết kế để cung cấp Value cho Consumer. Một Product có thể kết hợp:

- People
- Processes
- Technology
- Information
- Partners
- Infrastructure

Một hoặc nhiều Products có thể được sử dụng làm nền tảng cho Services.

### Service Offering

Service Provider trình bày Service tới Consumer thông qua **Service Offering**. Service Offering có thể bao gồm:

1. **Goods**
2. **Access to resources**
3. **Service actions**

Ví dụ Service Offering cho một nhân viên mới:

- Laptop.
- Microsoft 365 account.
- VPN access.
- Application access.
- IT support.

> **Product** là cách Provider cấu hình resources, còn **Service Offering** là cách Service được trình bày cho một nhóm Consumer cụ thể.

### Service Relationship

**Service Relationship** là sự hợp tác giữa Service Provider và Service Consumer, bao gồm:

- **Service Provision** – các hoạt động Provider thực hiện để cung cấp Service.
- **Service Consumption** – các hoạt động Consumer thực hiện để sử dụng Service.
- **Service Relationship Management** – các hoạt động chung nhằm duy trì continual Value co-creation.

Một Organization có thể vừa là **Service Provider**, vừa là **Service Consumer**.

## 3. Customer, User, Sponsor và các khái niệm cốt lõi

### Customer, User, Sponsor

- **Customer** – xác định requirements của Service và chịu trách nhiệm về Outcomes của việc tiêu thụ Service.
- **User** – người trực tiếp sử dụng Service.
- **Sponsor** – người phê duyệt ngân sách cho Service Consumption.

Trong doanh nghiệp, ba vai trò này có thể là ba người khác nhau.

### Output và Outcome

**Output** là một deliverable hữu hình hoặc vô hình được tạo ra bởi một activity. Ví dụ: laptop đã cấu hình, account đã tạo, application đã deploy, báo cáo compliance đã tạo.

**Outcome** là kết quả dành cho Stakeholder được tạo điều kiện bởi một hoặc nhiều Outputs. Ví dụ: nhân viên mới có thể bắt đầu làm việc an toàn ngay trong ngày đầu tiên.

> **Output = cái chúng ta tạo ra.**
>
> **Outcome = kết quả mà Stakeholder đạt được nhờ những Output đó.**

### Cost

**Cost** là số tiền chi cho một activity hoặc resource. Từ góc nhìn Service Consumer:

- **Costs removed by the Service**
- **Costs imposed by the Service**

Service tốt không có nghĩa là không có Cost. Vấn đề là Cost có hợp lý so với Value nhận được hay không.

### Risk

**Risk** là một sự kiện có thể xảy ra, gây tổn thất hoặc khiến việc đạt mục tiêu trở nên khó khăn hơn. Service có thể loại bỏ hoặc giảm một số Risks cho Consumer, đồng thời tạo ra những Risks mới.

Consumer góp phần giảm Risk bằng cách:

- tham gia xác định requirements;
- truyền đạt Critical Success Factors rõ ràng;
- cung cấp resources cần thiết trong suốt Service Relationship.

### Utility và Warranty

**Utility – Fit for purpose:** *What does the Service do?* Functionality của Product hoặc Service đáp ứng một nhu cầu cụ thể.

**Warranty – Fit for use:** *How does the Service perform?* Đảm bảo Service đáp ứng các yêu cầu đã thỏa thuận như Availability, Capacity, Continuity, Security.

> **Utility = Service làm được gì?**
>
> **Warranty = Service làm việc đó tốt và đáng tin cậy đến mức nào?**

## 4. Four Dimensions of Service Management

ITIL 4 yêu cầu khi thiết kế hoặc quản lý Service phải nhìn toàn diện qua **Four Dimensions of Service Management**. Chúng áp dụng cho toàn bộ SVS, Service Value Chain và tất cả ITIL Practices.

### 1. Organizations and People

Bao gồm organizational structure, roles, responsibilities, culture, skills, competencies và communication. Technology tốt nhưng con người thiếu skills hoặc Organization bị chia thành các silo thì Service vẫn có thể thất bại. Mọi người cần hiểu mình đóng góp thế nào vào việc tạo Value.

### 2. Information and Technology

Bao gồm information, knowledge và technology cần để quản lý Service: workflow systems, knowledge bases, inventory systems, communication systems, analytical tools.

Các câu hỏi cần nghĩ tới:

- Service quản lý information gì?
- Information và knowledge nào cần thiết để vận hành Service?
- Information được bảo vệ, lưu trữ và hủy bỏ thế nào?

Culture của Organization cũng ảnh hưởng lớn tới lựa chọn technology.

### 3. Partners and Suppliers

Dimension này xem xét quan hệ với các tổ chức khác, cùng contracts và agreements. Ba hình thức hợp tác phổ biến:

- **Goods Supply** – Supplier bán hàng hóa, thường qua contract hoặc invoice.
- **Service Delivery** – Supplier cung cấp Service, ví dụ cloud computing.
- **Service Partnership** – hai bên cùng co-create Value, ví dụ outsource IT.

### 4. Value Streams and Processes

**Value Stream** là chuỗi các bước Organization thực hiện để tạo và cung cấp Products và Services tới Consumer. Value Stream giúp tìm value-adding activities, non-value-adding activities, waste và automation opportunities.

**Process** là tập hợp các activities có quan hệ với nhau, chuyển **inputs** thành **outputs**.

> **Process cho biết công việc được thực hiện như thế nào. Value Stream nhìn toàn bộ dòng chảy tạo Value.**

### External Factors – PESTLE

Four Dimensions chịu ảnh hưởng bởi các yếu tố bên ngoài, phân tích bằng **PESTLE**: **P**olitical, **E**conomic, **S**ocial, **T**echnological, **L**egal, **E**nvironmental.

## 5. Service Value System và Guiding Principles

### Service Value System

**Service Value System (SVS)** mô tả cách tất cả các thành phần và activities của Organization phối hợp thành một hệ thống để tạo Value.

**Opportunity / Demand → Service Value System → Value**

SVS gồm 5 thành phần:

1. **Guiding Principles**
2. **Governance**
3. **Service Value Chain**
4. **Practices**
5. **Continual Improvement**

Một mục tiêu quan trọng của SVS là tránh **organizational silos**.

- **Opportunity** – cơ hội tạo thêm Value cho Stakeholders.
- **Demand** – nhu cầu đối với Products và Services từ Consumer bên trong hoặc bên ngoài.

### 7 Guiding Principles

Guiding Principles là khuyến nghị áp dụng trong mọi hoàn cảnh, bất kể thay đổi về goals, strategy, type of work hay management structure.

#### 1. Focus on Value

Mọi hoạt động cần liên kết trực tiếp hoặc gián tiếp với **Value**: revenue, customer loyalty, cost reduction, growth opportunities. Câu hỏi luôn đặt ra: *Việc này tạo Value gì và cho ai?*

#### 2. Start Where You Are

Đừng mặc định phải bỏ mọi thứ và xây lại từ đầu. Đánh giá current state, xác định những gì đang hoạt động tốt và tận dụng chúng.

#### 3. Progress Iteratively with Feedback

Không làm tất cả cùng lúc. Chia công việc thành iterations nhỏ, thu feedback trước, trong và sau mỗi iteration.

**Iteration → Feedback → Learn → Adjust → Next iteration**

#### 4. Collaborate and Promote Visibility

Collaboration tốt hơn silo. Đúng người, đúng vai trò, đủ information và transparency giúp tăng buy-in và khả năng thành công lâu dài.

#### 5. Think and Work Holistically

Một Service hiếm khi chỉ phụ thuộc vào một team. Hãy nhìn toàn bộ: **People + Process + Technology + Suppliers + Information**.

#### 6. Keep It Simple and Practical

Dùng ít bước nhất để đạt mục tiêu. Nếu một Process, Activity hoặc Metric không tạo Value hay useful Outcome, hãy loại bỏ. Bắt đầu đơn giản, chỉ thêm controls khi thực sự cần.

#### 7. Optimize and Automate

> **Optimize first. Automate second.**

Tự động hóa một process kém hiệu quả chỉ làm nó chạy kém hiệu quả nhanh hơn. Với IT Operations, đây là nguyên tắc rất gần với PowerShell, Power Automate hay Intune remediation:

**Understand → Simplify → Optimize → Automate → Measure**

## 6. Governance, Service Value Chain và Continual Improvement

### Governance

**Governance** là cách Organization được chỉ đạo và kiểm soát. Governing body chịu trách nhiệm về performance và compliance, thực hiện ba hoạt động:

> **EDM = Evaluate → Direct → Monitor**

### Service Value Chain

**Service Value Chain** là operating model gồm các activities chủ chốt để phản hồi Demand và hỗ trợ việc tạo Value. Có 6 Value Chain Activities:

- **Plan** – tạo sự hiểu chung về vision, current status và improvement direction cho Four Dimensions và mọi Products, Services.
- **Improve** – đảm bảo Continual Improvement cho Products, Services và Practices.
- **Engage** – hiểu nhu cầu Stakeholders, duy trì transparency và relationships.
- **Design and Transition** – đảm bảo Products và Services đáp ứng kỳ vọng về quality, cost và time to market.
- **Obtain/Build** – đảm bảo Service components có đúng lúc, đúng nơi, đúng specification.
- **Deliver and Support** – đảm bảo Services được cung cấp và hỗ trợ theo agreed specifications.

**Common rules:**

- Mọi trao đổi với bên ngoài Value Chain đi qua **Engage**.
- Mọi resources mới có được qua **Obtain/Build**.
- Planning ở mọi cấp thực hiện qua **Plan**.
- Improvement ở mọi cấp khởi tạo và quản lý qua **Improve**.

Các activities kết hợp linh hoạt để tạo thành **Value Streams**, không bắt buộc chạy theo thứ tự cố định.

### Continual Improvement Model

1. **What is the vision?** – xác định Vision, gắn với objectives của Organization.
2. **Where are we now?** – đánh giá current state, baseline.
3. **Where do we want to be?** – xác định measurable targets, thực hiện **Gap Analysis**.
4. **How do we get there?** – xây improvement plan.
5. **Take action** – thực thi, có thể theo waterfall hoặc iterations.
6. **Did we get there?** – đo Metrics và KPIs.
7. **How do we keep the momentum going?** – củng cố kết quả, tạo đà cho vòng tiếp theo.

> **Vision → Current → Target → Plan → Action → Measure → Sustain**

## 7. ITIL Management Practices

ITIL 4 có **34 Management Practices**:

- **14 General Management Practices**
- **17 Service Management Practices**
- **3 Technical Management Practices**

### 14 General Management Practices

1. Architecture management
2. Continual improvement
3. Information security management
4. Knowledge management
5. Measurement and reporting
6. Organizational change management
7. Portfolio management
8. Project management
9. Relationship management
10. Risk management
11. Service financial management
12. Strategy management
13. Supplier management
14. Workforce and talent management

### 17 Service Management Practices

1. Availability management
2. Business analysis
3. Capacity and performance management
4. Change enablement
5. Incident management
6. IT asset management
7. Monitoring and event management
8. Problem management
9. Release management
10. Service catalogue management
11. Service configuration management
12. Service continuity management
13. Service design
14. Service desk
15. Service level management
16. Service request management
17. Service validation and testing

### 3 Technical Management Practices

1. Deployment management
2. Infrastructure and platform management
3. Software development and management

### Continual Improvement

Liên tục align Practices và Services với nhu cầu thay đổi của Business. Activities chính: khuyến khích improvement, dành time và budget, ghi nhận opportunities trong **Continual Improvement Register (CIR)**. **Continual Improvement là trách nhiệm của mọi người**, senior management chịu trách nhiệm đưa nó vào văn hóa làm việc.

### Information Security Management

Bảo vệ information cần thiết cho hoạt động của Organization, dựa trên **CIA**: **Confidentiality, Integrity, Availability**, cùng authentication và non-repudiation. Cần cân bằng giữa **Prevention, Detection** và **Correction**.

### Relationship Management

Thiết lập và nuôi dưỡng liên kết giữa Organization và Stakeholders ở strategic và tactical level: hiểu nhu cầu, ưu tiên Products/Services, duy trì satisfaction cao.

### Supplier Management

Đảm bảo Suppliers và performance của họ được quản lý phù hợp, xây dựng quan hệ hợp tác chặt chẽ để tạo Value mới và giảm Risk thất bại.

## 8. Các Service Management Practices quan trọng

### Change Enablement

**Change** là việc thêm, sửa hoặc loại bỏ bất cứ thứ gì có thể ảnh hưởng trực tiếp hoặc gián tiếp tới Services. Mục tiêu là tối đa hóa số Change thành công bằng cách đánh giá Risk, authorize Change và quản lý **Change Schedule**. Người hoặc nhóm phê duyệt là **Change Authority**.

- **Standard Change** – low-risk, pre-authorized, đã được hiểu rõ và document đầy đủ.
- **Normal Change** – cần schedule, assess và authorize theo process.
- **Emergency Change** – triển khai càng sớm càng tốt, thường được expedite và không nằm trong Change Schedule.

### Incident Management

**Incident** là sự gián đoạn ngoài kế hoạch đối với Service hoặc suy giảm chất lượng Service.

> Mục tiêu: **restore normal Service operation as quickly as possible.**

Incident cần được logged, prioritized theo agreement và resolved trong thời gian đáp ứng kỳ vọng. Một số Incident do User tự xử lý (self-help), một số do Service Desk, Incident phức tạp được escalate tới support teams, Suppliers hoặc Partners. Major Incidents và Security Incidents thường có process riêng; trường hợp cực đoan có thể kích hoạt disaster recovery plan.

### Problem Management

**Problem** là nguyên nhân hoặc nguyên nhân tiềm ẩn của một hoặc nhiều Incidents. Mục tiêu là giảm khả năng xảy ra và Impact của Incidents.

- **Known Error** – Problem đã được analyzed nhưng chưa resolved.
- **Workaround** – giải pháp giảm hoặc loại bỏ Impact khi chưa có full resolution.
- **Error control** – quản lý Known Errors, có thể dẫn tới change request cho permanent solution.

Problems được ưu tiên dựa trên Risk mà chúng gây ra.

### IT Asset Management

**IT Asset** là component có giá trị tài chính đóng góp vào việc cung cấp IT Product hoặc Service: software, hardware, networking, cloud services, client devices. Mục tiêu là quản lý full lifecycle của IT Assets.

### Monitoring and Event Management

**Event** là thay đổi trạng thái có ý nghĩa đối với việc quản lý Service hoặc **Configuration Item (CI)**.

- **Informational Event** – không cần hành động ngay.
- **Warning Event** – cho phép hành động trước khi có tác động tiêu cực.
- **Exception Event** – cần hành động, dù business impact có thể chưa xảy ra.

### Release Management

**Release** là một version của Service hoặc CI, hoặc tập hợp CIs, được làm sẵn sàng để sử dụng. Release có thể rất nhỏ (một feature) hoặc rất lớn.

### Service Configuration Management

**Configuration Item (CI)** là component cần quản lý để cung cấp IT Service: hardware, software, networks, buildings, people, suppliers, documentation. Mục tiêu là đảm bảo thông tin configuration chính xác, tin cậy, có sẵn khi cần.

### Service Desk

Service Desk là **entry point** và **single point of contact** giữa Service Provider và Users, tiếp nhận Incidents và Service Requests. Channels gồm phone, service portal, mobile app, knowledge base, live chat, chatbot. Service Desk có thể centralized hoặc virtual; nhân sự cần skills kỹ thuật, business và đặc biệt là customer service.

### Service Level Management

**Service Level** là một hoặc nhiều Metrics xác định chất lượng Service kỳ vọng hoặc đã đạt được. Practice này đặt business-based targets, thống nhất với Customer, monitor, thực hiện Service Reviews và báo cáo Service Issues, mang lại end-to-end visibility.

> Đừng chỉ đo những Metrics IT thấy dễ đo. Hãy đo những thứ phản ánh Value và Customer Outcome.

### Service Request Management

**Service Request** là yêu cầu từ User hoặc đại diện được ủy quyền, khởi tạo một Service Action đã được thống nhất là phần bình thường của Service Delivery: request action, information, resource, access, hoặc feedback/compliments/complaints.

Service Requests nên được standardized và automated, có policy rõ về những request không cần thêm approval, và kỳ vọng fulfilment time phải rõ ràng.

### Deployment Management

Chuyển hardware, software, documentation, processes hoặc component mới/thay đổi vào live environment (hoặc test, staging).

- **Phased Deployment** – triển khai dần từng phần production.
- **Continuous Delivery** – components được integrated, tested và deployed khi cần.
- **Big Bang Deployment** – triển khai đến toàn bộ targets cùng lúc.
- **Pull Deployment** – software đặt trong controlled repository, User tự tải khi cần.

## 9. Những cặp khái niệm rất dễ nhầm

| Khái niệm | Ý nghĩa cần nhớ |
|---|---|
| **Output** | Thứ được tạo ra từ một Activity |
| **Outcome** | Kết quả Stakeholder đạt được nhờ Outputs |
| **Utility** | What the Service does – fit for purpose |
| **Warranty** | How the Service performs – fit for use |
| **Incident** | Service bị gián đoạn hoặc giảm chất lượng |
| **Problem** | Cause hoặc potential cause của Incidents |
| **Known Error** | Problem đã analyzed nhưng chưa resolved |
| **Workaround** | Giảm Impact khi chưa có full resolution |
| **Event** | Change of state có ý nghĩa đối với Service/CI |
| **Change** | Addition, modification hoặc removal có thể ảnh hưởng Service |
| **Release** | Version/component được làm available for use |
| **Deployment** | Di chuyển component vào environment |
| **Customer** | Defines requirements, chịu trách nhiệm về Outcomes |
| **User** | Uses the Service |
| **Sponsor** | Authorizes budget |

### Bức tranh tổng thể

```text
Opportunity + Demand
        |
        v
Service Value System (SVS)
        ├── Guiding Principles
        ├── Governance
        ├── Service Value Chain
        │     ├── Plan
        │     ├── Improve
        │     ├── Engage
        │     ├── Design & Transition
        │     ├── Obtain/Build
        │     └── Deliver & Support
        ├── Practices (34)
        └── Continual Improvement
              |
              v
            Value
```

## Kết luận

Điều mình thấy giá trị nhất sau khi hệ thống lại ITIL 4 Foundation là **ITIL không đơn thuần nói về ticket, Incident hay Change**. ITIL đưa ra cách nhìn toàn diện về cách một Organization sử dụng People, Process, Technology, Partners và Practices để cùng Consumer tạo **Value** thông qua **Services**.

Nếu chỉ nhớ một trục xuyên suốt: **Focus on Value → Think Holistically → Optimize → Automate → Continually Improve.**

Với người làm IT Operations, đây là cách chuyển tư duy từ **"quản lý hệ thống"** sang **"quản lý Service tạo ra Value cho Business"**. Bài tiếp theo mình sẽ đi sâu vào tình huống thực tế để phân biệt **Incident, Problem, Change, Service Request và Event**.

**Bạn đang áp dụng nguyên tắc nào của ITIL 4 nhiều nhất trong công việc IT hằng ngày?**
