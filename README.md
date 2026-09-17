# Figma Frontend Agent

Figma Frontend Agent là workflow evidence-first để chuyển Figma thành frontend mà vẫn kiểm soát request Figma, token, technical debt và độ bám sát design. Nó hỗ trợ HTML, CSS, JavaScript, SCSS cùng framework, coding rule và format report riêng của từng khách hàng.

Mọi context, evidence và report được lưu ngoài customer source tại `D:\agents\figma-frontend-agent\contexts\`. Customer source chỉ chứa code, config và test thuộc project.

## Bắt đầu

CLI thống nhất:

```powershell
figma-context <group> <command>
```

CLI chuẩn dùng nhóm lệnh: `context`, `design`, `amend`, `foundation`, `evidence`, `review`, `qc`, `util`. Ví dụ: `figma-context amend create`, `figma-context evidence capture`, `figma-context qc plan`. Có thể dùng `--task <project-key>/<task-id>` thay `--context` cho approved context; không dùng hai cờ cùng lúc. Các ví dụ tên lệnh phẳng cũ trong tài liệu vẫn chạy tương thích và trả `meta.warnings`; khi vận hành mới, ưu tiên command tree.

Lần đầu dùng screenshot capture, cài runtime trong Context Builder:

```powershell
cd D:\agents\figma-frontend-agent\context-builder
npm install
npx playwright install chromium
```

`FIGMA_ACCESS_TOKEN` là tùy chọn. Khi cần REST targeted, đặt token tại `D:\agents\figma-frontend-agent\.env`; CLI chỉ đọc token sau khi có `--allow-figma-rest`.

```env
FIGMA_ACCESS_TOKEN=<personal-access-token>
```

## Flow chuẩn

```text
Client input: Figma + rules + acceptance criteria + local source
  -> figma-context init / prepare
  -> task-context.draft.json
  -> user review + validate + approve
  -> Agent làm phase được phép
  -> task reports: foundation, evidence, screenshots, review/QC
```

Context Builder là CLI chạy chủ động, không phải Codex Lifecycle Hook. Người dùng review draft trước khi approve; Agent không tự build hoặc approve context khi đang ở context mode.

## Hai chế độ Agent

### Context mode

Dùng khi prompt có đường dẫn `task-context.approved.json`.

```text
Mode context. Thực hiện implementation theo context đã duyệt:
D:\agents\figma-frontend-agent\contexts\tasks\customer-a-pos\POS-142\task-context.approved.json
```

Agent xác thực checksum, freshness và phase gate trước khi làm việc. Nếu artifact thiếu/stale/blocked, Agent dừng phase liên quan và tạo yêu cầu refresh evidence; không tự chuyển sang direct mode.

### Context Amendment

Dùng Amendment cho yêu cầu nhanh có giới hạn như sửa hamburger theo evidence, thêm shadow/menu state có ảnh-node, hoặc thêm viewport QC đã xác nhận. Prompt phải kèm cả base context và amendment đã duyệt:

```text
Mode context. Base context:
D:\agents\...\task-context.approved.json

Approved amendment:
D:\agents\...\amendments\AMD-001-user-menu\amendment.approved.json
```

Amendment là overlay trong bộ nhớ; nó không sửa base context. Không dùng cho framework/rule, target frame chính, route architecture hoặc source ownership. Những thay đổi này cần task context revision.

Sau khi Foundation hoặc Implementation đã ghi source, `sourceFingerprint` của baseline có thể khác source hiện tại. Đây là expected source drift cho evidence/Review/QC, không phải quyền bỏ qua mọi gate. Các lệnh `capture-evidence`, `link-evidence`, `review-input`, `qc-plan` và `run-qc` xử lý drift này có kiểm soát; còn `status` giữ strict mặc định. Chỉ dùng `status --allow-source-drift` khi kiểm Review/QC hậu-implementation. Checksum, design artifact, profile/project reference và evidence gate vẫn bắt buộc.

### Direct mode

Dùng cho yêu cầu ad-hoc chưa có approved context. Agent phải công khai `Mode: direct`; kết quả có thể tạo draft để người dùng duyệt cho handoff hoặc task sau.

## Quick Start: Project đã có source

```powershell
# 1. Tạo intake template
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js init `
  --out D:\work\POS-142.intake.json

# 2. Ưu tiên import Figma JSON/export đã có: import, normalize, build và validate draft
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js prepare `
  --intake D:\work\POS-142.intake.json `
  --design-json D:\evidence\products-figma.json `
  --phase implementation

# 3. Review và validate draft
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js validate `
  --context D:\agents\figma-frontend-agent\contexts\tasks\customer-a-pos\POS-142\task-context.draft.json `
  --phase implementation

# 4. User approve baseline
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js approve `
  --context D:\agents\figma-frontend-agent\contexts\tasks\customer-a-pos\POS-142\task-context.draft.json
```

Chỉ khi local artifact/screenshot không đủ mới dùng Figma REST targeted:

```powershell
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js prepare `
  --intake D:\work\POS-142.intake.json `
  --figma-url "https://www.figma.com/design/<file-key>/Products?node-id=57-99" `
  --allow-figma-rest `
  --phase implementation
```

Không có `--allow-figma-rest`, CLI không đọc token và không gọi network.

## Quick Start: Source rỗng

Khi bạn tạo project từ đầu, chia baseline thành Foundation và Implementation. Foundation Context cần `scaffoldContract`; không dùng Foundation Context để implement page/domain slice.

```powershell
# Sau khi Foundation Agent tạo source, khởi tạo và điền manifest task-local
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js init-foundation-manifest `
  --context <foundation-approved-context>

# Chốt manifest bằng source fingerprint hậu Foundation
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js finalize-foundation-manifest `
  --context <foundation-approved-context>

# Tạo draft Implementation mới; không gọi Figma lại khi evidence Foundation còn current
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js transition `
  --from <foundation-approved-context> `
  --foundation-manifest <foundation-manifest.json> `
  --intake D:\work\POS-142-implementation.intake.json
```

`transition` kế thừa approved design evidence. Các field design artifact để `null` trong Implementation intake nghĩa là kế thừa, không phải xóa evidence. Khi `targetFrame` đổi, Builder chuẩn hóa lại từ collected artifact đã có, không gọi Figma thêm.

## Reports và Screenshot Evidence

```text
contexts/tasks/<project-key>/<task-id>/
  task-context.draft.json
  task-context.approved.json
  amendments/<amendment-id>/
    amendment.draft.json
    amendment.approved.json
    amendment.approved.json.sha256
  reports/
    foundation-manifest.json
    evidence/
      design-evidence-ledger.json
      quality-evidence-bundle.json
      evidence-links.json
      screenshots/
    review/
      change-manifest.json
      review-report.json
    qc/
      qc-plan.json
      qc-run.json
      visual-diff-summary.json
```

Khởi tạo ledger và bundle trước Implementation hoặc QC:

```powershell
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js init-evidence `
  --context <task-context.approved.json>
```

Khi local application đang chạy, capture render tại viewport contract:

```powershell
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js capture-evidence `
  --context <task-context.approved.json> `
  --url http://localhost:3000/dashboard.html `
  --screen dashboard-main `
  --state default `
  --viewport 1400x887 `
  --test-cases TC-UI-001,TC-UI-002
```

Lệnh này yêu cầu approved, current context; nó lưu PNG, SHA-256, URL, browser, viewport, DPR, zoom, ready selector, font/assets state, data seed và danh sách `--test-cases` vào task report. Bundle dùng `captured_pending_comparison` khi chưa đo được reference; visual diff chỉ ghi measurement evidence, không tự chấm `matched`, `PASS` hoặc `pixel-perfect`.

Trước Review hoặc QC, liên kết evidence task-local. Mỗi target phải có Figma node, source mapping và test case; QC còn cần screenshot render tồn tại:

```powershell
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js link-evidence `
  --context <task-context.approved.json> `
  --phase review
```

Review/QC đọc project artifacts từ context index, sau đó đọc ledger, bundle và evidence links từ `reportRefs` trong approved task context.

Review không cần đọc toàn bộ repository. Sau khi `link-evidence --phase review`, sinh change manifest từ file plan và các file thực tế có hash:

```powershell
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js review-input `
  --context <task-context.approved.json> `
  --changed-files dashboard.html,src/pages/_dashboard.scss,src/pages/dashboard.js
```

QC plan chỉ lấy viewport/state được approved context cấp. Chạy QC sau khi local server đã chạy; mỗi case thực hiện action/assertion đã khai báo, capture PNG/hash và tạo visual-diff summary. Kết quả automation vẫn chỉ là evidence, không phải Pass:

```powershell
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js qc-plan `
  --context <task-context.approved.json> `
  --url http://127.0.0.1:3001/dashboard.html `
  --screen dashboard-main `
  --test-cases TC-UI-001

node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js run-qc `
  --context <task-context.approved.json>

node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js link-evidence `
  --context <task-context.approved.json> `
  --phase qc
```

`allocate-port` trả về một port local đang rảnh tại thời điểm cấp phát để khởi động server ngay sau đó. CLI không tự chạy server hoặc tự chọn command build/dev của khách hàng.

Tạo Amendment từ base approved context, điền draft bằng node/ảnh/state/file plan/QC case, sau đó validate và approve:

```powershell
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js amend-init `
  --base <task-context.approved.json> `
  --id AMD-001-user-menu

node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js amend-build `
  --input <amendment-input.json>

node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js amend-validate `
  --amendment <amendment.draft.json> `
  --phase implementation

node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js amend-approve `
  --amendment <amendment.draft.json>
```

Khi dùng amendment, thêm `--amendment <amendment.approved.json>` nhất quán vào `capture-evidence`, `review-input`, `qc-plan`, `run-qc` và `link-evidence`.

Đưa ledger cũ ra khỏi source:

```powershell
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js migrate-evidence `
  --context <task-context> `
  --from D:\customer-source\reports\design-evidence-ledger.json `
  --remove-source
```

## Context Gate

Foundation và Implementation cần tối thiểu:

- `targetFrame` có `nodeId` và name xác định scope.
- `viewportContract` rõ `pc_only`/`responsive` cùng `min_width`, `max_width`, `fixed_canvas` hoặc `fluid`.
- Collected/normalized design artifact xác nhận target Frame.
- Ảnh `visual_comparison` ở path ổn định.
- `implementationContract` quy định delivery mode, route, entrypoint và file plan.
- Các state quan trọng như menu/modal/tooltip phải có visual-state evidence; shadow/blur/elevation không được tự suy đoán.

Figma frame `1400px` là số đo reference, không tự động có nghĩa CSS `max-width: 1400px`.

## Command Reference

| Command | Mục đích |
| --- | --- |
| `init --out <intake>` | Tạo intake template. |
| `prepare --intake <file> --design-json <json>` | Import, normalize, build và validate draft. |
| `prepare --figma-url <url> --allow-figma-rest` | Collect REST targeted sau khi được phép. |
| `build --intake <file>` | Build context từ intake đã có artifact local. |
| `validate --context <draft> --phase <phase>` | Validate draft trước approval. |
| `approve --context <draft>` | Tạo approved context immutable và checksum. |
| `status --context <approved> --phase <phase>` | Kiểm freshness/gate strict trước phase. |
| `status --context <approved> --phase <review\|qc> --allow-source-drift` | Kiểm Review/QC hậu-implementation, vẫn giữ integrity/design/evidence gate. |
| `amend-init --base <approved> --id <id>` | Tạo draft Context Amendment task-local. |
| `amend-build --input <json>` | Chuẩn hóa input amendment thành draft. |
| `amend-validate`, `amend-approve`, `amend-status` | Validate, duyệt và kiểm amendment immutable. |
| `init-foundation-manifest`, `finalize-foundation-manifest` | Handoff Foundation cho source scaffold. |
| `transition --from <foundation> --intake <implementation>` | Tạo baseline Implementation độc lập. |
| `init-evidence` | Tạo task-local evidence ledger và QC bundle. |
| `capture-evidence [--amendment <approved>]` | Capture render approved, lưu PNG/hash/metadata ngoài source, cập nhật evidence và trace Amendment khi có. |
| `link-evidence` | Sinh task-local evidence links, mở gate Review/QC khi coverage đủ. |
| `review-input` | Sinh change manifest có SHA-256 và static contract findings từ file plan. |
| `qc-plan` | Sinh matrix QC từ `viewportContract`, `visualStates` và `qualityPlan` đã duyệt. |
| `run-qc` | Chạy QC plan, capture/action/assertion/diff summary; không tự chấm Pass. |
| `allocate-port` | Cấp phát port local để người vận hành khởi động test server. |
| `migrate-evidence` | Chuyển ledger legacy ra khỏi customer source. |
| `import`, `collect`, `normalize` | Lệnh nâng cao/debug cho design artifact. |

## Kiểm soát chi phí

1. Reuse Profile/Project Context bằng hash/reference thay vì copy rules/framework vào mọi task.
2. Ưu tiên local Figma JSON, screenshot và cache; REST/MCP chỉ targeted khi có missing fact và authorization.
3. Artifact current được dùng lại qua phase; `--refresh` chỉ dùng khi có invalidation rõ ràng.
4. Agent chỉ load artifact được `project-context-index.json` cấp cho phase hiện tại.
5. Review/QC dùng evidence bundle, không re-query Figma chỉ để xác nhận lại.

## Cấu trúc Repository

```text
figma-frontend-agent/
  SKILL.md                 Root Skill Codex discover
  GUIDE.md                 Runbook chi tiết duy nhất
  context-builder/         Unified CLI, schema và tests
  design-collector/        Figma input adapter
  normalizers/             Filter/scope normalizer
  collectors/, hooks/      Local source/rules/compiler tooling
  playbooks/               Phase policy cho Agent
  codex-hooks/             Lifecycle status-only tùy chọn
  contexts/                Runtime contexts và reports ngoài source
```

## Kiểm thử

```powershell
cd D:\agents\figma-frontend-agent\context-builder
npm test

cd D:\agents\figma-frontend-agent\design-collector
npm test

cd D:\agents\figma-frontend-agent\normalizers\design-normalizer
npm test
```

Đọc [GUIDE.md](GUIDE.md) để xem schema intake, refresh/invalidation, responsive contract, artifact lifecycle và hướng dẫn vận hành chi tiết.
