export const K8_MODIFIER_COLORS = {
    positive: "rgb(0, 232, 220)",
    negative: "rgb(232, 89, 0)"
  };
  
  const NEGATIVE_IS_GOOD_TARGETS = new Set([
    "beff",
    "conditions.fatigue",
    "conditions.stress"
  ]);
  
  export function isK8NegativeGoodTarget(target) {
    return NEGATIVE_IS_GOOD_TARGETS.has(target);
  }
  
  export function getK8ModifierPolarity(target, value) {
    const numeric = Number(value) || 0;
  
    if (isK8NegativeGoodTarget(target)) {
      return numeric <= 0 ? "positive" : "negative";
    }
  
    return numeric >= 0 ? "positive" : "negative";
  }
  
  export function getK8ModifierColor(target, value) {
    return K8_MODIFIER_COLORS[getK8ModifierPolarity(target, value)];
  }