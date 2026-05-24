import { K8ContainedItemEditor } from "./contained-item-editor.mjs";
import { k8FloatingText } from "../utils/k8-floating-text.mjs";
import {
  getDiscardPile,
  removeItemFromDiscardPileAndReturn
} from "../utils/discard-pile.mjs";
import { K8ActorSheet } from "./actor-sheet.mjs";
import {
  normalizeSocialSlots,
  equipContainerItemDataToActor,
  validateGridPlacement,
  extractContainerItemToActor,
  moveItemBetweenContainers,
  moveDiscardItemToContainer,
  moveActorItemToContainer,
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
  getItemStackMax,
  findFirstFreeGridPosition
} from "../system/inventory-rules.mjs";

 
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class K8ContainerSheet extends HandlebarsApplicationMixin(ApplicationV2) {
    static openSheets = new Set();
  static DEFAULT_OPTIONS = {
    tag: "section",

    classes: ["k8system", "k8-container-sheet-app"],

    position: {
      width: 420,
      height: 420
    },

    window: {
      resizable: true
    }
  };

  static PARTS = {
    body: {
      template: "systems/k8system/templates/item/container-sheet.hbs"
    }
  };

  constructor(item, options = {}) {
    for (const sheet of K8ContainerSheet.openSheets) {
      if (sheet.item?.uuid === item.uuid) {
        sheet.close();
      }
    }
  
    super(options);
    this.item = item;
    K8ContainerSheet.openSheets.add(this);
  }
  
  async close(options = {}) {
    K8ContainerSheet.openSheets.delete(this);
    return super.close(options);
  }
  
  static async renderSheetsForItem(itemUuid) {
    for (const sheet of K8ContainerSheet.openSheets) {
      if (sheet.item?.uuid === itemUuid) {
        await sheet.render(true);
      }
    }
  }

  get title() {
    return this.item.name;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    context.item = this.item;
    context.system = this.item.system;
    context.container = this.item.system.container ?? {};

    const width = Number(context.container.width) || 1;
    const height = Number(context.container.height) || 1;

    context.gridCells = Array.from({ length: width * height }, (_, index) => ({
    index,
    x: index % width,
    y: Math.floor(index / width)
    }));

    context.gridStyle = `
        grid-template-columns: repeat(${width}, 64px);
        grid-template-rows: repeat(${height}, 64px);
        `;

        const storedItems = context.container.items ?? [];

        context.containerItems = storedItems.map(item => {
        const itemWidth = Number(item.system?.inventory?.width) || 1;
        const itemHeight = Number(item.system?.inventory?.height) || 1;

        return {
            ...item,

            style: `
            left: ${item.x * 64}px;
            top: ${item.y * 64}px;
            width: ${itemWidth * 64}px;
            height: ${itemHeight * 64}px;
            `
        };
        });

        return context;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const containerGrid = this.element.querySelector(".k8-container-grid");
    const app = this.element.closest(".application");
    const content = app?.querySelector(".window-content");
    const windowHeader = app?.querySelector(".window-header");
    
    if (containerGrid && content && windowHeader) {
        const gridRect = containerGrid.getBoundingClientRect();
    
      const extraWidth =
        app.offsetWidth - content.clientWidth;
    
      const extraHeight =
        app.offsetHeight - content.clientHeight;
    
      await this.setPosition({
        width: Math.ceil(gridRect.width + extraWidth),
        height: Math.ceil(gridRect.height + extraHeight)
      });
    }
  
    const header = this.element.closest(".application")?.querySelector(".window-header");
    const title = header?.querySelector(".window-title");
  
    if (title && !title.querySelector(".k8-container-title-icon")) {
      const icon = document.createElement("img");
      icon.classList.add("k8-container-title-icon");
      icon.src = this.item.img;
      icon.alt = this.item.name;
  
      title.prepend(icon);
    }
  
    const grid = this.element.querySelector(".k8-container-grid");

    const placementPreview =
    this.element.querySelector(
        ".k8-container-placement-preview"
    );

    if (grid) {
        grid.addEventListener("dragover", async event => {
            event.preventDefault();
          
            if (!placementPreview) return;
          
            const rect = grid.getBoundingClientRect();
          
            const x = Math.floor(
              (event.clientX - rect.left) / 64
            );
          
            const y = Math.floor(
              (event.clientY - rect.top) / 64
            );
          
            const draggedItem = globalThis.k8DragItem?.itemData;

            if (!draggedItem) return;
          
            const width =
              Number(
                draggedItem.system?.inventory?.width
              ) || 1;
          
            const height =
              Number(
                draggedItem.system?.inventory?.height
              ) || 1;
          
            placementPreview.style.left =
              `${x * 64}px`;
          
            placementPreview.style.top =
              `${y * 64}px`;
          
            placementPreview.style.width =
              `${width * 64}px`;
          
            placementPreview.style.height =
              `${height * 64}px`;
          
            placementPreview.classList.add("active");
          
            const result =
            validateGridPlacement({
              container:
                this.item.system.container ?? {},

              itemData: draggedItem,

              x,
              y,

              ignoredId:
                draggedItem.id
            });

          const valid = result.ok;
          
            placementPreview.classList.remove(
              "valid",
              "invalid"
            );
          
            placementPreview.classList.add(
              valid ? "valid" : "invalid"
            );
          });

          grid.addEventListener("dragleave", () => {

            if (!placementPreview) return;
          
            placementPreview.classList.remove(
              "active",
              "valid",
              "invalid"
            );
          });

    grid.addEventListener("drop", event => {
        this._handleItemDrop(event);
    });
    }

    const items = this.element.querySelectorAll(".k8-container-item");

    for (const element of items) {
        element.addEventListener("click", async event => {
            if (event.shiftKey) {
              event.preventDefault();
              event.stopPropagation();

              const itemId = element.dataset.itemId;
              if (!itemId) return;

              const actor = this.item.parent;
              if (!actor) return;

              const source = {
                type: "containerItem",
                containerItem: this.item,
                itemId
              };

              const sourceItemData =
                await getInventorySourceItemData(source);

              if (!sourceItemData) return;

              const result =
                await performInventoryHalfSplit({
                  source,
                  target: {
                    type: "smartInventory",
                    actor,
                    excludedContainerIds: [this.item.id],
                    onPlace: async containerItem => {
                      await K8ContainerSheet.renderSheetsForItem(
                        containerItem.uuid
                      );
                    }
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

              return;
            }

            if (!event.ctrlKey) return;

            event.preventDefault();
            event.stopPropagation();

            const itemId = element.dataset.itemId;
            if (!itemId) return;

            const container = foundry.utils.deepClone(this.item.system.container ?? {});
            const items = container.items ?? [];

            const filtered = items.filter(item => item.id !== itemId);

            await this.item.update({
              "system.container.items": filtered
            });

            await this.render(true);
          });
        element.addEventListener("dragstart", event => {
            event.stopPropagation();
          
            const itemId = element.dataset.itemId;
            if (!itemId) return;

            const sourceItems = this.item.system?.container?.items ?? [];
            const itemData = sourceItems.find(item => item.id === itemId);
            if (!itemData) return;

            const advancedSplit =
              event.shiftKey &&
              getItemStackMax(itemData) > 1 &&
              getItemQuantity(itemData) > 1;

            globalThis.k8DragItem = {
              type: "K8ContainedItem",
              itemData,
              advancedSplit
            };

            event.dataTransfer.effectAllowed = "move";

            event.dataTransfer.setData("text/plain", JSON.stringify({
              type: "K8ContainedItem",
              containerUuid: this.item.uuid,
              itemId,
              advancedSplit
            }));
          });

          element.addEventListener("dragend", () => {

            this._k8DraggedContainedItemId = null;
            this._k8DragPreview?.remove();
            this._k8DragPreview = null;
            globalThis.k8DragItem = null;
          });

    element.addEventListener("dblclick", event => {
        this._openContainedItem(event);
    });

    element.addEventListener("contextmenu", async event => {

      if (event.shiftKey) {
        await this._equipContainedItem(event);
        return;
      }
    
      this._extractContainedItem(event);
    });
    }

  }
  
  _isDropCellOccupied(container, x, y, ignoredId = null) {
    return (container.items ?? []).some(item => {
      if (
        ignoredId &&
        item.id === ignoredId
      ) {
        return false;
      }

      const itemX = Number(item.x) || 0;
      const itemY = Number(item.y) || 0;
      const itemWidth =
        Number(item.system?.inventory?.width) || 1;
      const itemHeight =
        Number(item.system?.inventory?.height) || 1;

      return (
        x >= itemX &&
        x < itemX + itemWidth &&
        y >= itemY &&
        y < itemY + itemHeight
      );
    });
  }

  async _performAdvancedSplitDrop(
    data,
    event,
    target
  ) {
    const source =
      await inventorySourceFromDropData(
        data,
        this.item.parent
      );

    if (!source) return false;

    const sourceItemData =
      await getInventorySourceItemData(source);

    if (!sourceItemData) return false;

    const splitQuantity =
      await promptAdvancedStackSplitQuantity(
        sourceItemData
      );

    if (!splitQuantity) return true;

    const result =
      await performInventoryDrop({
        data,
        target,
        fallbackActor: this.item.parent,
        splitQuantity
      });

    if (!result.ok) {
      k8FloatingText(event, result.message, "warn");
      return true;
    }

    await K8ContainerSheet.renderSheetsForItem(
      this.item.uuid
    );

    for (const sheet of K8ContainerSheet.openSheets ?? []) {
      if (sheet.item?.uuid !== this.item.uuid) {
        await sheet.render(true);
      }
    }

    for (const sheet of globalThis.k8DiscardPileSheets ?? []) {
      await sheet.render(true);
    }

    k8FloatingText(
      event,
      `${sourceItemData.name} ${result.action === "merge" ? "merged" : "split"}.`,
      "status"
    );

    return true;
  }


  async _handleItemDrop(event) {
    event.preventDefault();
    event.stopPropagation();

    const preview =
      this.element.querySelector(
        ".k8-container-placement-preview"
      );

    preview?.classList.remove(
      "active",
      "valid",
      "invalid"
    );

    const grid = event.currentTarget.closest(".k8-container-grid");
    if (!grid) return;

    const rect = grid.getBoundingClientRect();

    const x = Math.floor((event.clientX - rect.left) / 64);
    const y = Math.floor((event.clientY - rect.top) / 64);

    const dataText = event.dataTransfer.getData("text/plain");
    if (!dataText) return;

    let data;

    try {
      data = JSON.parse(dataText);
    } catch {
      return;
    }

    const container =
      this.item.system.container ?? {};

    const occupied =
      this._isDropCellOccupied(
        container,
        x,
        y,
        data.itemId ?? null
      );

    if (data.advancedSplit && !occupied) {
      const handled =
        await this._performAdvancedSplitDrop(
          data,
          event,
          {
            type: "containerGrid",
            containerItem: this.item,
            x,
            y
          }
        );

      if (handled) return;
    }

    if (data.type === "K8DiscardItem") {
      const result =
        await moveDiscardItemToContainer(
          this.item,
          data.itemId,
          x,
          y
        );

      if (!result.ok) {
        k8FloatingText(
          event,
          result.message,
          "warn"
        );

        return;
      }

      for (const sheet of globalThis.k8DiscardPileSheets ?? []) {
        await sheet.render(true);
      }

      await this.render(true);
      return;
    }

    if (data.type === "K8ContainedItem") {
      const sourceContainer =
        await fromUuid(data.containerUuid);

      if (!sourceContainer) return;

      const sourceItems =
        foundry.utils.deepClone(
          sourceContainer.system?.container?.items ?? []
        );

      const itemIndex =
        sourceItems.findIndex(
          item => item.id === data.itemId
        );

      if (itemIndex === -1) return;

      const movedItem =
        foundry.utils.deepClone(
          sourceItems[itemIndex]
        );

      const targetItems =
        foundry.utils.deepClone(
          container.items ?? []
        );

      const targetItem =
        targetItems.find(item => {
          if (item.id === movedItem.id) return false;

          const itemX = Number(item.x) || 0;
          const itemY = Number(item.y) || 0;
          const itemWidth =
            Number(item.system?.inventory?.width) || 1;
          const itemHeight =
            Number(item.system?.inventory?.height) || 1;

          return (
            x >= itemX &&
            x < itemX + itemWidth &&
            y >= itemY &&
            y < itemY + itemHeight
          );
        });

      if (targetItem) {
        const merge =
          calculateStackMerge(
            movedItem,
            targetItem
          );

        if (!merge.ok) {
          k8FloatingText(
            event,
            merge.message,
            "warn"
          );

          return;
        }

        targetItem.system.quantity =
          merge.targetQuantityAfter;

        if (sourceContainer.uuid === this.item.uuid) {
          if (merge.sourceConsumed) {
            const remaining =
              targetItems.filter(
                item => item.id !== movedItem.id
              );

            await this.item.update({
              "system.container.items": remaining
            });
          } else {
            const sourceItem =
              targetItems.find(
                item => item.id === movedItem.id
              );

            if (sourceItem) {
              sourceItem.system.quantity =
                merge.sourceQuantityAfter;
            }

            await this.item.update({
              "system.container.items": targetItems
            });
          }

          await this.render(true);
          return;
        }

        const updatedSourceItems =
          merge.sourceConsumed
            ? sourceItems.filter(
                item => item.id !== movedItem.id
              )
            : sourceItems.map(item => {
                if (item.id !== movedItem.id) return item;

                item.system.quantity =
                  merge.sourceQuantityAfter;

                return item;
              });

        await sourceContainer.update({
          "system.container.items": updatedSourceItems
        });

        await this.item.update({
          "system.container.items": targetItems
        });

        await K8ContainerSheet.renderSheetsForItem(
          this.item.uuid
        );

        await K8ContainerSheet.renderSheetsForItem(
          sourceContainer.uuid
        );

        return;
      }

      const result =
        validateGridPlacement({
          container,
          itemData: movedItem,
          x,
          y,
          ignoredId:
            movedItem.id
        });

      if (!result.ok) {
        k8FloatingText(
          event,
          result.message,
          "warn"
        );

        return;
      }

      movedItem.x = x;
      movedItem.y = y;

      if (sourceContainer.uuid === this.item.uuid) {
        sourceItems[itemIndex] = movedItem;

        await this.item.update({
          "system.container.items": sourceItems
        });

        await this.render(true);

        return;
      }

      const moveResult =
        await moveItemBetweenContainers(
          sourceContainer,
          this.item,
          movedItem,
          {
            sourceItemId: data.itemId,
            x,
            y
          }
        );

      if (!moveResult.ok) {
        k8FloatingText(
          event,
          moveResult.message,
          "warn"
        );

        return;
      }

      await K8ContainerSheet.renderSheetsForItem(
        this.item.uuid
      );

      await K8ContainerSheet.renderSheetsForItem(
        sourceContainer.uuid
      );

      return;
    }

    if (data.type !== "Item") return;

    const droppedItem =
      await Item.implementation.fromDropData(data);

    if (!droppedItem) return;

    if (droppedItem.uuid === this.item.uuid) {
      k8FloatingText(
        event,
        "Container cannot contain itself.",
        "warn"
      );

      return;
    }

    const sourceActor =
      droppedItem.parent?.documentName === "Actor"
        ? droppedItem.parent
        : data.actorId
          ? game.actors.get(data.actorId)
          : null;

    if (!sourceActor) {
      const itemData =
        droppedItem.toObject();

      delete itemData._id;
      delete itemData.id;

      itemData.id =
        foundry.utils.randomID();

      itemData.x = x;
      itemData.y = y;

      itemData.system ??= {};
      itemData.system.equipment ??= {};
      itemData.system.equipment.equipped = false;
      itemData.system.equipment.slot = "";

      const result =
        validateGridPlacement({
          container,
          itemData,
          x,
          y
        });

      if (!result.ok) {
        k8FloatingText(
          event,
          result.message,
          "warn"
        );

        return;
      }

      const items =
        foundry.utils.deepClone(
          container.items ?? []
        );

      items.push(itemData);

      await this.item.update({
        "system.container.items": items
      });

      await this.render(true);
      return;
    }

    const sourceItem =
      data.itemId
        ? sourceActor.items.get(data.itemId)
        : droppedItem;

    if (!sourceItem) return;

    const targetItems =
      foundry.utils.deepClone(
        container.items ?? []
      );

    const sourceItemData =
      sourceItem.toObject();

    const targetItem =
      targetItems.find(item => {
        const itemX = Number(item.x) || 0;
        const itemY = Number(item.y) || 0;
        const itemWidth =
          Number(item.system?.inventory?.width) || 1;
        const itemHeight =
          Number(item.system?.inventory?.height) || 1;

        return (
          x >= itemX &&
          x < itemX + itemWidth &&
          y >= itemY &&
          y < itemY + itemHeight
        );
      });

    if (targetItem) {
      const merge =
        calculateStackMerge(
          sourceItemData,
          targetItem
        );

      if (!merge.ok) {
        k8FloatingText(
          event,
          merge.message,
          "warn"
        );

        return;
      }

      targetItem.system.quantity =
        merge.targetQuantityAfter;

      await this.item.update({
        "system.container.items": targetItems
      });

      if (merge.sourceConsumed) {
        await sourceItem.delete();
      } else {
        await sourceItem.update({
          "system.quantity": merge.sourceQuantityAfter
        });
      }

      await this.render(true);
      await normalizeSocialSlots(sourceActor);

      return;
    }

    const result =
      await moveActorItemToContainer(
        sourceActor,
        sourceItem,
        this.item,
        x,
        y,
        {
          onPlace: async containerItem => {
            await K8ContainerSheet.renderSheetsForItem(
              containerItem.uuid
            );
          },

          onFail: async item => {
            k8FloatingText(
              event,
              `${item.name} could not be unloaded.`,
              "warn"
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

      return;
    }

    await this.render(true);

    await normalizeSocialSlots(sourceActor);
  }

  _openContainedItem(event) {
    event.preventDefault();
    event.stopPropagation();
  
    const element = event.currentTarget;
    const itemId = element.dataset.itemId;
  
    if (!itemId) return;

    this._k8DraggedContainedItemId = itemId;
  
    new K8ContainedItemEditor(
      this.item,
      itemId
    ).render(true);
  }
  
  async _extractContainedItem(event) {
    event.preventDefault();
    event.stopPropagation();
  
    if (!event.shiftKey) return;
  
    const element = event.currentTarget;
    const itemId = element.dataset.itemId;
  
    if (!itemId) return;
  
    const actor = this.item.parent;
  
    if (!actor) return;
  
    const result =
      await extractContainerItemToActor(
        actor,
        this.item,
        itemId
      );
  
    if (!result.ok) {
      k8FloatingText(
        event,
        result.message,
        "warn"
      );
  
      return;
    }
  
    await this.render(true);
  
    k8FloatingText(
      event,
      "Item extracted.",
      "status"
    );
  }

  async _equipContainedItem(event) {
    event.preventDefault();
    event.stopPropagation();
  
    const element = event.currentTarget;
    const itemId = element.dataset.itemId;
  
    if (!itemId) return;
  
    const container =
      foundry.utils.deepClone(
        this.item.system.container ?? {}
      );
  
    const items = container.items ?? [];
  
    const itemIndex =
      items.findIndex(i => i.id === itemId);
  
    if (itemIndex === -1) return;
  
    const itemData =
      foundry.utils.deepClone(
        items[itemIndex]
      );
  
    const actor = this.item.parent;
  
    if (!actor) return;
  
    const slotType =
      itemData.system?.equipment?.slotType ?? "";
  
    let targetSlot = null;
  
    const equippedItems =
      actor.items.filter(
        item => item.system?.equipment?.equipped === true
      );
  
    const equippedBySlot = slot =>
      equippedItems.find(
        item => item.system?.equipment?.slot === slot
      );
  
    const isSlotFree = slot =>
      !equippedBySlot(slot);
  
    // -----------------------------------
    // QUICK
    // -----------------------------------
  
    if (slotType === "quick") {
  
      for (let i = 1; i <= 12; i++) {
        const slot = `quick-${i}`;
  
        if (isSlotFree(slot)) {
          targetSlot = slot;
          break;
        }
      }
  
      if (!targetSlot) {
        targetSlot = "quick-1";
      }
    }
  
    // -----------------------------------
    // TACTICAL
    // -----------------------------------
  
    else if (slotType === "tactical") {
  
      for (let i = 1; i <= 12; i++) {
        const slot = `tactical-${i}`;
  
        if (isSlotFree(slot)) {
          targetSlot = slot;
          break;
        }
      }
  
      if (!targetSlot) {
        targetSlot = "tactical-1";
      }
    }
  
    // -----------------------------------
    // SOCIAL
    // -----------------------------------
  
    else if (slotType === "social") {

      for (let i = 1; i <= 6; i++) {
        const slot = `social-${i}`;
  
        if (isSlotFree(slot)) {
          targetSlot = slot;
          break;
        }
      }
  
      if (!targetSlot) {
        targetSlot = "social-1";
      }
    }
  
    // -----------------------------------
    // SHOULDER
    // -----------------------------------
  
    else if (
      itemData.type === "weapon"
    ) {
  
      const width =
        Number(itemData.system?.inventory?.width) || 1;
  
      const height =
        Number(itemData.system?.inventory?.height) || 1;
  
      if (
        height === 1 &&
        (width === 2 || width === 3)
      ) {
  
        const extraShoulderSlots =
        Number(actor.system?.equipment?.extraShoulderSlots) || 0;

        const shoulderSlots = Array.from(
          { length: 2 + extraShoulderSlots },
          (_, index) => `shoulder-${index + 1}`
        );
  
        for (const slot of shoulderSlots) {
          if (isSlotFree(slot)) {
            targetSlot = slot;
            break;
          }
        }
  
        if (!targetSlot) {
          targetSlot = "shoulder-1";
        }
      }
    }
  
    // -----------------------------------
    // NORMAL SLOT
    // -----------------------------------
  
    else {
      targetSlot = slotType;
    }
  
    if (!targetSlot) {
      k8FloatingText(
        event,
        "No equipment slot.",
        "warn"
      );
  
      return;
    }
  
    // -----------------------------------
    // SWAP
    // -----------------------------------
  
    const equipResult =
      await equipContainerItemDataToActor(
        actor,
        itemData,
        targetSlot,
        this.item,
        itemId,
        {
          onPlace: async containerItem => {
            await K8ContainerSheet.renderSheetsForItem(
              containerItem.uuid
            );
          },

          onFail: async item => {
            k8FloatingText(
              event,
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
        `${itemData.name} equipped in ${targetSlot}`,
        "status"
      );
    }
  }
}