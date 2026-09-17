# Guide Vận Hành Figma Frontend Agent

Đây là tài liệu vận hành chuẩn duy nhất dành cho người dùng, cache owner và AI Agent. Guide giải thích cách tạo, kiểm tra, duyệt, làm mới và sử dụng context cho công việc Figma-to-Frontend.

Guide không phải phase artifact. Khi đã có `task-context.approved.json`, Agent chỉ đọc `project-context-index.json` và các artifact được cấp cho phase hiện tại; không nạp lại toàn bộ guide hoặc raw Figma tree.

## Mục tiêu

```text
Source + rules + Figma JSON/link + visual evidence
  -> figma-context prepare
  -> task-context.draft.json
  -> người dùng review / approve
  -> task-context.approved.json
  -> Agent thực hiện phase được cấp quyền
```

Flow này nhằm:

- Bám theo evidence thiết kế thay vì suy đoán.
- Giảm token lặp lại và số request Figma không cần thiết.
- Tách context khỏi source code của khách hàng.
- Kiểm soát source ownership, responsive contract, icon/asset, visual state và quality evidence.

## Vị trí Report và Screenshot

Customer source chỉ chứa source code, cấu hình và test do khách hàng yêu cầu. Context reports luôn nằm ngoài source, theo task:

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
        <screen>--<state>--<viewport>--<timestamp>.png
    review/
      change-manifest.json
      review-report.json
    qc/
      qc-plan.json
      qc-run.json
      visual-diff-summary.json
```

Khởi tạo artifact evidence trước Implementation hoặc QC:

```powershell
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js init-evidence `
  --context <task-context.approved.json>
```

Khi local application đang chạy, chụp render thật ở viewport contract:

```powershell
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js capture-evidence `
  --context <task-context.approved.json> `
  --url http://localhost:3000/dashboard.html `
  --screen dashboard-main `
  --state default `
  --viewport 1400x887 `
  --test-cases TC-UI-001,TC-UI-002
```

`init-evidence` yêu cầu approved context còn current. `capture-evidence` và `link-evidence` dùng cùng integrity/design/phase checks, đồng thời chấp nhận expected source drift sau Implementation theo quy tắc ở phần bên dưới. `capture-evidence` cần Playwright và Chromium (`npm install` trong `context-builder`, sau đó `npx playwright install chromium`). Nó ghi PNG, SHA-256, URL/route, viewport, DPR, browser, zoom, ready selector, font/assets state, data seed và `--test-cases`; bundle dùng `captured_pending_comparison` khi không thể đo reference, còn visual diff chỉ ghi evidence. Khi capture cho một Amendment, truyền cùng `--amendment <amendment.approved.json>` để ledger/bundle giữ trace. Sau capture, chạy `link-evidence --context <task-context> --phase review` hoặc `--phase qc`; link chỉ current khi mỗi target có Figma node, source mapping và test case, còn QC cần screenshot render tồn tại. Để đưa ledger cũ ra khỏi source trong bước preparation có kiểm soát, dùng `migrate-evidence --context <task-context> --from <source-ledger> --remove-source --preparation`.

## Review và QC có kiểm soát

Review dùng `review-input` để tạo `reports/review/change-manifest.json`. Manifest chỉ chứa file từ `implementationContract.filePlan`, SHA-256, size, state thay đổi và static findings như file bắt buộc thiếu, file cấm xuất hiện, hoặc changed file nằm ngoài contract. Agent đọc manifest trước; chỉ mở file bị gắn finding hoặc file thực sự thay đổi. Không dùng screenshot trong chat làm evidence.

```powershell
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js review-input `
  --context <task-context.approved.json> `
  --changed-files dashboard.html,src/pages/_dashboard.scss,src/pages/dashboard.js
```

`qualityPlan` là phần tùy chọn của intake/context để khai báo test case ngoài baseline Figma. QC plan tự thêm mọi `visualStates.required`; nếu state đó chưa có action mở state tương ứng, case bị `blocked: visual_state_action_missing`, không chụp nhầm trạng thái mặc định. Một context PC-only `minWidth: 1400` chỉ được khai báo viewport QC có width từ 1400 trở lên. Muốn kiểm stretch `1800x1100`, dropdown mở hoặc long-content, phải thêm case vào revision của context rồi review/approve lại; không được tự nới matrix trong lúc QC.

```json
{
  "qualityPlan": {
    "visualDiff": { "channelThreshold": 16 },
    "cases": [
      {
        "id": "user-menu-open-wide",
        "screen": "dashboard-main",
        "state": "user-menu-open",
        "viewport": { "width": 1800, "height": 1100 },
        "testCases": ["TC-MENU-001"],
        "actions": [{ "type": "click", "selector": ".dashboard-user__trigger" }],
        "assertions": [{ "type": "element", "selector": "#dashboard-user-menu", "visible": true }]
      }
    ]
  }
}
```

Tạo và chạy matrix QC trên server do người vận hành chủ động khởi động:

```powershell
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js allocate-port

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

QC bắt đầu từ review evidence links. `run-qc` được phép tạo screenshot trước khi QC links tồn tại; ngay sau đó phải chạy `link-evidence --phase qc` và `status --phase qc --allow-source-drift`. Runner dùng một browser process tuần tự cho mọi case, thực hiện `click`, `press` hoặc `wait` được khai báo, kiểm document/element assertion, ghi PNG và đo pixel difference khi reference PNG có kích thước tương thích. `visual-diff-summary.json` chỉ ghi số pixel lệch và điều kiện đo. Không có ngưỡng nào tự đổi kết quả thành `PASS`, `pixel-perfect` hoặc `verified_pass`.

## Target frame và visual state sibling

Một task chỉ có một `targetFrame` chính: đó là baseline layout, viewport và source scope. Không khai báo mảng `targetFrame`. Khi Figma đặt trạng thái menu/modal mở thành frame sibling của màn hình chính, khai báo state bằng `stateFrameNodeId`; khi shadow/effect nằm ở node con, khai báo node đó trong `effectNodeIds`. Normalizer giữ các node state/effect này song song với subtree của target frame.

```json
{
  "id": "user-menu-open",
  "state": "open",
  "trigger": "click-user-summary",
  "stateFrameNodeId": "119:2",
  "effectNodeIds": ["119:10"],
  "required": true,
  "requiredEffects": ["DROP_SHADOW"],
  "referenceImagePath": "D:\\evidence\\Dashboard - Main - menu - open.png"
}
```

`targetNodeId` là field cũ vẫn tương thích; intake mới ưu tiên `stateFrameNodeId`. Mỗi `id` phải duy nhất. State đóng không có shadow phải để `requiredEffects: []` hoặc `required: false`, không sao chép yêu cầu effect từ state mở.

## Context Amendment cho yêu cầu nhanh

Amendment là overlay task-local đã duyệt, dành cho delta nhỏ sau khi base context đã approved. Nó phù hợp với ba loại: `evidence_backed_correction` khi code sai với evidence đang có, `evidence_backed_scope_extension` khi có node/ảnh/state/viewport mới, và `user_directed_deviation` khi bạn chủ động thay đổi nhưng không khẳng định nó khớp Figma.

Không dùng Amendment cho framework, coding/lint/format rules, target frame chính, delivery mode, route architecture, entrypoint strategy hoặc source ownership. Các thay đổi đó phải tạo task context revision.

Input tối thiểu cho một dropdown có shadow/state mới:

```json
{
  "id": "AMD-001-user-menu",
  "baseContext": {
    "path": "D:\\agents\\figma-frontend-agent\\contexts\\tasks\\pos\\POS-001\\task-context.approved.json"
  },
  "changeType": "evidence_backed_scope_extension",
  "allowedPhases": ["implementation", "review", "qc"],
  "reason": "Bổ sung user menu mở theo node và ảnh reference đã cung cấp.",
  "designEvidence": {
    "nodes": ["119:10"],
    "referenceImages": [
      {
        "path": "D:\\agents\\figma-frontend-agent\\contexts\\projects\\pos\\evidences\\user-menu-open.png",
        "role": "visual_comparison"
      }
    ]
  },
  "contractDelta": {
    "visualStates": [
      {
        "id": "user-menu-open",
        "state": "open",
        "trigger": "click-user-summary",
        "targetNodeId": "119:10",
        "requiredEffects": ["DROP_SHADOW"]
      }
    ],
    "filePlan": {
      "create": [],
      "modify": ["src/pages/dashboard.js", "src/pages/_dashboard.scss"]
    }
  },
  "qualityPlanDelta": {
    "cases": [
      {
        "id": "user-menu-open",
        "screen": "dashboard-main",
        "state": "open",
        "viewport": { "width": 1400, "height": 887 },
        "testCases": ["TC-MENU-001"],
        "actions": [{ "type": "click", "selector": ".dashboard-user__trigger" }],
        "assertions": [{ "type": "element", "selector": "#dashboard-user-menu", "visible": true }]
      }
    ]
  }
}
```

```powershell
# Tạo template task-local từ base đã approved/current
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js amend-init `
  --base <task-context.approved.json> `
  --id AMD-001-user-menu

# Sau khi điền input, Builder chuẩn hóa node, ảnh, file plan và QC delta
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js amend-build `
  --input D:\work\AMD-001-user-menu.json

node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js amend-validate `
  --amendment <amendment.draft.json> `
  --phase implementation

node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js amend-approve `
  --amendment <amendment.draft.json>
```

Amendment evidence-backed bắt buộc có ít nhất một Figma node ID và ảnh reference ở path ổn định. Mỗi visual state mới cần `id`, `state`, `trigger`, `stateFrameNodeId`; node đó và mọi `effectNodeIds` phải có trong `designEvidence.nodes`. `targetNodeId` chỉ là alias tương thích. `filePlan` chỉ cho phép thêm file `create`/`modify`; không thể đổi primary page hoặc gỡ file cấm của base context.

Khi giao task cho Agent, gửi cả hai path. Agent chạy `amend-status --amendment <approved> --phase <phase>`, đối chiếu base hash/task ID, rồi merge trong bộ nhớ. Không gửi draft amendment để implement. Khi cần capture ở Implementation, Review hoặc QC, truyền cùng `--amendment` vào `capture-evidence`; Review/QC tiếp tục dùng nó trong `review-input`, `qc-plan`, `run-qc`, `link-evidence`. Ledger, evidence links, QC plan và QC run sẽ giữ amendment reference để trace được nguồn thay đổi.

### Source fingerprint sau khi đã code

`sourceFingerprint` của base context là snapshot trước phase Implementation. Vì vậy source khác fingerprint sau Foundation hoặc Implementation là **expected source drift**, không tự thân là bằng chứng context design bị lỗi. Tuy nhiên nó không được bỏ qua trên toàn bộ flow:

- Trước Foundation/Implementation, `status` vẫn kiểm fingerprint strict.
- Sau khi code đã đổi, chỉ các lệnh tạo/đối chiếu evidence (`capture-evidence`, `link-evidence`), `review-input`, `qc-plan` và `run-qc` mới cho phép expected drift có kiểm soát. Chúng vẫn kiểm checksum context, profile/project/index reference, Figma/design artifact, phase gate và report evidence.
- Khi cần kiểm status ở Review hoặc QC sau implementation, dùng `status --allow-source-drift` **chỉ trong flow hậu-implementation**. Cờ này không chữa được `design_artifact_stale`, checksum sai, missing evidence hoặc phase bị block.

Nhờ vậy Agent không được lấy một context cũ để implement tiếp một cách mù quáng, nhưng vẫn có thể review/QC đúng source vừa được triển khai.

## Thuật ngữ và trách nhiệm

Chỉ dùng một CLI:

```powershell
figma-context <group> <command>
```

CLI chuẩn dùng command tree: `context`, `design`, `amend`, `foundation`, `evidence`, `review`, `qc`, `util`. Ví dụ mới: `figma-context amend create`, `figma-context evidence link`, `figma-context review input`, `figma-context qc run`. `ctx`, `amd`, `fdn`, `ev` là alias nhóm. Với approved task context, có thể dùng `--task <project-key>/<task-id>` thay `--context`; CLI từ chối dùng hai cờ cùng lúc và chặn path traversal. Tên lệnh phẳng cũ còn tương thích, luôn trả `meta.warnings`; chỉ dùng khi cần migration.

Khi truyền Figma URL có query string, bắt buộc đặt toàn bộ URL trong dấu nháy. `&` là toán tử của PowerShell/CMD; URL không được quote sẽ bị tách trước khi CLI chạy, dẫn tới thiếu `--allow-figma-rest` và lỗi kiểu `'p' is not recognized`.

CLI điều phối ba lớp nội bộ. Người vận hành dùng CLI chung, không cần chạy từng module riêng trong flow bình thường.

| Lớp | Trách nhiệm | Không được làm |
| --- | --- | --- |
| Collector / Adapter | Đọc source, rules, Figma JSON/export hoặc REST targeted; giữ fact an toàn cho pipeline. | Không suy luận layout, không approve. |
| Normalizer / Filter | Chọn đúng target frame, bỏ node ẩn/design-only, tóm tắt vector và cô lập scope. | Không gọi Figma, không tự đoán CSS hay breakpoint. |
| Context Builder / Compiler | Ghép fact đã chuẩn hóa thành context có hash, reference và phase gate. | Không sửa source customer, không auto-approve. |
| Skill / Playbook | Quy định cách Agent phân tích, implement, review và QC dựa vào context. | Không thay thế Builder hoặc bypass gate. |
| Lifecycle Hook | Tự động hóa trạng thái tùy chọn. | Không tự build context, không gọi Figma, không inject full JSON vào chat. |

Không lưu PAT, cookie, credential, raw Figma payload dư thừa hoặc source code khách hàng trong `contexts/`, Profile Context hay intake.

## Chuẩn bị đầu vào

Trước khi tạo intake, cần xác nhận:

- Repository khách hàng đã clone local, ví dụ `D:\workspace\customer-a-pos`.
- Task scope, framework, coding rule, lint/format và report rule của khách hàng.
- Target Figma node rõ ràng và ảnh evidence tại đường dẫn ổn định.
- Ý nghĩa viewport: `min_width`, `max_width`, `fixed_canvas` hoặc `fluid`.

Kích thước frame Figma 1400px chỉ là số đo tham chiếu. Nó không tự có nghĩa web phải dùng `max-width: 1400px`.

Ưu tiên Figma JSON đã có từ MCP/export/snapshot. Chỉ dùng REST targeted khi cache/JSON không đủ và người dùng hoặc cache owner đã cho phép rõ ràng.

## Intake Contract

Tạo template:

```powershell
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js init `
  --out D:\work\POS-142.intake.json
```

### `project` và `task`

| Field | Quy tắc |
| --- | --- |
| `project.key` | Mã project ổn định, chỉ chữ/số/gạch nối, ví dụ `customer-a-pos`. |
| `project.sourcePath` | Absolute path đến repository clone. Không sao chép source vào context. |
| `task.id`, `task.title` | Mã và mô tả cụ thể của task. |
| `task.requestedPhase` | `analysis`, `foundation`, `implementation`, `review` hoặc `qc`. |
| `task.allowedPhases` | Danh sách phase baseline được phép. |

`requestedPhase` là phase bắt đầu, không phải lý do để tạo context mới mỗi lần chuyển phase. Chỉ tạo revision mới khi source, profile/rules, Figma target, viewport contract hoặc baseline evidence thay đổi.

### `profile`

Profile là context tái sử dụng cho nhiều task/project cùng khách hàng.

| Field | Quy tắc |
| --- | --- |
| `customer`, `name`, `version` | Định danh profile; tăng version khi framework/rule/format đổi. |
| `framework` | Tên và major version đã xác nhận, như `html-css-js`, `react`, `nextjs`, `vue`. |
| `codingRules`, `lintRules`, `formatRules` | Rule kiến trúc, naming, CSS/SCSS, lint, format và test/report. |

Không đặt PAT, cookie, raw Figma payload hoặc source customer vào Profile Context.

### `design`

| Field | Quy tắc |
| --- | --- |
| `figmaUrl` | Link tham chiếu; không tự cấp quyền API. |
| `nodes` | Node liên quan; không thay thế `targetFrame`. |
| `targetFrame` | Một frame/page đúng scope, có `nodeId` và `name`. |
| `collectedArtifactPath` | `figma_collected_artifact` từ import/collect. |
| `normalizedArtifactPath` | Tùy chọn; CLI tự normalize nếu bỏ trống. |
| `rawArtifactPath` | Alias legacy của `collectedArtifactPath`; không dùng cho intake mới. |
| `referenceImages` | Ảnh visual ở path ổn định, không dùng clipboard tạm. |
| `visualStates` | State cần đối chiếu riêng: dropdown mở, modal, tooltip, hover, selected. |

Mỗi ảnh comparison nên có:

```json
{
  "path": "D:\\agents\\figma-frontend-agent\\contexts\\tasks\\customer-a-pos\\POS-142\\evidence\\products-pc.png",
  "role": "visual_comparison",
  "measurementAuthority": "figma_frame"
}
```

Target frame, artifact và ảnh phải nói về cùng screen/state. Nếu không khớp, giữ task ở `analysis` và tạo `evidence_refresh_request`.

### Visual state, shadow và blur

Ảnh màn hình mặc định không chứng minh dropdown đang mở. Với state có bề mặt riêng, khai báo `design.visualStates`:

```json
{
  "visualStates": [
    {
      "id": "user-menu-open",
      "state": "open",
      "trigger": "click-user-summary",
      "targetNodeId": "57:120",
      "required": true,
      "requiredEffects": ["DROP_SHADOW"],
      "referenceImagePath": "D:\\agents\\figma-frontend-agent\\contexts\\tasks\\customer-a-pos\\POS-142\\evidence\\user-menu-open.png"
    }
  ]
}
```

`stateFrameNodeId` là frame của dropdown/modal/tooltip, không phải node trigger. Khi effect nằm trong node con, khai báo node đó ở `effectNodeIds`. `requiredEffects` chấp nhận `DROP_SHADOW`, `INNER_SHADOW`, `LAYER_BLUR`, `BACKGROUND_BLUR`.

Collector lấy offset, radius, spread và color từ Figma. Layout compiler chuẩn hóa chúng thành `boxShadow`, `filter` hoặc `backdropFilter`. Không nhập CSS shadow ước lượng vào intake.

Nếu state khai báo `requiredEffects` nhưng node Figma chưa xác nhận effect tương ứng, Foundation/Implementation bị chặn với `required_visual_state_evidence_missing`. Agent phải tạo `evidence_refresh_request`, không tự chọn blur, opacity hoặc elevation.

### `viewportContract`

| Field | Quy tắc |
| --- | --- |
| `referenceViewport.width`, `height` | Kích thước frame/viewport đã xác nhận. |
| `deviceScope` | `pc_only` hoặc `responsive`. |
| `layoutBehavior` | `min_width`, `max_width`, `fixed_canvas` hoặc `fluid`. |
| `minWidth` | Bắt buộc khi `layoutBehavior` là `min_width`. |
| `maxWidth` | Chỉ điền khi evidence xác nhận cap chiều rộng. |
| `interpolationAllowed` | `false` cho PC fixed/only; `true` khi được phép nội suy responsive. |

Ví dụ PC only ở 1400px, giữ layout desktop khi viewport hẹp hơn:

```json
{
  "referenceViewport": { "width": 1400, "height": 887 },
  "deviceScope": "pc_only",
  "layoutBehavior": "min_width",
  "minWidth": 1400,
  "maxWidth": null,
  "interpolationAllowed": false
}
```

### `assetPolicy`, `implementationContract`, criteria

`assetPolicy` không cho phép thay icon bằng CSS/text/SVG tự đoán. Icon phải là Figma asset export hoặc mapping thư viện đã được duyệt.

`implementationContract` là hard boundary cho source ownership. Với `add_page_to_static_site`, `filePlan.primary` phải chứa `route.path`; không dùng `index.html` làm page chính. `index.html` chỉ được replace trong `replace_single_static_entry` với `entrypointStrategy: "replace"` rõ ràng.

```json
{
  "implementationContract": {
    "deliveryMode": "add_page_to_static_site",
    "sourceChangePolicy": "preserve_existing_entry",
    "entrypointStrategy": "modify_navigation_only",
    "route": { "path": "supplier.html", "navigationHref": "supplier.html" },
    "filePlan": {
      "primary": ["supplier.html"],
      "create": ["supplier.html", "src/pages/_supplier.scss"],
      "modify": ["index.html", "src/styles.scss"],
      "forbid": []
    }
  }
}
```

Acceptance criteria phải đo được theo node, viewport và state. Assumption chỉ dành cho quyết định rủi ro thấp; không dùng để che target frame, padding, breakpoint, asset/icon, visual state hoặc business behavior còn thiếu.

## Flow hằng ngày

### 1. Prepare từ Figma JSON/export

Đây là flow mặc định, không gọi API:

```powershell
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js prepare `
  --intake D:\work\POS-142.intake.json `
  --design-json D:\evidence\products-figma.json `
  --phase implementation
```

`prepare` thực hiện import -> normalize target -> build source/rules/design/layout/index/task draft -> validate. Nó không approve, không sửa source customer và không tự retry network.

### 2. Prepare từ Figma REST targeted

Chỉ dùng khi không có JSON/cache và người dùng đã authorize. Ưu tiên tạo `D:\agents\figma-frontend-agent\.env` từ `.env.example` rồi đặt token tại đó:

```powershell
# D:\agents\figma-frontend-agent\.env
FIGMA_ACCESS_TOKEN=<personal-access-token>

# Hoặc chỉ định tạm thời cho cửa sổ PowerShell hiện tại:
$env:FIGMA_ACCESS_TOKEN = "<personal-access-token>"
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js prepare `
  --intake D:\work\POS-142.intake.json `
  --figma-url "https://www.figma.com/design/<file-key>/Products?node-id=57-99" `
  --allow-figma-rest `
  --phase implementation
```

Thiếu `--allow-figma-rest`, CLI từ chối trước khi đọc token hoặc gọi network. Với `prepare --figma-url` và `collect`, CLI chỉ nạp key token được yêu cầu từ `.env` ở root Agent khi biến đó chưa có trong terminal. Biến của terminal luôn được ưu tiên. Token không được ghi vào intake, artifact, context hoặc log. Cache theo file/node/depth/version; cache hit không cần token/network.

### 3. Validate, review và approve

```powershell
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js validate `
  --context D:\agents\figma-frontend-agent\contexts\tasks\customer-a-pos\POS-142\task-context.draft.json `
  --phase implementation

node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js approve `
  --context D:\agents\figma-frontend-agent\contexts\tasks\customer-a-pos\POS-142\task-context.draft.json
```

Người dùng review target, viewport, visual state/effect, asset, implementation contract, assumption và validation trước approval. `approve` tạo approved JSON và SHA-256 sidecar read-only. Draft không được Agent dùng để implement trong context mode.

### 4. Giao Agent chạy phase

```text
Mode context. Hãy thực hiện phase implementation theo context đã duyệt:
D:\agents\figma-frontend-agent\contexts\tasks\customer-a-pos\POS-142\task-context.approved.json
```

Trước mỗi phase, Agent chạy:

```powershell
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js status `
  --context <task-context.approved.json> `
  --phase implementation
```

Agent chỉ đọc artifact được `project-context-index.json` cấp cho phase đó. Context stale/blocked phải dừng và báo evidence cần refresh; không tự build, approve hoặc gọi Figma để vượt gate.

## Command nâng cao

| Command | Mục đích |
| --- | --- |
| `import --input <json> --out <collected.json>` | Chuyển Figma MCP/export JSON thành collected artifact, không gọi API. |
| `collect --figma-url <url> --out <collected.json> --allow-figma-rest` | Lấy Figma REST targeted. |
| `normalize --input <collected.json> --out <normalized.json> --target-node-id <id>` | Review/debug target scope trước build. |
| `build --intake <intake.json>` | Build từ paths đã có trong intake. |
| `amend-init --base <approved> --id <id>` | Tạo draft Context Amendment task-local. |
| `amend-build --input <json>` | Chuẩn hóa amendment input và reference base hash. |
| `amend-validate`, `amend-approve`, `amend-status` | Validate, duyệt và kiểm amendment immutable. |
| `capture-evidence --context <approved> ... [--amendment <approved>]` | Capture render và ghi trace Amendment khi có. |
| `status --context <approved> --phase <review\|qc> --allow-source-drift` | Kiểm gate hậu-implementation mà vẫn giữ design/evidence/integrity checks. |
| `review-input --context <approved> --changed-files <files> [--amendment <approved>]` | Sinh manifest review có hash và kiểm file-plan. |
| `qc-plan --context <approved> --url <route> [--amendment <approved>]` | Sinh matrix QC từ baseline/context revision. |
| `run-qc --context <approved> [--amendment <approved>]` | Chạy matrix QC, action/assertion/capture/diff evidence. |
| `allocate-port` | Tìm port local rảnh cho test server do người vận hành khởi động. |

Flow bình thường dùng `prepare`; các command này dành cho debug, review evidence hoặc tái sử dụng artifact.

## Flow cho source rỗng và scaffold

Bạn cần tạo sẵn `sourcePath` là một thư mục local trước khi build context. Source Collector sẽ tự phân loại, không tin vào một giá trị người dùng tự khai báo:

| `sourceState` | Ý nghĩa |
| --- | --- |
| `empty_directory` | Không có file có ý nghĩa sau khi bỏ cache và Git metadata. |
| `workspace_only` | Chỉ có README, `.gitignore`, docs hoặc metadata workspace. |
| `partial_scaffold` | Có package/config/source rời rạc nhưng chưa có entry/build chain hoàn chỉnh. |
| `existing_project` | Có entrypoint và cấu trúc source có thể triển khai. |

Khi state là `empty_directory`, `workspace_only` hoặc `partial_scaffold`, tạo Foundation Context với `requestedPhase: "foundation"` và `scaffoldContract`. Contract phải ghi rõ owner, framework, package manager, build tool, styling, routing, source tree, scripts, base layout và reusable primitives.

```json
{
  "scaffoldContract": {
    "owner": "agent",
    "framework": { "name": "react", "majorVersion": "19" },
    "packageManager": "npm",
    "buildTool": "vite",
    "styling": "scss",
    "routing": "react-router",
    "sourceTree": {
      "create": ["package.json", "src/main.jsx", "src/styles/app.scss"],
      "forbid": []
    },
    "requiredScripts": ["dev", "build", "test"],
    "baseLayout": ["app-shell", "header", "sidebar", "main"],
    "initialPrimitives": ["button", "field", "table", "menu"]
  }
}
```

`owner` là ràng buộc bắt buộc:

- `agent`: Agent được scaffold đúng các path/dependency đã nêu.
- `user`: Agent chỉ kiểm tra source do người dùng tạo.
- `external`: Agent chờ source từ bên thứ ba; không tạo bản thay thế.

Foundation Context không được dùng cho page implementation. Sau Foundation:

1. Khởi tạo report template:

```powershell
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js init-foundation-manifest `
  --context <task-context.foundation.approved.json>
```

2. Foundation cập nhật `reports/foundation-manifest.json` theo schema do lệnh khởi tạo tạo ra: `files[]` (mỗi phần tử có `path`, `purpose`), `evidence.commands[]` (ít nhất một `status: "pass"`), `evidence.screenshot` và `handoff.allowed_next_slice`. Không tự ghi `sourceFingerprint` hoặc `status: "ready"`.
3. CLI tự chốt source state/fingerprint hậu Foundation:

```powershell
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js finalize-foundation-manifest `
  --context <task-context.foundation.approved.json>
```

4. Tạo intake mới chỉ chứa task Implementation và `implementationContract`; task id phải khác Foundation task id.
5. Tạo baseline Implementation, kế thừa Profile/Figma evidence qua hash và không fetch Figma lại:

```powershell
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js transition `
  --from <task-context.foundation.approved.json> `
  --foundation-manifest <reports\foundation-manifest.json> `
  --intake D:\work\POS-142-implementation.intake.json
```

`finalize-foundation-manifest` chỉ chốt manifest khi source là `existing_project`, có `files[]` và ít nhất một command `pass`. Nó tự ghi fingerprint từ source hiện tại. `transition` chỉ chạy khi Foundation context có checksum hợp lệ, scaffold contract ready, source hiện tại là `existing_project` và Foundation manifest có fingerprint khớp source. Nó tạo draft context Implementation mới, copy normalized design artifact bằng hash vào task mới và không gọi Figma.

Manifest legacy thiếu `foundationContextHash`, hoặc dùng alias cũ như `filesChanged`/`commands: passed`, sẽ được finalizer tự chuyển sang schema chuẩn, bind vào Foundation Context đang truyền vào và ghi `provenanceMigrated: true`. Nếu manifest đã có path hoặc hash của Foundation Context khác, finalizer vẫn dừng để tránh dùng sai baseline.

Trong intake Implementation dùng với `transition`, để `collectedArtifactPath`, `normalizedArtifactPath` hoặc `rawArtifactPath` là `null` nghĩa là kế thừa evidence đã duyệt từ Foundation; không phải xóa evidence. Nếu task đổi `targetFrame`, Builder dùng collected artifact đã kế thừa để chuẩn hóa lại artifact theo Frame mới, không gọi Figma lại.

Sau khi scaffold, Foundation Context cũ sẽ báo `source_context_stale`; đây là hành vi mong đợi vì source fingerprint đã đổi. `transition` không dùng context cũ để implement: nó chỉ kiểm integrity của baseline Foundation, rồi tạo baseline Implementation độc lập từ source và manifest mới.

## Artifact, refresh và chi phí

```text
draft -> validate -> approved -> stale | superseded
```

Artifacts luôn nằm dưới `D:\agents\figma-frontend-agent\contexts\`:

```text
profiles/<customer>/<name>.json
projects/<project>/project-context.json
tasks/<project>/<task>/
  intake.json
  task-context.draft.json
  task-context.approved.json
  task-context.approved.json.sha256
  evidence/
  reports/
```

- `draft`: tạo bởi `prepare`/`build`, chỉ để review.
- `approved`: baseline do người dùng duyệt, có checksum.
- `stale`: source/rules/design artifact hoặc baseline evidence đổi.
- `superseded`: baseline cũ được thay bằng revision mới, ví dụ `POS-142-r2`.

Đổi sang Review/QC dùng cùng approved context khi baseline không đổi. Screenshot/test report mới ghi vào `evidence/` hoặc `reports/`, không sửa approved JSON.

Để tối ưu chi phí và token:

1. Reuse Profile/Project Context bằng hash/reference, không copy framework/rule vào mọi task.
2. Ưu tiên cache và `--design-json`; REST/MCP chỉ dùng cho node/state đang thiếu evidence.
3. Không gọi Figma khi mở chat, chuyển phase, review/QC hoặc chỉ để xác nhận facts đã cache.
4. Agent chỉ nạp artifact phase-scoped, không nạp raw collected tree hoặc toàn bộ guide trong Implementation/Review/QC.
5. Evidence thiếu/stale tạo `evidence_refresh_request`; chỉ người dùng/cache owner authorize refresh.

## Quy tắc cho Agent

- `context` mode: prompt có path `task-context.approved.json`; Agent xác minh checksum, freshness và phase gate trước khi làm việc.
- `direct` mode: prompt không có approved context; Agent phải công khai mode và chỉ tạo draft khi người dùng yêu cầu.
- Agent không tự chuyển từ `context` sang `direct`, không tự approve draft và không dùng draft để implement/review/QC.
- Analysis ghi rõ evidence, visible facts, inferred facts, missing facts và ambiguity.
- Implementation chỉ sử dụng source files/route được `implementationContract` cho phép; không suy route hoặc thay entrypoint.
- Review/QC so sánh screenshot theo viewport/state, gồm dropdown/modal/tooltip mở, shadow/elevation, blur, overlay, clipping và placement khi thuộc scope.

## Checklist trước khi approve

- [ ] Source, Profile và rule/framework đúng hiện hành.
- [ ] Target frame, artifact và reference image là cùng screen/state.
- [ ] Viewport contract phản ánh đúng ý nghĩa kích thước Figma.
- [ ] Asset/icon có source hoặc mapping rõ ràng.
- [ ] Dropdown/modal/tooltip có `visualStates`; effect bắt buộc có node Figma xác nhận.
- [ ] `implementationContract` xác định route và allowed file plan.
- [ ] Acceptance criteria đo được; assumption không che giấu quyết định thiết kế.
- [ ] `validate --phase <phase>` pass trước approval.

## Kiểm thử tooling

```powershell
cd D:\agents\figma-frontend-agent\context-builder; npm test
cd D:\agents\figma-frontend-agent\design-collector; npm test
cd D:\agents\figma-frontend-agent\normalizers\design-normalizer; npm test
cd D:\agents\figma-frontend-agent\hooks\figma-layout-context-hook; npm test
```
