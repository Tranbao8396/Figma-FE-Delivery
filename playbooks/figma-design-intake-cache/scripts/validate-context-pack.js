#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const input = process.argv[2];
const requiredHeadings = [
  "# Figma Context Pack:",
  "## Index",
  "## Scope and Rules",
  "## Source and Build",
  "## Design Map",
  "## Tokens and Assets",
  "## Ambiguity and Decisions",
  "## Quality Handoff",
  "## Budget and Telemetry"
];

if (!input) {
  console.error("Usage: node validate-context-pack.js <context-pack.md>");
  process.exit(2);
}

const filePath = path.resolve(input);
let content;
try {
  content = fs.readFileSync(filePath, "utf8");
} catch (error) {
  console.error(`Cannot read ${filePath}: ${error.message}`);
  process.exit(2);
}

const missing = requiredHeadings.filter((heading) => !content.includes(heading));
const result = {
  file: filePath,
  valid: missing.length === 0,
  missingHeadings: missing,
  characters: content.length
};

console.log(JSON.stringify(result, null, 2));
process.exit(result.valid ? 0 : 1);
