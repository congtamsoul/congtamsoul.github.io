---
layout: post
title: "Gỡ hàng loạt app ngoài Software Catalog trên MacBook bằng Intune shell script"
seo_title: "Uninstall app macOS ngoài danh mục bằng Intune script"
description: "Cách dùng Intune shell script gỡ hàng loạt app không nằm trong Software Catalog trên MacBook: lấy report, cập nhật danh sách app, pilot group và đọc log."
date: 2026-11-10
author: "Tam Nguyen"
reading_time: 10
topic: macos
thumb_label: "MACOS UNINSTALL"
image: /images/photo/36.jpg
tags:
  - macOS
  - Intune
  - Bash
  - Security
  - Compliance
card_tags:
  - macOS
  - Intune
summary: "Một shell script tái sử dụng hàng tháng: chỉ sửa danh sách app, Intune tự gỡ các app ngoài Software Catalog trên MacBook và xuất log chi tiết."
redirect_from:
  - /posts/intune-macos-uninstall-unapproved-apps.html
---

Mỗi tháng, report **Discovered apps** trên Intune lại cho thấy hàng chục app trên MacBook không nằm trong **Software Catalog** — danh mục phần mềm được phép sử dụng ở công ty: Docker, CapCut, AnyDesk, RustDesk, Cloudflare WARP, Karabiner... Có app chỉ là vi phạm chính sách, có app là công cụ remote access hoặc VPN cá nhân — rủi ro bảo mật thật sự. Gỡ tay từng máy là không thể, còn viết script mới mỗi tháng thì vừa tốn thời gian vừa dễ xóa nhầm.

**Tóm tắt nhanh:** lấy report app ngoài catalog, đưa tên app vào **một block duy nhất** trong shell script, add MacBook cần xử lý vào Intune group, deploy script dạng **Shell script** chạy bằng root. Script tự quét app, gỡ an toàn (có workflow riêng cho app cần uninstaller của hãng), chặn tự động xóa với tên app chung chung, hỗ trợ `DRY_RUN` và xuất log + file summary để đối chiếu.

## Bối cảnh: vì sao cần script tái sử dụng

Yêu cầu của mình khi thiết kế script:

- **Chỉ sửa một chỗ** — mỗi tháng chỉ cập nhật mảng `apps=( ... )`, phần còn lại không đụng tới.
- **An toàn trước hết** — chỉ xóa `.app` nằm trong thư mục được quét, không xóa đệ quy theo tên mơ hồ.
- **Tôn trọng uninstaller của hãng** — app có daemon, kernel/system extension, VPN (Docker, Cloudflare WARP, Karabiner) phải gỡ bằng uninstaller chính chủ.
- **Có bằng chứng** — mỗi app đều có trạng thái rõ ràng trong file summary để báo cáo Security.

## Luồng tổng quan

1. **Report** — Intune → Apps → Monitor → **Discovered apps**, export, so với Software Catalog để ra danh sách app vi phạm và danh sách máy.
2. **Cập nhật script** — đưa tên app vào mảng `apps`.
3. **Group** — add các MacBook vi phạm vào một Intune device group (ví dụ bằng script Graph API add device vào cloud group).
4. **Deploy** — tạo macOS Shell script trên Intune, assign cho group.
5. **Kiểm tra** — đọc log và summary, xử lý các trạng thái cần can thiệp tay.

## Bước 1: Lấy report và chuẩn bị danh sách app

Từ report Discovered apps, lọc các app không có trong catalog. Tên đưa vào script nên là **tên bundle** (ví dụ `CapCut` cho `CapCut.app`) hoặc **bundle ID** (ví dụ `com.lemon.lvoverseas`). Script so khớp **chính xác, không phân biệt hoa thường** với:

- Tên file `.app` (bỏ đuôi)
- `CFBundleDisplayName`, `CFBundleName`
- `CFBundleIdentifier`
- `CFBundleExecutable`

Không dùng wildcard — đây là chủ đích để tránh xóa nhầm.

## Bước 2: Cập nhật script — chỉ sửa một block

```bash
# ======================= EDIT ONLY THIS BLOCK ================================
apps=(
    "Docker"
    "CapCut"
    "AnyDesk"
)
# ===================== DO NOT EDIT BELOW THIS LINE ===========================
```

Script tự kiểm tra danh sách trước khi chạy: dừng với **exit 2** nếu có dòng rỗng, tên chứa `/`, ký tự điều khiển, hoặc **tên bị trùng** sau khi chuẩn hóa. Dán danh sách kiểu JSON có dấu phẩy cuối dòng cũng được, script tự loại dấu phẩy.

## Script xử lý từng loại app thế nào

<table>
<tr><th>Loại</th><th>Ví dụ</th><th>Cách xử lý</th></tr>
<tr><td>App thường</td><td>CapCut, Steam</td><td>Dừng process trong bundle, xóa <code>.app</code>, kiểm tra lại đã mất</td></tr>
<tr><td>Có uninstaller tích hợp</td><td>Docker, Cloudflare WARP, Karabiner-Elements</td><td>Chạy uninstaller của hãng (timeout 300s), rồi xác minh</td></tr>
<tr><td>Cần override của hãng</td><td>Zoom, AnyDesk, RustDesk, Tailscale, Autodesk, Wacom, Homebrew...</td><td>Chạy script override đã duyệt trong <code>/Library/Management/IntuneUninstall/VendorOverrides</code>; không có thì báo <code>MANUAL_REQUIRED</code></td></tr>
<tr><td>Tên chung chung</td><td>helper, uninstall, commandline</td><td>Chỉ phát hiện, <strong>không xóa</strong> → <code>BLOCKED_AMBIGUOUS</code></td></tr>
<tr><td>Browser extension</td><td>uBlock Origin Lite</td><td>Chỉ phát hiện → <code>POLICY_REQUIRED</code>, gỡ bằng browser policy</td></tr>
<tr><td>CLI / thư mục không phải .app</td><td>binary trong <code>/usr/local/bin</code></td><td>Không xóa mù → <code>MANUAL_REQUIRED</code></td></tr>
</table>

Phạm vi quét: `/Applications` và `~/Applications`, `~/Desktop`, `~/Downloads` của từng user. Script override phải **thuộc root và không cho group/other ghi**, nếu không sẽ bị từ chối chạy.

### Tùy chọn khi chạy

- `DRY_RUN=1` — chỉ audit, không thay đổi gì.
- `REMOVE_USER_DATA=1` — xóa thêm preference, cache, container **đúng theo bundle ID**; Application Support dùng chung và Group Containers không bao giờ bị xóa.
- `VENDOR_TIMEOUT_SECONDS` — timeout cho uninstaller của hãng, mặc định 300 giây.

Có lock để không chạy chồng hai phiên, log và summary tự xoay vòng giữ 5 bản.

## Bước 3: Deploy bằng Intune

**Intune admin center → Devices → macOS → Scripts → Add (Shell script):**

<table>
<tr><th>Setting</th><th>Giá trị</th></tr>
<tr><td>Run script as signed-in user</td><td>No (chạy root)</td></tr>
<tr><td>Hide script notifications on devices</td><td>Yes</td></tr>
<tr><td>Script frequency</td><td>Not configured, hoặc mỗi 1 ngày nếu muốn quét lặp lại</td></tr>
<tr><td>Max number of times to retry if script fails</td><td>3</td></tr>
<tr><td>Assignment</td><td>Group MacBook vi phạm (pilot trước)</td></tr>
</table>

> **Lưu ý:** file `.sh` phải dùng **LF line ending** và bắt đầu bằng `#!/bin/bash`. Lưu từ Windows với CRLF sẽ khiến script lỗi ngay dòng đầu. Kiểm tra bằng `file script.sh` hoặc `cat -vet script.sh | head` (không được thấy `^M`).

Khuyến nghị: chạy bản `DRY_RUN=1` trên vài máy pilot trước (sửa dòng `DRY_RUN="${DRY_RUN:-0}"` thành `:-1` cho bản audit), đọc summary rồi mới deploy bản thật.

## Bước 4: Đọc log và summary

Trên MacBook:

```bash
# Log chi tiết
sudo cat /var/tmp/uninstall_apps_$(date +%Y_%m).log

# Summary dạng TSV: Target / Status / EvidenceOrPath / Detail
sudo column -t -s $'\t' /var/tmp/uninstall_apps_$(date +%Y_%m)_summary.tsv
```

<table>
<tr><th>Status</th><th>Ý nghĩa</th><th>Exit code</th></tr>
<tr><td>REMOVED</td><td>Đã gỡ và xác minh</td><td>0</td></tr>
<tr><td>ALREADY_ABSENT</td><td>Không có trên máy</td><td>0</td></tr>
<tr><td>DRY_RUN_FOUND</td><td>Phát hiện ở chế độ audit</td><td>1</td></tr>
<tr><td>MANUAL_REQUIRED</td><td>Cần uninstaller/override của hãng</td><td>1</td></tr>
<tr><td>BLOCKED_AMBIGUOUS</td><td>Tên chung chung, chặn xóa tự động</td><td>1</td></tr>
<tr><td>POLICY_REQUIRED</td><td>Cần gỡ bằng policy (browser extension)</td><td>1</td></tr>
<tr><td>FAILED</td><td>Gỡ thất bại hoặc vẫn còn</td><td>1</td></tr>
</table>

Exit code `1` hiện trên Intune là **Failed**, nhờ vậy máy còn tồn đọng nổi lên ngay trong report để xử lý tiếp. Exit `2` là lỗi cấu hình/quyền/lock.

## Những lỗi mình đã gặp

- **`/bin/bash^M: bad interpreter`** — file lưu CRLF từ Windows. Chuyển sang LF trước khi upload.
- **`PRECHECK_ERROR: Run as root`** — để nhầm "Run script as signed-in user = Yes".
- **`Duplicate app name after normalization`** — danh sách có `Zoom` và `zoom`. Script cố ý dừng để tránh danh sách bẩn.
- **App vẫn xuất hiện trong Discovered apps sau khi gỡ** — inventory Intune cập nhật chậm; kiểm tra summary trên máy là nguồn chính xác hơn.
- **Zoom/AnyDesk báo `MANUAL_REQUIRED`** — chưa có script override của hãng trong `VendorOverrides`. Cần đóng gói và deploy override (root-owned, quyền 755) trước.
- **User cài lại app** — gỡ chỉ là bước dọn dẹp; nên kết hợp chặn bằng policy, bỏ quyền admin local và truyền thông về Software Catalog.

## Kết luận

Với một shell script tái sử dụng, việc dọn app ngoài Software Catalog trên MacBook trở thành quy trình hàng tháng: export report, cập nhật một block danh sách, add máy vào group và đọc summary. Script ưu tiên an toàn — thà báo cần xử lý tay còn hơn xóa nhầm. Bước tiếp theo nên làm là chuẩn bị override cho các app vendor phổ biến và chạy DRY_RUN trên nhóm pilot.

Bạn đang kiểm soát phần mềm ngoài danh mục trên macOS bằng cách nào? Chia sẻ ở phần bình luận nhé.

## Full script

```bash
#!/bin/bash
###############################################################################
# Intune: Run script as signed-in user = No (root).
# Optional runtime controls (no script edit required):
#   DRY_RUN=1           Audit only; default is 0 for normal Intune execution.
#   REMOVE_USER_DATA=1  Remove only exact bundle-ID cache/preference/container
#                       paths; default is 0. Shared Application Support and
#                       Group Containers are never removed.
#
# Exit codes:
#   0 = all targets removed or already absent
#   1 = target remains, dry-run found a target, manual/policy action is needed,
#       or an uninstall operation failed
#   2 = configuration, privilege, lock, or preflight error
###############################################################################

# ======================= EDIT ONLY THIS BLOCK ================================
apps=(
    "Docker"
    "CapCut"
)
# ===================== DO NOT EDIT BELOW THIS LINE ===========================

set -u
set -o pipefail
umask 077
PATH="/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin:/opt/homebrew/bin"
export PATH

DRY_RUN="${DRY_RUN:-0}"
REMOVE_USER_DATA="${REMOVE_USER_DATA:-0}"
VENDOR_TIMEOUT_SECONDS="${VENDOR_TIMEOUT_SECONDS:-300}"
TEST_ROOT="${TEST_ROOT:-}"

root_path() {
    if [ -n "$TEST_ROOT" ]; then
        printf '%s%s' "${TEST_ROOT%/}" "$1"
    else
        printf '%s' "$1"
    fi
}

STATE_DIR="${STATE_DIR:-$(root_path /var/tmp)}"
RUN_TAG="$(date '+%Y_%m')"
LOG_FILE="${LOG_FILE:-$STATE_DIR/uninstall_apps_${RUN_TAG}.log}"
SUMMARY_FILE="${SUMMARY_FILE:-$STATE_DIR/uninstall_apps_${RUN_TAG}_summary.tsv}"
LOCK_DIR="${LOCK_DIR:-$STATE_DIR/.uninstall_apps_intune.lock}"
VENDOR_OVERRIDE_DIR="${VENDOR_OVERRIDE_DIR:-$(root_path /Library/Management/IntuneUninstall/VendorOverrides)}"
WORK_DIR=""
LOCK_HELD=0

rotate_file() {
    local file="$1" i
    [ -e "$file" ] || return 0
    rm -f "${file}.5"
    i=4
    while [ "$i" -ge 1 ]; do
        [ ! -e "${file}.${i}" ] || mv -f "${file}.${i}" "${file}.$((i + 1))"
        i=$((i - 1))
    done
    mv -f "$file" "${file}.1"
}

fatal_preflight() {
    printf 'PRECHECK_ERROR: %s\n' "$*" >&2
    exit 2
}

case "$DRY_RUN" in 0|1) ;; *) fatal_preflight "DRY_RUN must be 0 or 1" ;; esac
case "$REMOVE_USER_DATA" in 0|1) ;; *) fatal_preflight "REMOVE_USER_DATA must be 0 or 1" ;; esac
case "$VENDOR_TIMEOUT_SECONDS" in ''|*[!0-9]*) fatal_preflight "VENDOR_TIMEOUT_SECONDS must be an integer" ;; esac
[ "$VENDOR_TIMEOUT_SECONDS" -gt 0 ] || fatal_preflight "VENDOR_TIMEOUT_SECONDS must be greater than zero"

if [ -n "$TEST_ROOT" ]; then
    [ -d "$TEST_ROOT" ] || fatal_preflight "TEST_ROOT does not exist: $TEST_ROOT"
elif [ "${EUID:-$(id -u)}" -ne 0 ]; then
    fatal_preflight "Run as root. In Intune set 'Run script as signed-in user' to No."
fi

mkdir -p "$STATE_DIR" || fatal_preflight "Cannot create state directory: $STATE_DIR"
rotate_file "$LOG_FILE" || fatal_preflight "Cannot rotate log: $LOG_FILE"
rotate_file "$SUMMARY_FILE" || fatal_preflight "Cannot rotate summary: $SUMMARY_FILE"
touch "$LOG_FILE" "$SUMMARY_FILE" || fatal_preflight "Cannot create log or summary"
chmod 600 "$LOG_FILE" "$SUMMARY_FILE" 2>/dev/null || true

# Capture both stdout and stderr in the Intune log.
exec > >(/usr/bin/tee -a "$LOG_FILE") 2>&1

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    fatal_preflight "Another uninstall run is active (lock: $LOCK_DIR)"
fi
LOCK_HELD=1
WORK_DIR="$(mktemp -d "$STATE_DIR/.uninstall_apps.XXXXXX")" || fatal_preflight "Cannot create work directory"

cleanup() {
    local rc=$?
    trap - EXIT
    [ -z "$WORK_DIR" ] || rm -rf "$WORK_DIR"
    if [ "$LOCK_HELD" -eq 1 ]; then
        rmdir "$LOCK_DIR" 2>/dev/null || true
    fi
    exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' HUP INT TERM

log() {
    printf '%s [%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S%z')" "$1" "$2"
}

clean_field() {
    printf '%s' "$1" | tr '\t\r\n' '   '
}

lower_text() {
    printf '%s' "$1" | LC_ALL=C tr '[:upper:]' '[:lower:]'
}

normalize_entry() {
    # Accept normal Bash elements and pasted JSON-style elements ending in comma.
    printf '%s' "$1" | sed \
        -e 's/\r$//' \
        -e 's/^[[:space:]]*//' \
        -e 's/[[:space:]]*$//' \
        -e 's/,[[:space:]]*$//' \
        -e 's/[[:space:]]*$//'
}

path_exists() {
    [ -e "$1" ] || [ -L "$1" ]
}

NORMALIZED_APPS=()
NORMALIZED_KEYS=()
normalize_manifest() {
    local raw name key prior
    [ "${#apps[@]}" -gt 0 ] || fatal_preflight "apps array is empty"
    for raw in "${apps[@]}"; do
        name="$(normalize_entry "$raw")"
        [ -n "$name" ] || fatal_preflight "apps array contains an empty entry"
        case "$name" in
            */*|.|..) fatal_preflight "Unsafe app name: $name" ;;
        esac
        if printf '%s' "$name" | LC_ALL=C grep '[[:cntrl:]]' >/dev/null 2>&1; then
            fatal_preflight "App name contains a control character"
        fi
        key="$(lower_text "$name")"
        # ${arr[@]+...} keeps empty arrays safe under set -u on macOS bash 3.2.
        for prior in ${NORMALIZED_KEYS[@]+"${NORMALIZED_KEYS[@]}"}; do
            [ "$key" != "$prior" ] || fatal_preflight "Duplicate app name after normalization: $name"
        done
        NORMALIZED_APPS+=("$name")
        NORMALIZED_KEYS+=("$key")
    done
}

plist_value() {
    local plist="$1" key="$2" value=""
    if [ -x /usr/libexec/PlistBuddy ] && [ -f "$plist" ]; then
        value="$(/usr/libexec/PlistBuddy -c "Print :$key" "$plist" 2>/dev/null || true)"
    fi
    printf '%s' "$value" | tr '\t\r\n\037' '    '
}

SCAN_ROOTS=()
USER_HOMES=()
build_scan_roots() {
    local system_apps users_dir home sub
    system_apps="$(root_path /Applications)"
    users_dir="$(root_path /Users)"
    [ ! -d "$system_apps" ] || SCAN_ROOTS+=("$system_apps")
    if [ -d "$users_dir" ]; then
        for home in "$users_dir"/*; do
            [ -d "$home" ] || continue
            [ "$(basename "$home")" != "Shared" ] || continue
            USER_HOMES+=("$home")
            for sub in Applications Desktop Downloads; do
                [ ! -d "$home/$sub" ] || SCAN_ROOTS+=("$home/$sub")
            done
        done
    fi
}

INVENTORY_FILE=""
build_inventory() {
    local root path info base display bundle_name bundle_id executable link_flag
    INVENTORY_FILE="$WORK_DIR/app_inventory.bin"
    : > "$INVENTORY_FILE"
    log INFO "Building one reusable app inventory across ${#SCAN_ROOTS[@]} scan roots"
    for root in "${SCAN_ROOTS[@]}"; do
        log INFO "Scanning: $root"
        while IFS= read -r -d '' path; do
            case "$path" in
                *$'\n'*|*$'\r'*|*$'\t'*|*$'\037'*)
                    log WARN "Skipping path containing an unsupported control character"
                    continue
                    ;;
            esac
            base="$(basename "$path")"
            base="${base%.app}"
            info="$path/Contents/Info.plist"
            display="$(plist_value "$info" CFBundleDisplayName)"
            bundle_name="$(plist_value "$info" CFBundleName)"
            bundle_id="$(plist_value "$info" CFBundleIdentifier)"
            executable="$(plist_value "$info" CFBundleExecutable)"
            if [ -L "$path" ]; then link_flag=1; else link_flag=0; fi
            printf '%s\037%s\037%s\037%s\037%s\037%s\037%s\0' \
                "$path" "$base" "$display" "$bundle_name" "$bundle_id" "$executable" "$link_flag" >> "$INVENTORY_FILE"
        done < <(find "$root" -xdev \
            \( -type d -name '*.app' -print0 -prune \) -o \
            \( -type l -name '*.app' -print0 \) 2>>"$LOG_FILE")
    done
}

is_name_match() {
    local wanted="$1" candidate="$2"
    [ -n "$candidate" ] || return 1
    [ "$(lower_text "$wanted")" = "$(lower_text "$candidate")" ]
}

MATCH_FILE=""
collect_matches() {
    local target="$1" index="$2"
    local path base display bundle_name bundle_id executable link_flag
    MATCH_FILE="$WORK_DIR/matches.$index.bin"
    : > "$MATCH_FILE"
    while IFS=$'\037' read -r -d '' path base display bundle_name bundle_id executable link_flag; do
        if is_name_match "$target" "$base" || \
           is_name_match "$target" "$display" || \
           is_name_match "$target" "$bundle_name" || \
           is_name_match "$target" "$bundle_id" || \
           is_name_match "$target" "$executable"; then
            printf '%s\037%s\037%s\037%s\0' "$path" "$bundle_id" "$executable" "$link_flag" >> "$MATCH_FILE"
        fi
    done < "$INVENTORY_FILE"
}

count_matches() {
    local count=0 path bundle_id executable link_flag
    while IFS=$'\037' read -r -d '' path bundle_id executable link_flag; do
        path_exists "$path" || continue
        count=$((count + 1))
    done < "$MATCH_FILE"
    printf '%s' "$count"
}

join_match_paths() {
    local out="" path bundle_id executable link_flag
    while IFS=$'\037' read -r -d '' path bundle_id executable link_flag; do
        path_exists "$path" || continue
        if [ -n "$out" ]; then out="$out | $path"; else out="$path"; fi
    done < "$MATCH_FILE"
    printf '%s' "$out"
}

is_safe_app_path() {
    local path="$1" root
    case "$path" in *.app) ;; *) return 1 ;; esac
    for root in "${SCAN_ROOTS[@]}"; do
        case "$path" in "$root"/*.app) return 0 ;; esac
    done
    return 1
}

stop_bundle_processes() {
    local bundle="$1" pid command
    [ -d "$bundle" ] || return 0
    while read -r pid command; do
        [ -n "${pid:-}" ] || continue
        case "${command:-}" in
            "$bundle"/Contents/MacOS/*)
                [ "$pid" != "$$" ] || continue
                log INFO "Stopping PID $pid whose executable is inside: $bundle"
                kill -TERM "$pid" 2>/dev/null || true
                ;;
        esac
    done < <(ps -axo pid=,comm= 2>/dev/null)
    sleep 2
    while read -r pid command; do
        [ -n "${pid:-}" ] || continue
        case "${command:-}" in
            "$bundle"/Contents/MacOS/*)
                [ "$pid" != "$$" ] || continue
                kill -KILL "$pid" 2>/dev/null || true
                ;;
        esac
    done < <(ps -axo pid=,comm= 2>/dev/null)
}

safe_remove_app() {
    local path="$1"
    is_safe_app_path "$path" || { log ERROR "Refused unsafe app path: $path"; return 1; }
    if ! path_exists "$path"; then return 0; fi
    if [ "$DRY_RUN" -eq 1 ]; then
        log DRYRUN "Would remove app: $path"
        return 0
    fi
    if [ -L "$path" ]; then
        rm -f "$path" >>"$LOG_FILE" 2>&1 || return 1
    else
        stop_bundle_processes "$path"
        rm -rf "$path" >>"$LOG_FILE" 2>&1 || return 1
    fi
    if path_exists "$path"; then
        log ERROR "Verification failed; path still exists: $path"
        return 1
    fi
    log INFO "REMOVED and verified: $path"
    return 0
}

cleanup_bundle_id_data() {
    local bundle_id="$1" home candidate
    [ "$REMOVE_USER_DATA" -eq 1 ] || return 0
    case "$bundle_id" in
        ''|*[!A-Za-z0-9._-]*|.*|*.)
            log WARN "Skipping unsafe or empty bundle ID for user-data cleanup: $bundle_id"
            return 0
            ;;
    esac
    case "$bundle_id" in *.*) ;; *)
        log WARN "Skipping non-qualified bundle ID: $bundle_id"
        return 0
        ;;
    esac
    for home in ${USER_HOMES[@]+"${USER_HOMES[@]}"}; do
        for candidate in \
            "$home/Library/Preferences/$bundle_id.plist" \
            "$home/Library/Caches/$bundle_id" \
            "$home/Library/Containers/$bundle_id" \
            "$home/Library/Saved Application State/$bundle_id.savedState"; do
            path_exists "$candidate" || continue
            if [ "$DRY_RUN" -eq 1 ]; then
                log DRYRUN "Would remove exact bundle-ID data: $candidate"
            else
                rm -rf "$candidate" >>"$LOG_FILE" 2>&1 || log WARN "Could not remove user data: $candidate"
            fi
        done
    done
}

run_with_timeout() {
    local marker="$WORK_DIR/timeout.$RANDOM.$$" pid watcher rc
    rm -f "$marker"
    "$@" >>"$LOG_FILE" 2>&1 &
    pid=$!
    (
        sleep "$VENDOR_TIMEOUT_SECONDS"
        if kill -0 "$pid" 2>/dev/null; then
            : > "$marker"
            kill -TERM "$pid" 2>/dev/null || true
            pkill -TERM -P "$pid" 2>/dev/null || true
            sleep 5
            kill -KILL "$pid" 2>/dev/null || true
            pkill -KILL -P "$pid" 2>/dev/null || true
        fi
    ) &
    watcher=$!
    wait "$pid"; rc=$?
    kill "$watcher" 2>/dev/null || true
    wait "$watcher" 2>/dev/null || true
    if [ -e "$marker" ]; then
        rm -f "$marker"
        log ERROR "Command timed out after ${VENDOR_TIMEOUT_SECONDS}s: $*"
        return 124
    fi
    return "$rc"
}

is_secure_override() {
    local file="$1" owner perm perm_dec
    [ -f "$file" ] && [ ! -L "$file" ] || return 1
    owner="$(stat -f '%u' "$file" 2>/dev/null || printf 'invalid')"
    perm="$(stat -f '%Lp' "$file" 2>/dev/null || printf 'invalid')"
    [ "$owner" = "0" ] || return 1
    case "$perm" in ''|*[!0-7]*) return 1 ;; esac
    perm_dec=$((8#$perm))
    [ $((perm_dec & 8#022)) -eq 0 ] || return 1
    return 0
}

family_for_target() {
    local key
    key="$(lower_text "$1")"
    case "$key" in
        docker) printf 'docker' ;;
        'cloudflare warp') printf 'cloudflare-warp' ;;
        karabiner-*) printf 'karabiner-elements' ;;
        tunnelblick) printf 'tunnelblick' ;;
        'monsgeek driver') printf 'monsgeek' ;;
        orbstack) printf 'orbstack' ;;
        'google drive') printf 'google-drive' ;;
        adpclientservice|adpsdktools|adpsdkutil|adsklicensingagent|'autodesk access user interface'|cer_dialog|'process elevator'|senddmp)
            printf 'autodesk' ;;
        tailscale) printf 'tailscale' ;;
        zoom) printf 'zoom' ;;
        com.wacom.*|'wacom center'|'wacom display settings'|'wacom tablet utility'|wacom_iomanager)
            printf 'wacom' ;;
        anydesk) printf 'anydesk' ;;
        'opswat gears'|opswat_gears_client*) printf 'opswat-gears' ;;
        rustdesk) printf 'rustdesk' ;;
        razer*) printf 'razer' ;;
        homebrew) printf 'homebrew' ;;
        *) printf '' ;;
    esac
}

is_manual_family() {
    case "$1" in
        tunnelblick|monsgeek|orbstack|google-drive|autodesk|tailscale|zoom|wacom|anydesk|opswat-gears|rustdesk|razer|homebrew) return 0 ;;
        *) return 1 ;;
    esac
}

is_ambiguous_target() {
    case "$(lower_text "$1")" in
        commandline|universalinstaller|universaluninstaller|finderhelper|helper|uninstall) return 0 ;;
        *) return 1 ;;
    esac
}

glob_exists() {
    compgen -G "$1" >/dev/null 2>&1
}

vendor_evidence_exists() {
    local family="$1"
    case "$family" in
        docker) path_exists "$(root_path /Applications/Docker.app)" ;;
        cloudflare-warp) path_exists "$(root_path '/Applications/Cloudflare WARP.app')" ;;
        karabiner-elements)
            path_exists "$(root_path '/Applications/Karabiner-Elements.app')" || \
            path_exists "$(root_path '/Library/Application Support/org.pqrs/Karabiner-Elements')"
            ;;
        tunnelblick) path_exists "$(root_path /Applications/Tunnelblick.app)" ;;
        monsgeek)
            path_exists "$(root_path '/Applications/MonsGeek Driver.app')" || \
            glob_exists "$(root_path '/Library/LaunchDaemons')/*[Mm]ons[Gg]eek*"
            ;;
        orbstack) path_exists "$(root_path /Applications/OrbStack.app)" ;;
        google-drive)
            path_exists "$(root_path '/Applications/Google Drive.app')" || \
            glob_exists "$(root_path '/Library/LaunchDaemons')/com.google.drive*"
            ;;
        autodesk)
            path_exists "$(root_path '/Library/Application Support/Autodesk')" || \
            glob_exists "$(root_path '/Library/LaunchDaemons')/com.autodesk*"
            ;;
        tailscale) path_exists "$(root_path /Applications/Tailscale.app)" ;;
        zoom)
            path_exists "$(root_path /Applications/zoom.us.app)" || \
            path_exists "$(root_path /Applications/Zoom.app)" || \
            glob_exists "$(root_path '/Library/PrivilegedHelperTools')/us.zoom*"
            ;;
        wacom)
            path_exists "$(root_path '/Library/Application Support/Tablet')" || \
            glob_exists "$(root_path '/Library/LaunchDaemons')/com.wacom*"
            ;;
        anydesk)
            path_exists "$(root_path /Applications/AnyDesk.app)" || \
            glob_exists "$(root_path '/Library/LaunchDaemons')/com.philandro*"
            ;;
        opswat-gears)
            path_exists "$(root_path '/Library/Application Support/OPSWAT')" || \
            glob_exists "$(root_path '/Library/LaunchDaemons')/*[Oo][Pp][Ss][Ww][Aa][Tt]*"
            ;;
        rustdesk)
            path_exists "$(root_path /Applications/RustDesk.app)" || \
            glob_exists "$(root_path '/Library/LaunchDaemons')/*rustdesk*"
            ;;
        razer)
            path_exists "$(root_path '/Library/Application Support/Razer')" || \
            glob_exists "$(root_path '/Library/LaunchDaemons')/*[Rr]azer*"
            ;;
        homebrew)
            path_exists "$(root_path /opt/homebrew)" || path_exists "$(root_path /usr/local/Homebrew)"
            ;;
        *) return 1 ;;
    esac
}

run_family_override() {
    local family="$1" target="$2" override marker rc
    override="$VENDOR_OVERRIDE_DIR/$family.sh"
    marker="$WORK_DIR/vendor-$family.rc"
    if [ -f "$marker" ]; then
        rc="$(cat "$marker")"
        return "$rc"
    fi
    if ! is_secure_override "$override"; then
        log WARN "No approved secure override for family '$family': $override"
        return 125
    fi
    log INFO "Running approved vendor override for '$family' (target: $target)"
    run_with_timeout "$override" "$target"; rc=$?
    printf '%s' "$rc" > "$marker"
    return "$rc"
}

find_non_app_evidence() {
    local target="$1" root path
    for root in "${SCAN_ROOTS[@]}"; do
        path="$root/$target"
        if path_exists "$path" && [ "${path##*.}" != "app" ]; then
            printf '%s' "$path"
            return 0
        fi
    done
    return 1
}

find_cli_evidence() {
    local target="$1" lower dashed underscored compact name dir candidate
    lower="$(lower_text "$target")"
    dashed="$(printf '%s' "$lower" | tr ' ' '-')"
    underscored="$(printf '%s' "$lower" | tr ' ' '_')"
    compact="$(printf '%s' "$lower" | tr -d ' ')"
    for name in "$target" "$lower" "$dashed" "$underscored" "$compact"; do
        [ -n "$name" ] || continue
        for dir in /usr/local/bin /opt/homebrew/bin /usr/bin /bin /usr/sbin /sbin; do
            candidate="$(root_path "$dir")/$name"
            if [ -f "$candidate" ] || [ -L "$candidate" ]; then
                printf '%s' "$candidate"
                return 0
            fi
        done
    done
    return 1
}

ublock_evidence() {
    local home base profile extension_id
    # Chrome Web Store ID for uBlock Origin Lite. Browser profile data is only
    # detected; it is never deleted directly. Removal must use browser policy.
    extension_id="ddkjiahejlhfcafbddmgiahcphecmpfh"
    for home in ${USER_HOMES[@]+"${USER_HOMES[@]}"}; do
        for base in \
            "$home/Library/Application Support/Google/Chrome" \
            "$home/Library/Application Support/Microsoft Edge" \
            "$home/Library/Application Support/BraveSoftware/Brave-Browser"; do
            [ -d "$base" ] || continue
            for profile in "$base"/*; do
                [ -d "$profile/Extensions/$extension_id" ] || continue
                printf '%s' "$profile/Extensions/$extension_id"
                return 0
            done
        done
    done
    return 1
}

all_match_paths_absent() {
    local path bundle_id executable link_flag
    while IFS=$'\037' read -r -d '' path bundle_id executable link_flag; do
        path_exists "$path" && return 1
    done < "$MATCH_FILE"
    return 0
}

handle_docker() {
    local path bundle_id executable link_flag uninstaller failed=0 found=0
    while IFS=$'\037' read -r -d '' path bundle_id executable link_flag; do
        path_exists "$path" || continue
        found=1
        if [ "$DRY_RUN" -eq 1 ]; then
            log DRYRUN "Would run Docker uninstaller for: $path"
            continue
        fi
        uninstaller="$path/Contents/MacOS/uninstall"
        if [ -x "$uninstaller" ]; then
            run_with_timeout "$uninstaller" || failed=1
        else
            log WARN "Docker uninstaller not found; using verified bundle removal"
        fi
        if path_exists "$path"; then
            safe_remove_app "$path" || failed=1
        fi
        path_exists "$path" && failed=1
        [ "$failed" -ne 0 ] || cleanup_bundle_id_data "$bundle_id"
    done < "$MATCH_FILE"
    [ "$found" -eq 1 ] || return 3
    [ "$DRY_RUN" -eq 0 ] || return 4
    [ "$failed" -eq 0 ]
}

handle_cloudflare() {
    local path bundle_id executable link_flag uninstaller failed=0 found=0
    while IFS=$'\037' read -r -d '' path bundle_id executable link_flag; do
        path_exists "$path" || continue
        found=1
        uninstaller="$path/Contents/Resources/uninstall.sh"
        if [ "$DRY_RUN" -eq 1 ]; then
            log DRYRUN "Would run Cloudflare WARP uninstaller: $uninstaller -f"
            continue
        fi
        if [ -f "$uninstaller" ]; then
            run_with_timeout /bin/bash "$uninstaller" -f || failed=1
        else
            log ERROR "Cloudflare WARP uninstaller not found: $uninstaller"
            failed=1
        fi
        path_exists "$path" && failed=1
    done < "$MATCH_FILE"
    [ "$found" -eq 1 ] || return 3
    [ "$DRY_RUN" -eq 0 ] || return 4
    [ "$failed" -eq 0 ]
}

handle_karabiner() {
    local manager uninstaller
    vendor_evidence_exists karabiner-elements || return 3
    if [ "$DRY_RUN" -eq 1 ]; then
        log DRYRUN "Would run the Karabiner-Elements vendor uninstall workflow"
        return 4
    fi
    manager="$(root_path '/Library/Application Support/org.pqrs/Karabiner-DriverKit-VirtualHIDDevice/Applications/Karabiner-VirtualHIDDevice-Manager.app/Contents/MacOS/Karabiner-VirtualHIDDevice-Manager')"
    uninstaller="$(root_path '/Library/Application Support/org.pqrs/Karabiner-Elements/uninstall.sh')"
    if [ -x "$manager" ]; then
        run_with_timeout "$manager" deactivate || log WARN "Karabiner virtual HID deactivation returned non-zero"
    fi
    if [ ! -f "$uninstaller" ]; then
        log ERROR "Karabiner vendor uninstaller not found: $uninstaller"
        return 1
    fi
    run_with_timeout /bin/bash "$uninstaller" || return 1
    vendor_evidence_exists karabiner-elements && return 1
    return 0
}

TARGET_STATUS=""
TARGET_DETAIL=""
TARGET_PATHS=""

handle_target() {
    local target="$1" index="$2" matches family evidence rc
    local path bundle_id executable link_flag failed
    TARGET_STATUS=""
    TARGET_DETAIL=""
    TARGET_PATHS=""

    collect_matches "$target" "$index"
    matches="$(count_matches)"
    TARGET_PATHS="$(join_match_paths)"
    family="$(family_for_target "$target")"

    if [ "$(lower_text "$target")" = "ublock origin lite" ]; then
        evidence="$(ublock_evidence || true)"
        if [ -n "$evidence" ]; then
            TARGET_PATHS="$evidence"
            TARGET_STATUS="POLICY_REQUIRED"
            TARGET_DETAIL="Detected browser extension; remove with managed browser extension policy"
        else
            TARGET_STATUS="ALREADY_ABSENT"
            TARGET_DETAIL="No managed Chrome, Edge, or Brave profile evidence found"
        fi
        return
    fi

    if is_ambiguous_target "$target"; then
        evidence=""
        [ "$matches" -eq 0 ] || evidence="$TARGET_PATHS"
        [ -n "$evidence" ] || evidence="$(find_non_app_evidence "$target" || true)"
        [ -n "$evidence" ] || evidence="$(find_cli_evidence "$target" || true)"
        if [ -n "$evidence" ]; then
            TARGET_PATHS="$evidence"
            TARGET_STATUS="BLOCKED_AMBIGUOUS"
            TARGET_DETAIL="Generic name detected; automatic deletion is intentionally blocked"
        else
            TARGET_STATUS="ALREADY_ABSENT"
            TARGET_DETAIL="No exact evidence found for protected generic name"
        fi
        return
    fi

    case "$family" in
        docker)
            handle_docker; rc=$?
            case "$rc" in
                0) TARGET_STATUS="REMOVED"; TARGET_DETAIL="Docker vendor workflow completed and bundle absence verified" ;;
                3) TARGET_STATUS="ALREADY_ABSENT"; TARGET_DETAIL="No exact Docker app evidence found" ;;
                4) TARGET_STATUS="DRY_RUN_FOUND"; TARGET_DETAIL="Docker detected; no change made" ;;
                *) TARGET_STATUS="FAILED"; TARGET_DETAIL="Docker uninstall failed or target remains" ;;
            esac
            return
            ;;
        cloudflare-warp)
            handle_cloudflare; rc=$?
            case "$rc" in
                0) TARGET_STATUS="REMOVED"; TARGET_DETAIL="Cloudflare WARP vendor workflow completed and absence verified" ;;
                3) TARGET_STATUS="ALREADY_ABSENT"; TARGET_DETAIL="No exact Cloudflare WARP app evidence found" ;;
                4) TARGET_STATUS="DRY_RUN_FOUND"; TARGET_DETAIL="Cloudflare WARP detected; no change made" ;;
                *) TARGET_STATUS="FAILED"; TARGET_DETAIL="Cloudflare WARP uninstall failed or target remains" ;;
            esac
            return
            ;;
        karabiner-elements)
            handle_karabiner; rc=$?
            case "$rc" in
                0) TARGET_STATUS="REMOVED"; TARGET_DETAIL="Karabiner vendor workflow completed and absence verified" ;;
                3) TARGET_STATUS="ALREADY_ABSENT"; TARGET_DETAIL="No Karabiner family evidence found" ;;
                4) TARGET_STATUS="DRY_RUN_FOUND"; TARGET_DETAIL="Karabiner family detected; no change made" ;;
                *) TARGET_STATUS="FAILED"; TARGET_DETAIL="Karabiner uninstall failed or family evidence remains" ;;
            esac
            return
            ;;
    esac

    if is_manual_family "$family"; then
        if [ "$matches" -eq 0 ] && ! vendor_evidence_exists "$family"; then
            TARGET_STATUS="ALREADY_ABSENT"
            TARGET_DETAIL="No exact app or known vendor-family evidence found"
            return
        fi
        [ -n "$TARGET_PATHS" ] || TARGET_PATHS="known $family vendor evidence"
        if [ "$DRY_RUN" -eq 1 ]; then
            TARGET_STATUS="DRY_RUN_FOUND"
            TARGET_DETAIL="Vendor-managed family detected; no override executed"
            return
        fi
        run_family_override "$family" "$target"; rc=$?
        if [ "$rc" -eq 125 ]; then
            TARGET_STATUS="MANUAL_REQUIRED"
            TARGET_DETAIL="Vendor uninstall is required; install an approved root-owned override: $VENDOR_OVERRIDE_DIR/$family.sh"
        elif [ "$rc" -ne 0 ]; then
            TARGET_STATUS="FAILED"
            TARGET_DETAIL="Approved vendor override returned exit code $rc"
        elif ! all_match_paths_absent; then
            TARGET_STATUS="FAILED"
            TARGET_DETAIL="Vendor override returned success but an exact matched app remains"
        elif [ "$matches" -eq 0 ] && vendor_evidence_exists "$family"; then
            TARGET_STATUS="FAILED"
            TARGET_DETAIL="Vendor override returned success but known family evidence remains"
        else
            TARGET_STATUS="REMOVED"
            TARGET_DETAIL="Approved vendor override completed and target absence was verified"
        fi
        return
    fi

    if [ "$matches" -gt 0 ]; then
        if [ "$DRY_RUN" -eq 1 ]; then
            TARGET_STATUS="DRY_RUN_FOUND"
            TARGET_DETAIL="Found $matches exact app bundle(s); no change made"
            return
        fi
        failed=0
        while IFS=$'\037' read -r -d '' path bundle_id executable link_flag; do
            path_exists "$path" || continue
            safe_remove_app "$path" || failed=1
            if ! path_exists "$path"; then cleanup_bundle_id_data "$bundle_id"; fi
        done < "$MATCH_FILE"
        if [ "$failed" -eq 0 ] && all_match_paths_absent; then
            TARGET_STATUS="REMOVED"
            TARGET_DETAIL="Removed and verified $matches exact app bundle(s)"
        else
            TARGET_STATUS="FAILED"
            TARGET_DETAIL="One or more exact matched app bundles remain or removal failed"
        fi
        return
    fi

    evidence="$(find_non_app_evidence "$target" || true)"
    if [ -n "$evidence" ]; then
        TARGET_PATHS="$evidence"
        TARGET_STATUS="MANUAL_REQUIRED"
        TARGET_DETAIL="Exact non-.app path found; generic recursive deletion is intentionally blocked"
        return
    fi
    evidence="$(find_cli_evidence "$target" || true)"
    if [ -n "$evidence" ]; then
        TARGET_PATHS="$evidence"
        TARGET_STATUS="MANUAL_REQUIRED"
        TARGET_DETAIL="Exact CLI evidence found; use a vendor/package-aware override instead of deleting blindly"
        return
    fi

    TARGET_STATUS="ALREADY_ABSENT"
    TARGET_DETAIL="No exact app bundle, top-level path, CLI, or known vendor evidence found"
}

write_summary() {
    local target="$1" status="$2" paths="$3" detail="$4"
    printf '%s\t%s\t%s\t%s\n' \
        "$(clean_field "$target")" \
        "$(clean_field "$status")" \
        "$(clean_field "$paths")" \
        "$(clean_field "$detail")" >> "$SUMMARY_FILE"
}

normalize_manifest
build_scan_roots
[ "${#SCAN_ROOTS[@]}" -gt 0 ] || fatal_preflight "No valid application scan roots were found"
build_inventory

printf 'Target\tStatus\tEvidenceOrPath\tDetail\n' > "$SUMMARY_FILE"
log INFO "Run started: manifest=${#NORMALIZED_APPS[@]} dry_run=$DRY_RUN remove_user_data=$REMOVE_USER_DATA"

TOTAL=0
REMOVED=0
ABSENT=0
FAILED=0
MANUAL=0
BLOCKED=0
POLICY=0
DRY_FOUND=0
INDEX=0

for TARGET in "${NORMALIZED_APPS[@]}"; do
    INDEX=$((INDEX + 1))
    TOTAL=$((TOTAL + 1))
    log INFO "[$INDEX/${#NORMALIZED_APPS[@]}] Checking exact target: $TARGET"
    handle_target "$TARGET" "$INDEX"
    write_summary "$TARGET" "$TARGET_STATUS" "$TARGET_PATHS" "$TARGET_DETAIL"
    log INFO "Result: $TARGET => $TARGET_STATUS ($TARGET_DETAIL)"
    case "$TARGET_STATUS" in
        REMOVED) REMOVED=$((REMOVED + 1)) ;;
        ALREADY_ABSENT) ABSENT=$((ABSENT + 1)) ;;
        FAILED) FAILED=$((FAILED + 1)) ;;
        MANUAL_REQUIRED) MANUAL=$((MANUAL + 1)) ;;
        BLOCKED_AMBIGUOUS) BLOCKED=$((BLOCKED + 1)) ;;
        POLICY_REQUIRED) POLICY=$((POLICY + 1)) ;;
        DRY_RUN_FOUND) DRY_FOUND=$((DRY_FOUND + 1)) ;;
        *) FAILED=$((FAILED + 1)); log ERROR "Unknown result status: $TARGET_STATUS" ;;
    esac
done

log INFO "Summary: total=$TOTAL removed=$REMOVED already_absent=$ABSENT failed=$FAILED manual=$MANUAL blocked=$BLOCKED policy=$POLICY dry_run_found=$DRY_FOUND"
log INFO "Summary file: $SUMMARY_FILE"
log INFO "Log file: $LOG_FILE"

if [ "$FAILED" -gt 0 ] || [ "$MANUAL" -gt 0 ] || [ "$BLOCKED" -gt 0 ] || \
   [ "$POLICY" -gt 0 ] || [ "$DRY_FOUND" -gt 0 ]; then
    log ERROR "Completed with unresolved targets; returning exit code 1"
    exit 1
fi

log INFO "All targets are removed or already absent; returning exit code 0"
exit 0
```
