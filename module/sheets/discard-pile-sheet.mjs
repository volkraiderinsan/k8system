import {
    getDiscardPile,
    moveItemInDiscardPile,
    clearDiscardPile,
    saveDiscardPile,
    removeItemFromDiscardPileAndReturn
  } from "../utils/discard-pile.mjs";
  
  import { K8ContainerSheet } from "./container-sheet.mjs";
  import { K8ContainedItemEditor } from "./contained-item-editor.mjs";
  import { K8ActorSheet } from "./actor-sheet.mjs";
  import { k8FloatingText } from "../utils/k8-floating-text.mjs";
  
  import {
    validateGridPlacement,
    moveContainerItemToDiscard,
    moveActorItemToDiscard,
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
  
  const {
    ApplicationV2,
    HandlebarsApplicationMixin
  } = foundry.applications.api;
  
  export class K8DiscardPileSheet extends HandlebarsApplicationMixin(ApplicationV2) {
  
    static DEFAULT_OPTIONS = {
      tag: "section",
      classes: [
        "k8system",
        "k8-container-sheet-app",
        "k8-discard-pile-app"
      ],
      position: {
        width: 420,
        height: 420
      },
      window: {
        title: "Discard Pile",
        resizable: true
      }
    };
  
    static PARTS = {
      body: {
        template: "systems/k8system/templates/item/container-sheet.hbs"
      }
    };
  
    constructor(options = {}) {
      super(options);
  
      globalThis.k8DiscardPileSheets ??= new Set();
      globalThis.k8DiscardPileSheets.add(this);
    }
  
    async close(options = {}) {
      globalThis.k8DiscardPileSheets?.delete(this);
      return super.close(options);
    }
  
    get title() {
      return "Discard Pile";
    }
  
    async _prepareContext(options) {
      const context =
        await super._prepareContext(options);
  
      const pile = getDiscardPile();
  
      context.item = {
        name: "Discard Pile",
        img: "systems/k8system/images/discard.png"
      };
  
      context.system = {};
      context.container = pile;
  
      const width =
        Number(pile.width) || 6;
  
      const height =
        Number(pile.height) || 6;
  
      context.gridCells =
        Array.from(
          { length: width * height },
          (_, index) => ({
            index,
            x: index % width,
            y: Math.floor(index / width)
          })
        );
  
      context.gridStyle = `
        grid-template-columns: repeat(${width}, 64px);
        grid-template-rows: repeat(${height}, 64px);
      `;
  
      context.containerItems =
        (pile.items ?? []).map(item => {
          const itemWidth =
            Number(item.system?.inventory?.width) || 1;
  
          const itemHeight =
            Number(item.system?.inventory?.height) || 1;
  
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
  
      const grid =
        this.element.querySelector(".k8-container-grid");
  
      const placementPreview =
        this.element.querySelector(
          ".k8-container-placement-preview"
        );
  
      this._prepareDiscardButton();
      this._activateDiscardItems();
  
      if (!grid) return;
  
      grid.addEventListener(
        "dragover",
        event => this._onGridDragOver(
          event,
          placementPreview
        )
      );
  
      grid.addEventListener(
        "dragleave",
        () => {
          placementPreview?.classList.remove(
            "active",
            "valid",
            "invalid"
          );
        }
      );
  
      grid.addEventListener(
        "drop",
        event => this._onGridDrop(event, placementPreview)
      );
    }
  
    _prepareDiscardButton() {
      const button =
        document.createElement("button");
  
      button.type = "button";
      button.classList.add("k8-discard-clear-button");
      button.textContent = "Discard";
  
      const header =
        this.element
          .closest(".application")
          ?.querySelector(".window-header");
  
      if (header) {
        header.classList.add("k8-discard-header");
        header.appendChild(button);
      } else {
        this.element.prepend(button);
      }
  
      button.addEventListener("click", async event => {
        event.preventDefault();
  
        const confirm =
          await Dialog.confirm({
            title: "Discard all items?",
            content: `
              <p style="color: #efe6d0;">
                All items in the discard pile will be permanently deleted.
              </p>
            `,
            yes: () => true,
            no: () => false,
            defaultYes: false
          });
  
        if (!confirm) return;
  
        await clearDiscardPile();
        await this.render(true);
      });
    }
  
    _activateDiscardItems() {
      const items =
        this.element.querySelectorAll(".k8-container-item");
  
      for (const element of items) {
  
        element.addEventListener(
          "click",
          event => this._splitDiscardItemToOpenActor(event)
        );

        element.addEventListener(
          "dblclick",
          event => this._openDiscardItemEditor(event)
        );
  
        element.addEventListener(
          "dragstart",
          event => this._onDiscardItemDragStart(event)
        );
  
        element.addEventListener(
          "dragend",
          () => {
            globalThis.k8DragItem = null;
          }
        );
  
        element.addEventListener(
          "contextmenu",
          event => this._giveDiscardItemToOpenActor(event)
        );
      }
    }
  
    _openDiscardItemEditor(event) {
      event.preventDefault();
      event.stopPropagation();
  
      const itemId =
        event.currentTarget.dataset.itemId;
  
      if (!itemId) return;
  
      const discardAdapter = {
        get system() {
          return {
            container: getDiscardPile()
          };
        },
  
        async update(updateData) {
          const pile = getDiscardPile();
  
          if (updateData["system.container.items"]) {
            pile.items =
              updateData["system.container.items"];
          }
  
          await saveDiscardPile(pile);
  
          for (const sheet of globalThis.k8DiscardPileSheets ?? []) {
            await sheet.render(true);
          }
        }
      };
  
      new K8ContainedItemEditor(
        discardAdapter,
        itemId
      ).render(true);
    }
  
    _onDiscardItemDragStart(event) {
      const itemId =
        event.currentTarget.dataset.itemId;

      if (!itemId) return;

      const pile = getDiscardPile();

      const itemData =
        pile.items.find(item => item.id === itemId);

      if (!itemData) return;

      const advancedSplit =
        event.shiftKey &&
        getItemStackMax(itemData) > 1 &&
        getItemQuantity(itemData) > 1;

      globalThis.k8DragItem = {
        type: "K8DiscardItem",
        itemData,
        advancedSplit
      };

      event.dataTransfer.effectAllowed = "move";

      event.dataTransfer.setData(
        "text/plain",
        JSON.stringify({
          type: "K8DiscardItem",
          itemId,
          advancedSplit
        })
      );
    }

    async _chooseOpenActorSheet(event) {
      const openActorSheets =
        [...(K8ActorSheet.openSheets ?? [])]
          .filter(sheet => sheet.actor);

      if (openActorSheets.length === 0) {
        k8FloatingText(
          event,
          "Open character sheet first.",
          "warn"
        );
        return null;
      }

      if (openActorSheets.length === 1) {
        return openActorSheets[0];
      }

      const actorChoices = {};

      for (const sheet of openActorSheets) {
        actorChoices[sheet.actor.id] = {
          label: sheet.actor.name,
          callback: () => sheet.actor.id
        };
      }

      const actorId =
        await Dialog.wait({
          title: "Choose Character",
          content: `
            <p style="color: #efe6d0; text-align: center;">
              Give item to:
            </p>
          `,
          buttons: actorChoices,
          close: () => null
        });

      return openActorSheets.find(
        sheet => sheet.actor.id === actorId
      ) ?? null;
    }

    async _splitDiscardItemToOpenActor(event) {
      if (!event.shiftKey) return;

      event.preventDefault();
      event.stopPropagation();

      const itemId =
        event.currentTarget.dataset.itemId;

      if (!itemId) return;

      const targetSheet =
        await this._chooseOpenActorSheet(event);

      if (!targetSheet) return;

      const source = {
        type: "discardItem",
        itemId
      };

      const sourceItemData =
        await getStackSplitSourceItemData(source);

      if (!sourceItemData) return;

      const splitQuantity =
        Math.floor(
          getItemQuantity(sourceItemData) / 2
        );

      const result =
        await performStackSplit({
          source,
          target: {
            type: "smartInventory",
            actor: targetSheet.actor,
            onPlace: async containerItem => {
              await K8ContainerSheet.renderSheetsForItem(
                containerItem.uuid
              );
            }
          },
          moveQuantity: splitQuantity
        });

      if (!result.ok) {
        k8FloatingText(
          event,
          result.message,
          "warn"
        );
        return;
      }

      await this.render(true);
      await targetSheet.render(true);

      k8FloatingText(
        event,
        `${sourceItemData.name} split.`,
        "status"
      );
    }

    async _giveDiscardItemToOpenActor(event) {
      event.preventDefault();
      event.stopPropagation();
  
      if (!event.shiftKey) return;
  
      const openActorSheets =
        [...(K8ActorSheet.openSheets ?? [])]
          .filter(sheet => sheet.actor);
  
      if (openActorSheets.length === 0) {
        k8FloatingText(
          event,
          "Open character sheet first.",
          "warn"
        );
        return;
      }
  
      let targetSheet = null;
  
      if (openActorSheets.length === 1) {
        targetSheet = openActorSheets[0];
      } else {
        const actorChoices = {};
  
        for (const sheet of openActorSheets) {
          actorChoices[sheet.actor.id] = {
            label: sheet.actor.name,
            callback: () => sheet.actor.id
          };
        }
  
        const actorId =
          await Dialog.wait({
            title: "Choose Character",
            content: `
              <p style="color: #efe6d0; text-align: center;">
                Give item to:
              </p>
            `,
            buttons: actorChoices,
            close: () => null
          });
  
        targetSheet =
          openActorSheets.find(
            sheet => sheet.actor.id === actorId
          );
      }
  
      if (!targetSheet) return;
  
      const itemId =
        event.currentTarget.dataset.itemId;
  
      if (!itemId) return;
  
      const pile = getDiscardPile();
  
      const itemData =
        pile.items.find(item => item.id === itemId);
  
      if (!itemData) return;
  
      const success =
        await targetSheet.receiveItemFromDiscardPile(
          itemData,
          event
        );
  
      if (!success) return;
  
      await removeItemFromDiscardPileAndReturn(itemId);
  
      for (const sheet of globalThis.k8DiscardPileSheets ?? []) {
        await sheet.render(true);
      }
    }
  
    _onGridDragOver(event, placementPreview) {
      event.preventDefault();
  
      if (!placementPreview) return;
  
      const draggedItem =
        globalThis.k8DragItem?.itemData;
  
      if (!draggedItem) return;
  
      const grid =
        event.currentTarget;
  
      const rect =
        grid.getBoundingClientRect();
  
      const x =
        Math.floor((event.clientX - rect.left) / 64);
  
      const y =
        Math.floor((event.clientY - rect.top) / 64);
  
      const width =
        Number(draggedItem.system?.inventory?.width) || 1;
  
      const height =
        Number(draggedItem.system?.inventory?.height) || 1;
  
      placementPreview.style.left = `${x * 64}px`;
      placementPreview.style.top = `${y * 64}px`;
      placementPreview.style.width = `${width * 64}px`;
      placementPreview.style.height = `${height * 64}px`;
  
      const result =
        validateGridPlacement({
          container: getDiscardPile(),
          itemData: draggedItem,
          x,
          y,
          ignoredId: draggedItem.id
        });
  
      placementPreview.classList.add("active");
  
      placementPreview.classList.remove(
        "valid",
        "invalid"
      );
  
      placementPreview.classList.add(
        result.ok ? "valid" : "invalid"
      );
    }
  
    _isDiscardCellOccupied(x, y, ignoredId = null) {
      const pile = getDiscardPile();

      return (pile.items ?? []).some(item => {
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
        await stackSplitSourceFromDropData(
          data,
          null
        );

      if (!source) {
        return false;
      }

      const sourceItemData =
        await getStackSplitSourceItemData(source);

      if (!sourceItemData) {
        return false;
      }

      const splitQuantity =
        await promptAdvancedStackSplitQuantity(
          sourceItemData
        );

      if (!splitQuantity) {
        return true;
      }

      const result =
        await performStackSplit({
          source,
          target,
          moveQuantity: splitQuantity
        });

      if (!result.ok) {
        k8FloatingText(
          event,
          result.message,
          "warn"
        );
        return true;
      }

      for (const sheet of K8ContainerSheet.openSheets ?? []) {
        await sheet.render(true);
      }

      for (const sheet of globalThis.k8DiscardPileSheets ?? []) {
        await sheet.render(true);
      }

      k8FloatingText(
        event,
        `${sourceItemData.name} split.`,
        "status"
      );

      return true;
    }


    async _onGridDrop(event, placementPreview) {
      event.preventDefault();
      event.stopPropagation();

      placementPreview?.classList.remove(
        "active",
        "valid",
        "invalid"
      );

      const grid =
        event.currentTarget;

      const rect =
        grid.getBoundingClientRect();

      const x =
        Math.floor((event.clientX - rect.left) / 64);

      const y =
        Math.floor((event.clientY - rect.top) / 64);

      const dataText =
        event.dataTransfer.getData("text/plain");

      if (!dataText) return;

      let data;

      try {
        data = JSON.parse(dataText);
      } catch {
        return;
      }

      const target = {
        type: "discardGrid",
        x,
        y
      };

      if (data.advancedSplit) {
        const handled =
          await this._performAdvancedSplitDrop(
            data,
            event,
            target
          );

        if (handled) return;
      }

      const result =
        await performInventoryDrop({
          data,
          target
        });

      if (!result.ok) {
        k8FloatingText(event, result.message, "warn");
        return;
      }

      for (const sheet of K8ContainerSheet.openSheets ?? []) {
        await sheet.render(true);
      }

      for (const sheet of globalThis.k8DiscardPileSheets ?? []) {
        await sheet.render(true);
      }
    }

  }