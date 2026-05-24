// K8 System | Canvas zoom limits
//
// Human-sized tokens are 3x3, so the scene must support stronger zoom-out.
// Zoom-in is capped to avoid oversized close camera.

const K8_CANVAS_MIN_ZOOM = 0.025;
const K8_CANVAS_MAX_ZOOM = 1.2;

function setObjectPath(root, path, value) {
  const parts = path.split(".");
  let obj = root;

  while (parts.length > 1) {
    const key = parts.shift();
    obj[key] ??= {};
    obj = obj[key];
  }

  obj[parts[0]] = value;
}

function applyK8CanvasZoomLimits() {
  CONFIG.Canvas ??= {};

  CONFIG.Canvas.minZoom =
    Math.min(
      Number(CONFIG.Canvas.minZoom) || 0.1,
      K8_CANVAS_MIN_ZOOM
    );

  CONFIG.Canvas.maxZoom =
    Math.min(
      Number(CONFIG.Canvas.maxZoom) || 3,
      K8_CANVAS_MAX_ZOOM
    );

  // Several Foundry builds/modules read zoom limits from different places.
  setObjectPath(CONFIG, "Canvas.zoom.min", CONFIG.Canvas.minZoom);
  setObjectPath(CONFIG, "Canvas.zoom.max", CONFIG.Canvas.maxZoom);

  if (canvas?.stage?.scale) {
    const current =
      Number(canvas.stage.scale.x) || 1;

    const clamped =
      Math.clamp
        ? Math.clamp(current, CONFIG.Canvas.minZoom, CONFIG.Canvas.maxZoom)
        : Math.max(CONFIG.Canvas.minZoom, Math.min(CONFIG.Canvas.maxZoom, current));

    if (clamped !== current) {
      canvas.stage.scale.set(clamped);
    }
  }
}

Hooks.once("init", () => {
  applyK8CanvasZoomLimits();
});

Hooks.on("canvasReady", () => {
  applyK8CanvasZoomLimits();
});

Hooks.on("canvasPan", () => {
  applyK8CanvasZoomLimits();
});
