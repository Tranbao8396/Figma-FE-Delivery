#!/usr/bin/env node
const { execute } = require("../src/cli");

execute(process.argv.slice(2)).then((result) => {
  console.log(result.help || JSON.stringify(result, null, 2));
}).catch((error) => { console.error(error.message); process.exit(1); });
