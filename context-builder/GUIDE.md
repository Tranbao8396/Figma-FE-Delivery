# Guide Context Builder CLI

Đối tượng: người vận hành và AI Agent được giao chuẩn bị context. CLI duy nhất cần dùng là:

```powershell
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js <command>
```

`figma-context` là façade duy nhất cho Collector, Normalizer và Context Builder. Ba phần vẫn tách nội bộ để test/cache/bảo mật, nhưng không yêu cầu người dùng chạy ba executable khác nhau.

## Luồng dùng hằng ngày

```text
init -> điền intake -> prepare -> review validation -> approve -> status theo phase
```

### 1. Tạo intake

```powershell
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js init `
  --out D:\work\POS-142.intake.json
```

Điền file theo [Intake Guide](INTAKE_GUIDE.vi.md). Không cần đặt context vào repository customer.

### 2. Chuẩn bị draft từ JSON Figma đã có

Đây là lựa chọn mặc định, không gọi Figma API:

```powershell
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js prepare `
  --intake D:\work\POS-142.intake.json `
  --design-json D:\evidence\products-figma.json `
  --phase implementation
```

`prepare` thực hiện: import -> normalize target frame -> build source/rules/design/layout/index/task draft -> validate phase. Output JSON cho biết path artifact, cache hit và validation errors để review.

### 3. Chuẩn bị draft từ Figma REST có kiểm soát

Chỉ dùng khi không có cache/export JSON và người dùng đã cho phép request targeted.

```powershell
$env:FIGMA_ACCESS_TOKEN = "<personal-access-token>"

node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js prepare `
  --intake D:\work\POS-142.intake.json `
  --figma-url "https://www.figma.com/design/<file-key>/Products?node-id=57-99" `
  --allow-figma-rest `
  --phase implementation
```

Không có `--allow-figma-rest`, CLI sẽ từ chối trước khi đọc token hoặc gọi network. Cache hit cho cùng file/node/depth/version không gọi network.

### 4. Review draft, rồi approve

```powershell
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js validate `
  --context D:\agents\figma-frontend-agent\contexts\tasks\customer-a-pos\POS-142\task-context.draft.json `
  --phase implementation

node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js approve `
  --context D:\agents\figma-frontend-agent\contexts\tasks\customer-a-pos\POS-142\task-context.draft.json
```

`approve` là điểm dừng bắt buộc do người dùng quyết định. Nó tạo approved JSON cùng SHA-256 sidecar, cả hai read-only.

### 5. Kiểm tra trước khi giao Agent

```powershell
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js status `
  --context D:\agents\figma-frontend-agent\contexts\tasks\customer-a-pos\POS-142\task-context.approved.json `
  --phase implementation
```

## Command nâng cao

Các lệnh này dùng khi cần kiểm tra/tái dùng một artifact riêng. Flow thông thường dùng `prepare`.

| Command | Mục đích |
| --- | --- |
| `import --input <json> --out <collected.json>` | Chuyển Figma MCP/export JSON thành collected artifact, không gọi API. |
| `collect --figma-url <url> --out <collected.json> --allow-figma-rest` | Gọi Figma REST targeted. |
| `normalize --input <collected.json> --out <normalized.json> --target-node-id <id>` | Chuẩn hóa design thủ công để review trước. |
| `build --intake <intake.json>` | Build từ artifact path đã có trong intake. |

Ví dụ normalize thủ công:

```powershell
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js normalize `
  --input D:\agents\figma-frontend-agent\contexts\projects\customer-a-pos\figma\POS-142\design.collected.json `
  --out D:\agents\figma-frontend-agent\contexts\projects\customer-a-pos\figma\POS-142\design.normalized.json `
  --target-node-id 57:99
```

## Output và ranh giới

Artifacts được ghi dưới `D:\agents\figma-frontend-agent\contexts\`, không ghi vào customer source. `prepare` không sửa intake gốc; thêm `--write-resolved-intake D:\work\POS-142.resolved.json` khi muốn lưu phiên bản intake đã có collected path.

CLI không tự approve, không tự refresh Figma, không tự implement source và không dùng draft cho implementation. Khi collected/source/rules/normalized artifact đổi, approved context có thể stale; tạo draft/revision mới để review lại.
