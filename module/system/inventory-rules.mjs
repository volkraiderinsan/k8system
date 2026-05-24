import {
    getDiscardPile,
    removeItemFromDiscardPileAndReturn,
    addItemToDiscardPile,
    addItemToDiscardPileAt,
    saveDiscardPile
  } from "../utils/discard-pile.mjs";

// ============================================
// RESULT HELPERS
// ============================================

export function ok(data = {}) {
    return {
      ok: true,
      ...data
    };
  }
  
  export function fail(message) {
    return {
      ok: false,
      message
    };
  }
  

  const K8_LEGAL_INVENTORY_ITEM_TYPES = new Set([
    "weapon",
    "armor",
    "gear",
    "attachment",
    "consumable",
    "misc"
  ]);

  export function isLegalInventoryItem(itemData) {
    return K8_LEGAL_INVENTORY_ITEM_TYPES.has(itemData?.type);
  }

  export function validateInventoryItemType(itemData) {
    if (!isLegalInventoryItem(itemData)) {
      return fail(
        "This item type cannot be placed in inventory."
      );
    }

    return ok();
  }

  // ============================================
  // STACK RULES
  // ============================================

  export function getItemQuantity(itemData) {
    return Math.max(
      1,
      Number(itemData.system?.quantity) || 1
    );
  }

  export function getItemStackMax(itemData) {
    return Math.max(
      1,
      Number(itemData.system?.stack?.max) || 1
    );
  }

  export function isStackableItem(itemData) {
    return getItemStackMax(itemData) > 1;
  }

  export function areItemsStackCompatible(sourceItem, targetItem) {
    if (!sourceItem || !targetItem) return false;

    if (!isStackableItem(sourceItem)) return false;
    if (!isStackableItem(targetItem)) return false;

    return (
      sourceItem.type === targetItem.type &&
      sourceItem.name === targetItem.name &&
      sourceItem.img === targetItem.img &&
      getItemStackMax(sourceItem) === getItemStackMax(targetItem)
    );
  }

  export function getStackFreeSpace(itemData) {
    return Math.max(
      0,
      getItemStackMax(itemData) - getItemQuantity(itemData)
    );
  }

  export function calculateStackMerge(sourceItem, targetItem) {
    if (!areItemsStackCompatible(sourceItem, targetItem)) {
      return fail("Items cannot be stacked.");
    }

    const sourceQuantity =
      getItemQuantity(sourceItem);

    const targetQuantity =
      getItemQuantity(targetItem);

    const freeSpace =
      getStackFreeSpace(targetItem);

    if (freeSpace <= 0) {
      return fail("Target stack is full.");
    }

    const movedQuantity =
      Math.min(sourceQuantity, freeSpace);

    return ok({
      movedQuantity,
      sourceQuantityAfter: sourceQuantity - movedQuantity,
      targetQuantityAfter: targetQuantity + movedQuantity,
      sourceConsumed: sourceQuantity - movedQuantity <= 0
    });
  }

  export function createSplitStackItemData(itemData, splitQuantity) {
    const quantity =
      getItemQuantity(itemData);

    const amount =
      Math.floor(Number(splitQuantity) || 0);

    if (amount <= 0 || amount >= quantity) {
      return null;
    }

    const clone =
      foundry.utils.deepClone(itemData);

    delete clone._id;
    delete clone.id;

    clone.id =
      foundry.utils.randomID();

    clone.system ??= {};
    clone.system.equipment ??= {};

    clone.system.quantity = amount;
    clone.system.equipment.equipped = false;
    clone.system.equipment.slot = "";

    return clone;
  }

  export function calculateStackSplit(
    sourceItemData,
    moveQuantity
  ) {
    const quantity =
      getItemQuantity(sourceItemData);

    const stackMax =
      getItemStackMax(sourceItemData);

    const amount =
      Math.floor(Number(moveQuantity) || 0);

    if (stackMax <= 1) {
      return fail("This item cannot be split.");
    }

    if (quantity <= 1) {
      return fail("This stack cannot be split.");
    }

    if (
      amount <= 0 ||
      amount >= quantity
    ) {
      return fail("Invalid split amount.");
    }

    return ok({
      sourceQuantityBefore: quantity,
      sourceQuantityAfter: quantity - amount,
      splitQuantity: amount
    });
  }

  export async function promptAdvancedStackSplitQuantity(itemData) {
    const quantity =
      getItemQuantity(itemData);

    const stackMax =
      getItemStackMax(itemData);

    if (
      stackMax <= 1 ||
      quantity <= 1
    ) {
      return null;
    }

    const defaultMove =
      Math.floor(quantity / 2);

    const donorAfter =
      quantity - defaultMove;

    const targetAfter =
      defaultMove;

    const name =
      foundry.utils.escapeHTML?.(itemData.name) ??
      itemData.name;

    const img =
      foundry.utils.escapeHTML?.(itemData.img) ??
      itemData.img;

    return new Promise(resolve => {
      let settled = false;

      const dialog =
        new Dialog({
          title: `Split ${itemData.name}`,
          content: `
            <form class="k8-stack-split-dialog">
              <style>
                .k8-stack-split-dialog .k8-split-preview {
                  display: grid;
                  grid-template-columns: 72px 1fr 72px;
                  gap: 12px;
                  align-items: center;
                  margin-bottom: 12px;
                }
                .k8-stack-split-dialog .k8-split-card {
                  position: relative;
                  width: 64px;
                  height: 64px;
                  border: 1px solid rgba(255,255,255,0.25);
                  border-radius: 6px;
                  overflow: hidden;
                  background: rgba(0,0,0,0.25);
                }
                .k8-stack-split-dialog .k8-split-card img {
                  width: 100%;
                  height: 100%;
                  object-fit: cover;
                  display: block;
                }
                .k8-stack-split-dialog .k8-item-stack-count {
                  position: absolute;
                  left: 4px;
                  bottom: 2px;
                  font-family: "Tektur", sans-serif;
                  font-size: 15px;
                  font-weight: 700;
                  line-height: 1;
                  color: white;
                  text-shadow:
                    0 0 2px black,
                    0 0 4px black;
                  pointer-events: none;
                }
                .k8-stack-split-dialog .k8-split-label {
                  margin-top: 4px;
                  font-size: 11px;
                  text-align: center;
                  opacity: 0.8;
                }
                .k8-stack-split-dialog input[type="range"] {
                  width: 100%;
                }
              </style>

              <div class="k8-split-preview">
                <div>
                  <div class="k8-split-card">
                    <img src="${img}" alt="${name}" />
                    <span class="k8-item-stack-count" data-k8-donor-count>${donorAfter}</span>
                  </div>
                  <div class="k8-split-label">Donor</div>
                </div>

                <div>
                  <input
                    type="range"
                    name="moveQuantity"
                    min="1"
                    max="${quantity - 1}"
                    value="${defaultMove}"
                    step="1"
                    oninput="
                      const move = Number(this.value);
                      this.form.querySelector('[data-k8-target-count]').textContent = move;
                      this.form.querySelector('[data-k8-donor-count]').textContent = ${quantity} - move;
                    "
                  />
                </div>

                <div>
                  <div class="k8-split-card">
                    <img src="${img}" alt="${name}" />
                    <span class="k8-item-stack-count" data-k8-target-count>${targetAfter}</span>
                  </div>
                  <div class="k8-split-label">Target</div>
                </div>
              </div>
            </form>
          `,
          buttons: {
            split: {
              label: "Split",
              callback: html => {
                const root =
                  html?.[0] ?? html;

                const input =
                  root?.querySelector?.("[name='moveQuantity']") ??
                  html?.find?.("[name='moveQuantity']")?.[0];

                const value =
                  Math.floor(Number(input?.value) || 0);

                settled = true;

                resolve(
                  value > 0 && value < quantity
                    ? value
                    : null
                );
              }
            },
            cancel: {
              label: "Cancel",
              callback: () => {
                settled = true;
                resolve(null);
              }
            }
          },
          default: "split",
          close: () => {
            if (!settled) {
              resolve(null);
            }
          }
        });

      dialog.render(true);
    });
  }

  export async function stackSplitSourceFromDropData(
    data,
    fallbackActor = null
  ) {
    if (!data) return null;

    if (data.type === "Item") {
      let droppedItem = null;

      try {
        droppedItem =
          await Item.implementation.fromDropData(
            data
          );
      } catch {
        droppedItem = null;
      }

      const actor =
        droppedItem?.parent?.documentName === "Actor"
          ? droppedItem.parent
          : data.actorId
            ? game.actors.get(data.actorId)
            : fallbackActor;

      const itemId =
        data.itemId ??
        droppedItem?.id ??
        droppedItem?._id ??
        null;

      if (!actor || !itemId) {
        return null;
      }

      return {
        type: "actorItem",
        actor,
        itemId
      };
    }

    if (data.type === "K8ContainedItem") {
      const containerItem =
        await fromUuid(data.containerUuid);

      if (!containerItem || !data.itemId) {
        return null;
      }

      return {
        type: "containerItem",
        containerItem,
        itemId: data.itemId
      };
    }

    if (data.type === "K8DiscardItem") {
      if (!data.itemId) {
        return null;
      }

      return {
        type: "discardItem",
        itemId: data.itemId
      };
    }

    return null;
  }

  export async function getStackSplitSourceItemData(source) {
    if (!source) return null;

    if (source.type === "actorItem") {
      const item =
        source.actor?.items?.get(source.itemId);

      return item
        ? item.toObject()
        : null;
    }

    if (source.type === "containerItem") {
      const items =
        source.containerItem?.system?.container?.items ?? [];

      const item =
        items.find(entry => entry.id === source.itemId);

      return item
        ? foundry.utils.deepClone(item)
        : null;
    }

    if (source.type === "discardItem") {
      const pile =
        getDiscardPile();

      const item =
        (pile.items ?? []).find(
          entry => entry.id === source.itemId
        );

      return item
        ? foundry.utils.deepClone(item)
        : null;
    }

    return null;
  }

  async function updateStackSplitSourceQuantity(
    source,
    quantityAfter,
    tx = null
  ) {
    if (source.type === "actorItem") {
      const item =
        source.actor?.items?.get(source.itemId);

      if (!item) {
        return fail("Source item not found.");
      }

      if (tx) {
        await tx.updateDocument(
          item,
          {
            "system.quantity": quantityAfter
          }
        );
      } else {
        await item.update({
          "system.quantity": quantityAfter
        });
      }

      return ok();
    }

    if (source.type === "containerItem") {
      const container =
        foundry.utils.deepClone(
          source.containerItem.system?.container ?? {}
        );

      let found = false;

      const updated =
        (container.items ?? []).map(item => {
          if (item.id !== source.itemId) {
            return item;
          }

          found = true;
          item.system ??= {};
          item.system.quantity =
            quantityAfter;

          return item;
        });

      if (!found) {
        return fail("Source item not found.");
      }

      if (tx) {
        await tx.updateDocument(
          source.containerItem,
          {
            "system.container.items": updated
          }
        );
      } else {
        await source.containerItem.update({
          "system.container.items": updated
        });
      }

      return ok();
    }

    if (source.type === "discardItem") {
      const pile =
        getDiscardPile();

      let found = false;

      pile.items =
        (pile.items ?? []).map(item => {
          if (item.id !== source.itemId) {
            return item;
          }

          found = true;
          item.system ??= {};
          item.system.quantity =
            quantityAfter;

          return item;
        });

      if (!found) {
        return fail("Source item not found.");
      }

      await saveDiscardPile(pile);

      return ok();
    }

    return fail("Unsupported split source.");
  }

  async function placeStackSplitTarget(
    target,
    splitData,
    tx = null
  ) {
    if (target.type === "actorInventory") {
      const data =
        foundry.utils.deepClone(splitData);

      delete data._id;
      delete data.id;
      delete data.x;
      delete data.y;

      data.system ??= {};
      data.system.equipment ??= {};
      data.system.equipment.equipped = false;
      data.system.equipment.slot = "";

      const created = tx
        ? await tx.createEmbeddedDocuments(
            target.actor,
            "Item",
            [data]
          )
        : await target.actor.createEmbeddedDocuments(
            "Item",
            [data]
          );

      return ok({
        item: created?.[0] ?? null
      });
    }

    if (target.type === "smartInventory") {
      return smartPlaceIntoInventory(
        target.actor,
        splitData,
        {
          excludedContainerIds:
            target.excludedContainerIds ?? [],
          onPlace:
            target.onPlace ?? null,
          tx
        }
      );
    }

    if (target.type === "containerGrid") {
      const container =
        foundry.utils.deepClone(
          target.containerItem.system?.container ?? {}
        );

      const itemData =
        foundry.utils.deepClone(splitData);

      itemData.x = target.x;
      itemData.y = target.y;

      const validation =
        validateGridPlacement({
          container,
          itemData,
          x: target.x,
          y: target.y
        });

      if (!validation.ok) {
        return validation;
      }

      const items =
        foundry.utils.deepClone(
          container.items ?? []
        );

      items.push(itemData);

      if (tx) {
        await tx.updateDocument(
          target.containerItem,
          {
            "system.container.items": items
          }
        );
      } else {
        await target.containerItem.update({
          "system.container.items": items
        });
      }

      return ok({
        item: itemData,
        containerItem: target.containerItem
      });
    }

    if (target.type === "discardGrid") {
      const itemData =
        foundry.utils.deepClone(splitData);

      itemData.x = target.x;
      itemData.y = target.y;

      const success =
        await addItemToDiscardPileAt(
          itemData,
          target.x,
          target.y
        );

      if (!success) {
        return fail("Item does not fit here.");
      }

      return ok({
        item: itemData
      });
    }

    return fail("Unsupported split target.");
  }

  export async function performStackSplit({
    source,
    target,
    moveQuantity,
    tx = null
  }) {
    const sourceItemData =
      await getStackSplitSourceItemData(source);

    if (!sourceItemData) {
      return fail("Source item not found.");
    }

    const split =
      calculateStackSplit(
        sourceItemData,
        moveQuantity
      );

    if (!split.ok) {
      return split;
    }

    const splitData =
      createSplitStackItemData(
        sourceItemData,
        split.splitQuantity
      );

    if (!splitData) {
      return fail("This stack cannot be split.");
    }

    const placed =
      await placeStackSplitTarget(
        target,
        splitData,
        tx
      );

    if (!placed.ok) {
      return placed;
    }

    const updated =
      await updateStackSplitSourceQuantity(
        source,
        split.sourceQuantityAfter,
        tx
      );

    if (!updated.ok) {
      return updated;
    }

    return ok({
      split: true,
      item: placed.item ?? null,
      sourceQuantityAfter:
        split.sourceQuantityAfter,
      splitQuantity:
        split.splitQuantity,
      sourceItemData
    });
  }


  // ============================================
  // ITEM SIZE
  // ============================================
  
  export function getItemSize(itemData) {
    return {
      width:
        Number(itemData.system?.inventory?.width) || 1,
  
      height:
        Number(itemData.system?.inventory?.height) || 1
    };
  }
  
  // ============================================
  // GRID FIT
  // ============================================
  
  export function doesItemFitInGrid(
    container,
    itemData,
    x,
    y,
    ignoredId = null
  ) {
  
    const containerWidth =
      Number(container.width) || 1;
  
    const containerHeight =
      Number(container.height) || 1;
  
    const { width, height } =
      getItemSize(itemData);
  
    if (x < 0 || y < 0) {
      return false;
    }
  
    if (x + width > containerWidth) {
      return false;
    }
  
    if (y + height > containerHeight) {
      return false;
    }
  
    const items = container.items ?? [];
  
    for (const other of items) {
  
      if (
        ignoredId &&
        other.id === ignoredId
      ) {
        continue;
      }
  
      const otherX =
        Number(other.x) || 0;
  
      const otherY =
        Number(other.y) || 0;
  
      const otherSize =
        getItemSize(other);
  
      const overlaps =
        x < otherX + otherSize.width &&
        x + width > otherX &&
        y < otherY + otherSize.height &&
        y + height > otherY;
  
      if (overlaps) {
        return false;
      }
    }
  
    return true;
  }
  
  // ============================================
  // GRID VALIDATION
  // ============================================
  
  export function validateGridPlacement({
    container,
    itemData,
    x,
    y,
    ignoredId = null
  }) {
  
    const isGridContainer =
      itemData.system?.container?.enabled === true &&
      itemData.system?.container?.kind === "grid";
  
    const hasStoredItems =
      (itemData.system?.container?.items ?? []).length > 0;
  
    if (
      isGridContainer &&
      hasStoredItems
    ) {
      return fail(
        "Cannot move non-empty grid container."
      );
    }
  
    if (
      !doesItemFitInGrid(
        container,
        itemData,
        x,
        y,
        ignoredId
      )
    ) {
      return fail(
        "Item does not fit here."
      );
    }
  
    return ok();
  }
  
  // ============================================
  // EQUIPMENT VALIDATION
  // ============================================
  
  export function isItemValidForSlot(
    item,
    slotKey
  ) {
  
    const type = item.type;
  
    const itemSlot =
      item.system?.equipment?.slotType ?? "";
  
    const width =
      Number(item.system?.inventory?.width) || 1;
  
    const height =
      Number(item.system?.inventory?.height) || 1;
  
    if (slotKey.startsWith("quick-")) {
      return width === 1 && height === 1;
    }
  
    if (slotKey.startsWith("tactical-")) {
      return itemSlot === "tactical";
    }
  
    if (slotKey.startsWith("social-")) {
  
      const index =
        Number(slotKey.split("-")[1]) || 0;
  
      return (
        itemSlot === "social" &&
        index >= 1 &&
        index <= 6
      );
    }
  
    switch (slotKey) {
  
      case "head":
        return itemSlot === "head";
  
      case "torso":
        return itemSlot === "torso";
  
      case "arms":
        return itemSlot === "arms";
  
      case "legs":
        return itemSlot === "legs";
  
      case "outfit":
        return itemSlot === "outfit";
  
      case "back":
        return itemSlot === "back";
  
      case "battery":
        return itemSlot === "battery";
  
      case "shoulder-1":
      case "shoulder-2":
      case "shoulder-3":
      case "shoulder-4":
  
        return (
          type === "weapon" &&
          height === 1 &&
          (width === 2 || width === 3)
        );
  
      default:
        return false;
    }
  }
  
  export function validateEquipAction({
    item,
    slotKey
  }) {
  
    if (
      !isItemValidForSlot(
        item,
        slotKey
      )
    ) {
      return fail(
        "This item cannot be equipped in that slot."
      );
    }
  
    return ok();
  }

  
export async function mergeItemDataIntoContainerStack(
  containerItem,
  itemData,
  options = {}
) {
  const {
    ignoredId = null,
    tx = null
  } = options;

  const container =
    foundry.utils.deepClone(
      containerItem.system?.container ?? {}
    );

  const items =
    container.items ?? [];

  const targetStack =
    items.find(existing => {
      if (
        ignoredId &&
        existing.id === ignoredId
      ) {
        return false;
      }

      return calculateStackMerge(
        itemData,
        existing
      ).ok;
    });

  if (!targetStack) {
    return fail("No compatible stack found.");
  }

  const merge =
    calculateStackMerge(
      itemData,
      targetStack
    );

  if (!merge.ok) {
    return merge;
  }

  targetStack.system ??= {};
  targetStack.system.quantity =
    merge.targetQuantityAfter;

  if (tx) {
    await tx.updateDocument(
      containerItem,
      {
        "system.container.items": items
      }
    );
  } else {
    await containerItem.update({
      "system.container.items": items
    });
  }

  return ok({
    action: "merge",
    merged: true,
    targetStack,
    movedQuantity: merge.movedQuantity,
    sourceQuantityAfter: merge.sourceQuantityAfter,
    targetQuantityAfter: merge.targetQuantityAfter,
    sourceConsumed: merge.sourceConsumed
  });
}


// ============================================
// SMART INVENTORY
// ============================================

export function getSmartInventoryContainers(
    actor,
    excludedContainerIds = []
  ) {
  
    const equipped =
      actor.items.filter(item =>
        item.system?.equipment?.equipped === true &&
        item.system?.container?.enabled === true &&
        item.system?.container?.kind === "grid"
      );
  
    const backContainers =
      equipped.filter(item =>
        item.system?.equipment?.slot === "back"
      );
  
    const tacticalContainers =
      equipped.filter(item =>
        item.system?.equipment?.slot?.startsWith(
          "tactical-"
        )
      );
  
    return [
      ...backContainers,
      ...tacticalContainers
    ].filter(container =>
      !excludedContainerIds.includes(
        container.id
      )
    );
  }
  
  export function findFirstFreeGridPosition(
    container,
    itemData
  ) {
  
    const width =
      Number(container.width) || 1;
  
    const height =
      Number(container.height) || 1;
  
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
  
        if (
          doesItemFitInGrid(
            container,
            itemData,
            x,
            y
          )
        ) {
          return { x, y };
        }
      }
    }
  
    return null;
  }

  // ============================================
// SMART PLACE
// ============================================

export async function smartPlaceIntoInventory(
    actor,
    itemData,
    options = {}
  ) {

    const {
        excludedContainerIds = [],
        onPlace = null,
        tx = null,
        skipMerge = false
      } = options;

    const containers =
      getSmartInventoryContainers(
        actor,
        excludedContainerIds
      );

    const remainingItem =
      foundry.utils.deepClone(itemData);

    if (!skipMerge) {
      for (const containerItem of containers) {
        const merge =
          await mergeItemDataIntoContainerStack(
            containerItem,
            remainingItem,
            {
              ignoredId: remainingItem.id,
              tx
            }
          );

        if (!merge.ok) continue;

        if (onPlace) {
          await onPlace(containerItem);
        }

        if (merge.sourceConsumed) {
          return ok({
            merged: true,
            containerItem,
            movedQuantity: merge.movedQuantity
          });
        }

        remainingItem.system ??= {};
        remainingItem.system.quantity =
          merge.sourceQuantityAfter;
      }
    }

    for (const containerItem of containers) {

      const container =
        foundry.utils.deepClone(
          containerItem.system.container ?? {}
        );

      const position =
        findFirstFreeGridPosition(
          container,
          remainingItem
        );

      if (!position) {
        continue;
      }

      const placedItem =
        foundry.utils.deepClone(remainingItem);

      placedItem.x = position.x;
      placedItem.y = position.y;

      const items =
        foundry.utils.deepClone(
          container.items ?? []
        );

      items.push(placedItem);

      if (tx) {
        await tx.updateDocument(
          containerItem,
          {
            "system.container.items": items
          }
        );
      } else {
        await containerItem.update({
          "system.container.items": items
        });
      }

      if (onPlace) {
        await onPlace(containerItem);
      }

      return ok({
        containerItem,
        position,
        item: placedItem
      });
    }

    return fail(
      "Not enough space in inventory"
    );
  }

  // ============================================
  // SMART UNLOAD
  // ============================================
  
  export async function smartUnloadItem(
    actor,
    item,
    options = {}
  ) {
  
    const {
        excludedContainerIds = [],
        onPlace = null,
        tx = null
      } = options;
  
    const isGridContainer =
      item.system?.container?.enabled === true &&
      item.system?.container?.kind === "grid";
  
    // -----------------------------------
    // UNLOAD CONTAINER CONTENTS
    // -----------------------------------
  
    if (isGridContainer) {
  
      const storedItems =
        foundry.utils.deepClone(
          item.system?.container?.items ?? []
        );
  
      for (const containedItem of storedItems) {
  
        const tempItem =
          foundry.utils.deepClone(
            containedItem
          );
  
        tempItem.system.equipment.equipped = false;
        tempItem.system.equipment.slot = "";
  
        const moved =
          await smartPlaceIntoInventory(
            actor,
            tempItem,
            {
                excludedContainerIds: [
                  item.id,
                  ...excludedContainerIds
                ],
              
                onPlace,
                tx
              }
          );
  
        if (!moved.ok) {
          return moved;
        }
      }
  
      if (tx) {
        await tx.updateDocument(
          item,
          {
            "system.container.items": []
          }
        );
      } else {
        await item.update({
          "system.container.items": []
        });
      }
    }
  
    // -----------------------------------
    // MOVE CONTAINER ITSELF
    // -----------------------------------
  
    const itemData =
        createUnequippedItemData(
            item.toObject()
        );
  
    const moved =
      await smartPlaceIntoInventory(
        actor,
        itemData,
        {
          excludedContainerIds: [
            item.id,
            ...excludedContainerIds
          ],
  
          onPlace,
          tx
        }
      );
  
    if (!moved.ok) {
      return moved;
    }
  
    if (tx) {
        await tx.deleteDocument(item);
      } else {
        await item.delete();
      }
  
    return ok();
  }

  // ============================================
// EQUIPPED LOOKUP
// ============================================

export function getEquippedItemBySlot(actor, slotKey) {
    return actor.items.find(item =>
      item.system?.equipment?.equipped === true &&
      item.system?.equipment?.slot === slotKey
    ) ?? null;
  }

  // ============================================
// DYNAMIC SLOTS
// ============================================

export function prepareDynamicSlots(actor) {

    const equippedGear = actor.items.filter(item =>
      item.type === "gear" &&
      item.system?.equipment?.equipped === true
    );
  
    const tacticalCount =
      equippedGear.reduce((sum, item) => {
        return sum + (
          Number(
            item.system?.gear?.grants?.tacticalSlots
          ) || 0
        );
      }, 0);
  
    const quickCount =
      1 + equippedGear.reduce((sum, item) => {
        return sum + (
          Number(
            item.system?.gear?.grants?.quickSlots
          ) || 0
        );
      }, 0);
  
    const occupiedSocialItems =
      actor.items.filter(item =>
        item.system?.equipment?.equipped === true &&
        item.system?.equipment?.slot?.startsWith(
          "social-"
        )
      );
  
    const highestOccupiedSocialSlot =
      occupiedSocialItems.reduce((max, item) => {
  
        const slot =
          item.system?.equipment?.slot ?? "";
  
        const index =
          Number(
            slot.split("-")[1]
          ) || 0;
  
        return Math.max(max, index);
  
      }, 0);
  
    const socialCount = Math.min(
      6,
      Math.max(
        1,
        highestOccupiedSocialSlot >= 6
          ? 6
          : highestOccupiedSocialSlot + 1
      )
    );
  
    return {
  
      tactical: Array.from(
        { length: tacticalCount },
        (_, index) => ({
          key: `tactical-${index + 1}`,
          label: `Tactical ${index + 1}`,
          item: getEquippedItemBySlot(
            actor,
            `tactical-${index + 1}`
          )
        })
      ),
  
      quick: Array.from(
        { length: quickCount },
        (_, index) => ({
          key: `quick-${index + 1}`,
          label: `Quick ${index + 1}`,
          item: getEquippedItemBySlot(
            actor,
            `quick-${index + 1}`
          )
        })
      ),
  
      social: Array.from(
        { length: socialCount },
        (_, index) => ({
          key: `social-${index + 1}`,
          label: `Social ${index + 1}`,
          item: getEquippedItemBySlot(
            actor,
            `social-${index + 1}`
          )
        })
      )
    };
  }
  
  export async function normalizeSocialSlots(
    actor,
    options = {}
  ) {
  
    const {
      tx = null
    } = options;
  
    const socialItems =
      actor.items
        .filter(item =>
          item.system?.equipment?.equipped === true &&
          item.system?.equipment?.slot?.startsWith(
            "social-"
          )
        )
        .sort((a, b) => {
  
          const aIndex =
            Number(
              a.system.equipment.slot
                .split("-")[1]
            ) || 0;
  
          const bIndex =
            Number(
              b.system.equipment.slot
                .split("-")[1]
            ) || 0;
  
          return aIndex - bIndex;
        });
  
    for (let i = 0; i < socialItems.length; i++) {
  
      const expectedSlot =
        `social-${i + 1}`;
  
      if (
        socialItems[i].system.equipment.slot !==
        expectedSlot
      ) {
  
        if (tx) {
            await tx.updateDocument(
              socialItems[i],
              {
                "system.equipment.slot": expectedSlot
              }
            );
          } else {
            await socialItems[i].update({
              "system.equipment.slot": expectedSlot
            });
          }
      }
    }
  }

  async function moveInvalidSlotItemToDiscard(
    actor,
    item,
    options = {}
  ) {
    const {
      tx = null
    } = options;
  
    const itemData =
      createUnequippedItemData(
        item.toObject()
      );
  
    if (!tx?.dryRun) {
      await addItemToDiscardPile(itemData);
    }
  
    if (tx) {
      await tx.deleteDocument(item);
    } else {
      await item.delete();
    }
  
    await normalizeSocialSlots(
      actor,
      { tx }
    );
  
    return ok({
      discarded: true
    });
  }
  
  function shouldMoveInvalidSlotItemDirectlyToDiscard(item) {
    return (
      item.system?.container?.enabled === true &&
      item.system?.container?.kind === "grid" &&
      (item.system?.container?.items ?? []).length > 0
    );
  }

  // ============================================
// DYNAMIC SLOT RECONCILIATION
// ============================================

export async function reconcileDynamicSlots(
    actor,
    options = {}
  ) {
  
    const {
        onPlace = null,
        onFail = null,
        tx = null
      } = options;
  
    const dynamicSlots =
      prepareDynamicSlots(actor);
  
    const validSlots = new Set([
      ...dynamicSlots.quick.map(s => s.key),
      ...dynamicSlots.tactical.map(s => s.key),
      ...dynamicSlots.social.map(s => s.key)
    ]);
  
    const equippedItems =
      actor.items.filter(item =>
        item.system?.equipment?.equipped === true
      );
  
    const invalidItems =
      equippedItems.filter(item => {
  
        const slot =
          item.system?.equipment?.slot ?? "";
  
        if (slot.startsWith("quick-")) {
          return !validSlots.has(slot);
        }
  
        if (slot.startsWith("tactical-")) {
          return !validSlots.has(slot);
        }
  
        if (slot.startsWith("social-")) {
          return !validSlots.has(slot);
        }
  
        return false;
      });
  
      for (const item of invalidItems) {

        let moved = null;
      
        if (shouldMoveInvalidSlotItemDirectlyToDiscard(item)) {
          moved =
            await moveInvalidSlotItemToDiscard(
              actor,
              item,
              { tx }
            );
        } else {
          moved =
            await smartUnloadItem(
              actor,
              item,
              {
                onPlace,
                tx
              }
            );
      
          if (!moved.ok) {
            moved =
              await moveInvalidSlotItemToDiscard(
                actor,
                item,
                { tx }
              );
          }
        }
      
        if (!moved.ok && onFail) {
          await onFail(item, moved);
        }
      }
  }

  // ============================================
// EQUIP SLOT SEARCH
// ============================================

export function findBestEquipSlot(
    actor,
    itemData,
    baseSlots = []
  ) {
  
    const dynamicSlots =
      prepareDynamicSlots(actor);
  
    const candidateSlots = [
      ...baseSlots.map(s => s.key),
      ...dynamicSlots.quick.map(s => s.key),
      ...dynamicSlots.tactical.map(s => s.key),
      ...dynamicSlots.social.map(s => s.key)
    ];
  
    return candidateSlots.find(slot =>
      isItemValidForSlot(
        itemData,
        slot
      )
    ) ?? null;
  }

  // ============================================
// EQUIPPED ITEM DATA
// ============================================

export function createEquippedItemData(
    itemData,
    slotKey
  ) {
  
    const equipData =
      foundry.utils.deepClone(itemData);
  
    delete equipData.id;
    delete equipData._id;
    delete equipData.x;
    delete equipData.y;
  
    equipData.system.equipment.equipped = true;
    equipData.system.equipment.slot = slotKey;
  
    return equipData;
  }

  // ============================================
// EQUIP ITEM
// ============================================

export async function equipItemToSlot(
    actor,
    item,
    slotKey,
    options = {}
  ) {
  
    const {
        onPlace = null,
        onFail = null,
        tx = null
      } = options;

    const validationResult =
    validateEquipAction({
        item,
        slotKey
    });

    if (!validationResult.ok) {
    return validationResult;
    }
  
    const currentItem =
      actor.items.find(existing =>
        existing.system?.equipment?.slot === slotKey &&
        existing.system?.equipment?.equipped === true &&
        existing.id !== item.id
      );
  
        // -----------------------------------
    // STACK MERGE FIRST
    // -----------------------------------

    if (currentItem) {
      const merge =
        calculateStackMerge(
          item,
          currentItem
        );

      if (merge.ok) {
        if (tx) {
          await tx.updateDocument(
            currentItem,
            {
              "system.quantity":
                merge.targetQuantityAfter
            }
          );
        } else {
          await currentItem.update({
            "system.quantity":
              merge.targetQuantityAfter
          });
        }

        if (merge.sourceConsumed) {
          if (tx) {
            await tx.deleteDocument(item);
          } else {
            await item.delete();
          }
        } else if (tx) {
          await tx.updateDocument(
            item,
            {
              "system.quantity":
                merge.sourceQuantityAfter
            }
          );
        } else {
          await item.update({
            "system.quantity":
              merge.sourceQuantityAfter
          });
        }

        return ok({
          action: "merge",
          merged: true,
          item: currentItem,
          movedQuantity:
            merge.movedQuantity,
          sourceConsumed:
            merge.sourceConsumed
        });
      }
    }

// -----------------------------------
    // SWAP EQUIPPED ITEMS
    // -----------------------------------
  
    if (currentItem) {
  
      const sourceSlot =
        item.system?.equipment?.slot ?? "";
  
      const itemWasEquipped =
        item.system?.equipment?.equipped === true;
  
      if (
        itemWasEquipped &&
        sourceSlot &&
        sourceSlot !== slotKey
      ) {
  
        const equipResult =
          validateEquipAction({
            item: currentItem,
            slotKey: sourceSlot
          });
  
        if (!equipResult.ok) {
          return equipResult;
        }
  
        if (tx) {
            await tx.updateDocument(
              currentItem,
              {
                "system.equipment.equipped": true,
                "system.equipment.slot": sourceSlot
              }
            );
          } else {
            await currentItem.update({
              "system.equipment.equipped": true,
              "system.equipment.slot": sourceSlot
            });
          }
  
          if (tx) {
            await tx.updateDocument(
              item,
              {
                "system.equipment.equipped": true,
                "system.equipment.slot": slotKey
              }
            );
          } else {
            await item.update({
              "system.equipment.equipped": true,
              "system.equipment.slot": slotKey
            });
          }
  
        await reconcileDynamicSlots(
          actor,
          {
            onPlace,
            onFail,
            tx
          }
        );
  
        await normalizeSocialSlots(
            actor,
            {
              tx
            }
          );
  
        return ok({
          swapped: true,
          swappedItem: currentItem
        });
      }
  
      // -----------------------------------
      // UNEQUIP CURRENT
      // -----------------------------------
  
      if (tx) {
        await tx.updateDocument(
          currentItem,
          {
            "system.equipment.equipped": false,
            "system.equipment.slot": ""
          }
        );
      } else {
        await currentItem.update({
          "system.equipment.equipped": false,
          "system.equipment.slot": ""
        });
      }
  
      await reconcileDynamicSlots(
        actor,
        {
          onPlace,
          onFail,
          tx
        }
      );
  
      await normalizeSocialSlots(
        actor,
        {
          tx
        }
      );
    }
  
    // -----------------------------------
    // EQUIP TARGET
    // -----------------------------------
  
    if (tx) {
        await tx.updateDocument(
          item,
          {
            "system.equipment.equipped": true,
            "system.equipment.slot": slotKey
          }
        );
      } else {
        await item.update({
          "system.equipment.equipped": true,
          "system.equipment.slot": slotKey
        });
      }
  
    await reconcileDynamicSlots(
      actor,
      {
        onPlace,
        onFail,
        tx
      }
    );
  
    await normalizeSocialSlots(
        actor,
        {
          tx
        }
      );
  
    return ok({
      swapped: false,
      swappedItem: currentItem ?? null
    });
  }

  export function createUnequippedItemData(itemData) {
    const data =
      foundry.utils.deepClone(itemData);
  
    delete data._id;
  
    data.id =
      foundry.utils.randomID();
  
    data.system.equipment.equipped = false;
    data.system.equipment.slot = "";
  
    return data;
  }

  // ============================================
// EQUIP ITEM DATA TO ACTOR
// ============================================

export async function equipItemDataToActor(
    actor,
    itemData,
    slotKey,
    options = {}
  ) {
  
    const {
      onPlace = null,
      onFail = null,
      tx = null
    } = options;
  
    const validationResult =
      validateEquipAction({
        item: itemData,
        slotKey
      });
  
    if (!validationResult.ok) {
      return validationResult;
    }
  
    const existing =
      getEquippedItemBySlot(
        actor,
        slotKey
      );
  
        // -----------------------------------
    // STACK MERGE FIRST
    // -----------------------------------

    if (existing) {
      const merge =
        calculateStackMerge(
          itemData,
          existing
        );

      if (merge.ok) {
        if (tx) {
          await tx.updateDocument(
            existing,
            {
              "system.quantity":
                merge.targetQuantityAfter
            }
          );
        } else {
          await existing.update({
            "system.quantity":
              merge.targetQuantityAfter
          });
        }

        return ok({
          action: "merge",
          merged: true,
          item: existing,
          movedQuantity:
            merge.movedQuantity,
          sourceConsumed:
            merge.sourceConsumed
        });
      }
    }

// -----------------------------------
    // SWAP EXISTING ITEM
    // -----------------------------------
  
    if (existing) {
  
      const swapData =
        createUnequippedItemData(
          existing.toObject()
        );
  
        const moved =
        await smartPlaceIntoInventory(
          actor,
          swapData,
          {
            onPlace,
            tx
          }
        );
  
      if (!moved.ok) {
        return moved;
      }
  
      if (tx) {
        await tx.deleteDocument(existing);
      } else {
        await existing.delete();
      }
    }
  
    // -----------------------------------
    // CREATE EQUIPPED ITEM
    // -----------------------------------
  
    const equippedData =
      createEquippedItemData(
        itemData,
        slotKey
      );
  
      const created = tx
      ? await tx.createEmbeddedDocuments(
          actor,
          "Item",
          [equippedData]
        )
      : await actor.createEmbeddedDocuments(
          "Item",
          [equippedData]
        );
  
    await reconcileDynamicSlots(
      actor,
      {
        onPlace,
        onFail,
        tx
      }
    );
  
    await normalizeSocialSlots(
        actor,
        {
          tx
        }
      );
  
    return ok({
      item: created[0],
      swapped: Boolean(existing),
      swappedItem: existing ?? null
    });
  } 

  // ============================================
// EQUIP CONTAINER ITEM TO ACTOR
// ============================================

export async function equipContainerItemDataToActor(
  actor,
  itemData,
  slotKey,
  sourceContainer,
  sourceItemId,
  options = {}
) {
  const {
    onPlace = null,
    onFail = null,
    tx = null
  } = options;

  const validationResult =
    validateEquipAction({
      item: itemData,
      slotKey
    });

  if (!validationResult.ok) {
    return validationResult;
  }

  const container =
    foundry.utils.deepClone(
      sourceContainer.system?.container ?? {}
    );

  const containerItems =
    container.items ?? [];

  const remainingItems =
    containerItems.filter(
      item => item.id !== sourceItemId
    );

  const existing =
    getEquippedItemBySlot(
      actor,
      slotKey
    );

  // -----------------------------------
  // STACK MERGE FIRST
  // -----------------------------------

  if (existing) {
    const merge =
      calculateStackMerge(
        itemData,
        existing
      );

    if (merge.ok) {
      if (tx) {
        await tx.updateDocument(
          existing,
          {
            "system.quantity":
              merge.targetQuantityAfter
          }
        );
      } else {
        await existing.update({
          "system.quantity":
            merge.targetQuantityAfter
        });
      }

      const updatedSourceItems =
        merge.sourceConsumed
          ? containerItems.filter(
              item => item.id !== sourceItemId
            )
          : containerItems.map(item => {
              if (item.id !== sourceItemId) {
                return item;
              }

              item.system ??= {};
              item.system.quantity =
                merge.sourceQuantityAfter;

              return item;
            });

      if (tx) {
        await tx.updateDocument(
          sourceContainer,
          {
            "system.container.items":
              updatedSourceItems
          }
        );
      } else {
        await sourceContainer.update({
          "system.container.items":
            updatedSourceItems
        });
      }

      if (onPlace) {
        await onPlace(sourceContainer);
      }

      return ok({
        action: "merge",
        merged: true,
        item: existing,
        movedQuantity:
          merge.movedQuantity,
        sourceConsumed:
          merge.sourceConsumed
      });
    }
  }

  if (existing) {
    const swapData =
      createUnequippedItemData(
        existing.toObject()
      );

    const tempContainer =
      foundry.utils.deepClone(container);

    tempContainer.items = remainingItems;

    const position =
      findFirstFreeGridPosition(
        tempContainer,
        swapData
      );

    if (!position) {
      return fail(
        "Not enough space for swap."
      );
    }

    swapData.x = position.x;
    swapData.y = position.y;

    remainingItems.push(swapData);

    if (tx) {
        await tx.deleteDocument(existing);
      } else {
        await existing.delete();
      }
  }

  const equippedData =
    createEquippedItemData(
      itemData,
      slotKey
    );

    const created = tx
    ? await tx.createEmbeddedDocuments(
        actor,
        "Item",
        [equippedData]
      )
    : await actor.createEmbeddedDocuments(
        "Item",
        [equippedData]
      );

      if (tx) {
        await tx.updateDocument(
          sourceContainer,
          {
            "system.container.items": remainingItems
          }
        );
      } else {
        await sourceContainer.update({
          "system.container.items": remainingItems
        });
      }

  await reconcileDynamicSlots(
    actor,
    {
      onPlace,
      onFail,
      tx
    }
  );

  await normalizeSocialSlots(
    actor,
    {
      tx
    }
  );

  if (onPlace) {
    await onPlace(sourceContainer);
  }

  return ok({
    item: created[0],
    swapped: Boolean(existing),
    swappedItem: existing ?? null
  });
}

export async function extractContainerItemToActor(
    actor,
    sourceContainer,
    sourceItemId,
    options = {}
  ) {
  
    const {
      tx = null
    } = options;
  
    const container =
      foundry.utils.deepClone(
        sourceContainer.system?.container ?? {}
      );
  
    const items =
      container.items ?? [];
  
    const itemIndex =
      items.findIndex(
        item => item.id === sourceItemId
      );
  
    if (itemIndex === -1) {
      return fail(
        "Item not found in container."
      );
    }
  
    const itemData =
      foundry.utils.deepClone(
        items[itemIndex]
      );
  
    const remaining =
      items.filter(
        item => item.id !== sourceItemId
      );
  
    if (tx) {
      await tx.updateDocument(
        sourceContainer,
        {
          "system.container.items": remaining
        }
      );
    } else {
      await sourceContainer.update({
        "system.container.items": remaining
      });
    }
  
    delete itemData.id;
    delete itemData._id;
  
    const created = tx
      ? await tx.createEmbeddedDocuments(
          actor,
          "Item",
          [itemData]
        )
      : await actor.createEmbeddedDocuments(
          "Item",
          [itemData]
        );
  
    await normalizeSocialSlots(
      actor,
      { tx }
    );
  
    return ok({
      item: created[0]
    });
  }

// ============================================
// EQUIP DROPPED DATA TO SLOT
// ============================================

export async function equipDroppedDataToSlot(
    actor,
    data,
    slotKey,
    options = {}
  ) {
  
    const {
      event = null,
      onPlace = null,
      onFail = null
    } = options;
    
    return runInventoryTransaction(async tx => {
  
    // -----------------------------------
    // CONTAINER ITEM
    // -----------------------------------
  
    if (data.type === "K8ContainedItem") {
  
      const sourceContainer =
        await fromUuid(data.containerUuid);
  
      if (!sourceContainer) {
        return fail("Container not found.");
      }
  
      const container =
        foundry.utils.deepClone(
          sourceContainer.system?.container ?? {}
        );
  
      const containerItems =
        container.items ?? [];
  
      const containedItem =
        containerItems.find(
          item => item.id === data.itemId
        );
  
      if (!containedItem) {
        return fail("Item not found.");
      }
  
      return equipContainerItemDataToActor(
        actor,
        containedItem,
        slotKey,
        sourceContainer,
        data.itemId,
        {
          onPlace,
          onFail,
          tx
        }
      );
    }
  
    // -----------------------------------
    // DISCARD ITEM
    // -----------------------------------
  
    if (data.type === "K8DiscardItem") {
  
      const itemData =
        await removeItemFromDiscardPileAndReturn(
          data.itemId
        );
  
      if (!itemData) {
        return fail("Item not found.");
      }
  
      return equipItemDataToActor(
        actor,
        itemData,
        slotKey,
        {
          onPlace,
          onFail,
          tx
        }
      );
    }
  
    // -----------------------------------
    // NORMAL ITEM
    // -----------------------------------
  
    if (data.type === "Item") {
  
      let item =
        data.itemId
          ? actor.items.get(data.itemId)
          : null;
  
      if (!item) {
  
        const droppedItem =
          await Item.implementation.fromDropData(
            data
          );
  
        if (!droppedItem) {
          return fail("Item not found.");
        }
  
        const itemData =
          droppedItem.toObject();
  
        delete itemData._id;
  
        const createdItems =
            await tx.createEmbeddedDocuments(
                actor,
                "Item",
                [itemData]
            );
  
        item = createdItems[0];
      }
  
      if (!item) {
        return fail("Item not found.");
      }
  
      return equipItemToSlot(
        actor,
        item,
        slotKey,
        {
          onPlace,
          onFail,
          tx
        }
      );
    }
  
    return fail("Unsupported drop type.");
});  
}

  // ============================================
// INVENTORY TRANSACTION
// ============================================

export async function rollbackInventoryTransaction(tx) {

    console.warn(
      "Rolling back inventory transaction:",
      tx
    );
    tx.rollingBack = true;
  
    // -----------------------------------
    // REMOVE CREATED DOCUMENTS
    // -----------------------------------
  
    for (const document of [...tx.created].reverse()) {
  
      try {
        if (!document.deleted) {
          await document.delete();
        }
      } catch (error) {
        console.error(
          "Rollback delete failed:",
          error
        );
      }
    }
  
    // -----------------------------------
    // RESTORE UPDATED DOCUMENTS
    // -----------------------------------
  
    for (const entry of [...tx.updated].reverse()) {
  
      try {
  
        const {
          document,
          beforeData
        } = entry;
  
        if (!document.deleted) {
          await document.update(beforeData);
        }
  
      } catch (error) {
  
        console.error(
          "Rollback update failed:",
          error
        );
      }
    }
  
    // -----------------------------------
    // RESTORE DELETED DOCUMENTS
    // -----------------------------------
  
    for (const entry of [...tx.deleted].reverse()) {
  
      try {
  
        const {
          parent,
          documentData
        } = entry;
  
        await parent.createEmbeddedDocuments(
          "Item",
          [documentData]
        );
  
      } catch (error) {
  
        console.error(
          "Rollback recreate failed:",
          error
        );
      }
    }
  }

export async function runInventoryTransaction(
    operation,
    options = {}
  ) {
    const tx = {
    dryRun:
    options.dryRun === true,
      created: [],
      updated: [],
      deleted: [],
      rollingBack: false,
      committed: false,
      rolledBack: false,
      failed: false,

      async createEmbeddedDocuments(
        parent,
        type,
        data
      ) {
      
        if (this.dryRun) {
          return data.map(entry => ({
            ...entry,
            _id: foundry.utils.randomID()
          }));
        }
      
        const created =
          await parent.createEmbeddedDocuments(
            type,
            data
          );
      
        for (const document of created) {
          this.recordCreate(document);
        }
      
        return created;
      },
      
      async deleteDocument(document) {

        this.recordDelete(
          document.parent,
          document.toObject()
        );
      
        if (this.dryRun) {
          return;
        }
      
        await document.delete();
      },
      
      async updateDocument(
        document,
        changes
      ) {
      
        this.recordUpdate(
          document,
          document.toObject()
        );
      
        if (this.dryRun) {
          return;
        }
      
        await document.update(changes);
      },
  
      recordCreate(document) {
        if (this.rollingBack) return;
      
        this.created.push(document);
      },
  
      recordUpdate(document, beforeData) {
        if (this.rollingBack) return;
      
        this.updated.push({
          document,
          beforeData
        });
      },
  
      recordDelete(parent, documentData) {
        if (this.rollingBack) return;
      
        this.deleted.push({
          parent,
          documentData
        });
      }
    };
  
    try {
        const result = await operation(tx);

        if (!result?.ok) {
        
          tx.failed = true;
        
          await rollbackInventoryTransaction(tx);
        
          tx.rolledBack = true;
        
          return {
            ...result,
            transaction: tx
          };
        }
        
        tx.committed = true;
        
        return {
          ...result,
          transaction: tx
        };
    } catch (error) {
        console.error("Inventory transaction failed:", error);
        tx.failed = true;
      
        await rollbackInventoryTransaction(tx);
        tx.rolledBack = true;
      
        return fail(
          error?.message ?? "Inventory transaction failed."
        );
      }
  }

  export async function moveItemBetweenContainers(
    sourceContainer,
    targetContainer,
    itemData,
    options = {}
  ) {
  
    const {
      sourceItemId = null,
      x = 0,
      y = 0,
      tx = null
    } = options;
  
    const target =
      foundry.utils.deepClone(
        targetContainer.system?.container ?? {}
      );
  
    const movedItem =
      foundry.utils.deepClone(itemData);
  
    movedItem.x = x;
    movedItem.y = y;
  
    const validation =
      validateGridPlacement({
        container: target,
        itemData: movedItem,
        x,
        y,
        ignoredId: movedItem.id
      });
  
    if (!validation.ok) {
      return validation;
    }
  
    // -----------------------------------
    // TARGET UPDATE
    // -----------------------------------
  
    const targetItems =
      foundry.utils.deepClone(
        target.items ?? []
      );
  
    targetItems.push(movedItem);
  
    if (tx) {
      await tx.updateDocument(
        targetContainer,
        {
          "system.container.items": targetItems
        }
      );
    } else {
      await targetContainer.update({
        "system.container.items": targetItems
      });
    }
  
    // -----------------------------------
    // SOURCE UPDATE
    // -----------------------------------
  
    if (sourceContainer && sourceItemId) {
  
      const source =
        foundry.utils.deepClone(
          sourceContainer.system?.container ?? {}
        );
  
      const remaining =
        (source.items ?? []).filter(
          item => item.id !== sourceItemId
        );
  
      if (tx) {
        await tx.updateDocument(
          sourceContainer,
          {
            "system.container.items": remaining
          }
        );
      } else {
        await sourceContainer.update({
          "system.container.items": remaining
        });
      }
    }
  
    return ok({
      movedItem
    });
  }

  export async function moveDiscardItemToContainer(
    targetContainer,
    discardItemId,
    x,
    y,
    options = {}
  ) {
    const {
      tx = null
    } = options;
  
    const pile = getDiscardPile();
  
    const originalItem =
      pile.items.find(item => item.id === discardItemId);
  
    if (!originalItem) {
      return fail("Item not found.");
    }
  
    const itemData =
      foundry.utils.deepClone(originalItem);
  
    itemData.x = x;
    itemData.y = y;
  
    const target =
      foundry.utils.deepClone(
        targetContainer.system?.container ?? {}
      );
  
    const result =
      validateGridPlacement({
        container: target,
        itemData,
        x,
        y
      });
  
    if (!result.ok) {
      return result;
    }
  
    const items =
      foundry.utils.deepClone(target.items ?? []);
  
    items.push(itemData);
  
    if (tx) {
      await tx.updateDocument(
        targetContainer,
        {
          "system.container.items": items
        }
      );
    } else {
      await targetContainer.update({
        "system.container.items": items
      });
    }
  
    await removeItemFromDiscardPileAndReturn(discardItemId);
  
    return ok({
      item: itemData
    });
  }

  export async function moveActorItemToContainer(
    actor,
    item,
    targetContainer,
    x,
    y,
    options = {}
  ) {
  
    const {
      tx = null,
      onPlace = null,
      onFail = null
    } = options;
  
    const target =
      foundry.utils.deepClone(
        targetContainer.system?.container ?? {}
      );
  
    const itemData =
      createUnequippedItemData(
        item.toObject()
      );
  
    itemData.x = x;
    itemData.y = y;
  
    const validation =
      validateGridPlacement({
        container: target,
        itemData,
        x,
        y
      });
  
    if (!validation.ok) {
      return validation;
    }
  
    const items =
      foundry.utils.deepClone(
        target.items ?? []
      );
  
    items.push(itemData);
  
    if (tx) {
      await tx.updateDocument(
        targetContainer,
        {
          "system.container.items": items
        }
      );
    } else {
      await targetContainer.update({
        "system.container.items": items
      });
    }
  
    if (tx) {
        await tx.deleteDocument(item);
      } else {
        await item.delete();
      }
      
      await normalizeSocialSlots(
        actor,
        { tx }
      );
  
    return ok({
      item: itemData
    });
  }

  export async function moveContainerItemToDiscard(
    sourceContainer,
    sourceItemId,
    x,
    y,
    options = {}
  ) {
  
    const {
      tx = null
    } = options;
  
    const container =
      foundry.utils.deepClone(
        sourceContainer.system?.container ?? {}
      );
  
    const items =
      container.items ?? [];
  
    const item =
      items.find(
        entry => entry.id === sourceItemId
      );
  
    if (!item) {
      return fail("Item not found.");
    }
  
    const success =
      await addItemToDiscardPileAt(
        item,
        x,
        y
      );
  
    if (!success) {
      return fail(
        "Item does not fit here."
      );
    }
  
    const remaining =
      items.filter(
        entry => entry.id !== sourceItemId
      );
  
    if (tx) {
      await tx.updateDocument(
        sourceContainer,
        {
          "system.container.items": remaining
        }
      );
    } else {
      await sourceContainer.update({
        "system.container.items": remaining
      });
    }
  
    return ok({
      item
    });
  }

  export async function moveActorItemToDiscard(
    actor,
    item,
    x,
    y,
    options = {}
  ) {
    const {
      tx = null
    } = options;
  
    const itemData =
      createUnequippedItemData(
        item.toObject()
      );
  
    itemData.x = x;
    itemData.y = y;
  
    const success =
      await addItemToDiscardPileAt(
        itemData,
        x,
        y
      );
  
    if (!success) {
      return fail("Item does not fit here.");
    }
  
    if (tx) {
      await tx.deleteDocument(item);
    } else {
      await item.delete();
    }
  
    await normalizeSocialSlots(
      actor,
      { tx }
    );
  
    return ok({
      item: itemData
    });
  }


// ============================================
// CENTRAL INVENTORY OPERATION LAYER
// ============================================

export function createK8InventoryDragData({
  type,
  source,
  itemData,
  shiftKey = false
}) {
  const quantity = getItemQuantity(itemData);
  const stackMax = getItemStackMax(itemData);

  return {
    type,
    ...source,
    advancedSplit:
      shiftKey === true &&
      stackMax > 1 &&
      quantity > 1
  };
}

export async function inventorySourceFromDropData(
  data,
  fallbackActor = null
) {
  return stackSplitSourceFromDropData(
    data,
    fallbackActor
  );
}

export async function getInventorySourceItemData(source) {
  return getStackSplitSourceItemData(source);
}

function isSameInventoryRef(source, targetRef) {
  if (!source || !targetRef) return false;

  if (source.type === "actorItem" && targetRef.type === "actorItem") {
    return source.actor?.id === targetRef.actor?.id && source.itemId === targetRef.itemId;
  }

  if (source.type === "containerItem" && targetRef.type === "containerItem") {
    return source.containerItem?.uuid === targetRef.containerItem?.uuid && source.itemId === targetRef.itemId;
  }

  if (source.type === "discardItem" && targetRef.type === "discardItem") {
    return source.itemId === targetRef.itemId;
  }

  return false;
}

export function getItemAtGridPosition(
  container,
  x,
  y,
  ignoredId = null
) {
  return (container.items ?? []).find(item => {
    if (ignoredId && item.id === ignoredId) return false;

    const itemX = Number(item.x) || 0;
    const itemY = Number(item.y) || 0;
    const itemWidth = Number(item.system?.inventory?.width) || 1;
    const itemHeight = Number(item.system?.inventory?.height) || 1;

    return (
      x >= itemX &&
      x < itemX + itemWidth &&
      y >= itemY &&
      y < itemY + itemHeight
    );
  }) ?? null;
}

async function updateInventorySourceAfterQuantityChange(
  source,
  quantityAfter,
  options = {}
) {
  const { tx = null } = options;

  if (source.type === "actorItem") {
    const item = source.actor?.items?.get(source.itemId);
    if (!item) return fail("Source item not found.");

    if (quantityAfter <= 0) {
      if (tx) await tx.deleteDocument(item);
      else await item.delete();
    } else if (tx) {
      await tx.updateDocument(item, { "system.quantity": quantityAfter });
    } else {
      await item.update({ "system.quantity": quantityAfter });
    }

    return ok();
  }

  if (source.type === "containerItem") {
    const container = foundry.utils.deepClone(source.containerItem.system?.container ?? {});
    let found = false;

    const items = (container.items ?? []).flatMap(item => {
      if (item.id !== source.itemId) return [item];
      found = true;
      if (quantityAfter <= 0) return [];
      item.system ??= {};
      item.system.quantity = quantityAfter;
      return [item];
    });

    if (!found) return fail("Source item not found.");

    if (tx) await tx.updateDocument(source.containerItem, { "system.container.items": items });
    else await source.containerItem.update({ "system.container.items": items });

    return ok();
  }

  if (source.type === "discardItem") {
    const pile = getDiscardPile();
    let found = false;

    pile.items = (pile.items ?? []).flatMap(item => {
      if (item.id !== source.itemId) return [item];
      found = true;
      if (quantityAfter <= 0) return [];
      item.system ??= {};
      item.system.quantity = quantityAfter;
      return [item];
    });

    if (!found) return fail("Source item not found.");

    await saveDiscardPile(pile);
    return ok();
  }

  return fail("Unsupported source.");
}

async function updateInventoryTargetQuantity(
  targetRef,
  quantityAfter,
  options = {}
) {
  const { tx = null } = options;

  if (targetRef.type === "actorItem") {
    const item = targetRef.actor?.items?.get(targetRef.itemId);
    if (!item) return fail("Target item not found.");

    if (tx) await tx.updateDocument(item, { "system.quantity": quantityAfter });
    else await item.update({ "system.quantity": quantityAfter });

    return ok();
  }

  if (targetRef.type === "containerItem") {
    const container = foundry.utils.deepClone(targetRef.containerItem.system?.container ?? {});
    let found = false;

    const items = (container.items ?? []).map(item => {
      if (item.id !== targetRef.itemId) return item;
      found = true;
      item.system ??= {};
      item.system.quantity = quantityAfter;
      return item;
    });

    if (!found) return fail("Target item not found.");

    if (tx) await tx.updateDocument(targetRef.containerItem, { "system.container.items": items });
    else await targetRef.containerItem.update({ "system.container.items": items });

    return ok();
  }

  if (targetRef.type === "discardItem") {
    const pile = getDiscardPile();
    let found = false;

    pile.items = (pile.items ?? []).map(item => {
      if (item.id !== targetRef.itemId) return item;
      found = true;
      item.system ??= {};
      item.system.quantity = quantityAfter;
      return item;
    });

    if (!found) return fail("Target item not found.");

    await saveDiscardPile(pile);
    return ok();
  }

  return fail("Unsupported target.");
}

export async function performInventoryStackMerge({
  source,
  targetRef,
  tx = null
}) {
  if (isSameInventoryRef(source, targetRef)) {
    return fail("Cannot stack item with itself.");
  }

  const sourceItemData = await getInventorySourceItemData(source);
  const targetItemData = await getInventorySourceItemData(targetRef);

  if (!sourceItemData || !targetItemData) {
    return fail("Stack item not found.");
  }

  const merge = calculateStackMerge(sourceItemData, targetItemData);

  if (!merge.ok) return merge;

  const targetUpdated = await updateInventoryTargetQuantity(
    targetRef,
    merge.targetQuantityAfter,
    { tx }
  );

  if (!targetUpdated.ok) return targetUpdated;

  const sourceUpdated = await updateInventorySourceAfterQuantityChange(
    source,
    merge.sourceQuantityAfter,
    { tx }
  );

  if (!sourceUpdated.ok) return sourceUpdated;

  return ok({
    action: "merge",
    merged: true,
    movedQuantity: merge.movedQuantity,
    sourceConsumed: merge.sourceConsumed,
    sourceQuantityAfter: merge.sourceQuantityAfter,
    targetQuantityAfter: merge.targetQuantityAfter
  });
}

async function moveItemInDiscardPileCompat(itemId, x, y) {
  const pile = getDiscardPile();
  const items = pile.items ?? [];
  const index = items.findIndex(item => item.id === itemId);

  if (index === -1) return false;

  const moved = foundry.utils.deepClone(items[index]);
  const remaining = items.filter(item => item.id !== itemId);
  const tempPile = foundry.utils.deepClone(pile);

  tempPile.items = remaining;

  if (!doesItemFitInGrid(tempPile, moved, x, y)) {
    return false;
  }

  moved.x = x;
  moved.y = y;

  pile.items = [...remaining, moved];

  await saveDiscardPile(pile);
  return true;
}

async function placeInventorySourceIntoTarget({
  source,
  target,
  sourceItemData,
  tx = null
}) {
  if (target.type === "actorInventory") {
    const data = createUnequippedItemData(sourceItemData);

    const created = tx
      ? await tx.createEmbeddedDocuments(target.actor, "Item", [data])
      : await target.actor.createEmbeddedDocuments("Item", [data]);

    await updateInventorySourceAfterQuantityChange(source, 0, { tx });

    return ok({ action: "move", item: created?.[0] ?? null });
  }

  if (target.type === "smartInventory") {
    const data = createUnequippedItemData(sourceItemData);

    const placed = await smartPlaceIntoInventory(
      target.actor,
      data,
      {
        excludedContainerIds: target.excludedContainerIds ?? [],
        onPlace: target.onPlace ?? null,
        tx
      }
    );

    if (!placed.ok) return placed;

    await updateInventorySourceAfterQuantityChange(source, 0, { tx });

    return ok({ action: "move", ...placed });
  }

  if (target.type === "containerGrid") {
    if (source.type === "actorItem") {
      const item = source.actor?.items?.get(source.itemId);
      if (!item) return fail("Source item not found.");

      return moveActorItemToContainer(
        source.actor,
        item,
        target.containerItem,
        target.x,
        target.y,
        { tx }
      );
    }

    if (source.type === "containerItem") {
      return moveItemBetweenContainers(
        source.containerItem,
        target.containerItem,
        sourceItemData,
        {
          sourceItemId: source.itemId,
          x: target.x,
          y: target.y,
          tx
        }
      );
    }

    if (source.type === "discardItem") {
      return moveDiscardItemToContainer(
        target.containerItem,
        source.itemId,
        target.x,
        target.y,
        { tx }
      );
    }
  }

  if (target.type === "discardGrid") {
    if (source.type === "actorItem") {
      const item = source.actor?.items?.get(source.itemId);
      if (!item) return fail("Source item not found.");

      return moveActorItemToDiscard(
        source.actor,
        item,
        target.x,
        target.y,
        { tx }
      );
    }

    if (source.type === "containerItem") {
      return moveContainerItemToDiscard(
        source.containerItem,
        source.itemId,
        target.x,
        target.y,
        { tx }
      );
    }

    if (source.type === "discardItem") {
      const moved = await moveItemInDiscardPileCompat(
        source.itemId,
        target.x,
        target.y
      );

      return moved
        ? ok({ action: "move" })
        : fail("Item does not fit here.");
    }
  }

  return fail("Unsupported inventory move.");
}

export async function getInventoryTargetRefAtPosition(
  target,
  source = null
) {
  if (target.type === "containerGrid") {
    const container = target.containerItem.system?.container ?? {};

    const item = getItemAtGridPosition(
      container,
      target.x,
      target.y,
      source?.type === "containerItem" &&
      source.containerItem?.uuid === target.containerItem?.uuid
        ? source.itemId
        : null
    );

    return item
      ? {
          type: "containerItem",
          containerItem: target.containerItem,
          itemId: item.id
        }
      : null;
  }

  if (target.type === "discardGrid") {
    const pile = getDiscardPile();

    const item = getItemAtGridPosition(
      pile,
      target.x,
      target.y,
      source?.type === "discardItem"
        ? source.itemId
        : null
    );

    return item
      ? {
          type: "discardItem",
          itemId: item.id
        }
      : null;
  }

  if (target.type === "equipmentSlot") {
    const existing = getEquippedItemBySlot(
      target.actor,
      target.slotKey
    );

    return existing
      ? {
          type: "actorItem",
          actor: target.actor,
          itemId: existing.id
        }
      : null;
  }

  return null;
}

export async function performInventoryHalfSplit({
  source,
  target,
  tx = null
}) {
  const sourceItemData = await getInventorySourceItemData(source);

  if (!sourceItemData) {
    return fail("Source item not found.");
  }

  return performStackSplit({
    source,
    target,
    moveQuantity: Math.floor(getItemQuantity(sourceItemData) / 2),
    tx
  });
}

export async function performInventoryDrop({
  data,
  target,
  fallbackActor = null,
  splitQuantity = null,
  tx = null
}) {
  const source = await inventorySourceFromDropData(
    data,
    fallbackActor
  );

  if (!source) {
    return fail("Unsupported inventory source.");
  }

  const sourceItemData = await getInventorySourceItemData(source);

  if (!sourceItemData) {
    return fail("Source item not found.");
  }

  if (target.type === "equipmentSlot") {
    const targetRef = await getInventoryTargetRefAtPosition(
      target,
      source
    );

    if (targetRef) {
      const merge = await performInventoryStackMerge({
        source,
        targetRef,
        tx
      });

      if (merge.ok) return merge;
    }

    return equipDroppedDataToSlot(
      target.actor,
      data,
      target.slotKey,
      {
        onPlace: target.onPlace ?? null,
        onFail: target.onFail ?? null
      }
    );
  }

  const occupiedTarget = await getInventoryTargetRefAtPosition(
    target,
    source
  );

  if (occupiedTarget) {
    return performInventoryStackMerge({
      source,
      targetRef: occupiedTarget,
      tx
    });
  }

  if (data.advancedSplit === true) {
    if (splitQuantity === null || splitQuantity === undefined) {
      return fail("Split quantity required.");
    }

    return performStackSplit({
      source,
      target,
      moveQuantity: splitQuantity,
      tx
    });
  }

  return placeInventorySourceIntoTarget({
    source,
    target,
    sourceItemData,
    tx
  });
}
