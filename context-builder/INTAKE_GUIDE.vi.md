# Hướng dẫn tạo `intake.json`

Tài liệu này là contract đầu vào cho Context Builder. Người phụ trách hoặc Agent có thể dùng nó để tạo một `intake.json` dạng **draft** trước khi chạy `figma-context build`.

Mục tiêu của intake là ghi lại dữ kiện đã xác nhận, không phải để Agent suy đoán thiết kế. Thiếu dữ kiện quan trọng thì để rõ là chưa có, chuyển task về `analysis`, hoặc yêu cầu bổ sung evidence. Không tự điền padding, breakpoint, `max-width`, node Figma, icon hay kích thước từ phỏng đoán.

## Quy trình tạo intake

1. Xác định repository đã clone, task và phase đầu tiên cần làm.
2. Chọn hoặc tạo Profile Context cho framework, coding rule, lint, format của khách hàng.
3. Thu thập một target frame Figma rõ ràng, raw artifact có scope đúng frame và ảnh tham chiếu lưu ở đường dẫn ổn định.
4. Khai báo ý nghĩa viewport: desktop cố định, `min-width`, `max-width` hay responsive fluid. Kích thước frame Figma **không tự động** là `max-width` của web.
5. Khai báo chính sách asset/icon và acceptance criteria có thể kiểm chứng.
6. Chạy build và validate. Người dùng kiểm tra draft, sau đó mới approve.

Agent chỉ được tạo hoặc chỉnh sửa intake/draft khi được yêu cầu. Agent không tự approve, không tự gọi Figma MCP/REST để lấp dữ kiện thiếu, và không dùng draft để implement trong `context` mode.

## Cấu trúc từng phần

### `project`

| Field | Bắt buộc | Ý nghĩa và quy tắc |
| --- | --- | --- |
| `key` | Có | Mã project ổn định, chữ thường và gạch nối, ví dụ `customer-a-pos`. Dùng để tạo thư mục context. |
| `sourcePath` | Có | Đường dẫn tuyệt đối tới repository đã clone, ví dụ `D:\\workspace\\customer-a-pos`. Không chép source code vào context. |

### `task`

| Field | Bắt buộc | Ý nghĩa và quy tắc |
| --- | --- | --- |
| `id` | Có | Mã task ổn định, ví dụ `POS-142`. |
| `title` | Có | Mô tả ngắn, cụ thể về màn hình hoặc thay đổi cần làm. |
| `requestedPhase` | Có | Phase khởi đầu: `analysis`, `foundation`, `implementation`, `review`, hoặc `qc`. |
| `allowedPhases` | Nên có | Các phase được phép trên baseline này. Mặc định gồm cả năm phase. |

`requestedPhase` chỉ là phase khởi đầu, không có nghĩa mỗi lần đổi phase phải tạo lại context. Khi chuyển sang review hay QC, Agent chạy `figma-context status --phase review` hoặc `--phase qc` để kiểm tra gate hiện tại. Chỉ rebuild/supersede baseline khi source, profile/rules, target design, viewport contract hoặc evidence nền thay đổi.

### `profile`

Profile là dữ kiện có thể tái sử dụng giữa nhiều task/project cùng khách hàng.

| Field | Bắt buộc | Ý nghĩa và quy tắc |
| --- | --- | --- |
| `customer` | Có | Tên khách hàng hoặc `standard`. |
| `name` | Có | Tên profile, ví dụ `web-frontend`. |
| `version` | Có | Tăng version khi framework/rule/format thay đổi. |
| `framework.name` | Có | Framework thực tế, ví dụ `html-css-js`, `react`, `nextjs`, `vue`. |
| `framework.majorVersion` | Nên có | Major version đã xác nhận, ví dụ `19`. |
| `codingRules` | Có thể rỗng | Rule kiến trúc, naming, CSS/SCSS, component, accessibility. |
| `lintRules` | Có thể rỗng | Rule lint hoặc đường dẫn cấu hình lint. |
| `formatRules` | Có thể rỗng | Prettier/style format, quy tắc report/test file của khách hàng. |

Không đặt PAT, cookie, secrets, raw Figma payload hoặc source code khách hàng vào Profile.

### `design`

| Field | Bắt buộc cho implement | Ý nghĩa và quy tắc |
| --- | --- | --- |
| `figmaUrl` | Có nếu có Figma | Link Figma nguồn. Chỉ là tham chiếu, không tự cấp quyền gọi API. |
| `nodes` | Có | Danh sách node liên quan. Có thể nhiều node, nhưng không thay thế `targetFrame`. |
| `targetFrame` | Có | Một frame/page chính xác cho scope hiện tại: `nodeId` và `name`. Đây là cơ sở đo layout. |
| `rawArtifactPath` | Có | Đường dẫn artifact do Design Collector `import` hoặc `collect` tạo ra, nằm dưới `contexts`. Scope phải chứa đúng `targetFrame`. |
| `referenceImages` | Có | Ít nhất một ảnh visual lưu tại đường dẫn ổn định. Không dùng đường dẫn clipboard tạm. |

Mỗi mục `referenceImages` nên có:

```json
{
  "path": "D:\\agents\\figma-frontend-agent\\contexts\\tasks\\customer-a-pos\\POS-142\\evidence\\products-pc.png",
  "role": "visual_comparison",
  "measurementAuthority": "figma_frame"
}
```

`measurementAuthority: "figma_frame"` nghĩa là ảnh dùng để so sánh trực quan; số đo chuẩn lấy từ frame Figma/contract, không lấy từ ảnh bị scale trong chat.

Target frame, raw artifact và ảnh phải nói về cùng một màn hình/trạng thái. Nếu không khớp, task chỉ nên ở phase `analysis` cho tới khi evidence được làm rõ.

### `viewportContract`

Đây là phần chặn lỗi phổ biến: nhìn thấy thiết kế 1400 px rồi tự viết `max-width: 1400px`.

| Field | Bắt buộc | Giá trị / ý nghĩa |
| --- | --- | --- |
| `referenceViewport.width`, `height` | Có | Kích thước viewport/frame tham chiếu đã xác nhận. |
| `deviceScope` | Có | `pc_only`, `responsive`, hoặc phạm vi thiết bị đã được xác nhận. |
| `layoutBehavior` | Có | `min_width`, `max_width`, `fixed_canvas`, hoặc `fluid`. |
| `minWidth` | Theo behavior | Bắt buộc khi `min_width`; `null` nếu không có cơ sở. |
| `maxWidth` | Theo behavior | Chỉ điền khi có bằng chứng content bị giới hạn chiều rộng. Để `null` nếu thiết kế PC không có cap. |
| `interpolationAllowed` | Có | `false` cho layout cố định/PC only; `true` khi được phép nội suy responsive giữa các breakpoint. |

Ví dụ đúng cho thiết kế Products chỉ dành cho PC ở 1400 px, cần giữ bố cục desktop khi màn hình hẹp hơn:

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

`min_width` không tự quyết định cách scroll/overflow; acceptance criteria hoặc task phải nói rõ hành vi cần có. `max_width` chỉ dùng khi Figma, brief hoặc evidence xác nhận nội dung được giới hạn ở một chiều rộng tối đa. Nếu có desktop/tablet/mobile riêng, ghi từng viewport và breakpoint/evidence trong acceptance criteria hoặc context mở rộng thay vì tự nội suy.

### `assetPolicy`

```json
{
  "icons": "figma_asset_or_approved_library_only",
  "forbidCssRecreationWithoutEvidence": true
}
```

Với chính sách này, icon phải dùng asset export từ Figma hoặc thư viện được duyệt và mapping được nêu rõ. Không được vẽ icon gần giống bằng ký tự text, pseudo-element CSS hoặc SVG tự đoán. Nếu Design Collector chỉ đánh dấu asset `requires_export_or_library_mapping`, Agent phải tạo `evidence_refresh_request` thay vì thay thế bằng icon khác.

### `acceptanceCriteria`

Mỗi tiêu chí phải khách quan và kiểm chứng được. Ví dụ:

```json
[
  "Triển khai target frame 57:99 (Products) ở viewport 1400x887.",
  "Sidebar, header, bảng và filter đối chiếu với ảnh products-pc.png.",
  "Không gán max-width: 1400px nếu không có evidence giới hạn content.",
  "Icon export dùng asset Figma hoặc thư viện đã được phê duyệt có mapping.",
  "Không thay đổi hành vi mobile vì task hiện là pc_only."
]
```

Không dùng tiêu chí mơ hồ như “gần giống Figma” hoặc “responsive đẹp”. Nêu node, viewport, trạng thái UI, asset và giới hạn scope cần kiểm.

### `assumptions`

Assumption là điều chưa được chứng minh nhưng có rủi ro thấp và đã được nêu công khai để người dùng kiểm tra. Không dùng assumptions cho target frame, viewport, margin/padding, icon, breakpoint hoặc tính năng quan trọng. Nếu chưa biết các điều đó, task phải bị block ở phase liên quan.

Khuyến nghị ghi dạng object:

```json
[
  {
    "statement": "Dữ liệu bảng có thể dùng mock tĩnh trong phase foundation.",
    "reason": "Task chỉ yêu cầu layout tĩnh.",
    "risk": "low",
    "needsConfirmation": true
  }
]
```

## Mẫu intake tối thiểu cho Products

```json
{
  "project": {
    "key": "customer-a-pos",
    "sourcePath": "D:\\workspace\\customer-a-pos"
  },
  "task": {
    "id": "POS-142",
    "title": "Implement Products desktop screen",
    "requestedPhase": "implementation",
    "allowedPhases": ["analysis", "foundation", "implementation", "review", "qc"]
  },
  "profile": {
    "customer": "customer-a",
    "name": "web-frontend",
    "version": "1.0.0",
    "framework": { "name": "html-css-js", "majorVersion": null },
    "codingRules": [],
    "lintRules": [],
    "formatRules": []
  },
  "design": {
    "figmaUrl": "https://www.figma.com/design/FILE_KEY/Products?node-id=57-99",
    "nodes": ["57:99"],
    "targetFrame": { "nodeId": "57:99", "name": "Products" },
    "rawArtifactPath": "D:\\agents\\figma-frontend-agent\\contexts\\tasks\\customer-a-pos\\POS-142\\evidence\\products.raw.json",
    "referenceImages": [
      {
        "path": "D:\\agents\\figma-frontend-agent\\contexts\\tasks\\customer-a-pos\\POS-142\\evidence\\products-pc.png",
        "role": "visual_comparison",
        "measurementAuthority": "figma_frame"
      }
    ]
  },
  "viewportContract": {
    "referenceViewport": { "width": 1400, "height": 887 },
    "deviceScope": "pc_only",
    "layoutBehavior": "min_width",
    "minWidth": 1400,
    "maxWidth": null,
    "interpolationAllowed": false
  },
  "assetPolicy": {
    "icons": "figma_asset_or_approved_library_only",
    "forbidCssRecreationWithoutEvidence": true
  },
  "acceptanceCriteria": [],
  "assumptions": []
}
```

Thay tất cả giá trị ví dụ bằng dữ kiện thật trước khi build. Một file `intake.json` hợp lệ về cú pháp vẫn có thể bị chặn nếu raw artifact, target, viewport hoặc visual evidence không đủ cho phase cần làm.

## Lệnh và gate

```powershell
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js init --out D:\intake.json
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js build --intake D:\intake.json
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js validate --context <task-context.draft.json> --phase implementation
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js approve --context <task-context.draft.json>
```

| Phase | Tối thiểu cần sẵn sàng |
| --- | --- |
| `analysis` | Source/profile/rule và scope task có thể xác định. |
| `foundation` | Target frame, raw artifact đúng scope, viewport contract và ảnh visual ổn định. |
| `implementation` | Toàn bộ gate của foundation, cùng asset policy và acceptance criteria đủ để không tự suy diễn. |
| `review`, `qc` | Approved baseline còn fresh, evidence/screenshot/report của phase hiện tại theo project context index. |

## Checklist trước khi approve

- [ ] `sourcePath` là repository đúng và truy cập được.
- [ ] Profile phản ánh framework/rule/format hiện tại; không chứa secrets.
- [ ] `targetFrame.nodeId`, raw artifact và ảnh tham chiếu là cùng màn hình/trạng thái.
- [ ] Ảnh evidence ở đường dẫn ổn định dưới `contexts`, không phải clipboard tạm.
- [ ] Viewport contract mô tả ý nghĩa 1400 px; không suy `maxWidth` từ kích thước frame.
- [ ] Icon/asset có nguồn rõ ràng hoặc task bị block chờ export/mapping.
- [ ] Acceptance criteria đo được tại viewport và trạng thái cụ thể.
- [ ] Assumption không che giấu một quyết định thiết kế quan trọng.
- [ ] `validate` pass tại phase cần thực hiện trước khi `approve`.
