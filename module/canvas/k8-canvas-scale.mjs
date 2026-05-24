// K8 System | Canvas UI scale
//
// Token HUD / token status icons / token names are scaled for the 3x3 token baseline.
// Ruler and movement distance labels are intentionally smaller than the main HUD.

const K8_TOKEN_UI_SCALE = 3;
const K8_TOKEN_NAME_SCALE = 2;
const K8_RULER_LABEL_SCALE = 1.5;

function setK8UiScaleVariables() {
  document.documentElement.style.setProperty(
    "--k8-token-ui-scale",
    String(K8_TOKEN_UI_SCALE)
  );

  document.documentElement.style.setProperty(
    "--k8-token-name-scale",
    String(K8_TOKEN_NAME_SCALE)
  );

  document.documentElement.style.setProperty(
    "--k8-ruler-label-scale",
    String(K8_RULER_LABEL_SCALE)
  );
}

function rememberBaseScale(displayObject, key = "k8systemBaseScale") {
  displayObject[key] ??= {
    x: Number(displayObject.scale?.x) || 1,
    y: Number(displayObject.scale?.y) || 1
  };

  return displayObject[key];
}

function setScaled(displayObject, scale, key = "k8systemBaseScale") {
  if (!displayObject?.scale?.set) return;

  const base =
    rememberBaseScale(displayObject, key);

  displayObject.scale.set(
    base.x * scale,
    base.y * scale
  );
}

function isPixiText(displayObject) {
  return (
    typeof displayObject?.text === "string" &&
    displayObject.text.trim().length > 0 &&
    displayObject.scale?.set instanceof Function
  );
}

function scaleRulerLabels(root) {
  if (!root?.children) return;

  const stack = [...root.children];

  while (stack.length > 0) {
    const child = stack.pop();

    if (!child) continue;

    if (isPixiText(child)) {
      // This layer is mostly transient ruler/movement text.
      setScaled(
        child,
        K8_RULER_LABEL_SCALE,
        "k8systemRulerBaseScale"
      );
    }

    if (child.children?.length) {
      stack.push(...child.children);
    }
  }
}

function scaleTokenName(token) {
  const expected =
    token?.document?.name ?? token?.name;

  if (!expected || !token?.children) return;

  const stack = [...token.children];

  while (stack.length > 0) {
    const child = stack.pop();

    if (!child) continue;

    if (
      isPixiText(child) &&
      child.text === expected
    ) {
      setScaled(
        child,
        K8_TOKEN_NAME_SCALE,
        "k8systemNameBaseScale"
      );
    }

    if (child.children?.length) {
      stack.push(...child.children);
    }
  }
}

function scaleTokenEffects(token) {
  const effects =
    token?.effects ??
    token?.effectsContainer ??
    token?.statusEffects;

  if (!effects) return;

  setScaled(
    effects,
    K8_TOKEN_UI_SCALE,
    "k8systemEffectsBaseScale"
  );
}

function refreshTokenUiScale(token) {
  scaleTokenName(token);
  scaleTokenEffects(token);
}

function refreshAllTokenUiScale() {
  for (const token of canvas?.tokens?.placeables ?? []) {
    refreshTokenUiScale(token);
  }
}

function refreshK8CanvasScale() {
  setK8UiScaleVariables();

  scaleRulerLabels(canvas?.controls);
  scaleRulerLabels(canvas?.interface);
  refreshAllTokenUiScale();
}

Hooks.once("init", () => {
  setK8UiScaleVariables();
});

Hooks.on("canvasReady", () => {
  refreshK8CanvasScale();

  if (globalThis.k8CanvasScaleTickerAttached) return;

  globalThis.k8CanvasScaleTickerAttached = true;

  canvas?.app?.ticker?.add(() => {
    scaleRulerLabels(canvas?.controls);
    scaleRulerLabels(canvas?.interface);
  });
});

Hooks.on("refreshToken", token => {
  refreshTokenUiScale(token);
});

Hooks.on("drawToken", token => {
  refreshTokenUiScale(token);
});

Hooks.on("canvasPan", () => {
  refreshK8CanvasScale();
});

Hooks.on("highlightObjects", () => {
  refreshK8CanvasScale();
});
