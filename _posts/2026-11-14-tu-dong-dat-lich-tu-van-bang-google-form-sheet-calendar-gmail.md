---
layout: post
title: "Tự động đặt lịch tư vấn khách hàng bằng Google Form, Sheet, Calendar và Gmail (không cần Power Automate)"
seo_title: "Tự động đặt lịch tư vấn bằng Google Form + Calendar"
description: "Hướng dẫn xây flow đặt lịch tư vấn tự động bằng Google Form, Sheet, Apps Script, Calendar và Gmail: chỉ hiện giờ trống, chống trùng lịch, tự gửi email xác nhận."
date: 2026-11-14
author: "Tam Nguyen"
reading_time: 12
topic: dx
thumb_label: "TỰ ĐỘNG HÓA"
image: /images/photo/45.jpg
tags:
  - Google Workspace
  - Apps Script
  - Automation
card_tags:
  - Apps Script
summary: "Khách chọn giờ trong Form, hệ thống kiểm tra Calendar, tạo lịch họp và gửi email xác nhận. Chỉ dùng công cụ Google, có sẵn code để copy."
redirect_from:
  - /posts/tu-dong-dat-lich-tu-van-google-form-calendar-gmail.html
---

Một công ty tư vấn luật doanh nghiệp nhận đăng ký tư vấn qua biểu mẫu trực tuyến, nhưng chỉ tiếp khách trong những khung giờ cố định mỗi tuần. Với mỗi đơn, người trực lễ tân phải đọc form, mở lịch kiểm tra giờ đó có trống không, tạo sự kiện, thêm khách vào lời mời, tạo link họp rồi soạn email xác nhận. Làm vài đơn thì ổn, nhưng làm đều mỗi ngày thì vừa tốn thời gian vừa dễ nhầm giờ hoặc đặt trùng.

Mình đã dựng một flow tự động cho bài toán này chỉ bằng **Google Form, Google Sheet, Google Calendar và Gmail**, kết nối bằng Google Apps Script. Không cần Power Automate, không cần Microsoft Bookings, không cần mua thêm phần mềm nào. Bài này chia sẻ toàn bộ kiến trúc, cách cài đặt và code hoàn chỉnh để bạn copy về dùng.

> **Tóm tắt nhanh:** Khách chọn khung giờ trong một câu hỏi Dropdown (chỉ hiện giờ còn trống). Khi khách gửi form, script kiểm tra lại Calendar, nếu trống thì tạo sự kiện kèm Google Meet và gửi email xác nhận cho khách và cho bạn. Nếu bận, khách nhận email kèm 3 khung giờ trống gần nhất. Khung giờ tiếp khách chỉnh trực tiếp trong một tab của Google Sheet, không phải sửa code.

## Bối cảnh: vì sao không dùng Power Automate hoặc Bookings

Yêu cầu ban đầu của mình là làm bằng Microsoft 365. Nhưng giấy phép trong trường hợp này **không có Power Automate và không có Microsoft Bookings**. Khi chỉ còn Microsoft Forms, Outlook và Excel, mình chỉ làm được giải pháp *bán tự động*: Forms không đọc được Outlook Calendar, và không có flow nào tự tạo sự kiện hay tự gửi email.

Google Workspace (hoặc cả tài khoản Gmail cá nhân để thử nghiệm) lại cho phép làm trọn vòng tự động, nhờ Apps Script đọc được Calendar, sửa được Form và gửi được Gmail. Dưới đây là so sánh nhanh:

| Khả năng | Microsoft Forms + Outlook + Excel | Google Form + Sheet + Calendar + Gmail |
|---|---|---|
| Tự tạo sự kiện trên lịch | Không (thủ công) | Có, bằng Apps Script |
| Tự gửi email xác nhận | Không (thủ công) | Có |
| Ẩn khung giờ đã bận trong Form | Không | Có, script ghi lại danh sách lựa chọn |
| Chi phí thêm | Không | Không |

## Kiến trúc và cách vận hành

Luồng dữ liệu đi như sau:

```text
Khách hàng
   │  chọn khung giờ (chỉ thấy giờ còn trống)
   ▼
Google Form ──► Google Sheet (tab Form Responses 1)
                    │  trigger "On form submit"
                    ▼
              Apps Script: processBookingForm
                    │  1. đọc và kiểm tra dữ liệu
                    │  2. kiểm tra Google Calendar lần cuối
                    ├─ Trống ─► tạo sự kiện (+ Meet) ─► Gmail xác nhận khách + admin
                    ├─ Bận ───► Gmail gửi khách 3 giờ trống gần nhất
                    └─ Sai dữ liệu ─► Gmail nhắc khách kiểm tra lại
```

Script dùng **3 trigger**, mỗi cái đảm nhận một việc:

| Trigger | Hàm chạy | Khi nào chạy | Tác dụng |
|---|---|---|---|
| From spreadsheet, On form submit | `processBookingForm` | Ngay khi khách gửi Form | Kiểm tra, tạo lịch, gửi email |
| Time-driven | `refreshFormSlots` | Mỗi 10 phút | Làm mới danh sách giờ trống trên Form |
| Calendar, Changed | `refreshFormSlots` | Khi Calendar có sự kiện được tạo, sửa, xoá | Làm mới Form nhanh hơn |

### Google Form không tự cập nhật theo Calendar, vậy làm sao chỉ hiện giờ trống?

Google Form **không** tự đọc Calendar. Cách làm ở đây là để Apps Script *ghi lại danh sách lựa chọn của câu hỏi Dropdown* mỗi khi lịch thay đổi. Vì vậy danh sách luôn gần đúng nhưng **không phải thời gian thực**. Hai lớp bảo vệ bù lại khoảng trễ này:

- Khi khách gửi form, script **xếp hàng xử lý từng đơn một** (dùng `LockService`) và **kiểm tra Calendar lần cuối** ngay trước khi tạo sự kiện.
- Nếu hai khách cùng chọn một giờ, người đến sau nhận email "giờ không còn khả dụng" kèm 3 giờ thay thế.

## Chuẩn bị Form và Sheet

### Câu hỏi trong Google Form

Tạo Form với các câu hỏi sau, bật **Required** cho tất cả. Tiêu đề câu hỏi cần chứa đúng các từ khóa như bảng dưới vì script tìm cột theo tiêu đề.

| Câu hỏi | Loại | Ghi chú |
|---|---|---|
| Họ và tên | Short answer | Tiêu đề chứa "Họ và tên" |
| Email doanh nghiệp | Short answer | Tiêu đề chứa "Email" |
| Tên công ty | Short answer | Tiêu đề chứa "Tên công ty" |
| Mã số thuế | Short answer | Dùng Short answer để giữ số 0 ở đầu |
| Chức vụ | Short answer | |
| Số điện thoại | Short answer | Tiêu đề chứa "Số điện thoại" |
| Nội dung cần tư vấn | Paragraph | Tiêu đề chứa "Nội dung tư vấn" hoặc "Nhu cầu" |
| Hình thức họp | Multiple choice | Lựa chọn chứa "trực tuyến", "trực tiếp", "điện thoại" |
| **Ngày và Khung giờ đề xuất họp** | **Dropdown** | Script sẽ tự điền các lựa chọn |

Với câu hỏi cuối, bạn **bắt buộc dùng Dropdown** (hoặc Multiple choice), không dùng dạng lưới. Lưới trắc nghiệm không cho ẩn từng ô, nên script không cập nhật được.

Phần kiểm tra dữ liệu có thể làm sơ bộ ngay trong Form bằng *Response validation* (kiểu Email, hoặc Regular expression để chặn `gmail.com`, `yahoo.com`...). Phần script bên dưới kiểm tra thêm định dạng email và khung giờ.

### Liên kết Form với Sheet

Trong Form, vào tab **Responses** → **Link to Sheets** để tạo Google Sheet nhận câu trả lời. Sau đó mở Sheet này, chọn **Extensions → Apps Script**. Mở Apps Script từ chính Sheet giúp script tự biết Sheet nào đang dùng.

## Cài đặt từng bước

1. Trong Apps Script, bấm **Services (+)**, chọn **Google Calendar API**, giữ tên mặc định `Calendar`, bấm **Add**.
2. Xoá code mẫu, dán toàn bộ code ở phần dưới vào.
3. Sửa các giá trị đầu file: `ADMIN_EMAIL`, `COMPANY_NAME`, `COMPANY_CONTACT`, `OFFICE_ADDRESS`. Nếu tab trả lời của bạn không tên là `Form Responses 1` thì sửa `RESPONSE_SHEET` cho khớp.
4. Chọn hàm `initConfigSheet` và bấm **Run**. Hàm này tạo tab `Config_Slots` với lịch mẫu từ Thứ 2 đến Thứ 6, 7 khung giờ mỗi ngày.
5. Mở tab `Config_Slots` và sửa cho đúng lịch tiếp khách thật của bạn (xem mục dưới).
6. Chọn hàm `setupTriggers` và bấm **Run**. Lần đầu Google sẽ xin quyền: **Review permissions → Advanced → Go to project (unsafe) → Allow**.
7. Mở Execution log, bạn phải thấy 3 dòng `OK`. Bấm biểu tượng đồng hồ **Triggers** ở thanh bên trái, kiểm tra đã có 3 trigger.

<div class="callout danger">
  <span>⛔</span>
  <div><b>Nguy hiểm</b>Chỉ chạy <code>initConfigSheet</code> một lần duy nhất. Hàm này <b>xoá và ghi đè</b> toàn bộ tab <code>Config_Slots</code>, nên nếu chạy lại bạn sẽ mất các khung giờ đã chỉnh.</div>
</div>

## Quản lý khung giờ tiếp khách bằng Config_Slots

Mỗi dòng trong tab `Config_Slots` là một khung giờ lặp lại hằng tuần:

| Cột | Ý nghĩa | Ví dụ |
|---|---|---|
| Weekday | 1 = Thứ 2, 2 = Thứ 3, ... 7 = Chủ nhật | `1` |
| Start | Giờ bắt đầu, dạng `HH:mm` (24 giờ) | `14:00` |
| End | Giờ kết thúc, dạng `HH:mm` | `15:00` |
| Active | `TRUE` để mở, `FALSE` để tạm tắt | `TRUE` |

Một vài thao tác thường gặp:

- **Tạm không tiếp khách một khung giờ cố định:** đổi `Active` thành `FALSE`, không cần xoá dòng.
- **Thêm khung giờ:** thêm một dòng mới ở cuối bảng.
- **Nghỉ đột xuất một ngày cụ thể:** tạo sự kiện **Busy** trong Google Calendar vào đúng giờ đó. Các slot trùng sẽ tự biến mất khỏi Form.
- **Cập nhật Form ngay sau khi sửa bảng:** chạy tay hàm `refreshFormSlots`, hoặc chờ tối đa 10 phút.

<div class="callout warn">
  <span>⚠️</span>
  <div><b>Lưu ý</b>Hai cột giờ (Start, End) phải để dạng văn bản thuần và gõ theo dạng <code>09:00</code>, không gõ AM/PM. Nếu Sheets tự đổi sang kiểu giờ, script sẽ báo lỗi "Giờ không hợp lệ".</div>
</div>

## Code hoàn chỉnh

Thay các giá trị trong ngoặc vuông như `[ADMIN_EMAIL]` bằng thông tin thật của bạn.

```javascript
/*********************************************************************
 * ĐẶT LỊCH TƯ VẤN TỰ ĐỘNG: Google Form -> Google Sheet -> Google Calendar -> Gmail
 * Dán vào Apps Script (nên mở từ Sheet: Extensions > Apps Script).
 * Bật dịch vụ: Services (+) > Google Calendar API (giữ tên "Calendar")
 *********************************************************************/
var CONFIG = {
  ADMIN_EMAIL: '[ADMIN_EMAIL]',
  SPREADSHEET_ID: '',               // chỉ cần điền nếu script KHÔNG mở từ Sheet
  FORM_ID: '',                      // để trống nếu Form đã liên kết với Sheet
  RESPONSE_SHEET: 'Form Responses 1', // tên tab chứa câu trả lời của Form
  SLOT_SHEET: 'Config_Slots',
  CALENDAR_ID: 'primary',
  TZ: 'Asia/Ho_Chi_Minh',
  COMPANY_NAME: '[COMPANY_NAME]',
  COMPANY_CONTACT: '[COMPANY_PHONE] | [COMPANY_EMAIL]',
  OFFICE_ADDRESS: '[OFFICE_ADDRESS]',
  SLOT_QUESTION_KEYWORD: 'Ngày và Khung giờ đề xuất họp',
  DAYS_AHEAD: 6,           // mở lịch trong N ngày tới
  MIN_LEAD_HOURS: 2,       // phải đặt trước ít nhất N giờ
  BUFFER_MIN: 0,           // thời gian đệm giữa 2 cuộc họp (phút)
  CREATE_MEET_LINK: true,  // họp online: tự tạo link Google Meet
  SEND_CALENDAR_INVITE: true,
  REFRESH_MINUTES: 10      // chỉ nhận 1, 5, 10, 15, 30
};

var STATUS = {
  OK: '✅ ĐÃ XÁC NHẬN LỊCH',
  BUSY: '❌ TRÙNG LỊCH (Đã từ chối)',
  INVALID: '⚠️ DỮ LIỆU KHÔNG HỢP LỆ',
  MAIL_FAIL: '⚠️ ĐÃ TẠO LỊCH - LỖI GỬI MAIL',
  ERROR: '❌ LỖI XỬ LÝ'
};

function getSS_() {
  var active = SpreadsheetApp.getActiveSpreadsheet();
  return active ? active : SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

/* ============================ SETUP ============================ */

// Tạo (hoặc GHI ĐÈ) sheet Config_Slots với lịch mẫu T2-T6. Chỉ chạy 1 lần đầu!
function initConfigSheet() {
  var ss = getSS_();
  var sh = ss.getSheetByName(CONFIG.SLOT_SHEET) || ss.insertSheet(CONFIG.SLOT_SHEET);
  sh.clear();
  sh.getRange(2, 2, 300, 2).setNumberFormat('@'); // giờ để dạng text
  sh.getRange(1, 1, 1, 4).setValues([['Weekday (1=Thứ 2 ... 7=Chủ nhật)', 'Start (HH:mm)', 'End (HH:mm)', 'Active (TRUE/FALSE)']]);
  var times = [['10:00', '11:00'], ['11:00', '12:00'], ['13:00', '14:00'], ['14:00', '15:00'],
               ['15:00', '16:00'], ['16:00', '17:00'], ['17:00', '18:00']];
  var rows = [];
  for (var d = 1; d <= 5; d++) times.forEach(function (t) { rows.push([d, t[0], t[1], true]); });
  sh.getRange(2, 1, rows.length, 4).setValues(rows);
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, 4);
}

// Chạy 1 lần: cài 3 trigger, mỗi trigger báo OK/LỖI riêng trong Execution log
function setupTriggers() {
  var ss = getSS_();
  var log = [];
  var handlers = ['processBookingForm', 'refreshFormSlots'];
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (handlers.indexOf(t.getHandlerFunction()) !== -1) ScriptApp.deleteTrigger(t);
  });
  function add(name, fn) {
    try { fn(); log.push('OK   : ' + name); }
    catch (err) { log.push('LỖI : ' + name + ' -> ' + err); }
  }
  add('Form submit -> processBookingForm', function () {
    ScriptApp.newTrigger('processBookingForm').forSpreadsheet(ss).onFormSubmit().create();
  });
  add('Mỗi ' + CONFIG.REFRESH_MINUTES + ' phút -> refreshFormSlots', function () {
    ScriptApp.newTrigger('refreshFormSlots').timeBased().everyMinutes(CONFIG.REFRESH_MINUTES).create();
  });
  add('Calendar thay đổi -> refreshFormSlots', function () {
    ScriptApp.newTrigger('refreshFormSlots')
      .forUserCalendar(Session.getEffectiveUser().getEmail()).onEventUpdated().create();
  });
  add('Cập nhật Form lần đầu', function () { refreshFormSlots(); });
  log.push('Tổng số trigger hiện có: ' + ScriptApp.getProjectTriggers().length);
  console.log(log.join('\n'));
}

/* ====================== XỬ LÝ KHI KHÁCH SUBMIT ====================== */

function processBookingForm(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000); // xếp hàng: mỗi lần chỉ xử lý 1 đơn
  var sheet, row;
  try {
    sheet = (e && e.range) ? e.range.getSheet() : getSS_().getSheetByName(CONFIG.RESPONSE_SHEET);
    row = (e && e.range) ? e.range.getRow() : sheet.getLastRow();
    handleBooking_(sheet, row);
  } catch (err) {
    console.error(err);
    try {
      var sc = ensureColumn_(sheet, readHeaders_(sheet), 'Trạng thái xử lý');
      var fc = ensureColumn_(sheet, readHeaders_(sheet), 'Ghi chú lỗi');
      sheet.getRange(row, sc).setValue(STATUS.ERROR);
      sheet.getRange(row, fc).setValue(String(err).substring(0, 300));
      // Email lỗi KHÔNG chứa MST/SĐT/nội dung của khách
      GmailApp.sendEmail(CONFIG.ADMIN_EMAIL, '[SỰ CỐ] Xử lý đặt lịch - dòng ' + row,
        'Có lỗi khi xử lý dòng ' + row + ' trong sheet "' + sheet.getName() + '".\nLỗi: ' + String(err).substring(0, 300));
    } catch (e2) { console.error(e2); }
  } finally {
    lock.releaseLock();
  }
  try { refreshFormSlots(); } catch (e3) { console.error(e3); }
}

function handleBooking_(sheet, row) {
  var headers = readHeaders_(sheet);
  var statusCol = ensureColumn_(sheet, headers, 'Trạng thái xử lý');
  var timeCol = ensureColumn_(sheet, headers, 'Thời gian đặt lịch');
  var idCol = ensureColumn_(sheet, headers, 'Booking ID');
  var evCol = ensureColumn_(sheet, headers, 'Calendar Event ID');
  var meetCol = ensureColumn_(sheet, headers, 'Meet Link');
  var failCol = ensureColumn_(sheet, headers, 'Ghi chú lỗi');

  // Chống xử lý lặp: dòng đã có trạng thái thì bỏ qua
  if (String(sheet.getRange(row, statusCol).getValue()).trim() !== '') return;

  var values = sheet.getRange(row, 1, 1, headers.length).getDisplayValues()[0];
  var rowData = {};
  for (var i = 0; i < headers.length; i++) rowData[headers[i]] = String(values[i] || '').trim();

  var customerEmail = getValueByHeader(rowData, ['Email doanh nghiệp', 'Email']);
  var customerName = getValueByHeader(rowData, ['Họ và tên']) || 'Quý khách';
  var companyName = getValueByHeader(rowData, ['Tên công ty', 'Công ty']);
  var phone = getValueByHeader(rowData, ['Số điện thoại', 'Phone']);
  var taxCode = getValueByHeader(rowData, ['Mã số thuế']);
  var need = getValueByHeader(rowData, ['Nội dung tư vấn', 'Nhu cầu', 'Nội dung']);
  var meetingTypeText = getValueByHeader(rowData, ['Hình thức họp', 'Hình thức']);
  var meetingType = detectMeetingType_(meetingTypeText);

  // Booking ID dựa trên thời điểm khách gửi Form (không phụ thuộc số dòng)
  var bookingId = String(sheet.getRange(row, idCol).getValue() || '').trim();
  if (!bookingId) {
    var ts = sheet.getRange(row, 1).getValue(); // cột A = Timestamp của Form
    if (!(ts instanceof Date)) ts = new Date();
    bookingId = 'BK-' + Utilities.formatDate(ts, CONFIG.TZ, 'yyyyMMdd-HHmmss');
    sheet.getRange(row, idCol).setValue(bookingId);
  }

  // ---- 1. Đọc và kiểm tra khung giờ khách chọn ----
  var slot = parseSlot_(rowData);
  var invalid = [];
  if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(customerEmail)) invalid.push('Email');
  if (!slot) invalid.push('Ngày và khung giờ');
  else if (slot.start.getTime() <= Date.now()) invalid.push('Ngày và khung giờ (đã qua)');

  if (invalid.length) {
    sheet.getRange(row, statusCol).setValue(STATUS.INVALID);
    sheet.getRange(row, failCol).setValue('Trường cần kiểm tra: ' + invalid.join(', '));
    if (customerEmail && invalid.indexOf('Email') === -1) {
      sendHtml_(customerEmail, '[' + CONFIG.COMPANY_NAME + '] Vui lòng kiểm tra lại thông tin đăng ký - ' + bookingId,
        wrap_('<p>Kính gửi ' + esc_(customerName) + ',</p><p>Chúng tôi chưa thể tạo lịch vì cần kiểm tra lại: <b>' + esc_(invalid.join(', ')) +
          '</b>.</p><p>Vui lòng đăng ký lại. Liên hệ: ' + esc_(CONFIG.COMPANY_CONTACT) + '.</p>'));
    }
    return;
  }
  sheet.getRange(row, timeCol).setValue(slot.label);

  // ---- 2. Chống tạo trùng khi chạy lại: cùng mã + cùng giờ thì dùng lại sự kiện cũ ----
  var calId = CONFIG.CALENDAR_ID;
  var existing = (Calendar.Events.list(calId, { privateExtendedProperty: 'bookingId=' + bookingId, maxResults: 5 }).items || [])
    .filter(function (ev) {
      return ev.status !== 'cancelled' && ev.start && ev.start.dateTime &&
             new Date(ev.start.dateTime).getTime() === slot.start.getTime();
    });
  var created;
  if (existing.length) {
    created = existing[0];
  } else {
    // ---- 3. Kiểm tra Calendar lần cuối ngay trước khi tạo ----
    var busy = getBusyIntervals_(new Date(slot.start.getTime() - 86400000), new Date(slot.end.getTime() + 86400000));
    if (isBusy_(slot.start, slot.end, busy)) {
      var alts = getAvailableSlots_().sort(function (a, b) {
        return Math.abs(a.start - slot.start) - Math.abs(b.start - slot.start);
      }).slice(0, 3);
      sheet.getRange(row, statusCol).setValue(STATUS.BUSY);
      var altHtml = alts.length
        ? '<p>Các khung giờ còn trống gần nhất:</p><ul>' + alts.map(function (s) { return '<li>' + esc_(s.label) + '</li>'; }).join('') + '</ul>'
        : '<p>Hiện chưa có khung giờ trống trong thời gian tới. Chúng tôi sẽ liên hệ lại với quý khách.</p>';
      sendHtml_(customerEmail, '[' + CONFIG.COMPANY_NAME + '] Khung giờ bạn chọn không còn khả dụng - ' + bookingId,
        wrap_('<p>Kính gửi ' + esc_(customerName) + ',</p><p>Khung giờ <b>' + esc_(slot.label) +
          '</b> hiện đã có lịch khác nên chúng tôi chưa thể tạo cuộc họp.</p>' + altHtml +
          '<p>Vui lòng đăng ký lại và chọn khung giờ khác. Liên hệ: ' + esc_(CONFIG.COMPANY_CONTACT) + '.</p>'));
      GmailApp.sendEmail(CONFIG.ADMIN_EMAIL, '[Trùng lịch] ' + bookingId + ' - ' + (companyName || customerName),
        'Đơn ' + bookingId + ' chọn khung giờ ' + slot.label + ' nhưng lịch đã bận. Không tạo sự kiện. Đã gửi email đề xuất slot khác cho khách.');
      return;
    }

    // ---- 4. Tạo sự kiện ----
    var desc = 'Mã đặt lịch: ' + bookingId + '\nĐại diện: ' + customerName + '\nCông ty: ' + companyName +
      '\nEmail: ' + customerEmail + '\nSĐT: ' + phone + '\nMST: ' + taxCode +
      '\nHình thức: ' + meetingTypeText + '\nNội dung: ' + need;
    var location = '';
    if (meetingType === 'office') location = CONFIG.OFFICE_ADDRESS;
    if (meetingType === 'phone') desc += '\n>>> GỌI ĐIỆN cho khách theo số: ' + phone;

    var resource = {
      summary: 'Họp tư vấn: ' + (companyName || customerName) + ' [' + bookingId + ']',
      description: desc,
      location: location,
      start: { dateTime: iso_(slot.start), timeZone: CONFIG.TZ },
      end: { dateTime: iso_(slot.end), timeZone: CONFIG.TZ },
      attendees: [{ email: customerEmail }],
      extendedProperties: { 'private': { bookingId: bookingId } }
    };
    if (meetingType === 'online' && CONFIG.CREATE_MEET_LINK) {
      resource.conferenceData = { createRequest: { requestId: bookingId, conferenceSolutionKey: { type: 'hangoutsMeet' } } };
    }
    created = Calendar.Events.insert(resource, calId, {
      conferenceDataVersion: 1,
      sendUpdates: CONFIG.SEND_CALENDAR_INVITE ? 'all' : 'none'
    });
  }

  var meetLink = created.hangoutLink || '';
  var where = meetingType === 'online' ? (meetLink ? '<a href="' + esc_(meetLink) + '">' + esc_(meetLink) + '</a>' : 'Link họp sẽ được gửi trong lời mời Google Calendar')
    : meetingType === 'office' ? esc_(CONFIG.OFFICE_ADDRESS)
    : meetingType === 'phone' ? 'Chúng tôi sẽ gọi đến số ' + esc_(maskPhone_(phone)) : '';

  sheet.getRange(row, statusCol).setValue(STATUS.OK);
  sheet.getRange(row, evCol).setValue(created.id);
  sheet.getRange(row, meetCol).setValue(meetLink);

  // ---- 5. Gửi email xác nhận (lỗi gửi mail không làm mất lịch đã tạo) ----
  var dateText = Utilities.formatDate(slot.start, CONFIG.TZ, 'dd/MM/yyyy');
  var timeText = Utilities.formatDate(slot.start, CONFIG.TZ, 'HH:mm') + ' - ' + Utilities.formatDate(slot.end, CONFIG.TZ, 'HH:mm');
  var mailErr = [];

  var custTable = tableHtml_([
    ['Mã đặt lịch', bookingId], ['Khách hàng / Công ty', customerName + ' – ' + companyName],
    ['Ngày họp', dateText], ['Thời gian', timeText + ' (GMT+7, giờ Việt Nam)'],
    ['Hình thức', meetingTypeText], ['Nội dung tư vấn', need]
  ]) + '<p><b>Địa điểm / Liên kết:</b> ' + where + '</p>';
  try {
    sendHtml_(customerEmail, '[' + CONFIG.COMPANY_NAME + '] Xác nhận lịch họp thành công - ' + bookingId,
      wrap_('<p>Kính gửi ' + esc_(customerName) + ',</p><p>Lịch họp của quý khách đã được đặt thành công:</p>' + custTable +
        '<p>Cần thay đổi lịch, vui lòng liên hệ ' + esc_(CONFIG.COMPANY_CONTACT) + ' và nêu mã <b>' + bookingId + '</b>.</p>'));
  } catch (err1) { mailErr.push('Mail khách: ' + err1); }

  try {
    var adminTable = tableHtml_([
      ['Mã đặt lịch', bookingId], ['Khách hàng', customerName], ['Công ty', companyName], ['MST', taxCode],
      ['Email', customerEmail], ['SĐT', phone], ['Ngày', dateText], ['Thời gian', timeText + ' (GMT+7)'],
      ['Hình thức', meetingTypeText], ['Nội dung', need], ['Meet', meetLink]
    ]);
    sendHtml_(CONFIG.ADMIN_EMAIL, '[LỊCH HỌP MỚI] ' + bookingId + ' - ' + (companyName || customerName),
      wrap_('<p>Có lịch tư vấn mới đã được tạo trong Google Calendar:</p>' + adminTable));
  } catch (err2) { mailErr.push('Mail admin: ' + err2); }

  if (mailErr.length) {
    sheet.getRange(row, statusCol).setValue(STATUS.MAIL_FAIL);
    sheet.getRange(row, failCol).setValue(mailErr.join(' | ').substring(0, 300));
  }
}

/* ============ CẬP NHẬT DANH SÁCH KHUNG GIỜ TRỐNG TRÊN FORM ============ */

function refreshFormSlots() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;
  try {
    var form = CONFIG.FORM_ID ? FormApp.openById(CONFIG.FORM_ID) : FormApp.openByUrl(getSS_().getFormUrl());
    var item = null;
    form.getItems().forEach(function (it) {
      if (it.getTitle().indexOf(CONFIG.SLOT_QUESTION_KEYWORD) !== -1) item = it;
    });
    if (!item) throw new Error('Không tìm thấy câu hỏi chứa: ' + CONFIG.SLOT_QUESTION_KEYWORD);

    var slots = getAvailableSlots_();
    var labels = slots.length ? slots.map(function (s) { return s.label; })
      : ['Hiện chưa có khung giờ trống - vui lòng quay lại sau'];

    var type = item.getType();
    if (type === FormApp.ItemType.LIST) {
      var li = item.asListItem();
      li.setChoices(labels.map(function (l) { return li.createChoice(l); }));
    } else if (type === FormApp.ItemType.MULTIPLE_CHOICE) {
      var mc = item.asMultipleChoiceItem();
      mc.setChoices(labels.map(function (l) { return mc.createChoice(l); }));
    } else {
      throw new Error('Câu hỏi khung giờ phải là Dropdown hoặc Multiple choice (hiện là ' + type + ').');
    }
    item.setHelpText('Chỉ hiển thị các khung giờ còn trống (cập nhật lúc ' +
      Utilities.formatDate(new Date(), CONFIG.TZ, 'HH:mm dd/MM') + ', GMT+7). Lịch chỉ được xác nhận khi bạn nhận được email xác nhận.');
  } finally {
    lock.releaseLock();
  }
}

/* ============================ LỊCH & SLOT ============================ */

function getAvailableSlots_() {
  var cands = generateCandidateSlots_();
  if (!cands.length) return [];
  var busy = getBusyIntervals_(new Date(cands[0].start.getTime() - 86400000),
    new Date(cands[cands.length - 1].end.getTime() + 86400000));
  return cands.filter(function (s) { return !isBusy_(s.start, s.end, busy); });
}

function generateCandidateSlots_() {
  var sh = getSS_().getSheetByName(CONFIG.SLOT_SHEET);
  if (!sh) throw new Error('Chưa có sheet ' + CONFIG.SLOT_SHEET + ' - hãy chạy initConfigSheet()');
  var cfg = sh.getDataRange().getDisplayValues().slice(1).filter(function (r) {
    return r[0] !== '' && String(r[3]).toUpperCase() === 'TRUE';
  });
  var minStart = Date.now() + CONFIG.MIN_LEAD_HOURS * 3600000;
  var p = Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd').split('-').map(Number);
  var out = [];
  for (var i = 0; i <= CONFIG.DAYS_AHEAD; i++) {
    var d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + i));
    var y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, day = d.getUTCDate();
    var wd = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
    cfg.forEach(function (r) {
      if (Number(r[0]) !== wd) return;
      var st = hm_(r[1]), en = hm_(r[2]);
      var start = vnDate_(y, m, day, st.h, st.m), end = vnDate_(y, m, day, en.h, en.m);
      if (start.getTime() < minStart) return;
      out.push({ start: start, end: end, label: dayLabel_(wd, y, m, day) + ' | ' + fmt12_(start) + ' - ' + fmt12_(end) });
    });
  }
  return out.sort(function (a, b) { return a.start - b.start; });
}

// Các khoảng BẬN: bỏ qua sự kiện đã huỷ, đặt "Free", bạn đã Decline, Working location, Birthday
function getBusyIntervals_(from, to) {
  var busy = [], token;
  do {
    var res = Calendar.Events.list(CONFIG.CALENDAR_ID, {
      timeMin: from.toISOString(), timeMax: to.toISOString(),
      singleEvents: true, orderBy: 'startTime', maxResults: 250, pageToken: token
    });
    (res.items || []).forEach(function (ev) {
      if (ev.status === 'cancelled' || ev.transparency === 'transparent') return;
      if (ev.eventType === 'workingLocation' || ev.eventType === 'birthday') return;
      var me = (ev.attendees || []).filter(function (a) { return a.self; })[0];
      if (me && me.responseStatus === 'declined') return;
      var s = ev.start.dateTime ? new Date(ev.start.dateTime) : new Date(ev.start.date + 'T00:00:00+07:00');
      var e = ev.end.dateTime ? new Date(ev.end.dateTime) : new Date(ev.end.date + 'T00:00:00+07:00');
      busy.push({ start: s, end: e, title: ev.summary || '(không tên)', allDay: !ev.start.dateTime });
    });
    token = res.nextPageToken;
  } while (token);
  return busy;
}

// Hai khoảng giao nhau khi: StartA < EndB và EndA > StartB
function isBusy_(start, end, busy) {
  var buf = CONFIG.BUFFER_MIN * 60000;
  return busy.some(function (b) { return b.start < end.getTime() + buf && b.end > start.getTime() - buf; });
}

// Đọc khung giờ từ dropdown: "Thứ 2 (16/11/2026) | 10:00 AM - 11:00 AM"
function parseSlot_(rowData) {
  var text = '';
  for (var h in rowData) {
    if (h.indexOf(CONFIG.SLOT_QUESTION_KEYWORD) !== -1 && rowData[h] !== '') { text = rowData[h]; break; }
  }
  var dm = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  var re = /(\d{1,2}):(\d{2})\s*(AM|PM)?/gi, m, times = [];
  while ((m = re.exec(text)) !== null) {
    var hh = parseInt(m[1], 10), mm = parseInt(m[2], 10);
    if (m[3]) {
      var ap = m[3].toUpperCase();
      if (ap === 'PM' && hh < 12) hh += 12;
      if (ap === 'AM' && hh === 12) hh = 0;
    }
    times.push({ h: hh, m: mm });
  }
  if (!dm || !times.length) return null;
  var y = +dm[3], mo = +dm[2], d = +dm[1];
  var start = vnDate_(y, mo, d, times[0].h, times[0].m);
  var end = times.length > 1 ? vnDate_(y, mo, d, times[1].h, times[1].m) : start;
  if (end <= start) end = new Date(start.getTime() + 3600000);
  return { start: start, end: end, label: text };
}

/* ============================== HELPERS ============================== */

function readHeaders_(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
}
function ensureColumn_(sheet, headers, name) {
  var i = headers.indexOf(name);
  if (i === -1) { headers.push(name); i = headers.length - 1; sheet.getRange(1, i + 1).setValue(name); }
  return i + 1;
}
function getValueByHeader(rowData, keywords) {
  for (var k = 0; k < keywords.length; k++)
    for (var h in rowData)
      if (h.toLowerCase().indexOf(keywords[k].toLowerCase()) !== -1 && rowData[h] !== '') return rowData[h];
  return '';
}
function detectMeetingType_(t) {
  t = String(t).toLowerCase();
  if (/trực tuyến|online|teams|meet|zoom/.test(t)) return 'online';
  if (/trực tiếp|văn phòng|offline|in-person|office/.test(t)) return 'office';
  if (/điện thoại|phone|call|gọi/.test(t)) return 'phone';
  return 'other';
}
function hm_(s) {
  var m = String(s).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) throw new Error('Giờ không hợp lệ trong Config_Slots: "' + s + '" (cần dạng HH:mm)');
  return { h: +m[1], m: +m[2] };
}
function vnDate_(y, m, d, h, mi) { return new Date(Date.UTC(y, m - 1, d, h - 7, mi)); } // GMT+7 cố định
function fmt12_(dt) { return Utilities.formatDate(dt, CONFIG.TZ, 'hh:mm a'); }
function iso_(dt) { return Utilities.formatDate(dt, CONFIG.TZ, "yyyy-MM-dd'T'HH:mm:ssXXX"); }
function dayLabel_(wd, y, m, d) {
  var names = ['', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
  return names[wd] + ' (' + ('0' + d).slice(-2) + '/' + ('0' + m).slice(-2) + '/' + y + ')';
}
function maskPhone_(p) {
  var s = String(p).replace(/[\s.\-+]/g, '');
  return s.length < 4 ? '' : new Array(s.length - 2).join('*') + s.slice(-3);
}
function esc_(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function tableHtml_(pairs) {
  return '<table style="border-collapse:collapse">' + pairs.map(function (r) {
    return '<tr><td style="padding:4px 14px 4px 0;vertical-align:top"><b>' + esc_(r[0]) + '</b></td><td>' + esc_(r[1]) + '</td></tr>';
  }).join('') + '</table>';
}
function wrap_(inner) {
  return '<div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#222">' + inner +
    '<p>Trân trọng,<br>' + esc_(CONFIG.COMPANY_NAME) + '</p></div>';
}
function sendHtml_(to, subject, html) {
  GmailApp.sendEmail(to, subject, html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '),
    { htmlBody: html, name: CONFIG.COMPANY_NAME, replyTo: CONFIG.ADMIN_EMAIL });
}
```

### Điểm đáng chú ý trong code

- **Chống đặt trùng khi hai khách gửi gần như cùng lúc:** `LockService` xếp hàng từng đơn, sau đó Calendar được kiểm tra lại ngay trước khi tạo sự kiện.
- **Chống tạo sự kiện trùng khi chạy lại:** mỗi đơn có `Booking ID` dạng `BK-yyyyMMdd-HHmmss` lấy từ thời điểm gửi Form, được lưu vào Sheet và gắn vào sự kiện (`extendedProperties`). Chạy lại cùng đơn thì script nhận ra sự kiện đã có và không tạo thêm.
- **Phát hiện trùng một phần:** hai khoảng thời gian giao nhau khi `StartA < EndB` và `EndA > StartB`.
- **Lỗi gửi mail không làm mất lịch:** sự kiện đã tạo thì được giữ nguyên, trạng thái đổi thành "ĐÃ TẠO LỊCH - LỖI GỬI MAIL" để bạn liên hệ khách thủ công.
- **Email báo lỗi cho admin không chứa dữ liệu nhạy cảm:** chỉ có số dòng và nội dung lỗi kỹ thuật.

## Kiểm thử trước khi dùng thật

Dùng link Form chính thức (không phải chế độ Preview) và một email khác email admin để đóng vai khách.

| Test | Cách làm | Kết quả mong đợi |
|---|---|---|
| Giờ trống, họp online | Chọn một slot, hình thức trực tuyến | Có sự kiện kèm link Meet, cả khách và admin nhận email, trạng thái "ĐÃ XÁC NHẬN LỊCH" |
| Slot biến mất | Chạy `refreshFormSlots`, tải lại Form | Slot vừa đặt không còn trong Dropdown |
| Hai khách cùng slot | Mở sẵn 2 tab Form, gửi lần lượt cùng một slot | Đơn thứ hai bị từ chối, nhận email gợi ý 3 slot |
| Giờ bận | Tạo sự kiện Busy trùng một phần, gửi form từ tab mở sẵn | Bị từ chối vì trùng lịch |
| Họp trực tiếp / gọi điện | Gửi hai đơn | Họp trực tiếp có địa điểm; gọi điện ghi số khách trong mô tả sự kiện |
| Chạy lại | Chạy tay `processBookingForm` trên dòng đã xử lý | Không có sự kiện hay email mới |

Sau khi test, nhớ xoá các sự kiện `[BK-...]` thử trong Calendar, nếu không các slot đó vẫn bị chặn.

## Những lỗi mình đã gặp

- **`Cannot read properties of null (reading 'getSheetByName')`:** project Apps Script của mình là project độc lập, không gắn với Sheet nên `getActiveSpreadsheet()` trả về `null`. Cách sửa: mở Apps Script từ **Extensions** trong Sheet, hoặc điền `SPREADSHEET_ID` vào `CONFIG` (code ở trên đã có sẵn cơ chế dự phòng này).
- **Trang Triggers trống:** mình mới chạy `initConfigSheet` mà chưa chạy `setupTriggers`. Hàm này không tự chạy khi lưu code. Phải chọn hàm rồi bấm Run, và xem Executions để biết hàm nào đã chạy.
- **Dropdown chỉ hiện "Hiện chưa có khung giờ trống":** do sự kiện cả ngày hoặc loại Working location trong Calendar bị tính là bận. Code đã bỏ qua `workingLocation` và `birthday`. Nếu bạn có sự kiện cả ngày đặt "Busy" thì nó vẫn chặn toàn bộ slot trong ngày đó, đây là hành vi đúng.
- **Danh sách trông như bị lặp:** thực ra là hai tuần liên tiếp có cùng khung giờ nhưng khác ngày, do `DAYS_AHEAD` đang đặt 14. Đặt `DAYS_AHEAD: 6` nếu chỉ muốn mở một tuần.
- **Xoá dòng test rồi chạy lại, chỉ có email mà không có lịch:** bản đầu tạo `Booking ID` từ số dòng, nên sau khi xoá dòng, đơn mới nhận lại đúng mã cũ và script tưởng sự kiện đã tồn tại. Bản code ở trên đã sửa: mã lấy từ thời điểm gửi form, và chỉ coi là trùng khi cùng mã **và** cùng giờ.

<div class="callout warn">
  <span>⚠️</span>
  <div><b>Lưu ý về dữ liệu và giới hạn</b>Script ghi mã số thuế và số điện thoại vào mô tả sự kiện Calendar và gửi vào email admin, nên chỉ chia sẻ Sheet và Calendar cho người được ủy quyền. Gmail cũng có giới hạn số người nhận mỗi ngày (tài khoản cá nhân thấp hơn Workspace), hãy xem trang <a href="https://developers.google.com/apps-script/guides/services/quotas">Quotas for Google Services</a> trước khi dùng cho số lượng đơn lớn.</div>
</div>

## Kết luận

Với vài công cụ Google sẵn có, bạn có một flow đặt lịch tư vấn chạy tự động từ lúc khách gửi form đến khi có lịch họp và email xác nhận. Người vận hành chỉ cần giám sát cột trạng thái trong Sheet và chỉnh bảng `Config_Slots` khi đổi giờ tiếp khách. Giải pháp này đơn giản, dễ bàn giao, nhưng vẫn là mô hình *gần* thời gian thực. Nếu sau này khối lượng đơn tăng hoặc cần khách chỉ thấy giờ trống tuyệt đối, bạn nên cân nhắc một công cụ đặt lịch chuyên dụng.

Việc nên làm tiếp: thử trên một Form và một Calendar riêng với dữ liệu giả, chạy đủ 6 test ở trên, rồi mới đưa link Form chính thức cho khách. Bạn đang dùng cách nào để quản lý lịch hẹn khách hàng, và còn thiếu tính năng nào mà bạn muốn mình bổ sung (ví dụ kiểm tra số điện thoại, chặn email cá nhân hay nhắc lịch trước giờ họp)? Hãy để lại bình luận nhé.
