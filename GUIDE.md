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

## Thuật ngữ và trách nhiệm

Chỉ dùng một CLI:

```powershell
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js <command>
```

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

`targetNodeId` là node của dropdown/modal/tooltip, không phải node trigger. `requiredEffects` chấp nhận `DROP_SHADOW`, `INNER_SHADOW`, `LAYER_BLUR`, `BACKGROUND_BLUR`.

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

Chỉ dùng khi không có JSON/cache và người dùng đã authorize:

```powershell
$env:FIGMA_ACCESS_TOKEN = "<personal-access-token>"
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js prepare `
  --intake D:\work\POS-142.intake.json `
  --figma-url "https://www.figma.com/design/<file-key>/Products?node-id=57-99" `
  --allow-figma-rest `
  --phase implementation
```

Thiếu `--allow-figma-rest`, CLI từ chối trước khi đọc token hoặc gọi network. Token chỉ đọc từ environment variable của process, không được ghi vào artifact hoặc log. Cache theo file/node/depth/version; cache hit không cần token/network.

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

Flow bình thường dùng `prepare`; các command này dành cho debug, review evidence hoặc tái sử dụng artifact.

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
