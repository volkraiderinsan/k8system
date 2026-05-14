import { K8ActorSheet } from "./sheets/actor-sheet.mjs";

Hooks.once("init", () => {
  console.log("K8 System | Initializing");

  foundry.documents.collections.Actors.unregisterSheet("core", foundry.appv1.sheets.ActorSheet);

  foundry.documents.collections.Actors.registerSheet("k8system", K8ActorSheet, {
    types: ["player", "npc"],
    makeDefault: true,
    label: "K8 System Actor Sheet"
  });
});