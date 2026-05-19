import { closeK8WindowsByClass } from "../utils/k8-window-utils.mjs";
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
  
  function countDegrees(roll, target, success) {
    if (success) {
      return Math.floor((target - roll) / 10) + 1;
    }
  
    return Math.floor((roll - target - 1) / 10) + 1;
  }
  
  function signed(value) {
    return value >= 0 ? `+${value}` : `${value}`;
  }
  
  export async function rollAttributeCheck(actor, attributeKey) {
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
    
    await closeK8WindowsByClass("k8-attribute-check-window");

    const dialogResult = await foundry.applications.api.DialogV2.wait({
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
  
    if (!dialogResult) return;
  
    const manualModifier = dialogResult.manualModifier;
    const target = baseTarget + modifierTotal + manualModifier;
    const totalFatigue = fatigue + fatigueModifierTotal;
    const dieSize = Math.max(1, 100 + totalFatigue);
    const formula = `1d${dieSize}`;
  
    const roll = await new Roll(formula).evaluate();
    const rollTotal = roll.total;
  
    const success = rollTotal <= target;
    const degrees = countDegrees(rollTotal, target, success);
  
    let stress = null;
  
    if (dialogResult.includeStress) {
      const sp = Number(actor.system.attributes?.sp?.value) || 0;
      const stressValue = Number(calculated.conditions?.stress?.value) || 0;
      const equ = Number(actor.system.equ) || 1;
  
      const stressDie = Math.max(1, sp * equ);
      const stressFormula = `1d${stressDie}`;
      const stressRoll = await new Roll(stressFormula).evaluate();
  
      stress = {
        formula: stressFormula,
        rollTotal: stressRoll.total,
        target: stressValue,
        success: stressRoll.total >= stressValue
      };
    }
  
    const cardContent = await foundry.applications.handlebars.renderTemplate(
      "systems/k8system/templates/rolls/attribute-check-card.hbs",
      {
        title: `${label} Check`,
        actorName: actor.name,
        actorImage: actor.getFlag("k8system", "tokenArtwork") || actor.img,
        formula,
        rollTotal,
        target,
        fatigue: totalFatigue,
        manualModifier,
        success,
        degrees,
        degreesLabel: `${degrees} ${success ? "success" : "failure"}${degrees === 1 ? "" : "s"}`,
        stress
      }
    );
  
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: cardContent,
      rolls: stress ? [roll, await new Roll(stress.formula).evaluate()] : [roll]
    });
  }