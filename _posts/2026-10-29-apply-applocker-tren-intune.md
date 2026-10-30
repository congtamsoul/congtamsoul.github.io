---
layout: post
title: "Apply AppLocker trên Intune bằng Custom OMA-URI: chuyển GPO on-premises sang thiết bị cloud"
seo_title: "Apply AppLocker trên Intune bằng OMA-URI"
description: "Hướng dẫn export AppLocker từ GPO on-premises, tạo Intune Custom Profile với OMA-URI cho EXE, MSI, Appx, Script và kiểm tra kết quả bằng Event Viewer."
date: 2026-10-29
author: "Tam Nguyen"
reading_time: 9
topic: security
thumb_label: "APPLOCKER"
tags:
  - Intune
  - AppLocker
  - Security
  - Hybrid
card_tags:
  - Intune
  - AppLocker
summary: "Đưa AppLocker từ GPO on-premises lên Intune bằng Custom OMA-URI cho EXE, MSI, Appx, Script, và cách kiểm tra rule có chặn đúng không."
redirect_from:
  - /posts/apply-applocker-tren-intune.html
---

Công ty mình chặn phần mềm không được phép bằng **AppLocker qua GPO** từ lâu. Cách này chạy tốt với máy nằm trong mạng nội bộ. Nhưng khi ngày càng nhiều laptop làm việc từ xa, ít khi kết nối về domain controller, policy trên máy cứ cũ dần, và app vừa bị chặn ở văn phòng lại chạy bình thường ở nhà. Intune không có giao diện cấu hình AppLocker riêng, nhưng có thể đẩy chính các rule đó xuống máy qua **AppLocker CSP**. Bài này hướng dẫn cách mình chuyển rule từ GPO lên Intune cho môi trường Hybrid.

> **Tóm tắt nhanh:** Export AppLocker từ GPO on-premises ra XML. Mỗi loại rule (Exe, Msi, Appx, Script) lấy phần từ `<RuleCollection ...>` đến `</RuleCollection>`, dán vào một dòng OMA-URI trong Intune Custom Profile, kiểu String. Assign profile cho group, rồi kiểm tra kết quả trong Event Viewer: **Applications and Services Logs > Microsoft > Windows > AppLocker**.

## Bối cảnh: vì sao cần đưa AppLocker lên Intune

| | GPO on-premises | Intune Custom Profile |
|---|---|---|
| Máy nhận policy khi | Kết nối được tới domain controller | Có Internet và check-in với Intune |
| Máy làm việc từ xa | Policy dễ bị cũ | Luôn nhận policy mới |
| Giao diện cấu hình | Có sẵn trong GPMC | Không có, phải dùng OMA-URI và XML |
| Báo cáo | Không có | Có trạng thái Succeeded / Error theo từng máy |

Intune không có mục cấu hình AppLocker trên giao diện. Cách làm là dùng **Custom profile** và gửi XML qua **AppLocker CSP** (`./Vendor/MSFT/AppLocker`). Như vậy GPMC vẫn là nơi soạn rule, còn Intune chỉ là kênh đưa rule xuống máy.

## Bước 1: Export AppLocker từ GPO on-premises

Có hai cách lấy XML.

**Cách 1: dùng GPMC**

1. Mở **Group Policy Management**, edit GPO AppLocker.
2. Vào **Computer Configuration > Policies > Windows Settings > Security Settings > Application Control Policies > AppLocker**.
3. Chuột phải **AppLocker > Export Policy...**, lưu ra file `.xml`.

**Cách 2: dùng PowerShell**

```powershell
# Export policy từ GPO (đổi đường dẫn LDAP theo GPO của bạn)
Get-AppLockerPolicy -Domain -Ldap "LDAP://CN={GPO-GUID},CN=Policies,CN=System,DC=contoso,DC=local" -Xml |
  Out-File C:\Temp\AppLocker_GPO.xml -Encoding utf8

# Hoặc export policy hiệu lực trên một máy đã nhận GPO
Get-AppLockerPolicy -Effective -Xml | Out-File C:\Temp\AppLocker_Effective.xml -Encoding utf8
```

File XML có cấu trúc như sau. Mỗi khối `RuleCollection` tương ứng với một dòng OMA-URI trên Intune:

```xml
<AppLockerPolicy Version="1">
  <RuleCollection Type="Exe" EnforcementMode="NotConfigured"> ... </RuleCollection>
  <RuleCollection Type="Msi" EnforcementMode="NotConfigured"> ... </RuleCollection>
  <RuleCollection Type="Appx" EnforcementMode="NotConfigured"> ... </RuleCollection>
  <RuleCollection Type="Script" EnforcementMode="NotConfigured"> ... </RuleCollection>
  <RuleCollection Type="Dll" EnforcementMode="NotConfigured"> ... </RuleCollection>
</AppLockerPolicy>
```

Trong mỗi khối có thể có ba loại điều kiện: **FilePublisherRule** (theo chữ ký số), **FilePathRule** (theo đường dẫn) và **FileHashRule** (theo hash file).

### Tách XML theo từng loại

Script dưới đây tách file export thành từng file nhỏ, mỗi file đúng một khối `RuleCollection`, để copy vào Intune cho tiện:

```powershell
[xml]$xml = Get-Content C:\Temp\AppLocker_GPO.xml -Raw
foreach ($rc in $xml.AppLockerPolicy.RuleCollection) {
    $out = "C:\Temp\AppLocker_$($rc.Type).xml"
    $rc.OuterXml | Out-File $out -Encoding utf8
    Write-Host "$($rc.Type): $($rc.ChildNodes.Count) rule(s) -> $out"
}
```

### Script của mình


```powershell
# Export-AppLockerForIntune.ps1
# Export GPO -> tách theo RuleCollection -> sẵn sàng dán vào OMA-URI

```

## Bước 2: Tạo Custom Configuration Profile trên Intune

1. Vào **Intune admin center > Devices > Windows > Configuration > Create > New policy**.
2. Platform: **Windows 10 and later**. Profile type: **Templates > Custom**.
3. Đặt tên profile, ví dụ `AppLocker - Block Apps`.
4. Ở **Configuration settings**, thêm 4 dòng OMA-URI như bảng dưới.

| Name | OMA-URI | Data type | Value |
|---|---|---|---|
| Block EXE | `./Vendor/MSFT/AppLocker/ApplicationLaunchRestrictions/apps/EXE/Policy` | String | Khối `<RuleCollection Type="Exe" ...>` |
| Block MSI | `./Vendor/MSFT/AppLocker/ApplicationLaunchRestrictions/apps/MSI/Policy` | String | Khối `<RuleCollection Type="Msi" ...>` |
| Block Appx | `./Vendor/MSFT/AppLocker/ApplicationLaunchRestrictions/apps/StoreApps/Policy` | String | Khối `<RuleCollection Type="Appx" ...>` |
| Block Script | `./Vendor/MSFT/AppLocker/ApplicationLaunchRestrictions/apps/Script/Policy` | String | Khối `<RuleCollection Type="Script" ...>` |

Phần `apps` trong đường dẫn là tên nhóm (*Grouping*) do mình tự đặt. Cả 4 dòng phải dùng **cùng một tên nhóm**.

### Value: copy đúng một khối RuleCollection

Ở ô **Value**, copy từ dòng mở `<RuleCollection Type="Exe" EnforcementMode="NotConfigured">` đến dòng đóng `</RuleCollection>`. **Không** copy thẻ `<AppLockerPolicy>` bên ngoài.

```xml
<RuleCollection Type="Exe" EnforcementMode="NotConfigured">
  <FilePathRule Id="..." Name="Allow all" Description="" UserOrGroupSid="S-1-1-0" Action="Allow">
    <Conditions>
      <FilePathCondition Path="*" />
    </Conditions>
  </FilePathRule>
  <FilePublisherRule Id="..." Name="Razer Synapse" Description="TICKET-ID - Block Razer Synapse" UserOrGroupSid="S-1-1-0" Action="Deny">
    <Conditions>
      <FilePublisherCondition PublisherName="..." ProductName="*" BinaryName="*">
        <BinaryVersionRange LowSection="*" HighSection="*" />
      </FilePublisherCondition>
    </Conditions>
  </FilePublisherRule>
</RuleCollection>
```

*Hình 1: dòng OMA-URI Block EXE, kiểu String, Value là khối RuleCollection.*

Mô hình mình dùng là **Allow all + Deny từng app**: một rule `Allow` cho `Path="*"`, sau đó thêm các rule `Deny` cho app cần chặn. Vì Deny luôn được ưu tiên hơn Allow, app nằm trong rule Deny sẽ bị chặn, còn các app khác vẫn chạy bình thường.

<div class="callout warn">
  <span>⚠️</span>
  <div><b>Lưu ý</b><code>EnforcementMode="NotConfigured"</code> không có nghĩa là tắt. Khi một rule collection có rule, AppLocker sẽ <b>enforce</b> nó. Nếu muốn chạy thử mà không chặn, đổi thành <code>AuditOnly</code> và theo dõi event 8003 / 8006 trước. Ngoài ra, nếu một collection chỉ có rule Deny mà <b>không có rule Allow</b>, mọi thứ thuộc loại đó sẽ bị chặn.</div>
</div>

### Script của mình


```xml
<!-- Block EXE - Value -->

```

```xml
<!-- Block MSI - Value -->

```

```xml
<!-- Block Appx - Value -->

```

```xml
<!-- Block Script - Value -->

```

## Bước 3: Assign profile cho group

1. Ở **Assignments**, chọn group thiết bị hoặc người dùng cần áp dụng.
2. Thêm **Scope tag** nếu môi trường có nhiều quốc gia hoặc nhiều đội quản trị.
3. **Review + create**.

*Hình 2: profile Custom với 4 dòng Block EXE, MSI, Appx, Script.*

Nên rollout theo vòng: **nhóm IT pilot → một phòng ban nhỏ → toàn công ty**. Mỗi vòng chờ vài ngày để phát hiện app bị chặn nhầm.

## Bước 4: Kiểm tra kết quả trên thiết bị

### Ép máy đồng bộ với Intune

Trên máy: **Settings > Accounts > Access work or school > chọn tài khoản > Info > Sync**. Hoặc trên Intune: **Devices > chọn máy > Sync**.

### Kiểm tra policy đã xuống máy chưa

```powershell
# Service AppLocker phải đang chạy
Get-Service AppIDSvc

# Policy đang hiệu lực trên máy
Get-AppLockerPolicy -Effective -Xml | Out-File C:\Temp\Effective.xml
Select-String -Path C:\Temp\Effective.xml -Pattern 'Razer'

# Policy do Intune (CSP) đẩy xuống
Get-ChildItem 'HKLM:\SOFTWARE\Microsoft\PolicyManager\current\device\ApplicationLaunchRestrictions' -ErrorAction SilentlyContinue

# Test một file cụ thể có bị chặn không
Get-AppLockerFileInformation -Path "C:\Path\To\App.exe" |
  Test-AppLockerPolicy -XmlPolicy C:\Temp\Effective.xml -User Everyone
```

### Kiểm tra trong Event Viewer

1. Trên máy, chạy file cài đặt của app muốn chặn. Nếu rule hoạt động, Windows sẽ báo app đã bị quản trị viên chặn.
2. Mở **Event Viewer**, vào **Applications and Services Logs > Microsoft > Windows > AppLocker**.
3. Xem log tương ứng với loại file:

| Log | Allowed | Audit (sẽ bị chặn) | Blocked |
|---|---|---|---|
| EXE and DLL | 8002 | 8003 | **8004** |
| MSI and Script | 8005 | 8006 | **8007** |
| Packaged app-Execution | 8020 | 8021 | **8022** |
| Packaged app-Deployment | 8023 | 8024 | **8025** |

Hoặc lấy nhanh bằng PowerShell:

```powershell
Get-WinEvent -LogName 'Microsoft-Windows-AppLocker/EXE and DLL' -MaxEvents 100 |
  Where-Object Id -in 8003,8004 | Select-Object TimeCreated, Id, Message | Format-List

Get-WinEvent -LogName 'Microsoft-Windows-AppLocker/MSI and Script' -MaxEvents 100 |
  Where-Object Id -in 8006,8007 | Select-Object TimeCreated, Id, Message | Format-List
```

<div class="callout">
  <span>💡</span>
  <div><b>Tip</b>Event 8004 / 8007 cho biết đường dẫn file và tên rule đã chặn. Đây là bằng chứng nhanh nhất khi user báo "không mở được app": chỉ cần nhìn tên rule là biết bị chặn bởi AppLocker hay bởi nguyên nhân khác.</div>
</div>

## Những lỗi mình đã gặp

| Lỗi | Triệu chứng | Nguyên nhân gốc | Cách xử lý |
|---|---|---|---|
| Profile báo **Error** trên Intune | Trạng thái 0x87d1fde8 hoặc Remediation failed | Copy cả thẻ `<AppLockerPolicy>`, hoặc XML bị lỗi cú pháp | Chỉ copy từ `<RuleCollection>` đến `</RuleCollection>`, kiểm tra XML trước khi dán |
| Profile Succeeded nhưng không chặn | Không có event 8004 | Service `AppIDSvc` không chạy | Kiểm tra service; với GPO thì set Automatic, với Intune có thể dùng thêm Settings catalog / script để bật |
| App vẫn chạy | Rule không khớp | Rule Publisher không khớp chữ ký của file cài đặt, hoặc app chạy từ `%LOCALAPPDATA%` | Lấy Publisher bằng `Get-AppLockerFileInformation` từ chính file exe, thêm rule cho file cài đặt và file chạy |
| Chặn nhầm cả Windows | User không mở được app hệ thống | Collection chỉ có rule Deny, không có rule Allow | Luôn có rule Allow (Allow all hoặc default rules) trong mỗi collection |
| Rule cũ vẫn còn | Đã xóa rule trên GPO nhưng máy vẫn chặn | Máy nhận cùng lúc cả GPO và Intune, policy hiệu lực là kết hợp của cả hai | Xóa rule ở cả hai nơi, hoặc loại máy khỏi GPO khi đã chuyển hẳn sang Intune |
| Policy không có hiệu lực trên một số máy | Không chặn dù đã nhận profile | Edition Windows không hỗ trợ enforce AppLocker | Kiểm tra edition (`Get-ComputerInfo WindowsEditionId`), đối chiếu với tài liệu AppLocker CSP |

Một lưu ý nhỏ nhưng quan trọng: **không ghi link nội bộ hay thông tin nhạy cảm vào trường Description** của profile và của rule. Trường này có thể được người khác đọc qua báo cáo và trên máy. Hãy ghi mã ticket là đủ.

## Kết luận

Intune không có giao diện cấu hình AppLocker, nhưng với 4 dòng OMA-URI, bạn có thể dùng lại toàn bộ rule đã xây trên GPO và đưa chúng xuống cả những máy không bao giờ về văn phòng. Hãy bắt đầu bằng `AuditOnly` trên nhóm pilot, đọc event 8003 / 8006 trong một tuần, rồi mới chuyển sang enforce.

Bạn đang dùng AppLocker, WDAC (App Control for Business) hay giải pháp bên thứ ba để kiểm soát ứng dụng?

<!--
Phần cuối bài (nút Chia sẻ LinkedIn, Facebook, Copy link, khung tác giả, bài trước/sau)
và Mục lục bên phải được layout tự thêm vào, không cần viết trong file này.
Xem trước trên máy: bundle exec jekyll serve --unpublished (chỉ cần khi bài còn published: false).
-->
