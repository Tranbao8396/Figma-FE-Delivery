#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { buildContext, validateContext, approveContext } = require("../src/core");

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? null : process.argv[index + 1];
}

function copyTemplate(output) {
  if (fs.existsSync(output)) throw new Error(`Refusing to overwrite existing intake: ${output}`);
  const template = path.join(__dirname, "..", "templates", "intake.template.json");
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.copyFileSync(template, output);
  return { intakePath: output };
}

function main() {
  const command = process.argv[2];
  const target = argument(command === "init" ? "out" : command === "build" ? "intake" : "context");
  const phase = argument("phase");
  if (!command || !target) throw new Error("Usage: figma-context <init|build|validate|approve|status> --out|--intake|--context <path>");
  if (command === "init") return copyTemplate(path.resolve(target));
  if (command === "build") return buildContext(JSON.parse(fs.readFileSync(path.resolve(target), "utf8")));
  if (command === "validate") return validateContext(path.resolve(target), { phase });
  if (command === "approve") return approveContext(path.resolve(target));
  if (command === "status") return validateContext(path.resolve(target), { requireApproved: true, phase });
  throw new Error(`Unknown command: ${command}`);
}

try { console.log(JSON.stringify(main(), null, 2)); } catch (error) { console.error(error.message); process.exit(1); }
