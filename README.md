# Figma Frontend Agent

Agent hỗ trợ chuyển Figma design thành frontend có evidence, giới hạn Figma request, giảm token lặp lại và giữ context ngoài customer source. Hỗ trợ HTML, CSS, JavaScript, SCSS và framework/rule riêng của từng khách hàng.

## Bắt đầu ở đây

Vận hành thông thường chỉ dùng một CLI:

```powershell
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js
```

Flow chuẩn:

```text
init -> điền intake -> prepare -> review/validate -> approve -> Agent làm phase
```

```powershell
# 1. Tạo intake
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js init `
  --out D:\work\POS-142.intake.json

# 2. Import JSON Figma đã có, normalize, build và validate draft trong một lệnh
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js prepare `
  --intake D:\work\POS-142.intake.json `
  --design-json D:\evidence\products-figma.json `
  --phase implementation

# 3. Sau khi người dùng review draft, approve baseline
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js approve `
  --context D:\agents\figma-frontend-agent\contexts\tasks\customer-a-pos\POS-142\task-context.draft.json
```

Không có JSON Figma cache/export thì mới dùng REST targeted:

```powershell
# Ưu tiên: đặt FIGMA_ACCESS_TOKEN trong D:\agents\figma-frontend-agent\.env.
# Hoặc chỉ định tạm thời cho cửa sổ PowerShell hiện tại:
$env:FIGMA_ACCESS_TOKEN = "<personal-access-token>"
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js prepare `
  --intake D:\work\POS-142.intake.json `
  --figma-url "https://www.figma.com/design/<file-key>/Products?node-id=57-99" `
  --allow-figma-rest `
  --phase implementation
```

`--allow-figma-rest` là authorization bắt buộc. Thiếu cờ này CLI từ chối trước khi đọc token hoặc gọi network.

## Cách đọc tài liệu

| Tài liệu | Dành cho | Khi nào đọc |
| --- | --- | --- |
| [GUIDE.md](GUIDE.md) | Người dùng, cache owner, Agent chuẩn bị context | Tài liệu chuẩn duy nhất: intake, CLI, Collector, Normalizer, approval, state/effect và refresh. |

`GUIDE.md` là runbook, không phải phase artifact. Khi Agent đang làm theo approved context, Agent không cần nạp lại guide; nó chỉ đọc project context index và artifact của phase hiện tại.

## Kiến trúc

```text
Source + rules + Figma JSON/link + visual evidence
  -> figma-context prepare
     -> Collector / Adapter       (đọc input đúng loại)
     -> Normalizer / Filter       (scope và lọc node)
     -> Context Builder           (hash, gate, draft)
  -> user review / approve
  -> task-context.approved.json
  -> Agent Analysis / Foundation / Implementation / Review / QC
```

Collector, Normalizer và Builder vẫn tách module nội bộ để giữ test, cache, token boundary và trách nhiệm rõ ràng. Với người vận hành, chúng là implementation detail của `figma-context`.

## Hai chế độ Agent

### Context mode

Dùng khi prompt cung cấp path `task-context.approved.json`.

```text
Mode context. Hãy thực hiện phase implementation theo context đã duyệt:
D:\agents\figma-frontend-agent\contexts\tasks\customer-a-pos\POS-142\task-context.approved.json
```

Agent kiểm tra checksum, freshness và phase gate bằng `figma-context status --phase <phase>`. Sau đó chỉ đọc artifact được `project-context-index.json` cấp cho phase đó. Context stale/blocked phải dừng và báo evidence cần refresh.

### Direct mode

Dùng khi chưa có approved context. Agent công khai `Mode: direct`. Nếu người dùng yêu cầu tạo draft, Agent dùng playbook `figma-context-preparation`, build/validate rồi chờ người dùng approve; không tự coi draft là authoritative.

## Cấu trúc thư mục

```text
figma-frontend-agent/
  SKILL.md                         Root Skill duy nhất được Codex discover
  GUIDE.md                         Tài liệu vận hành chuẩn duy nhất
  context-builder/                 Unified figma-context CLI và tests
  design-collector/                Module adapter Figma
  normalizers/design-normalizer/   Module scope/filter
  collectors/                      Adapter source/rules local
  hooks/                           Compiler source/rules/index/layout/evidence
  playbooks/                       Policy context preparation và phase delivery
  codex-hooks/                     Lifecycle status-only tùy chọn
  contexts/                        Artifact runtime, nằm ngoài customer source
```

Customer source phải ở nơi khác, ví dụ `D:\workspace\customer-a-pos`. Không lưu source, PAT, cookie hoặc credential trong `contexts`, Profile Context hay guide.

## Vòng đời context

```text
draft -> validate -> approved -> stale | superseded
```

- `draft`: tạo bởi `prepare` hoặc `build`; không dùng để implement trong context mode.
- `approved`: do người dùng review rồi gọi `approve`; có checksum SHA-256 và read-only.
- `stale`: source, rules, collected/normalized design artifact hoặc reference hash đổi.
- `superseded`: baseline cũ được thay bằng task revision mới, ví dụ `POS-142-r2`.

Chỉ đổi phase Implementation sang Review/QC thì không cần build baseline mới. Dùng cùng approved context và chạy `status --phase review` hoặc `status --phase qc`. Evidence/report mới nằm trong `contexts/tasks/<project>/<task>/evidence/` hoặc `reports/`, không sửa approved JSON.

## Context và evidence tối thiểu

Foundation/Implementation chỉ được mở khi có:

- Một `targetFrame` xác định đúng màn hình/state.
- `viewportContract` rõ ràng.
- Collected/normalized artifact chứa target frame.
- Ảnh `visual_comparison` tại path ổn định.
- Asset policy không cho Agent thay icon bằng CSS/text/SVG tự đoán.
- `implementationContract` xác định delivery mode, route, entrypoint strategy và file plan.
- Dropdown, modal, tooltip hoặc state mở cần đối chiếu phải khai báo trong `design.visualStates`. `DROP_SHADOW`/blur chỉ được triển khai từ effect Figma đã thu thập hoặc evidence được duyệt, không được tự chọn CSS gần đúng.

`referenceViewport: 1400px` là kích thước để đo, không tự có nghĩa `max-width: 1400px`. Chọn đúng `layoutBehavior`: `min_width`, `fixed_canvas`, `fluid` hoặc `max_width` theo requirement/evidence.

`implementationContract` chặn suy luận file/route: task thêm static page phải có `route.path` và `filePlan.primary` như `supplier.html`; `index.html` chỉ được replace khi `replace_single_static_entry` được phê duyệt rõ ràng.

## Command reference

| Command | Dùng khi |
| --- | --- |
| `init --out <intake>` | Tạo intake template. |
| `prepare --intake <file> --design-json <json>` | Flow mặc định: import, normalize, build, validate. |
| `prepare --intake <file> --figma-url <url> --allow-figma-rest` | Không có cache/export và user cho phép REST targeted. |
| `validate --context <draft> --phase <phase>` | Kiểm tra draft trước approval. |
| `approve --context <draft>` | Người dùng khóa approved baseline. |
| `status --context <approved> --phase <phase>` | Kiểm tra trước mỗi phase Agent. |
| `import`, `collect`, `normalize`, `build` | Command nâng cao/debug; xem GUIDE.md. |

## Kiểm soát chi phí và token

1. Reuse Profile/Project Context bằng hash/reference thay vì lặp framework/rule vào task.
2. Ưu tiên cache và `--design-json`; REST/MCP chỉ targeted khi được cho phép.
3. Cache hit không cần token/network; `--refresh` chỉ khi Figma revision/evidence thực sự đổi.
4. Agent chỉ tải phase artifact qua project context index, không nạp raw collected tree hoặc toàn bộ guide trong implementation/review/QC.
5. Evidence thiếu/stale: tạo `evidence_refresh_request`, không tự suy diễn hoặc tự fetch lại Figma.

## Kiểm thử

```powershell
cd D:\agents\figma-frontend-agent\context-builder
npm test

cd D:\agents\figma-frontend-agent\design-collector
npm test

cd D:\agents\figma-frontend-agent\normalizers\design-normalizer
npm test
```

Các compiler dưới `hooks/` có test độc lập. Chạy test của module bị ảnh hưởng trước khi thay đổi policy hoặc artifact schema.
