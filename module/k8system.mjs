import { K8ActorSheet } from "./sheets/actor-sheet.mjs";
import { K8EffectSheet } from "./sheets/effect-sheet.mjs";

Hooks.once("init", async () => {
  console.log("K8 System | Initializing");

  await foundry.applications.handlebars.loadTemplates([
    "systems/k8system/templates/actor/tabs/main.hbs",
    "systems/k8system/templates/actor/tabs/inventory.hbs",
    "systems/k8system/templates/actor/tabs/modifiers.hbs",
    "systems/k8system/templates/rolls/attribute-check-dialog.hbs",
    "systems/k8system/templates/rolls/attribute-check-card.hbs"
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

  foundry.documents.collections.Items.unregisterSheet(
    "core",
    foundry.appv1.sheets.ItemSheet
  );

  foundry.documents.collections.Items.registerSheet("k8system", K8EffectSheet, {
    types: ["effect"],
    makeDefault: true,
    label: "K8 Effect Sheet"
  });
});