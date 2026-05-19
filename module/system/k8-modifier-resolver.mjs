export const K8_MODIFIER_TYPE_OPTIONS = {
  stat: "Stat mod",
  roll: "Roll mod"
};

export const K8_ROLL_CONTEXT_OPTIONS = {
  checks: "All Checks",

  "checks.attribute": "All Attribute Checks",
  "checks.attribute.str": "STR Checks",
  "checks.attribute.for": "FOR Checks",
  "checks.attribute.ref": "REF Checks",
  "checks.attribute.fit": "FIT Checks",
  "checks.attribute.sp": "SP Checks",

  "checks.stress": "Stress Checks",

  "checks.attack": "All Attack Checks",
  "checks.attack.ranged": "Ranged Attack Checks",
  "checks.attack.melee": "Melee Attack Checks",

  "checks.profession": "All Profession Checks"
};

const K8_STAT_CONTEXT_BASE_OPTIONS = {
  "": "—",

  "checks.attribute": "All Attribute Checks",
  "checks.attribute.str": "STR Checks",
  "checks.attribute.for": "FOR Checks",
  "checks.attribute.ref": "REF Checks",
  "checks.attribute.fit": "FIT Checks",
  "checks.attribute.sp": "SP Checks",

  "checks.stress": "Stress Checks",

  "checks.attack": "All Attack Checks",
  "checks.attack.ranged": "Ranged Attack Checks",
  "checks.attack.melee": "Melee Attack Checks",

  "checks.profession": "All Profession Checks"
};

const K8_CONTEXTUAL_STAT_TARGETS = new Set([
  "conditions.fatigue",
  "conditions.stress"
]);

const K8_STAT_CONTEXT_EXCLUSIONS = {
  "conditions.fatigue": [
    "checks.stress"
  ],

  "conditions.stress": [
    "checks.attribute",
    "checks.attribute.for",
    "checks.stress"
  ]
};

export function getK8StatContextOptions(target) {
  if (!K8_CONTEXTUAL_STAT_TARGETS.has(target)) {
    return { "": "—" };
  }

  const excluded = new Set(K8_STAT_CONTEXT_EXCLUSIONS[target] ?? []);

  return Object.fromEntries(
    Object.entries(K8_STAT_CONTEXT_BASE_OPTIONS)
      .filter(([key]) => !excluded.has(key))
  );
}

export function hasK8StatContextOptions(target) {
  return K8_CONTEXTUAL_STAT_TARGETS.has(target);
}

function matchesContext(modifierContext, checkPath) {
  if (!modifierContext || !checkPath) return false;

  return (
    checkPath === modifierContext ||
    checkPath.startsWith(`${modifierContext}.`)
  );
}

function effectDisplayName(item) {
  const severity = Number(item.system?.severity) || 0;
  return severity > 0 ? `${item.name} (${severity})` : item.name;
}

function modifierValue(item, modifier) {
  const baseValue = Number(modifier.value) || 0;
  const severity = Number(item.system?.severity) || 0;

  return modifier.useSeverity === true
    ? baseValue * severity
    : baseValue;
}

export function resolveActorCheckModifiers(actor, checkPath, options = {}) {
  const ignoredKeys = new Set(options.ignoredKeys ?? []);
  const results = [];

  for (const item of actor.items ?? []) {
    if (item.type !== "effect") continue;
    if (item.system?.active === false) continue;

    const modifiers = item.system?.modifiers ?? [];

    for (const modifier of modifiers) {
      const type = modifier.type ?? (modifier.appliesTo ? "roll" : "stat");
      if (type !== "roll") continue;

      const context = modifier.context ?? modifier.appliesTo ?? "";
      if (!matchesContext(context, checkPath)) continue;

      const key = modifier.key ?? "";
      if (key && ignoredKeys.has(key)) continue;

      const value = modifierValue(item, modifier);
      if (value === 0) continue;

      results.push({
        key,
        sourceName: effectDisplayName(item),
        context,
        value
      });
    }
  }

  return results;
}

export function resolveActorRollStatModifiers(actor, checkPath, target, options = {}) {
  const ignoredKeys = new Set(options.ignoredKeys ?? []);
  const results = [];

  for (const item of actor.items ?? []) {
    if (item.type !== "effect") continue;
    if (item.system?.active === false) continue;

    const modifiers = item.system?.modifiers ?? [];

    for (const modifier of modifiers) {
      const type = modifier.type ?? (modifier.appliesTo ? "roll" : "stat");
      if (type !== "stat") continue;
      if (modifier.target !== target) continue;

      const context = modifier.context ?? modifier.appliesTo ?? "";
      if (!context) continue;
      if (!matchesContext(context, checkPath)) continue;

      const key = modifier.key ?? "";
      if (key && ignoredKeys.has(key)) continue;

      const value = modifierValue(item, modifier);
      if (value === 0) continue;

      results.push({
        key,
        sourceName: effectDisplayName(item),
        target,
        context,
        value
      });
    }
  }

  return results;
}