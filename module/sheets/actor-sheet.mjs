import { rollAttributeCheck } from "../rolls/k8-rolls.mjs";
import { calculateActorDerived } from "../system/actor-derived.mjs";
import { closeK8WindowsByClass } from "../utils/k8-window-utils.mjs";

const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

const DEFAULT_ACTOR_IMAGE = "icons/svg/mystery-man.svg";

function isRealImage(path) {
  return Boolean(path) && path !== DEFAULT_ACTOR_IMAGE && !path.includes("mystery-man");
}

export class K8ActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
    static DEFAULT_OPTIONS = {
        tag: "form",
      
        classes: ["k8system", "sheet", "actor", "k8-actor-sheet-app"],
      
        position: {
          width: 900,
          height: 760
        },
      
        window: {
          resizable: true
        },
      
        form: {
          handler: async function (event, form, formData) {
            event.preventDefault();
            await this.document.update(formData.object);
            await this.render(true);
          },
          submitOnChange: true,
          closeOnSubmit: false
        }
      };

      static PARTS = {
        form: {
          template: "systems/k8system/templates/actor/actor-sheet.hbs"
        }
      };
      
      get title() {
        return this.actor.name || "Unnamed Actor";
      }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const calculated = calculateActorDerived(this.actor);

    context.actor = this.actor;
    context.system = this.actor.system;
    context.items = this.actor.items;

    context.derived = calculated.derived;
    context.calculatedResources = calculated.resources;
    context.calculatedDefense = calculated.defense;
    context.calculatedConditions = calculated.conditions;

    context.genderOptions = {
      male: "Male",
      female: "Female"
    };

    context.portraitMode = this.actor.getFlag("k8system", "portraitMode") ?? "token";
    context.isArtMode = context.portraitMode === "art";

    const tokenArtwork = this.actor.getFlag("k8system", "tokenArtwork") || "";
    const characterArt = this.actor.img || "";

    context.hasPortraitImage = isRealImage(tokenArtwork);
    context.hasFullArtImage = isRealImage(characterArt);

    context.displayImage = context.isArtMode
      ? context.hasFullArtImage ? characterArt : DEFAULT_ACTOR_IMAGE
      : context.hasPortraitImage ? tokenArtwork : DEFAULT_ACTOR_IMAGE;

    context.showImageLabel = context.isArtMode
      ? !context.hasFullArtImage
      : !context.hasPortraitImage;

    context.backgroundArt = context.hasFullArtImage ? characterArt : "";

    context.activeTab = this.actor.getFlag("k8system", "activeTab") ?? "main";

    context.isMainTab = context.activeTab === "main";
    context.isInventoryTab = context.activeTab === "inventory";
    context.isModifiersTab = context.activeTab === "modifiers";

    const conditionEffects = this.actor.items.filter(item =>
      item.type === "effect" &&
      item.system.category === "condition"
    );
    
    const prepareCondition = item => {
      const duration = item.system.duration ?? {};
      const unit = duration.unit;
      const remaining = Number(duration.remaining) || 0;
    
      let durationLabel = "";

      if (unit !== "permanent") {
        durationLabel = remaining > 0 ? `${remaining} ${unit}` : "expired";
      }
    
      const severity = Number(item.system.severity) || 0;

      return {
        id: item.id,
        name: severity > 0 ? `${item.name} (${severity})` : item.name,
        durationLabel
      };
    };
    
    context.positiveConditions = conditionEffects
    .filter(item => item.system.polarity === "positive")
    .reverse()
    .map(prepareCondition);
  
  context.negativeConditions = conditionEffects
    .filter(item => item.system.polarity === "negative")
    .reverse()
    .map(prepareCondition);
    
    return context;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const genderSelect = this.element.querySelector('select[name="system.identity.gender"]');
    if (genderSelect) {
      genderSelect.addEventListener("change", async () => {
        await this.actor.update({ "system.identity.gender": genderSelect.value });
        await this.render(true);
      });
    }

    const portrait = this.element.querySelector(".k8-portrait-image");
    if (portrait) {
      portrait.addEventListener("click", async () => {
        const mode = this.actor.getFlag("k8system", "portraitMode") ?? "token";

        const current = mode === "art"
          ? this.actor.img || DEFAULT_ACTOR_IMAGE
          : this.actor.getFlag("k8system", "tokenArtwork") || DEFAULT_ACTOR_IMAGE;

        new FilePicker({
          type: "image",
          current,
          callback: async path => {
            if (!path) return;

            if (mode === "art") {
              await this.actor.update({ img: path });
            } else {
              await this.actor.setFlag("k8system", "tokenArtwork", path);
              await this.actor.update({ "prototypeToken.texture.src": path });
            }

            await this.render(true);
          }
        }).browse();
      });
    }

    const toggle = this.element.querySelector(".k8-portrait-toggle");
    if (toggle) {
      toggle.addEventListener("click", async event => {
        event.preventDefault();

        const current = this.actor.getFlag("k8system", "portraitMode") ?? "token";
        const next = current === "token" ? "art" : "token";

        await this.actor.setFlag("k8system", "portraitMode", next);
        await this.render(true);
      });
    }
    const tabButtons = this.element.querySelectorAll(".k8-tab-button");

    for (const button of tabButtons) {
      button.addEventListener("click", async event => {
        event.preventDefault();
    
        const tab = button.dataset.tab;
        if (!tab) return;
    
        await this.actor.setFlag("k8system", "activeTab", tab);
        await this.render(true);
      });
    }

    const attributeRollButtons = this.element.querySelectorAll(".k8-attribute-roll");

    for (const button of attributeRollButtons) {
      button.addEventListener("click", async event => {
        event.preventDefault();

        const attribute = button.dataset.attribute;
        if (!attribute) return;

        await rollAttributeCheck(this.actor, attribute);
      });
    }
    
    const addConditionButtons = this.element.querySelectorAll(".k8-condition-add");

    for (const button of addConditionButtons) {
      button.addEventListener("click", async event => {
        event.preventDefault();
    
        const polarity = button.dataset.polarity;
        if (!["positive", "negative"].includes(polarity)) return;
    
        if (ui.windows.k8AddConditionDialog) {
          ui.windows.k8AddConditionDialog.bringToFront();
          return;
        }
        
        await closeK8WindowsByClass("k8-add-condition-window");

        const choice = await foundry.applications.api.DialogV2.wait({
          window: {
            title: "Add Condition"
          },
        
          classes: ["k8system", "k8-add-condition-window"],
        
          content: ``,
        
          buttons: [
            {
              action: "compendium",
              label: "Compendium",
              callback: () => "compendium"
            },
            {
              action: "custom",
              label: "Custom",
              default: true,
              callback: () => "custom"
            }
          ],
        
          rejectClose: false
        });
        
        if (choice === "compendium") {
          const pack = game.packs.get("k8system.conditions");
        
          if (!pack) {
            ui.notifications.error("Conditions compendium not found.");
            return;
          }
        
          pack.render(true);
          return;
        }
        
        if (choice === "custom") {
          const [effect] = await this.actor.createEmbeddedDocuments("Item", [
            {
              name: polarity === "positive"
                ? "New Positive Condition"
                : "New Negative Condition",
        
              type: "effect",
              img: "icons/svg/aura.svg",
        
              system: {
                category: "condition",
                polarity,
                severity: 0,
        
                duration: {
                  value: 0,
                  unit: "permanent",
                  remaining: 0
                },
        
                modifiers: []
              }
            }
          ]);
        
          await this.render(true);

          effect.sheet.setEditMode?.(true);
          await effect.sheet.render(true, { focus: true });
          effect.sheet.bringToFront?.();
        }
      });
    }
    
    const conditionEntries = this.element.querySelectorAll(".k8-condition-entry");
    
    for (const entry of conditionEntries) {
      entry.addEventListener("click", async event => {
        event.preventDefault();
    
        const itemId = entry.dataset.itemId;
        if (!itemId) return;
    
        const item = this.actor.items.get(itemId);
        if (!item) return;
        
        item.sheet.setEditMode?.(event.shiftKey);
        await item.sheet.render(true, { focus: true });
        item.sheet.bringToFront?.();
      });
    }
    
    const deleteConditionButtons = this.element.querySelectorAll(".k8-condition-delete");
    
    for (const button of deleteConditionButtons) {
      button.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();
    
        const itemId = button.dataset.itemId;
        if (!itemId) return;
    
        const item = this.actor.items.get(itemId);
        if (!item) return;
    
        await item.delete();
        await this.render(true);
      });
    }

    const conditionColumns = this.element.querySelectorAll(".k8-condition-column");

    for (const column of conditionColumns) {
      column.addEventListener("dragover", event => {
        event.preventDefault();
        column.classList.add("drag-hover");
      });

      column.addEventListener("dragleave", () => {
        column.classList.remove("drag-hover");
      });

      column.addEventListener("drop", async event => {
        event.stopPropagation();
        event.preventDefault();
        column.classList.remove("drag-hover");

        const expectedPolarity = column.dataset.dropPolarity;
        if (!expectedPolarity) return;

        const dataText = event.dataTransfer.getData("text/plain");
        if (!dataText) return;

        let data;
        try {
          data = JSON.parse(dataText);
        } catch {
          return;
        }

        const droppedItem = await Item.implementation.fromDropData(data);
        if (!droppedItem) return;

        if (droppedItem.type !== "effect") {
          ui.notifications.warn("Only effects can be added as conditions.");
          return;
        }

        if (droppedItem.system.category !== "condition") {
          ui.notifications.warn("Only condition effects can be added here.");
          return;
        }

        if (droppedItem.system.polarity !== expectedPolarity) {
          ui.notifications.warn("This condition belongs to the other list.");
          return;
        }

        const itemData = droppedItem.toObject();

        delete itemData._id;

        await this.actor.createEmbeddedDocuments("Item", [itemData]);
        await this.render(true);
      });
    }
  }
}