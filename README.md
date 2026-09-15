# Figma Frontend Agent

Agent hỗ trợ triển khai giao diện web từ Figma theo hướng có bằng chứng, kiểm soát chi phí Figma MCP và giảm token lặp lại. Agent hỗ trợ HTML, CSS, JavaScript, SCSS và có thể tiếp nhận framework/rule riêng của từng khách hàng.

Đọc [Guide vận hành end-to-end](GUIDE.md) để chạy toàn bộ flow từ intake đến implementation, review và QC.

`GUIDE.md` là runbook vận hành: chỉ dùng khi con người hoặc Agent đang chuẩn bị/refresh context. Khi làm việc với approved context, Agent không nạp lại guide mà chỉ đọc project context index và artifact của phase hiện tại.

## Mục tiêu

- Phân tích thiết kế trước khi triển khai.
- Bám sát design, viewport và coding rules đã được cung cấp.
- Tái sử dụng context framework, lint, format và rule khách hàng giữa nhiều task.
- Không tự đánh giá `PASS` khi review hoặc QC.
- Chỉ dùng Figma MCP khi evidence cục bộ, Figma web hoặc screenshot không đủ.

## Kiến trúc

```text
Input dự án
  -> Collector / Adapter
  -> Normalizer / Filter
  -> Context Builder
  -> task-context.draft.json
  -> Người dùng kiểm tra
  -> task-context.approved.json
  -> Agent làm Analysis / Implement / Review / QC
```

Context Builder chỉ tạo file context. Nó không tự đưa context vào Agent và không tự gọi Figma MCP/API. Người dùng phải kiểm tra, approve, rồi chủ động gửi đường dẫn context đã duyệt vào task Agent.

## Hai chế độ làm việc

### Context mode

Dùng khi người dùng cung cấp đường dẫn tới `task-context.approved.json`.

Agent sẽ kiểm tra status, checksum, profile/project reference, source/design freshness và phase gate trước khi làm việc. Nếu context thiếu, stale hoặc phase bị block, Agent dừng phase đó và báo artifact/evidence cần refresh. Agent không tự chuyển sang direct mode.

### Direct mode

Dùng khi yêu cầu chỉ gồm prompt, Figma link, source hoặc rule rời.

Agent thông báo đang ở direct mode, sau đó chạy quy trình intake thông thường. Direct mode có thể tạo draft context để người dùng review cho task sau, nhưng không được tự tạo approved context.

## Cấu trúc thư mục

```text
figma-frontend-agent/
  SKILL.md                  Root Skill của Codex
  playbooks/                Quy tắc theo phase của Agent
  context-builder/          CLI tạo, validate và approve context
  collectors/               Adapter đọc source/rules theo loại input
  design-collector/         Adapter Figma REST/MCP/export có cache request
  normalizers/              Filter scope, node rác và asset manifest
  hooks/                    Các compiler context cục bộ
  codex-hooks/              Lifecycle Hook tùy chọn, chỉ báo status
  contexts/
    profiles/               Context framework/rules/format dùng lại
    projects/               Context source và design theo project
    tasks/                  Draft/approved context, evidence, report
```

Customer source không được lưu trong thư mục Agent. Context chỉ lưu digest, fingerprint, evidence được phép lưu và reference cần thiết.

## Context Builder

Trước khi tạo intake, đọc [hướng dẫn `intake.json`](context-builder/INTAKE_GUIDE.vi.md). Tài liệu này là contract để người dùng hoặc Agent thu thập dữ kiện, khai báo đúng viewport/target frame/icon, và tránh tự suy diễn khi build context.

Chạy các lệnh sau bằng PowerShell:

```powershell
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js init --out D:\intake.json
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js build --intake D:\intake.json
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js validate --context <task-context.draft.json>
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js approve --context <task-context.draft.json>
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js status --context <task-context.approved.json>
```

`init` tạo intake template. `build` tạo hoặc tái sử dụng Profile Context, Project Context và Task Context. `validate` kiểm tra schema, reference, freshness và phase gate. `approve` tạo approved context bất biến cùng checksum SHA-256. `status` kiểm tra lại approved context trước khi đưa cho Agent.

Chi tiết contract và checklist DoD nằm tại [context-builder/WORKFLOW.md](context-builder/WORKFLOW.md).

## Design Collector

Đọc [Guide Design Collector](design-collector/GUIDE.md) trước khi import hoặc gọi Figma REST. Guide giải thích trách nhiệm Collector, token, cache, giới hạn payload và cách đưa output vào intake.

Design Collector tạo `figma_collected_artifact` dùng cho `design.collectedArtifactPath` trong `intake.json`. Có hai cách thu thập:

```powershell
# Import JSON đã được lưu từ Figma MCP hoặc export khác. Không cần token.
node D:\agents\figma-frontend-agent\design-collector\bin\figma-design.js import `
  --input D:\figma-mcp-response.json `
  --out D:\agents\figma-frontend-agent\contexts\projects\customer-a-pos\figma\order.collected.json `
  --node-ids 123:456

# Gọi Figma REST API cho đúng node. Token chỉ được đọc từ environment variable.
$env:FIGMA_ACCESS_TOKEN = "..."
node D:\agents\figma-frontend-agent\design-collector\bin\figma-design.js collect `
  --figma-url "https://www.figma.com/design/<file-key>/<name>?node-id=123-456" `
  --out D:\agents\figma-frontend-agent\contexts\projects\customer-a-pos\figma\order.collected.json
```

Collector chỉ lấy node được chỉ định, không lấy toàn bộ file, không lưu token và không tự retry. Nếu file output có cùng Figma file/node/depth, Collector dùng cache và không gọi API. Muốn gọi lại phải thêm `--refresh` một cách chủ động.

Collector chỉ thực hiện transport-safe projection: bỏ plugin data/vector path, giới hạn depth/children và không lưu secret. Nó không quyết định node nào là UI. Design Normalizer chọn đúng `targetFrame`, bỏ node ẩn/design-only/non-UI, tóm tắt vector thành asset manifest và tạo `normalized_design_artifact`. Context Builder dùng artifact đã chuẩn hóa để tạo design index/layout context; không tự lọc tree.

```powershell
node D:\agents\figma-frontend-agent\normalizers\design-normalizer\bin\figma-normalize.js `
  --input D:\agents\figma-frontend-agent\contexts\projects\customer-a-pos\figma\order.collected.json `
  --out D:\agents\figma-frontend-agent\contexts\projects\customer-a-pos\figma\order.normalized.json `
  --target-node-id 123:456
```

`figma-context build` tự điều phối Normalizer khi intake chỉ có `collectedArtifactPath`. Có thể đưa `normalizedArtifactPath` đã tạo sẵn để Builder chỉ kiểm tra và ghép reference.

## Context Levels

### Profile Context

Dùng lại giữa nhiều task hoặc project cùng khách hàng:

- Framework và major version.
- Coding rules, lint rules, format rules.
- Quy ước naming, report và test case.

Profile được nhận diện bằng `id`, `version` và `hash`. Chỉ build lại khi input thay đổi.

### Project Context

Dùng cho một repository clone local:

- Source fingerprint.
- Framework/package manager/scripts thực tế.
- Source topology và convention phát hiện được.
- Reference tới Profile Context và Rules Context.

### Task Context

Dùng cho một task cụ thể:

- Task scope, phase yêu cầu, acceptance criteria.
- Figma URL, node, screenshot/reference image.
- Assumption, evidence và phase permission.
- Reference hash tới Profile/Project/Context Index.

Task Context không copy toàn bộ Profile hoặc Project Context để tránh phình payload/token.

## Khai Báo Design Chính Xác

Mỗi task implementation phải có đúng một `targetFrame`, một ảnh đối chiếu cục bộ và `viewportContract`. Ví dụ màn Products chỉ dành cho PC với chiều rộng tối thiểu 1400px:

```json
{
  "task": {
    "requestedPhase": "implementation",
    "allowedPhases": ["analysis", "foundation", "implementation", "review", "qc"]
  },
  "design": {
    "targetFrame": { "nodeId": "57:99", "name": "Products" },
    "referenceImages": [{
      "path": "D:\\evidence\\products-pc.png",
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

`referenceViewport` là kích thước frame để đo. Nó không tự có nghĩa là `max-width`. Các giá trị hợp lệ của `layoutBehavior` là `min_width`, `fixed_canvas`, `fluid`, hoặc `max_width`; Agent phải dùng đúng giá trị đã khai báo.

Context Builder chỉ cho phép Foundation/Implementation khi target frame có trong normalized artifact, viewport contract hợp lệ và ảnh `visual_comparison` tồn tại. Layout context giữ geometry `x/y/width/height` của node để Agent không phải tự đoán padding, gap hoặc margin.

Sau khi baseline được approve, không cần build lại design context chỉ để đổi từ Implementation sang Review/QC. Gửi cùng approved context với phase mới; CLI status đọc phase gate hiện tại từ context index:

```powershell
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js status `
  --context <task-context.approved.json> `
  --phase review
```

Chỉ rebuild baseline khi Figma/source/rule/viewport contract thay đổi. Evidence và report của từng phase được cập nhật ngoài approved baseline.

## Figma Và Kiểm Soát Chi Phí

Ưu tiên nguồn dữ liệu theo thứ tự:

1. Context đã duyệt, source local, coding rules và evidence cache.
2. Figma web/share link hoặc screenshot/export được cung cấp.
3. JSON đã lưu từ Figma MCP/export, qua Design Collector `import`.
4. Figma REST Collector hoặc Figma MCP cho fact được request planner xác định là `MCP_required`.

Không gọi Figma MCP khi mở chat, đổi phase, review/QC, hoặc chỉ để xác nhận lại thông tin đã có. Khi evidence thiếu, Agent tạo `evidence_refresh_request`; chỉ người dùng hoặc cache owner mới được phép refresh targeted.

## Vai Trò Các Thành Phần

- **Collector / Adapter**: đọc Figma/source/rules đúng theo loại input, không suy luận UI.
- **Normalizer / Filter**: chọn scope, bỏ dữ liệu rác và tạo artifact nhỏ gọn cho code.
- **Context Builder**: CLI chủ động ghép fact đã chuẩn hóa, kiểm tra/approve context.
- **Compiler Hook**: chương trình cục bộ, xác định, tạo index/layout/source/rules context nhỏ gọn.
- **Skill/Playbook**: policy để Agent quyết định cách Analysis, Implement, Review và QC.
- **Codex Lifecycle Hook**: tùy chọn, chỉ báo status; không phải Context Builder.

## Kiểm Thử

```powershell
cd D:\agents\figma-frontend-agent\context-builder
npm test
```

Bộ test hiện bao phủ cache hit, approval gate, checksum, source stale và design artifact stale. Các compiler trong `hooks/` có unit test riêng.
