# Guide Vận Hành Figma Frontend Agent

Tài liệu này hướng dẫn vận hành toàn bộ flow: tiếp nhận source/rules/Figma, tạo context có kiểm soát, giao Agent làm việc, review/QC và xử lý thay đổi. Đây là runbook thực thi, không phải tài liệu marketing hay mô tả chung.

## Cách dùng tài liệu này

`GUIDE.md` là runbook cấp vận hành dành cho người dùng, cache owner và Agent **chỉ khi được giao chuẩn bị context**. Nó không phải phase artifact và không được tự nạp khi Agent đang Analysis, Foundation, Implementation, Review hoặc QC theo approved context.

- Tạo hoặc sửa draft context: đọc các phần liên quan của guide cùng `context-builder/INTAKE_GUIDE.vi.md` và, khi cần, `design-collector/GUIDE.md`.
- Làm việc theo approved context: không đọc lại guide; chỉ đọc `project-context-index.json` và artifact được phase hiện tại cho phép.
- Tác vụ ad-hoc không tạo context: dùng Direct mode và playbook phase tương ứng; không cần nạp toàn bộ guide.

## 1. Mục tiêu vận hành

Flow được thiết kế để Agent không phải tự đoán dữ liệu quan trọng như target Figma, padding/gap, viewport, `max-width`, icon hay coding rule.

```text
Input được xác nhận
  -> Collector / Adapter
  -> Normalizer / Filter
  -> Context Builder
  -> Người dùng review draft
  -> Approved Context
  -> Agent Analysis / Foundation / Implementation / Review / QC
  -> Evidence và report ngoài baseline
```

Nguyên tắc bắt buộc:

1. Context Builder là deterministic CLI, không phải AI tự hiểu mọi thứ.
2. Chỉ `task-context.approved.json` được Agent dùng trong `context` mode.
3. Không tự gọi Figma MCP/REST khi mở chat, chuyển phase, review hoặc QC.
4. Mỗi target implementation phải có target frame, viewport contract và visual evidence ổn định.
5. Approved baseline là bất biến. Report/evidence mới không sửa file approved.

## 2. Thành phần và trách nhiệm

| Thành phần | Nhiệm vụ | Không được làm |
| --- | --- | --- |
| Collector / Adapter | Đọc Figma JSON/REST, source tree, rules input thành fact có cấu trúc. | Suy luận UI, tự approve, implement source. |
| Normalizer / Filter | Chọn target scope, bỏ node rác/ẩn/design-only, tóm tắt vector và nén context. | Gọi Figma, tự chọn yêu cầu nghiệp vụ. |
| Context Builder | Ghép fact, tạo Profile/Project/Task Context, hash, validation, phase gate và approve. | Tự gọi Figma, tự tạo evidence, tự sửa customer source. |
| Skill / Playbook | Quy tắc để Agent làm Analysis, Implement, Review, QC. | Thay approved context bằng suy đoán. |
| Codex Lifecycle Hook | Chỉ báo status context nếu được cấu hình. | Tự build/inject context, gọi Figma. |
| Người dùng / cache owner | Cung cấp input, review draft, approve, cấp quyền refresh Figma. | — |

## 3. Hai chế độ Agent

### Context mode

Dùng khi prompt Agent có đường dẫn tuyệt đối tới `task-context.approved.json`.

Agent phải:

1. Nói rõ `Mode: context`.
2. Chạy `figma-context status` với phase cần làm.
3. Chỉ đọc project index và artifact của phase hiện tại.
4. Dừng nếu context stale, blocked, checksum sai hoặc evidence thiếu.

Ví dụ prompt:

```text
Mode context. Hãy triển khai phase implementation theo context đã duyệt:
D:\agents\figma-frontend-agent\contexts\tasks\customer-a-pos\POS-142\task-context.approved.json
```

### Direct mode

Dùng cho yêu cầu ad-hoc chưa có approved context. Agent phải nói rõ `Mode: direct`, làm intake có evidence và có thể tạo **draft** cho lần sau. Direct mode không được ngầm trở thành context mode.

## 4. Chuẩn bị một lần cho project

### 4.1 Chuẩn bị source local

Clone repository customer ở ngoài thư mục Agent, ví dụ:

```text
D:\workspace\customer-a-pos
```

Không đặt context vào repository customer. Toàn bộ artifact của Agent nằm dưới:

```text
D:\agents\figma-frontend-agent\contexts\
```

### 4.2 Chuẩn bị Profile Context

Profile chứa framework, version, coding rule, lint, format và quy ước report/test có thể tái sử dụng. Dữ kiện này được đưa vào `intake.json` và Builder cache theo `customer`, `name`, `version`, hash.

Chỉ tăng `profile.version` khi framework/rule/format thay đổi. Không tạo profile mới cho từng task chỉ vì task khác màn hình.

Không đưa vào profile: PAT, cookie, API key, source customer, raw Figma payload hoặc screenshot riêng tư không cần thiết.

### 4.3 Chuẩn bị visual evidence

Lưu ảnh Figma export/screenshot ở đường dẫn ổn định, ví dụ:

```text
D:\agents\figma-frontend-agent\contexts\tasks\customer-a-pos\POS-142\evidence\products-pc.png
```

Không dùng đường dẫn clipboard hoặc Temp làm evidence baseline. Ảnh là nguồn đối chiếu trực quan; số đo chuẩn lấy từ frame Figma và `viewportContract`.

## 5. Flow chuẩn cho một task mới

### Bước 1: Tạo intake template

```powershell
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js init `
  --out D:\work\POS-142.intake.json
```

Mở file vừa tạo và điền dữ kiện thật theo [hướng dẫn intake](context-builder/INTAKE_GUIDE.vi.md).

Tối thiểu cần có:

- `project.key`, `project.sourcePath`
- `task.id`, `task.title`, `task.requestedPhase`
- Profile framework/rules
- `design.targetFrame` nếu task đi tới Foundation/Implementation
- `viewportContract`
- `referenceImages` có đường dẫn ổn định

### Bước 2: Thu thập design có chủ đích

Ưu tiên theo thứ tự:

1. Collected artifact còn fresh trong `contexts`.
2. JSON đã lưu từ Figma MCP/export bằng `import`.
3. Figma REST targeted bằng `collect`, chỉ khi người dùng cho phép refresh.

Import JSON có sẵn, không gọi API:

```powershell
node D:\agents\figma-frontend-agent\design-collector\bin\figma-design.js import `
  --input D:\evidence\products-figma.json `
  --out D:\agents\figma-frontend-agent\contexts\projects\customer-a-pos\figma\products.collected.json `
  --node-ids 57:99
```

Collect từ Figma REST khi thật sự cần:

```powershell
$env:FIGMA_ACCESS_TOKEN = "<personal-access-token>"

node D:\agents\figma-frontend-agent\design-collector\bin\figma-design.js collect `
  --figma-url "https://www.figma.com/design/<file-key>/Products?node-id=57-99" `
  --out D:\agents\figma-frontend-agent\contexts\projects\customer-a-pos\figma\products.collected.json
```

Xem [Guide Design Collector](design-collector/GUIDE.md) để biết chi tiết token, cache, `--refresh`, giới hạn depth và rate-limit.

### Bước 3: Khai báo target và viewport chính xác

Trong intake, khai báo đồng nhất giữa Figma URL, `nodes`, `targetFrame`, collected artifact và evidence image.

Ví dụ màn Products PC-only tại viewport 1400x887, cần giữ desktop canvas thay vì cap chiều rộng:

```json
{
  "design": {
    "nodes": ["57:99"],
    "targetFrame": { "nodeId": "57:99", "name": "Products" },
    "collectedArtifactPath": "D:\\agents\\figma-frontend-agent\\contexts\\projects\\customer-a-pos\\figma\\products.collected.json",
    "normalizedArtifactPath": null,
    "referenceImages": [{
      "path": "D:\\agents\\figma-frontend-agent\\contexts\\tasks\\customer-a-pos\\POS-142\\evidence\\products-pc.png",
      "role": "visual_comparison",
      "measurementAuthority": "figma_frame"
    }]
  },
  "viewportContract": {
    "referenceViewport": { "width": 1400, "height": 887 },
    "deviceScope": "pc_only",
    "layoutBehavior": "min_width",
    "minWidth": 1400,
    "maxWidth": null,
    "interpolationAllowed": false
  }
}
```

Không suy `maxWidth: 1400` chỉ từ việc Figma frame rộng 1400 px. Nếu chưa rõ desktop/mobile behavior, để task ở `analysis` và yêu cầu clarification/evidence.

### Bước 4: Build draft context

```powershell
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js build `
  --intake D:\work\POS-142.intake.json
```

Builder thực hiện theo thứ tự:

1. Source Adapter đọc metadata source local.
2. Rules Adapter tạo input từ Profile.
3. Source/Rules Compiler sinh artifact gọn và cache khi input không đổi.
4. Design Normalizer tạo `normalized_design_artifact` đúng `targetFrame` từ `collectedArtifactPath`.
5. Design Index/Layout Compiler chỉ dùng normalized artifact theo task.
6. Project Context Index ghi artifact nào cần cho từng phase.
7. Task Context draft ghi reference/hash thay vì copy payload lớn.

Output thường nằm tại:

```text
contexts/
  profiles/<customer>/<profile>.json
  projects/<project-key>/
    project-context.json
    project-context-index.json
    figma/<task-id>/normalized-design.json
    figma/<task-id>/design-index.json
    figma/<task-id>/layout-context.json
  tasks/<project-key>/<task-id>/
    task-context.draft.json
```

### Bước 5: Review draft và validate phase

```powershell
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js validate `
  --context D:\agents\figma-frontend-agent\contexts\tasks\customer-a-pos\POS-142\task-context.draft.json `
  --phase implementation
```

Trước khi approve, kiểm tra:

- `targetFrame` có trong normalized artifact và là đúng màn hình/state.
- Reference image mở được, đúng viewport/state với Figma.
- `viewportContract` diễn đạt đúng requirement PC/mobile/tablet.
- Asset policy không cho phép icon thay thế tự đoán.
- Phase yêu cầu không bị block.
- Profile/source/rules là đúng phiên bản.

Nếu validate fail, không dùng Agent để “tự bù” dữ kiện. Sửa intake/evidence, build lại draft, rồi validate lại.

### Bước 6: Approve baseline

```powershell
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js approve `
  --context D:\agents\figma-frontend-agent\contexts\tasks\customer-a-pos\POS-142\task-context.draft.json
```

Lệnh chỉ chạy sau khi draft valid. Nó tạo:

```text
task-context.approved.json
task-context.approved.json.sha256
```

Hai file được đặt read-only. Không sửa trực tiếp JSON, không đổi `status` bằng tay và không đổi tên để giả approval.

### Bước 7: Giao Agent làm việc

Gửi prompt có đường dẫn approved context và phase rõ ràng:

```text
Mode context. Hãy thực hiện phase implementation theo approved context sau:
D:\agents\figma-frontend-agent\contexts\tasks\customer-a-pos\POS-142\task-context.approved.json

Không gọi Figma MCP/REST. Nếu evidence thiếu, tạo evidence_refresh_request.
```

Agent phải kiểm tra:

```powershell
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js status `
  --context D:\agents\figma-frontend-agent\contexts\tasks\customer-a-pos\POS-142\task-context.approved.json `
  --phase implementation
```

Sau đó Agent chỉ tải artifact hiện tại từ `project-context-index.json`, không nạp toàn bộ Profile/Project/Task vào prompt.

## 6. Vận hành theo phase

| Phase | Mục tiêu | Điều kiện để bắt đầu | Output mong đợi |
| --- | --- | --- | --- |
| `analysis` | Xác định scope, risk, component plan, estimate. | Source/profile/rules và task scope. | Analysis report, assumption/evidence gap. |
| `foundation` | Dựng source tree, base layout, tokens, component khung. | Target frame, normalized design, viewport, visual evidence. | Foundation contract và khung source. |
| `implementation` | Code giao diện/chức năng trong scope đã duyệt. | Toàn bộ Foundation gate và asset policy. | Source change, screenshot/evidence. |
| `review` | Kiểm tra code/risk/regression theo evidence. | Approved baseline và review evidence/index. | Review report, finding, không tự PASS. |
| `qc` | Test layout/functional/edge/responsive theo contract. | Approved baseline và QC evidence/index. | Test report, evidence, blocked/fail/pass có cơ sở. |

Chuyển từ Implementation sang Review/QC không cần tạo baseline mới nếu design/source/rule/viewport không đổi:

```powershell
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js status `
  --context <task-context.approved.json> `
  --phase review
```

Evidence/report mới lưu dưới `contexts/tasks/<project>/<task>/evidence/` và `reports/`; không sửa approved context.

## 7. Khi nào phải refresh hoặc tạo baseline mới

| Tình huống | Hành động |
| --- | --- |
| Chỉ đổi phase từ implementation sang review/QC | Không rebuild baseline; chạy `status --phase`. |
| Thêm screenshot/test evidence | Lưu evidence/report; không sửa baseline. |
| Source code/config/dependency đổi | Rebuild draft; approved context cũ có thể stale. |
| Coding rule/framework/format đổi | Tăng profile version hoặc sửa Profile input, build draft mới. |
| Target Figma, revision, viewport hay asset đổi | Targeted collect/import mới, build draft mới và review lại. |
| Figma evidence thiếu | Tạo `evidence_refresh_request`; chỉ user/cache owner cho phép collect/MCP targeted. |

Phiên bản CLI hiện không ghi đè một approved context đã tồn tại. Khi baseline đã approved nhưng input nền thay đổi, tạo một task revision rõ ràng, ví dụ `POS-142-r2`, để có draft/approved artifact mới và vẫn giữ baseline cũ để đối chiếu lịch sử.

## 8. Kiểm soát chi phí và token

1. Dùng Profile Context qua hash/version, không lặp coding rules trong từng task.
2. Dùng Project Context Index; Agent chỉ đọc artifact cần cho phase hiện tại.
3. Dùng `import` từ JSON/export đã lưu trước Figma REST/MCP.
4. Dùng Collector cache; không thêm `--refresh` nếu file/node/depth/version không đổi.
5. Request Figma theo node, không lấy full file.
6. Không nạp raw/collected tree vào Agent; chỉ nạp normalized layout/index theo phase.
7. Không gọi Figma lại chỉ để “xác nhận” dữ kiện đã có fingerprint/evidence hợp lệ.

## 9. Xử lý lỗi thường gặp

| Dấu hiệu | Nguyên nhân thường gặp | Cách xử lý |
| --- | --- | --- |
| `target_frame_not_confirmed` | Target node không có trong normalized artifact hoặc chọn page root sai. | Kiểm tra `targetFrame.nodeId`, import/collect đúng node, build lại. |
| `viewport_contract_not_confirmed` | Thiếu viewport/behavior hoặc khai báo không hợp lệ. | Bổ sung `referenceViewport`, `deviceScope`, `layoutBehavior`; không tự suy max-width. |
| `visual_reference_not_confirmed` | Ảnh không tồn tại hoặc role không phải `visual_comparison`. | Lưu ảnh ổn định dưới `contexts`, sửa path/role, build lại. |
| `design_artifact_stale` | Normalized artifact đã thay đổi sau approve. | Review lại nguồn thay đổi và tạo revision baseline nếu cần. |
| `collected_design_artifact_stale` | Collected Figma artifact nguồn đã thay đổi. | Normalize/build/review lại; không tiếp tục implement bằng baseline cũ. |
| `requested_phase_blocked` | Artifact cần cho phase bị thiếu/invalid. | Đọc `project-context-index.json`, bổ sung artifact được nêu trong `blockedBy`. |
| Missing Figma token | Chạy REST collect nhưng environment variable chưa có. | Chỉ set `FIGMA_ACCESS_TOKEN` trong process hiện tại hoặc dùng `import`. |
| Rate limit/Figma lỗi | Gọi refresh quá nhiều hoặc quyền/token không phù hợp. | Dừng retry tự động, dùng cache/import, chờ hoặc xin quyền targeted refresh. |

## 10. Checklist vận hành mỗi task

- [ ] Source đã clone local và path đúng.
- [ ] Profile đúng framework/rules/format hiện tại.
- [ ] Figma target node cụ thể, không mơ hồ page/component library.
- [ ] Collected artifact đến từ cache/import/REST có lý do rõ ràng.
- [ ] Visual evidence ở đường dẫn ổn định.
- [ ] Viewport contract không suy diễn `max-width`.
- [ ] Draft `validate` pass tại phase chuẩn bị làm.
- [ ] Người dùng đã review và chạy `approve`.
- [ ] Prompt Agent có approved-context path và phase rõ ràng.
- [ ] Evidence/report mới được lưu ngoài approved baseline.
