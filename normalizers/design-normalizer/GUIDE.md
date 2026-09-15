# Guide Design Normalizer

Đối tượng: người dùng và AI Agent đang kiểm tra design artifact trước khi tạo context. Trong flow thường ngày, Normalizer chạy bên trong `figma-context prepare`; không cần gọi executable riêng.

## Vai trò

Normalizer nhận `figma_collected_artifact`, chọn đúng `targetFrame` và sinh `normalized_design_artifact` nhỏ gọn cho Context Builder.

Nó thực hiện các việc có tính deterministic:

- Cô lập target frame, kể cả khi node nằm lồng trong page.
- Bỏ node ẩn, opacity 0, node non-UI và design-only.
- Bỏ vector path, tạo asset manifest cho icon/illustration cần export hoặc mapping library.
- Ghi diagnostics khi target thiếu hoặc node bị lọc.

Normalizer không gọi Figma, không đọc token, không tự đoán viewport/padding/breakpoint và không approve context.

## Cách dùng thường ngày

Khai báo `targetFrame` trong intake rồi chạy:

```powershell
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js prepare `
  --intake D:\work\POS-142.intake.json `
  --design-json D:\evidence\products-figma.json
```

`prepare` chuyển artifact qua Normalizer trước khi build design index/layout. Agent triển khai chỉ đọc normalized layout/index của phase hiện tại, không đọc whole collected tree.

## Khi cần chạy riêng

Dùng để review target scope hoặc debug evidence trước khi build:

```powershell
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js normalize `
  --input D:\agents\figma-frontend-agent\contexts\projects\customer-a-pos\figma\POS-142\design.collected.json `
  --out D:\agents\figma-frontend-agent\contexts\projects\customer-a-pos\figma\POS-142\design.normalized.json `
  --target-node-id 57:99
```

Sau khi đã có normalized artifact tự chạy, có thể đưa `normalizedArtifactPath` vào intake để Builder dùng đúng artifact đó. Không sửa normalized artifact đã là baseline của approved context; nếu evidence đổi, tạo revision draft mới.
