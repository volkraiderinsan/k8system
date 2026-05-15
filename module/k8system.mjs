import { K8ActorSheet } from "./sheets/actor-sheet.mjs";

Hooks.once("init", async () => {
  console.log("K8 System | Initializing");

  await loadTemplates([
    "systems/k8system/templates/actor/tabs/main.hbs",
    "systems/k8system/templates/actor/tabs/inventory.hbs",
    "systems/k8system/templates/actor/tabs/modifiers.hbs"
  ]);

  foundry.documents.collections.Actors.unregisterSheet(
    "core",
    foundry.appv1.sheets.ActorSheet
  );

  foundry.documents.collections.Actors.registerSheet("k8system", K8ActorSheet, {
    types: ["player", "npc"],
    makeDefault: true,
    label: "K8 System Actor Sheet"
  });
});