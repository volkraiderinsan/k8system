// K8 System | Token movement animation speed
//
// Larger battlefield scale benefits from faster token movement animation.
// This defensively wraps Foundry token movement animation methods when present.

const K8_TOKEN_MOVEMENT_SPEED_MULTIPLIER = 3;

function speedUpDuration(options) {
  if (!options || typeof options !== "object") {
    return options;
  }

  if (Number.isFinite(Number(options.duration))) {
    options.duration =
      Math.max(
        1,
        Number(options.duration) / K8_TOKEN_MOVEMENT_SPEED_MULTIPLIER
      );
  }

  if (Number.isFinite(Number(options.animationDuration))) {
    options.animationDuration =
      Math.max(
        1,
        Number(options.animationDuration) / K8_TOKEN_MOVEMENT_SPEED_MULTIPLIER
      );
  }

  return options;
}

function patchMethod(proto, methodName) {
  const original =
    proto?.[methodName];

  if (!(original instanceof Function)) return;
  if (original.k8systemMovementPatched) return;

  const patched =
    function (...args) {
      for (const arg of args) {
        speedUpDuration(arg);
      }

      return original.apply(this, args);
    };

  patched.k8systemMovementPatched = true;

  proto[methodName] = patched;
}

Hooks.once("init", () => {
  const tokenPrototype =
    globalThis.Token?.prototype;

  patchMethod(tokenPrototype, "animate");
  patchMethod(tokenPrototype, "animateMovement");
  patchMethod(tokenPrototype, "_animateMovement");
});
