import { rollAttributeCheck } from "../rolls/k8-rolls.mjs";
import { calculateActorDerived } from "../system/actor-derived.mjs";
import { waitK8SingletonDialog } from "../utils/k8-window-utils.mjs";
import { K8ContainerSheet } from "./container-sheet.mjs";
import { k8FloatingText } from "../utils/k8-floating-text.mjs";
import { K8DiscardPileSheet } from "./discard-pile-sheet.mjs";
import {
  removeItemFromDiscardPileAndReturn
} from "../utils/discard-pile.mjs";
import { addItemToDiscardPile } from "../utils/discard-pile.mjs";
import {
  isItemValidForSlot,
  smartPlaceIntoInventory,
  getEquippedItemBySlot,
  prepareDynamicSlots,
  normalizeSocialSlots,
  findBestEquipSlot,
  equipItemToSlot,
  createUnequippedItemData,
  equipItemDataToActor,
  equipContainerItemDataToActor,
  equipDroppedDataToSlot,
  reconcileDynamicSlots,
  calculateStackMerge,
  performStackSplit,
  performInventoryDrop,
  performInventoryHalfSplit,
  promptAdvancedStackSplitQuantity,
  stackSplitSourceFromDropData,
  getStackSplitSourceItemData,
  getInventorySourceItemData,
  inventorySourceFromDropData,
  getItemQuantity,
  getItemStackMax
} from "../system/inventory-rules.mjs";

const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

const DEFAULT_ACTOR_IMAGE = "icons/svg/mystery-man.svg";

function isRealImage(path) {
  return Boolean(path) && path !== DEFAULT_ACTOR_IMAGE && !path.includes("mystery-man");
}

const K8_BASE_EQUIPMENT_SLOTS = [
  { key: "head", label: "Head", accepts: "Helmets" },
  { key: "torso", label: "Torso", accepts: "Vests" },
  { key: "arms", label: "Arms", accepts: "Arm protection" },
  { key: "legs", label: "Legs", accepts: "Leg protection" },
  { key: "outfit", label: "Outfit", accepts: "Clothes" },
  { key: "back", label: "Back", accepts: "Backpacks / Heavy gear" },
  { key: "battery", label: "Battery", accepts: "Power cells" },
  { key: "shoulder-1", label: "Shoulder", accepts: "1x2 / 1x3 weapons" },
  { key: "shoulder-2", label: "Shoulder", accepts: "1x2 / 1x3 weapons" },
];

function prepareEquipmentSlot(actor, slot) {
  const item = getEquippedItemBySlot(actor, slot.key);

  return {
    ...slot,
    item: item
      ? {
          id: item.id,
          name: item.name,
          img: item.img,
          type: item.type,
          quantity: Number(item.system?.quantity) || 1,
          stackMax: Number(item.system?.stack?.max) || 1,
          system: item.system
        }
      : null
  };
}


export class K8ActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static openSheets = new Set();

  get actor() {
    return this.document;
  }

  constructor(...args) {
    super(...args);
}

async close(options = {}) {
  K8ActorSheet.openSheets.delete(this);
  return super.close(options);
}
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
    
    const extraShoulderSlots =
    Number(this.actor.system?.equipment?.extraShoulderSlots) || 0;

    const visibleEquipmentSlots = [...K8_BASE_EQUIPMENT_SLOTS];

    for (let i = 0; i < extraShoulderSlots; i++) {
      const shoulderIndex = i + 3;

      visibleEquipmentSlots.push({
        key: `shoulder-${shoulderIndex}`,
        label: `Shoulder ${shoulderIndex}`,
        accepts: "1x2 / 1x3 weapons"
      });
    }

    context.equipmentSlots = visibleEquipmentSlots.map(slot =>
      prepareEquipmentSlot(this.actor, slot)
    );

    context.dynamicEquipmentSlots = prepareDynamicSlots(this.actor);

    context.inventoryItems = this.actor.items
      .filter(item => item.type !== "effect")
      .filter(item => item.system?.equipment?.equipped !== true)
      .map(item => ({
        id: item.id,
        name: item.name,
        img: item.img,
        type: item.type,
        width: Number(item.system?.inventory?.width) || 1,
        height: Number(item.system?.inventory?.height) || 1,
        quantity: Number(item.system?.quantity) || 1,
        stackMax: Number(item.system?.stack?.max) || 1
      }));
    
      context.discardPileCount =
      game.settings.get("k8system", "discardPile")?.items?.length ?? 0;

    return context;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    K8ActorSheet.openSheets.add(this);

    const debugInventoryToggle = this.element.querySelector(".k8-debug-inventory-toggle");
    const debugInventory = this.element.querySelector(".k8-dev-inventory");

    debugInventoryToggle?.addEventListener("click", event => {
      event.preventDefault();
      debugInventory?.classList.toggle("hidden");
    });

    const discardButton = this.element.querySelector(".k8-discard-pile-button");

    discardButton?.addEventListener("click", event => {
      event.preventDefault();
      new K8DiscardPileSheet().render(true);
    });

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
        
        const choice = await waitK8SingletonDialog("add-condition", {
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

        await normalizeSocialSlots(this.actor);

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

    const draggableItems = this.element.querySelectorAll(".k8-draggable-item");

    const actorInventory =
      this.element.querySelector(".k8-dev-inventory");

    actorInventory?.addEventListener("click", async event => {
      if (!event.shiftKey) return;

      const itemElement =
        event.target.closest(".k8-dev-item.k8-draggable-item");

      if (!itemElement) return;

      event.preventDefault();
      event.stopPropagation();

      const itemId = itemElement.dataset.itemId;
      if (!itemId) return;

      const source = {
        type: "actorItem",
        actor: this.actor,
        itemId
      };

      const sourceItemData =
        await getInventorySourceItemData(source);

      if (!sourceItemData) return;

      const result =
        await performInventoryHalfSplit({
          source,
          target: {
            type: "actorInventory",
            actor: this.actor
          }
        });

      if (!result.ok) {
        k8FloatingText(event, result.message, "warn");
        return;
      }

      await this.render(true);

      k8FloatingText(
        event,
        `${sourceItemData.name} split.`,
        "status"
      );
    });

    actorInventory?.addEventListener("dragover", event => {
      if (!globalThis.k8DragItem?.advancedSplit) return;
      event.preventDefault();
    });

    actorInventory?.addEventListener("drop", async event => {
      const dataText =
        event.dataTransfer.getData("text/plain");

      if (!dataText) return;

      let data;

      try {
        data = JSON.parse(dataText);
      } catch {
        return;
      }

      if (!data.advancedSplit) return;

      event.preventDefault();
      event.stopPropagation();

      const source =
        await getInventorySourceItemData(
          await inventorySourceFromDropData(data, this.actor)
        );

      if (!source) return;

      const splitQuantity =
        await promptAdvancedStackSplitQuantity(source);

      if (!splitQuantity) return;

      const result =
        await performInventoryDrop({
          data,
          target: {
            type: "actorInventory",
            actor: this.actor
          },
          fallbackActor: this.actor,
          splitQuantity
        });

      if (!result.ok) {
        k8FloatingText(event, result.message, "warn");
        return;
      }

      await this.render(true);

      for (const sheet of K8ContainerSheet.openSheets ?? []) {
        await sheet.render(true);
      }

      for (const sheet of globalThis.k8DiscardPileSheets ?? []) {
        await sheet.render(true);
      }

      k8FloatingText(
        event,
        `${source.name} split.`,
        "status"
      );
    });

    const equippedItems = this.element.querySelectorAll(".k8-paperdoll-slot[data-item-id]");

    for (const element of equippedItems) {
      element.addEventListener("dblclick", async event => {
        event.preventDefault();

        const itemId = element.dataset.itemId;
        if (!itemId) return;

        const item = this.actor.items.get(itemId);
        if (!item) return;

        await item.sheet.render(true);
        item.sheet.bringToFront?.();
      });
    }

    for (const element of draggableItems) {
      element.addEventListener("click", async event => {
        if (!event.ctrlKey) return;
      
        event.preventDefault();
        event.stopPropagation();
      
        const itemId = element.dataset.itemId;
        if (!itemId) return;
      
        const item = this.actor.items.get(itemId);
        if (!item) return;
      
        await item.delete();
        await this.render(true);
      });
      element.addEventListener("dragstart", event => {
        const itemId = element.dataset.itemId;
        if (!itemId) return;
    
        const item = this.actor.items.get(itemId);
        if (!item) return;
    
        this._k8DraggedItemId = itemId;

        const itemData =
          item.toObject();

        const advancedSplit =
          event.shiftKey &&
          getItemStackMax(itemData) > 1 &&
          getItemQuantity(itemData) > 1;

        globalThis.k8DragItem = {
          type: "Item",
          itemData,
          advancedSplit
        };

        setTimeout(() => {
          for (const sheet of K8ContainerSheet.openSheets ?? []) {
            sheet.bringToFront?.();
        
            const app = sheet.element.closest(".application");
            if (!app) continue;
        
            app.dataset.k8PreviousZIndex = app.style.zIndex ?? "";
            app.style.zIndex = "999999";
          }
        }, 0);
    
        event.dataTransfer.setData("text/plain", JSON.stringify({
          type: "Item",
          actorId: this.actor.id,
          itemId,
          uuid: item.uuid,
          advancedSplit
        }));
      });

      element.addEventListener("dragend", () => {
        this._k8DraggedItemId = null;
        this._k8DragPreview?.remove();
        this._k8DragPreview = null;
        globalThis.k8DragItem = null;
      
        for (const sheet of K8ContainerSheet.openSheets ?? []) {
          const app = sheet.element.closest(".application");
          if (!app) continue;
      
          app.style.zIndex = app.dataset.k8PreviousZIndex ?? "";
          delete app.dataset.k8PreviousZIndex;
        }
      });
    }

    const equipmentSlots = this.element.querySelectorAll(".k8-paperdoll-slot");

    for (const slot of equipmentSlots) {
      slot.addEventListener("dragover", event => {
        event.preventDefault();
      
        slot.classList.remove("drag-valid", "drag-invalid");
      
        const itemId = this._k8DraggedItemId;

        let item = null;

        if (itemId) {
          item = this.actor.items.get(itemId);
        } else {
          item = globalThis.k8DragItem?.itemData ?? null;
        }

        if (!item) {
          slot.classList.add("drag-valid");
          return;
        }

        globalThis.k8DragItem = {
          type: globalThis.k8DragItem?.type ?? "Item",
          itemData: item.toObject
            ? item.toObject()
            : foundry.utils.deepClone(item),
          advancedSplit:
            globalThis.k8DragItem?.advancedSplit === true
        };
      
        const valid = isItemValidForSlot(item, slot.dataset.slot);
      
        slot.classList.add(valid ? "drag-valid" : "drag-invalid");
      });

      slot.addEventListener("dragleave", () => {
        slot.classList.remove(
          "drag-hover",
          "drag-valid",
          "drag-invalid"
        );
      });

      slot.addEventListener("drop", async event => {
        event.preventDefault();
        event.stopPropagation();
      
        slot.classList.remove(
          "drag-hover",
          "drag-valid",
          "drag-invalid"
        );
      
        this._k8DraggedItemId = null;
      
        const slotKey = slot.dataset.slot;
        if (!slotKey) return;
      
        const dataText = event.dataTransfer.getData("text/plain");
        if (!dataText) return;
      
        let data;
      
        try {
          data = JSON.parse(dataText);
        } catch {
          return;
        }
      
        let item = null;
      
        // ---------------------------------------------------
        // ITEM FROM CONTAINER
        // ---------------------------------------------------
      
        const equipResult =
        await equipDroppedDataToSlot(
          this.actor,
          data,
          slotKey,
          {
            onPlace: async containerItem => {
              await K8ContainerSheet.renderSheetsForItem(
                containerItem.uuid
              );
            },

            onFail: async item => {
              k8FloatingText(
                null,
                `${item.name} could not be unloaded.`,
                "warn"
              );
            }
          }
        );

      if (!equipResult.ok) {
        k8FloatingText(
          event,
          equipResult.message,
          "warn"
        );

        return;
      }

      item = equipResult.item ?? this.actor.items.get(data.itemId) ?? null;

      if (equipResult.swapped) {
        const itemName =
          item?.name ?? globalThis.k8DragItem?.itemData?.name ?? "Item";

        const swappedName =
          equipResult.swappedItem?.name ?? "item";

        k8FloatingText(
          event,
          `${itemName} swapped with ${swappedName}`,
          "status"
        );
      }
        if (data.type === "K8DiscardItem") {
          for (const sheet of globalThis.k8DiscardPileSheets ?? []) {
            await sheet.render(true);
          }
        }
        await this.render(true);
      });

      slot.addEventListener("contextmenu", async event => {
        event.preventDefault();
      
        const slotKey = slot.dataset.slot;
        if (!slotKey) return;
      
        const equippedItem = this.actor.items.find(item =>
          item.system?.equipment?.equipped === true &&
          item.system?.equipment?.slot === slotKey
        );
      
        if (!equippedItem) return;
      
        if (event.shiftKey) {
          const moved = await this._moveEquippedItemToSmartContainer(
            equippedItem,
            event
          );
        
          if (moved) {
            await this.render(true);
          }
        
          return;
        }
      
        if (equippedItem.system?.container?.enabled === true) {
          new K8ContainerSheet(equippedItem).render(true);
          return;
        }
      });
    }
  }
  async _moveEquippedItemToSmartContainer(item, event) {
    const isNonEmptyGridContainer =
    item.system?.container?.enabled === true &&
    item.system?.container?.kind === "grid" &&
    (item.system?.container?.items ?? []).length > 0;

    if (isNonEmptyGridContainer) {
      k8FloatingText(event, "Cannot move non-empty grid container.", "warn");
      return false;
    }
    const itemData =
    createUnequippedItemData(
      item.toObject()
    );

    const result =
      await smartPlaceIntoInventory(
        this.actor,
        itemData,
        {
          excludedContainerIds: [
            item.id
          ],

          onPlace: async containerItem => {

            await K8ContainerSheet.renderSheetsForItem(
              containerItem.uuid
            );
          }
        }
      );

    if (!result.ok) {

      k8FloatingText(
        event,
        result.message,
        "warn"
      );

      return false;
    }

    await item.delete();

    await normalizeSocialSlots(
      this.actor
    );

    k8FloatingText(
      event,
      `${item.name} moved to ${result.containerItem.name}`,
      "status"
    );

    return true;
    }
  
    async receiveItemFromDiscardPile(itemData, event) {
      const moved =
        await smartPlaceIntoInventory(
          this.actor,
          foundry.utils.deepClone(itemData),
          {
            onPlace: async containerItem => {
              await K8ContainerSheet.renderSheetsForItem(
                containerItem.uuid
              );
            }
          }
        );
    
      if (moved.ok) {
        k8FloatingText(
          event,
          `${itemData.name} moved to ${this.actor.name}'s inventory`,
          "status"
        );
    
        await this.render(true);
        return true;
      }
    
      const targetSlot =
        findBestEquipSlot(
          this.actor,
          itemData,
          K8_BASE_EQUIPMENT_SLOTS
        );
    
      if (!targetSlot) {
        k8FloatingText(
          event,
          "Not enough space in inventory",
          "warn"
        );
    
        return false;
      }
    
      const equipResult =
        await equipItemDataToActor(
          this.actor,
          itemData,
          targetSlot,
          {
            onPlace: async containerItem => {
              await K8ContainerSheet.renderSheetsForItem(
                containerItem.uuid
              );
            }
          }
        );
    
      if (!equipResult.ok) {
        k8FloatingText(
          event,
          equipResult.message,
          "warn"
        );
    
        return false;
      }
    
      await this.render(true);
    
      if (equipResult.swapped) {
        k8FloatingText(
          event,
          `${itemData.name} swapped with ${equipResult.swappedItem.name}`,
          "status"
        );
      } else {
        k8FloatingText(
          event,
          `${itemData.name} equipped by ${this.document.name} in ${targetSlot}`,
          "status"
        );
      }
    
      return true;
    }
}