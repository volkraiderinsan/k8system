import { waitK8SingletonDialog } from "../utils/k8-window-utils.mjs";
import { getK8ModifierPolarity } from "../system/k8-modifier-style.mjs";
import { calculateActorDerived } from "../system/actor-derived.mjs";
import {
  resolveActorCheckModifiers,
  resolveActorRollStatModifiers
} from "../system/k8-modifier-resolver.mjs";

const ATTRIBUTE_LABELS = {
  str: "Strength",
  for: "Fortitude",
  ref: "Reflex",
  fit: "Fitness",
  sp: "Spirit"
};

const ATTRIBUTE_ICONS = {
  str: "/systems/k8system/images/attributes/str.png",
  for: "/systems/k8system/images/attributes/for.png",
  ref: "/systems/k8system/images/attributes/ref.png",
  fit: "/systems/k8system/images/attributes/fit.png",
  sp: "/systems/k8system/images/attributes/sp.png"
};

const DEFAULT_ACTOR_IMAGE = "icons/svg/mystery-man.svg";

function countDegrees(roll, target, success) {
  if (success) {
    return Math.floor((target - roll) / 10) + 1;
  }

  return Math.floor((roll - target - 1) / 10) + 1;
}

function signed(value) {
  return value >= 0 ? `+${value}` : `${value}`;
}

function isCriticalSuccess(rollTotal) {
  return rollTotal >= 1 && rollTotal <= 5;
}

function resolveMainOutcome({ rollTotal, target, stress }) {
  const rawSuccess = rollTotal <= target;
  const rawDegrees = countDegrees(rollTotal, target, rawSuccess);

  const criticalSuccess = isCriticalSuccess(rollTotal);

  let success = rawSuccess;
  let baseDegrees = rawDegrees;
  let criticalBonus = 0;

  if (criticalSuccess) {
    success = true;
    baseDegrees = rawSuccess ? rawDegrees : 1;
    criticalBonus = 3;
  }

  let degrees = baseDegrees + criticalBonus;
  let degreeText = criticalBonus > 0
    ? `${baseDegrees}+${criticalBonus}`
    : `${degrees}`;

  let rollCanceledByStress = false;
  let critCanceledByStress = false;
  let stressCanceledByCrit = false;

  if (stress && stress.success === false && success === true) {
    if (criticalSuccess) {
      success = true;
      degrees = baseDegrees;
      degreeText = `${baseDegrees}`;
    
      critCanceledByStress = true;
      stressCanceledByCrit = true;
    } else {
      success = false;
      degrees = 1;
      degreeText = "1";

      rollCanceledByStress = true;
    }
  }

  return {
    rawSuccess,
    rawDegrees,

    success,
    degrees,
    degreeText,

    criticalSuccess,
    criticalBonus,

    showCriticalIcon: criticalSuccess,
    criticalPolarityClass: criticalSuccess ? "success" : "",

    rollCanceledByStress,
    critCanceledByStress,
    stressCanceledByCrit
  };
}

export async function rollAttributeCheck(actor, attributeKey, options = {}) {
  const calculated = calculateActorDerived(actor);
  const attribute = actor.system.attributes?.[attributeKey];

  if (!attribute) {
    ui.notifications.warn(`Unknown attribute: ${attributeKey}`);
    return;
  }

  const label = ATTRIBUTE_LABELS[attributeKey] ?? attributeKey.toUpperCase();
  const icon = ATTRIBUTE_ICONS[attributeKey] ?? "/systems/k8system/images/rolldice.png";

  const baseTarget = Number(attribute.value) || 0;
  const fatigue = Number(calculated.conditions?.fatigue?.value) || 0;

  const checkPath = `checks.attribute.${attributeKey}`;
  const checkModifiers = resolveActorCheckModifiers(actor, checkPath);

  const fatigueModifiers = resolveActorRollStatModifiers(
    actor,
    checkPath,
    "conditions.fatigue"
  );

  const fatigueModifierTotal = fatigueModifiers.reduce((total, modifier) => {
    return total + modifier.value;
  }, 0);

  const modifierTotal = checkModifiers.reduce((total, modifier) => {
    return total + modifier.value;
  }, 0);

  let dialogResult = null;

  if (options.skipDialog === true) {
    dialogResult = {
      manualModifier: Number(options.manualModifier) || 0,
      includeStress: options.includeStress === true
    };
  } else {
    const dialogContent = await foundry.applications.handlebars.renderTemplate(
      "systems/k8system/templates/rolls/attribute-check-dialog.hbs",
      {
        title: `${label} Check`,
        icon,
        attributeLabel: label,
        baseTarget,
        includeStressDefault: true,
        modifiers: [
          ...checkModifiers.map(modifier => ({
            label: modifier.sourceName,
            value: modifier.value,
            signedValue: signed(modifier.value),
            polarityClass: getK8ModifierPolarity("roll", modifier.value)
          })),

          ...fatigueModifiers.map(modifier => ({
            label: `${modifier.sourceName} / Fatigue`,
            value: modifier.value,
            signedValue: signed(modifier.value),
            polarityClass: getK8ModifierPolarity("conditions.fatigue", modifier.value)
          }))
        ]
      }
    );

    dialogResult = await waitK8SingletonDialog("attribute-check", {
      window: {
        title: `${label} Check`
      },

      classes: ["k8system", "k8-attribute-check-window"],

      content: dialogContent,

      buttons: [
        {
          action: "roll",
          label: "Roll",

          callback: (event, button, dialog) => {
            const form = dialog.element.querySelector("form");

            return {
              manualModifier: Number(form.manualModifier.value) || 0,
              includeStress: form.includeStress.checked
            };
          }
        }
      ],

      rejectClose: false
    });
  }

  if (!dialogResult) return;

  const manualModifier = Number(dialogResult.manualModifier) || 0;
  const targetModifierTotal = modifierTotal + manualModifier;
  const target = baseTarget + targetModifierTotal;

  const totalFatigue = fatigue + fatigueModifierTotal;
  const dieSize = Math.max(1, 100 + totalFatigue);
  const formula = `1d${dieSize}`;

  const roll = await new Roll(formula).evaluate();
  const rollTotal = roll.total;

  let stress = null;
  let stressRoll = null;

  if (dialogResult.includeStress) {
    const sp = Number(actor.system.attributes?.sp?.value) || 0;
    const stressValue = Number(calculated.conditions?.stress?.value) || 0;
    const equ = Number(actor.system.equ) || 1;

    const stressDie = Math.max(1, sp * equ);
    const stressFormula = `1d${stressDie}`;

    stressRoll = await new Roll(stressFormula).evaluate();

    stress = {
      formula: stressFormula,
      rollTotal: stressRoll.total,
      target: stressValue,
      success: stressRoll.total >= stressValue
    };
  }

  const outcome = resolveMainOutcome({
    rollTotal,
    target,
    stress
  });

  if (stress) {
    stress.canceledByCrit = outcome.stressCanceledByCrit;
  }

  const actorImage =
    actor.getFlag("k8system", "tokenArtwork") ||
    actor.img ||
    DEFAULT_ACTOR_IMAGE;

  const cardContent = await foundry.applications.handlebars.renderTemplate(
    "systems/k8system/templates/rolls/attribute-check-card.hbs",
    {
      title: `${label} Check`,
      actorUuid: actor.uuid,
      actorName: actor.name,
      actorImage,

      attributeKey,
      attributeLabel: label,
      attributeIcon: icon,

      formula,
      rollTotal,
      target,
      fatigue: totalFatigue,
      manualModifier,
      targetModifierSigned: signed(targetModifierTotal),
      includeStress: Boolean(dialogResult.includeStress),

      success: outcome.success,
      degrees: outcome.degrees,
      degreeText: outcome.degreeText,
      degreesLabel: `${outcome.degrees} ${outcome.success ? "success" : "failure"}${outcome.degrees === 1 ? "" : "s"}`,

      showCriticalIcon: outcome.showCriticalIcon,
      criticalPolarityClass: outcome.criticalPolarityClass,
      critCanceledByStress: outcome.critCanceledByStress,
      rollCanceledByStress: outcome.rollCanceledByStress,

      stress
    }
  );

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: cardContent,
    rolls: stressRoll ? [roll, stressRoll] : [roll]
  });
}