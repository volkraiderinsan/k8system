import { getK8ModifierColor } from "./k8-modifier-style.mjs";

function fromTable(value, table) {
    const numeric = Number(value) || 0;
    const row = table.find(entry => numeric >= entry.min);
    return row?.value ?? 0;
  }
  
  function signed(value) {
    return value >= 0 ? `+${value}` : `${value}`;
  }
  
  function sourceColor(value, options = {}) {
    return getK8ModifierColor(options.target ?? "", value);
  }
  
  function makeTooltipLine(source, options = {}) {
    const color = sourceColor(source.value, options);
    return `<span style="color: ${color};">${source.label}: ${signed(source.value)}</span>`;
  }
  
  function makeStat(sources, options = {}) {
    const raw = sources.reduce((total, source) => total + source.value, 0);
    const value = options.min !== undefined ? Math.max(options.min, raw) : raw;
  
    const tooltipLines = sources.map(source => makeTooltipLine(source, options));
  
    return {
      value,
      raw,
      sources,
      tooltip: tooltipLines.join("<br>")
    };
  }
  
  const MOVE_BY_FIT = [
    { min: 100, value: 33 },
    { min: 90, value: 30 },
    { min: 80, value: 27 },
    { min: 70, value: 24 },
    { min: 60, value: 21 },
    { min: 50, value: 18 },
    { min: 40, value: 16 },
    { min: 30, value: 14 },
    { min: 10, value: 12 },
    { min: 0, value: 12 }
  ];
  
  const FPR_BY_SP = [
    { min: 100, value: 45 },
    { min: 90, value: 40 },
    { min: 80, value: 35 },
    { min: 70, value: 30 },
    { min: 60, value: 25 },
    { min: 50, value: 20 },
    { min: 40, value: 15 },
    { min: 30, value: 10 },
    { min: 20, value: 5 },
    { min: 10, value: 0 },
    { min: 0, value: 0 }
  ];
  
  const FOCUS_MAX_BY_SP = [
    { min: 100, value: 200 },
    { min: 90, value: 180 },
    { min: 80, value: 160 },
    { min: 70, value: 140 },
    { min: 60, value: 120 },
    { min: 50, value: 100 },
    { min: 40, value: 80 },
    { min: 30, value: 60 },
    { min: 20, value: 40 },
    { min: 10, value: 20 },
    { min: 0, value: 20 }
  ];
  
  const PERCEPTION_BY_REF = [
    { min: 100, value: 75 },
    { min: 90, value: 70 },
    { min: 80, value: 65 },
    { min: 70, value: 60 },
    { min: 60, value: 55 },
    { min: 50, value: 50 },
    { min: 40, value: 45 },
    { min: 30, value: 40 },
    { min: 20, value: 35 },
    { min: 10, value: 30 },
    { min: 0, value: 30 }
  ];
  
  const BACC_BY_REF = [
    { min: 100, value: 55 },
    { min: 90, value: 50 },
    { min: 80, value: 45 },
    { min: 70, value: 40 },
    { min: 60, value: 35 },
    { min: 50, value: 30 },
    { min: 40, value: 25 },
    { min: 30, value: 20 },
    { min: 20, value: 15 },
    { min: 10, value: 10 },
    { min: 0, value: 10 }
  ];
  
  const MACC_BY_STR = [
    { min: 100, value: 75 },
    { min: 90, value: 70 },
    { min: 80, value: 65 },
    { min: 70, value: 60 },
    { min: 60, value: 55 },
    { min: 50, value: 50 },
    { min: 40, value: 45 },
    { min: 30, value: 40 },
    { min: 20, value: 35 },
    { min: 10, value: 30 },
    { min: 0, value: 30 }
  ];
  
  const REPULSE_BY_STR = [
    { min: 100, value: 50 },
    { min: 90, value: 40 },
    { min: 80, value: 30 },
    { min: 70, value: 20 },
    { min: 60, value: 10 },
    { min: 55, value: 5 },
    { min: 50, value: 0 },
    { min: 45, value: -5 },
    { min: 40, value: -10 },
    { min: 30, value: -20 },
    { min: 20, value: -30 },
    { min: 10, value: -40 },
    { min: 0, value: -40 }
  ];
  
  const HP_BY_FOR = [
    { min: 100, torso: 25, limb: 20 },
    { min: 90, torso: 23, limb: 18 },
    { min: 80, torso: 21, limb: 16 },
    { min: 70, torso: 19, limb: 14 },
    { min: 60, torso: 17, limb: 12 },
    { min: 55, torso: 16, limb: 11 },
    { min: 50, torso: 15, limb: 10 },
    { min: 40, torso: 14, limb: 9 },
    { min: 30, torso: 13, limb: 8 },
    { min: 20, torso: 12, limb: 7 },
    { min: 10, torso: 11, limb: 6 },
    { min: 0, torso: 11, limb: 6 }
  ];
  
  const STAMINA_MAX_BY_FOR = [
    { min: 100, value: 60 },
    { min: 90, value: 52 },
    { min: 80, value: 44 },
    { min: 70, value: 36 },
    { min: 60, value: 28 },
    { min: 55, value: 24 },
    { min: 50, value: 20 },
    { min: 45, value: 19 },
    { min: 40, value: 18 },
    { min: 30, value: 16 },
    { min: 20, value: 14 },
    { min: 10, value: 12 },
    { min: 0, value: 12 }
  ];
  
  const BLOOD_MAX_BY_FOR = [
    { min: 100, value: 50 },
    { min: 90, value: 44 },
    { min: 80, value: 38 },
    { min: 70, value: 32 },
    { min: 60, value: 26 },
    { min: 55, value: 23 },
    { min: 50, value: 20 },
    { min: 45, value: 19 },
    { min: 40, value: 18 },
    { min: 30, value: 16 },
    { min: 20, value: 14 },
    { min: 10, value: 12 },
    { min: 0, value: 12 }
  ];
  
  const BEFF_BY_REF = [
    { min: 100, value: -25 },
    { min: 90, value: -20 },
    { min: 80, value: -15 },
    { min: 70, value: -10 },
    { min: 60, value: -5 },
    { min: 50, value: 0 },
    { min: 40, value: 0 },
    { min: 30, value: 5 },
    { min: 20, value: 5 },
    { min: 10, value: 5 },
    { min: 0, value: 5 }
  ];
  
  const STRMOD_BY_STR = [
    { min: 100, value: 10 },
    { min: 90, value: 8 },
    { min: 80, value: 6 },
    { min: 70, value: 4 },
    { min: 60, value: 2 },
    { min: 55, value: 1 },
    { min: 50, value: 0 },
    { min: 45, value: -1 },
    { min: 40, value: -2 },
    { min: 30, value: -4 },
    { min: 20, value: -6 },
    { min: 10, value: -8 },
    { min: 0, value: -8 }
  ];
  
  const FITMOD_BY_FIT = [
    { min: 100, value: 10 },
    { min: 90, value: 8 },
    { min: 80, value: 6 },
    { min: 70, value: 4 },
    { min: 60, value: 2 },
    { min: 55, value: 1 },
    { min: 50, value: 0 },
    { min: 40, value: 0 },
    { min: 30, value: 0 },
    { min: 20, value: 0 },
    { min: 10, value: 0 },
    { min: 0, value: 0 }
  ];
  
  function collectBonuses(actor, key) {
    return actor.items
      .filter(item =>
        item.type === "effect" &&
        item.system.category === "condition" &&
        Array.isArray(item.system.modifiers)
      )
      .flatMap(item => {
        return item.system.modifiers
        .filter(modifier => {
          const type = modifier.type ?? (modifier.appliesTo ? "roll" : "stat");
          const context = modifier.context ?? modifier.appliesTo ?? "";
        
          return type === "stat" && context === "" && modifier.target === key;
        })
          .map(modifier => ({
            label: item.name,
            value: Number(modifier.value) || 0
          }));
      });
  }
  
  export function calculateActorDerived(actor) {
    const attr = actor.system.attributes;
  
    const str = Number(attr.str?.value) || 0;
    const forValue = Number(attr.for?.value) || 0;
    const ref = Number(attr.ref?.value) || 0;
    const fit = Number(attr.fit?.value) || 0;
    const sp = Number(attr.sp?.value) || 0;
  
    const hpRow = HP_BY_FOR.find(row => forValue >= row.min) ?? HP_BY_FOR.at(-1);
  
    const makeDerived = (key, baseLabel, baseValue, options = {}) => {
      return makeStat([
        { label: baseLabel, value: baseValue },
        ...collectBonuses(actor, key)
      ], {
        ...options,
        target: key
      });
    };
  
    const derived = {
      move: makeDerived("move", `fit ${fit}`, fromTable(fit, MOVE_BY_FIT)),
      fpr: makeDerived("fpr", `sp ${sp}`, fromTable(sp, FPR_BY_SP)),
      perception: makeDerived("perception", `ref ${ref}`, fromTable(ref, PERCEPTION_BY_REF)),
      bacc: makeDerived("bacc", `ref ${ref}`, fromTable(ref, BACC_BY_REF)),
      macc: makeDerived("macc", `str ${str}`, fromTable(str, MACC_BY_STR)),
      beff: makeDerived("beff", `ref ${ref}`, fromTable(ref, BEFF_BY_REF), {
        negativeIsGood: true
      }),
      strmod: makeDerived("strmod", `str ${str}`, fromTable(str, STRMOD_BY_STR)),
      fitmod: makeDerived("fitmod", `fit ${fit}`, fromTable(fit, FITMOD_BY_FIT)),
      focusres: makeStat(collectBonuses(actor, "focusres")),
      staminares: makeStat(collectBonuses(actor, "staminares"))
    };
  
    const resources = {
      focus: makeDerived("focus.max", `sp ${sp}`, fromTable(sp, FOCUS_MAX_BY_SP)),
      stamina: makeDerived("stamina.max", `for ${forValue}`, fromTable(forValue, STAMINA_MAX_BY_FOR)),
      blood: makeDerived("blood.max", `for ${forValue}`, fromTable(forValue, BLOOD_MAX_BY_FOR))
    };
  
    const repulse = makeDerived(
      "defense.repulse",
      `str ${str}`,
      fromTable(str, REPULSE_BY_STR),
      { min: 0 }
    );
  
    const defense = {
      head: {
        hp: makeDerived("defense.head.hp", `for ${forValue}`, hpRow.limb),
        repulse
      },
      arms: {
        hp: makeDerived("defense.arms.hp", `for ${forValue}`, hpRow.limb),
        repulse
      },
      torso: {
        hp: makeDerived("defense.torso.hp", `for ${forValue}`, hpRow.torso),
        repulse
      },
      legs: {
        hp: makeDerived("defense.legs.hp", `for ${forValue}`, hpRow.limb),
        repulse
      }
    };
    
    const conditions = {
      poise: {
        value: Number(actor.system.conditions.poise?.value) || 0
      },
    
      fatigue: makeStat([
        {
          label: "fatigue mod",
          value: Number(actor.system.conditions.fatigue?.mod) || 0
        },
        ...collectBonuses(actor, "conditions.fatigue")
      ], {
        target: "conditions.fatigue",
        negativeIsGood: true,
        min: 0
      }),
      
      stress: makeStat([
        {
          label: "stress mod",
          value: Number(actor.system.conditions.stress?.mod) || 0
        },
        ...collectBonuses(actor, "conditions.stress")
      ], {
        target: "conditions.stress",
        negativeIsGood: true,
        min: 0
      })
    }

    return {
      derived,
      resources,
      defense,
      conditions
    };
  }