const fs = require("fs");
const path = require("path");

const AGENT_ROOT = path.resolve(__dirname, "..", "..");

function unquote(value) {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'")))) {
    return trimmed.slice(1, -1);
  }
  return trimmed.replace(/\s+#.*$/, "").trim();
}

function readEnvFile(envPath) {
  const values = new Map();
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (match) values.set(match[1], unquote(match[2]));
  }
  return values;
}

// Load only explicit allowlisted keys so unrelated customer secrets never enter this process.
function loadRootEnv(keys, options = {}) {
  const envPath = options.envPath || path.join(AGENT_ROOT, ".env");
  const requestedKeys = [...new Set((keys || []).filter((key) => typeof key === "string" && key))];
  if (!fs.existsSync(envPath)) return { envPath, found: false, loadedKeys: [] };
  const values = readEnvFile(envPath);
  const loadedKeys = [];
  for (const key of requestedKeys) {
    if (process.env[key] === undefined && values.has(key)) {
      process.env[key] = values.get(key);
      loadedKeys.push(key);
    }
  }
  return { envPath, found: true, loadedKeys };
}

module.exports = { AGENT_ROOT, readEnvFile, loadRootEnv };
