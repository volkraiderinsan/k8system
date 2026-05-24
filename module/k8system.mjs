import "./canvas/k8-token-size-defaults.mjs";
import "./canvas/k8-canvas-zoom.mjs";
import "./canvas/k8-canvas-scale.mjs";
import "./canvas/k8-token-movement-speed.mjs";
import "./canvas/k8-token-highlights.mjs";
import { K8ActorSheet } from "./sheets/actor-sheet.mjs";
import { K8EffectSheet } from "./sheets/effect-sheet.mjs";
import { rollAttributeCheck } from "./rolls/k8-rolls.mjs";
import { K8ItemSheet } from "./sheets/item-sheet.mjs";
import { K8DiscardPileSheet } from "./sheets/discard-pile-sheet.mjs";

Hooks.once("init", async () => {
  console.log("K8 System | Initializing");

  game.settings.register("k8system", "discardPile", {
    scope: "world",
    config: false,
    type: Object,
    default: {
      width: 6,
      height: 6,
      items: []
    }
  });

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

  foundry.documents.collections.Items.registerSheet("k8system", K8ItemSheet, {
    types: ["weapon", "armor", "gear", "attachment", "consumable", "misc", "talent"],
    makeDefault: true,
    label: "K8 Item Sheet"
  });

});

Hooks.on("renderChatMessageHTML", (message, html, context) => {
  const rollCard = html.querySelector(".k8-chat-roll-card");

  if (rollCard) {
    const actorUuid = rollCard.dataset.actorUuid;

    if (actorUuid) {
      fromUuid(actorUuid).then(actor => {
        if (!actor) return;

        const sender = html.querySelector(".message-sender");
        if (!sender) return;

        if (sender.querySelector(".k8-chat-portrait")) return;

        const portrait = document.createElement("img");

        portrait.classList.add("k8-chat-portrait");

        portrait.src =
          actor.getFlag("k8system", "tokenArtwork") ||
          actor.img ||
          "icons/svg/mystery-man.svg";

        portrait.alt = actor.name;

        sender.prepend(portrait);
      });
    }
  }
  const repeatButtons = html.querySelectorAll(".k8-roll-repeat");

  for (const button of repeatButtons) {
    button.addEventListener("click", async event => {
      event.preventDefault();

      const card = button.closest(".k8-chat-roll-card");
      if (!card) return;

      if (card.dataset.k8CardType !== "attribute-check") return;

      const actorUuid = card.dataset.actorUuid;
      const attributeKey = card.dataset.attributeKey;

      if (!actorUuid || !attributeKey) return;

      const actor = await fromUuid(actorUuid);

      if (!actor) {
        ui.notifications.warn("Actor not found.");
        return;
      }

      if (!actor.isOwner) {
        ui.notifications.warn("You do not have permission to roll for this actor.");
        return;
      }

      await rollAttributeCheck(actor, attributeKey, {
        skipDialog: true,
        manualModifier: Number(card.dataset.manualModifier) || 0,
        includeStress: card.dataset.includeStress === "true"
      });
    });
  }
});