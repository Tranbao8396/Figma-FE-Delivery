# Guide Design Collector

Design Collector là lớp **Collector / Adapter** trong workflow Figma Frontend Agent. Nó đọc dữ liệu thiết kế từ một nguồn đã được chỉ định, chuyển về `figma_collected_artifact` an toàn cho pipeline, rồi lưu artifact bên ngoài customer source.

Nó không phải AI, không tự phân tích “ý đồ thiết kế”, không tự chọn layout để implement, không tạo Task Context và không approve context.

## Vị trí trong flow

```text
Figma REST / Figma MCP JSON / export JSON
  -> Design Collector
  -> figma_collected_artifact
  -> Design Normalizer
  -> normalized_design_artifact
  -> Context Builder
  -> task-context.draft.json / task-context.approved.json
```

Collector chỉ có trách nhiệm adapter dữ liệu đầu vào. Việc chọn đúng `targetFrame`, loại node ẩn, node design-only, vector nháp hoặc tạo asset manifest thuộc về Design Normalizer.

## Khi nào dùng

Ưu tiên các nguồn theo thứ tự sau:

1. Artifact đã thu thập và còn fresh trong `contexts`.
2. JSON đã lưu từ Figma MCP hoặc Figma export, dùng `import`.
3. Figma REST API, dùng `collect` có chủ đích cho đúng node.

Không chạy Collector khi mở chat, đổi phase, review/QC, hoặc chỉ để xác nhận lại dữ kiện đã có. Nếu Agent thiếu evidence, Agent chỉ tạo `evidence_refresh_request`; người dùng hoặc cache owner quyết định có chạy Collector hay không.

## Output và vị trí lưu

Output phải nằm dưới:

```text
D:\agents\figma-frontend-agent\contexts\
```

Ví dụ cấu trúc khuyến nghị:

```text
contexts/
  projects/
    customer-a-pos/
      figma/
        products.collected.json
        products.normalized.json
```

Artifact output có `kind: "figma_collected_artifact"`. Nó chỉ giữ field cần thiết để các compiler làm việc, bỏ `pluginData`, `vectorPaths` và giới hạn độ sâu/số node con theo lệnh. Nó không chứa PAT, cookie hay customer source.

## Cách 1: Import JSON đã có

Dùng khi đã lưu output từ Figma MCP, Figma export hoặc nguồn JSON tương thích. Cách này không yêu cầu token và không gọi Figma API.

```powershell
node D:\agents\figma-frontend-agent\design-collector\bin\figma-design.js import `
  --input D:\evidence\figma-mcp-products.json `
  --out D:\agents\figma-frontend-agent\contexts\projects\customer-a-pos\figma\products.collected.json `
  --node-ids 57:99
```

`--node-ids` ghi lại scope mong muốn vào metadata. Design Normalizer vẫn là nơi bắt buộc chọn và xác nhận `targetFrame` trước khi artifact được dùng cho implementation.

## Cách 2: Collect từ Figma REST API

Dùng khi cache/local export không đủ và người dùng đã cho phép targeted refresh. URL phải có file key; node có thể lấy từ `node-id` trong link hoặc truyền rõ bằng `--node-ids`.

```powershell
$env:FIGMA_ACCESS_TOKEN = "<personal-access-token>"

node D:\agents\figma-frontend-agent\design-collector\bin\figma-design.js collect `
  --figma-url "https://www.figma.com/design/<file-key>/Products?node-id=57-99" `
  --out D:\agents\figma-frontend-agent\contexts\projects\customer-a-pos\figma\products.collected.json `
  --depth 10
```

Collector chỉ gọi endpoint targeted:

```text
GET /v1/files/:key/nodes?ids=<node-id>&depth=<depth>
```

Nó không lấy toàn bộ Figma file và không tự retry request lỗi.

## Token `FIGMA_ACCESS_TOKEN`

Mặc định Collector đọc token từ environment variable `FIGMA_ACCESS_TOKEN` của process chạy lệnh:

```powershell
$env:FIGMA_ACCESS_TOKEN = "<personal-access-token>"
```

Có thể dùng tên biến khác:

```powershell
$env:CUSTOMER_FIGMA_TOKEN = "<personal-access-token>"
node D:\agents\figma-frontend-agent\design-collector\bin\figma-design.js collect `
  --figma-url "https://www.figma.com/design/<file-key>/Products?node-id=57-99" `
  --out D:\agents\figma-frontend-agent\contexts\projects\customer-a-pos\figma\products.collected.json `
  --token-env CUSTOMER_FIGMA_TOKEN
```

Token chỉ được đọc khi cache miss và ngay trước REST request. Nó chỉ được gửi trong header `X-Figma-Token`; không được ghi vào artifact, intake, context, log hay Profile Context.

## Cache và kiểm soát request

Collector tạo fingerprint từ `fileKey`, danh sách node, `depth` và `version`.

- Output đã tồn tại với fingerprint giống nhau: cache hit, không cần token và không gọi network.
- Muốn thu thập lại có chủ đích: thêm `--refresh`.
- Thay đổi node, depth hoặc version: fingerprint thay đổi và tạo request mới.

```powershell
node D:\agents\figma-frontend-agent\design-collector\bin\figma-design.js collect `
  --figma-url "https://www.figma.com/design/<file-key>/Products?node-id=57-99" `
  --out D:\agents\figma-frontend-agent\contexts\projects\customer-a-pos\figma\products.collected.json `
  --refresh
```

Chỉ dùng `--refresh` khi có lý do cụ thể: Figma revision đổi, target node đổi, evidence bị stale hoặc người dùng yêu cầu lấy lại dữ liệu.

## Giới hạn payload

| Option | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `--depth` | `10` | Độ sâu Figma REST trả về. |
| `--max-depth` | `10` | Độ sâu tối đa Collector lưu vào artifact. |
| `--max-children` | `100` | Số node con tối đa được lưu trên mỗi node. |
| `--node-ids` | Từ URL | Danh sách node scope, ngăn cách bởi dấu phẩy. |
| `--version` | Không có | Version Figma cần lấy khi có cơ sở rõ ràng. |

Không tăng các giới hạn này chỉ để “lấy cho chắc”. Nếu target bị truncated hoặc thiếu, chọn node cụ thể hơn hoặc yêu cầu targeted refresh.

## Đưa output vào intake

Intake mới dùng `collectedArtifactPath`:

```json
{
  "design": {
    "figmaUrl": "https://www.figma.com/design/<file-key>/Products?node-id=57-99",
    "nodes": ["57:99"],
    "targetFrame": { "nodeId": "57:99", "name": "Products" },
    "collectedArtifactPath": "D:\\agents\\figma-frontend-agent\\contexts\\projects\\customer-a-pos\\figma\\products.collected.json",
    "normalizedArtifactPath": null
  }
}
```

Sau đó chạy:

```powershell
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js build --intake D:\intake.json
```

Context Builder điều phối Design Normalizer để tạo `normalized_design_artifact` theo `targetFrame`, rồi mới tạo index/layout context. Có thể chạy Normalizer trước bằng tay và đưa `normalizedArtifactPath`, nhưng không sửa artifact đã approve.

## Checklist trước khi collect

- [ ] Đã có Figma URL và `node-id` đúng scope task.
- [ ] Đã kiểm tra cache/local export trước khi gọi REST API.
- [ ] Đường dẫn `--out` nằm dưới `contexts`.
- [ ] Node được lấy là target cần implement, không phải page root hoặc component library không liên quan.
- [ ] Lý do dùng REST/`--refresh` được ghi lại trong intake hoặc evidence request.
- [ ] Không đặt token vào file JSON, `.md`, source code hoặc Profile Context.
