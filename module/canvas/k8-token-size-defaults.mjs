const K8_DEFAULT_TOKEN_SIZE = 3;

function isK8SizedActor(actor) {
  return ["player", "npc"].includes(actor?.type);
}

function applyDefaultSize(updateData) {
  updateData["prototypeToken.width"] =
    K8_DEFAULT_TOKEN_SIZE;

  updateData["prototypeToken.height"] =
    K8_DEFAULT_TOKEN_SIZE;
}

Hooks.on("preCreateActor", (actor, data) => {
  if (!isK8SizedActor(actor)) return;

  const width =
    Number(data?.prototypeToken?.width) || 1;

  const height =
    Number(data?.prototypeToken?.height) || 1;

  if (width !== 1 || height !== 1) return;

  applyDefaultSize(data);
});
