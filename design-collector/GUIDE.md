# Guide Design Collector

Đối tượng: người dùng và AI Agent đang **chuẩn bị hoặc refresh context**. Với vận hành thông thường, không chạy executable trong thư mục này; dùng `figma-context prepare` theo [Guide Context Builder](../context-builder/GUIDE.md).

## Vai trò

Design Collector là module nội bộ đọc Figma REST, Figma MCP JSON hoặc export JSON và tạo `figma_collected_artifact` an toàn cho pipeline.

Nó chỉ làm adapter dữ liệu: không chọn layout, không loại node theo ý nghĩa UI, không tạo approved context và không implement code. Các việc đó thuộc Design Normalizer, Context Builder và Agent Skill.

## Cách dùng qua CLI chung

### Có JSON Figma MCP/export

```powershell
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js prepare `
  --intake D:\work\POS-142.intake.json `
  --design-json D:\evidence\products-figma.json
```

Đây là lựa chọn ưu tiên: không cần token, không có Figma API request.

### Chỉ có Figma URL

```powershell
$env:FIGMA_ACCESS_TOKEN = "<personal-access-token>"
node D:\agents\figma-frontend-agent\context-builder\bin\figma-context.js prepare `
  --intake D:\work\POS-142.intake.json `
  --figma-url "https://www.figma.com/design/<file-key>/Products?node-id=57-99" `
  --allow-figma-rest
```

`--allow-figma-rest` là authorization rõ ràng. Không có cờ này, CLI không gọi API. Token chỉ đọc từ environment variable của process và không được ghi vào artifact/context/log.

## Cache và scope

Collector chỉ lấy node target, không lấy full Figma file. Nó cache theo file key, node id, depth và version. Cùng input sẽ cache hit; chỉ dùng `--refresh` khi người dùng/cache owner yêu cầu lấy lại dữ liệu vì revision/evidence đã đổi.

Output `figma_collected_artifact` nằm dưới `contexts/projects/<project>/figma/<task>/`. Artifact có projection an toàn: không chứa `pluginData`, `vectorPaths`, PAT hoặc cookie. Nó vẫn chưa là context dùng cho Agent; `prepare` sẽ gọi Normalizer và Builder tiếp theo.

## Quy tắc Agent

Agent ưu tiên context/cache/import JSON. Nếu thiếu evidence, Agent báo `evidence_refresh_request`; không tự chạy REST/MCP chỉ để xác nhận lại. Agent chỉ collect REST khi người dùng đã yêu cầu rõ và có `--allow-figma-rest`.
