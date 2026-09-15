const fs = require("fs");

const event = process.argv[2] || "unknown";
const contextDirectory = process.env.FIGMA_FRONTEND_CONTEXT_DIR || null;

process.stdout.write(JSON.stringify({
  kind: "figma_frontend_context_status",
  event,
  contextDirectory,
  contextAvailable: Boolean(contextDirectory && fs.existsSync(contextDirectory))
}));
