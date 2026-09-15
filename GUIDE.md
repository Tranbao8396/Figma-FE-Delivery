# Guide Vận Hành Figma Frontend Agent

Đối tượng: người dùng vận hành workflow và AI Agent được giao chuẩn bị context. Đây là guide chung; tài liệu module chi tiết nằm tại:

- [Context Builder CLI](context-builder/GUIDE.md)
- [Design Collector](design-collector/GUIDE.md)
- [Design Normalizer](normalizers/design-normalizer/GUIDE.md)
- [Intake schema](context-builder/INTAKE_GUIDE.vi.md)

## Nguyên tắc

Một executable vận hành flow: `figma-context`. Bên trong, nó điều phối Collector -> Normalizer -> Builder. Sự tách lớp là để kiểm soát network/token, lọc dữ liệu có test, cache và approval; người dùng không cần quản lý từng module trong workflow thường ngày.

```text
Source + rules + Figma JSON/link + visual evidence
  -> figma-context prepare
  -> task-context.draft.json
  -> người dùng review/approve
  -> task-context.approved.json
  -> Agent làm phase được cấp quyền
```

`GUIDE.md` không phải phase artifact. Chỉ đọc nó khi tạo/refresh context. Khi đã có approved context, Agent chỉ đọc project context index và artifact của phase hiện tại.

## Flow chuẩn

### 1. Chuẩn bị input

- Source customer đã clone local, ví dụ `D:\workspace\customer-a-pos`.
- Coding rule/framework/format đã biết để điền Profile trong intake.
- Figma target node cụ thể và screenshot/export ở path ổn định.
- Không đặt source customer, PAT/cookie hay raw credential vào `D:\agents\figma-frontend-agent`.

### 2. Tạo intake

```powershell
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js init `
  --out D:\work\POS-142.intake.json
```

Điền `targetFrame`, `viewportContract`, visual evidence và asset policy theo [Intake schema](context-builder/INTAKE_GUIDE.vi.md). Kích thước Figma 1400px không tự có nghĩa `max-width: 1400px`.

### 3. Prepare bằng một lệnh

Ưu tiên JSON Figma MCP/export đã có:

```powershell
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js prepare `
  --intake D:\work\POS-142.intake.json `
  --design-json D:\evidence\products-figma.json `
  --phase implementation
```

Chỉ khi cache/export không đủ mới dùng Figma REST có authorization rõ ràng:

```powershell
$env:FIGMA_ACCESS_TOKEN = "<personal-access-token>"
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js prepare `
  --intake D:\work\POS-142.intake.json `
  --figma-url "https://www.figma.com/design/<file-key>/Products?node-id=57-99" `
  --allow-figma-rest `
  --phase implementation
```

`prepare` import/collect, normalize, build và validate. Nó không approve, không sửa customer source và không tự retry API.

### 4. Review và approve

Người dùng kiểm tra validation, target frame, viewport, screenshot, asset policy và assumptions. Nếu valid:

```powershell
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js approve `
  --context D:\agents\figma-frontend-agent\contexts\tasks\customer-a-pos\POS-142\task-context.draft.json
```

Draft không được đưa vào Agent implementation. Approved JSON và checksum là baseline bất biến.

### 5. Giao Agent làm phase

```text
Mode context. Hãy thực hiện phase implementation theo context đã duyệt:
D:\agents\figma-frontend-agent\contexts\tasks\customer-a-pos\POS-142\task-context.approved.json
```

Agent chạy `status --phase implementation`, sau đó chỉ đọc artifact được `project-context-index.json` cấp cho phase đó. Agent không tự build context, approve hoặc gọi Figma để vượt gate.

## Khi thay đổi

- Đổi phase sang Review/QC: dùng cùng approved context, chạy `status --phase review` hoặc `qc`.
- Thêm screenshot/report: lưu vào task `evidence/` hoặc `reports/`, không sửa baseline.
- Source/rule/target Figma/viewport đổi: prepare revision draft mới và review lại.
- Evidence thiếu: Agent tạo `evidence_refresh_request`; người dùng quyết định dùng cache/import/REST targeted.

CLI không ghi đè approved context. Dùng task revision rõ ràng như `POS-142-r2` khi baseline nền đã thay đổi.

## Chi phí và token

1. Reuse Profile/Project Context qua hash/reference.
2. Dùng cache hoặc `--design-json` trước REST/MCP.
3. REST chỉ lấy node target, có `--allow-figma-rest`; không gọi khi mở chat/chuyển phase/review/QC.
4. Agent không nạp guide hay collected tree trong implementation; chỉ nạp phase artifact nhỏ gọn.
5. Context thiếu/stale thì dừng và yêu cầu evidence refresh, không tự suy đoán.
