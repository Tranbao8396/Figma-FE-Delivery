function collectRulesInput(profile) {
  return {
    kind: "collected_rules_input",
    profile: { id: profile.id, version: profile.version },
    rules: [...(profile.codingRules || []), ...(profile.lintRules || []), ...(profile.formatRules || [])],
    reportFormat: profile.reportFormat || null
  };
}

module.exports = { collectRulesInput };
