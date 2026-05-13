import { K8ActorSheet } from "./sheets/actor-sheet.mjs";

Hooks.once("init", async function () {
  console.log("K8 System | Initializing");

  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("k8system", K8ActorSheet, {
    types: ["player", "npc"],
    makeDefault: true
  });
});