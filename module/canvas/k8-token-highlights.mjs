// K8 System | Token highlight overlays
//
// Draws hover / controlled / targeted token outlines inside the token bounds.
// This module intentionally keeps the logic isolated from sheets and inventory code.

const K8_TOKEN_HIGHLIGHT_LAYER_NAME = "k8system.tokenHighlights";

const K8_HIGHLIGHT_STYLE = {
  inset: 4,
  radius: 6,

  hover: {
    width: 2,
    color: 0xe0c36a,
    alpha: 0.95
  },

  controlled: {
    width: 2,
    color: 0xf2d36b,
    alpha: 1
  },

  targeted: {
    width: 3,
    color: 0xdd4b39,
    alpha: 1
  }
};

function getTokenHighlightContainer(token) {
  if (!token) return null;

  if (!token.k8systemHighlight) {
    const container = new PIXI.Container();

    container.name = K8_TOKEN_HIGHLIGHT_LAYER_NAME;
    container.eventMode = "none";
    container.interactive = false;
    container.interactiveChildren = false;
    container.sortableChildren = true;
    container.zIndex = 10_000;

    const hover = new PIXI.Graphics();
    hover.name = "k8system.hoverHighlight";

    const controlled = new PIXI.Graphics();
    controlled.name = "k8system.controlledHighlight";

    const targeted = new PIXI.Graphics();
    targeted.name = "k8system.targetedHighlight";

    container.addChild(hover);
    container.addChild(controlled);
    container.addChild(targeted);

    token.k8systemHighlight = {
      container,
      hover,
      controlled,
      targeted
    };

    token.addChild(container);
  }

  return token.k8systemHighlight;
}

function clearNativeTokenBorders(token) {
  // Foundry draws hover/control/target visuals on PIXI Graphics owned by Token.
  // These property names have changed between versions, so every access is defensive.
  const possibleGraphics = [
    token?.border,
    token?.target,
    token?.tooltip?.border
  ];

  for (const graphic of possibleGraphics) {
    if (graphic?.clear instanceof Function) {
      graphic.clear();
    }
  }
}

function drawInsetRect(graphics, token, style, insetExtra = 0) {
  if (!graphics || !token || !style) return;

  const width = Number(token.w) || Number(token.width) || 0;
  const height = Number(token.h) || Number(token.height) || 0;

  if (width <= 0 || height <= 0) return;

  const inset =
    Math.max(
      0,
      Number(K8_HIGHLIGHT_STYLE.inset) + insetExtra
    );

  const rectWidth =
    Math.max(0, width - inset * 2);

  const rectHeight =
    Math.max(0, height - inset * 2);

  if (rectWidth <= 0 || rectHeight <= 0) return;

  graphics
    .lineStyle(
      Number(style.width) || 2,
      Number(style.color) || 0xffffff,
      Number(style.alpha) || 1
    )
    .drawRoundedRect(
      inset,
      inset,
      rectWidth,
      rectHeight,
      Number(K8_HIGHLIGHT_STYLE.radius) || 0
    );
}

function isTokenTargeted(token) {
  if (!token) return false;

  if (token.isTargeted === true) return true;

  const targeted = token.targeted;

  if (targeted instanceof Set) {
    return targeted.size > 0;
  }

  if (Array.isArray(targeted)) {
    return targeted.length > 0;
  }

  return Boolean(targeted);
}

function refreshK8TokenHighlight(token) {
  if (!token) return;

  const highlight =
    getTokenHighlightContainer(token);

  if (!highlight) return;

  clearNativeTokenBorders(token);

  highlight.hover.clear();
  highlight.controlled.clear();
  highlight.targeted.clear();

  const isHovered =
    token.hover === true ||
    canvas?.tokens?.hover === token;

  const isControlled =
    token.controlled === true;

  const isTargeted =
    isTokenTargeted(token);

  if (isHovered) {
    drawInsetRect(
      highlight.hover,
      token,
      K8_HIGHLIGHT_STYLE.hover,
      0
    );
  }

  if (isControlled) {
    drawInsetRect(
      highlight.controlled,
      token,
      K8_HIGHLIGHT_STYLE.controlled,
      2
    );
  }

  if (isTargeted) {
    drawInsetRect(
      highlight.targeted,
      token,
      K8_HIGHLIGHT_STYLE.targeted,
      4
    );
  }
}

function refreshAllK8TokenHighlights() {
  for (const token of canvas?.tokens?.placeables ?? []) {
    refreshK8TokenHighlight(token);
  }
}

Hooks.on("refreshToken", token => {
  refreshK8TokenHighlight(token);
});

Hooks.on("hoverToken", token => {
  refreshK8TokenHighlight(token);
});

Hooks.on("controlToken", token => {
  refreshK8TokenHighlight(token);
});

Hooks.on("targetToken", token => {
  refreshK8TokenHighlight(token);
});

Hooks.on("canvasReady", () => {
  refreshAllK8TokenHighlights();
});
