const MIN_SIZE = 6;

function getItemSize(itemData) {
  return {
    width: Number(itemData.system?.inventory?.width) || 1,
    height: Number(itemData.system?.inventory?.height) || 1
  };
}

export function doesItemFit(container, itemData, x, y, ignoredId = null) {
  const { width, height } = getItemSize(itemData);

  if (x < 0 || y < 0) return false;
  if (x + width > container.width) return false;
  if (y + height > container.height) return false;

  for (const other of container.items ?? []) {
    if (ignoredId && other.id === ignoredId) continue;
    const otherSize = getItemSize(other);
    const otherX = Number(other.x) || 0;
    const otherY = Number(other.y) || 0;

    const overlaps =
      x < otherX + otherSize.width &&
      x + width > otherX &&
      y < otherY + otherSize.height &&
      y + height > otherY;

    if (overlaps) return false;
  }

  return true;
}

function findPosition(container, itemData) {
  for (let y = 0; y < container.height; y++) {
    for (let x = 0; x < container.width; x++) {
      if (doesItemFit(container, itemData, x, y)) return { x, y };
    }
  }

  return null;
}

export function getDiscardPile() {
  return foundry.utils.deepClone(
    game.settings.get("k8system", "discardPile") ?? {
      width: MIN_SIZE,
      height: MIN_SIZE,
      items: []
    }
  );
}

export async function saveDiscardPile(pile) {
  pile.width = Math.max(MIN_SIZE, Number(pile.width) || MIN_SIZE);
  pile.height = Math.max(MIN_SIZE, Number(pile.height) || MIN_SIZE);
  pile.items ??= [];

  await game.settings.set("k8system", "discardPile", pile);
}

export async function addItemToDiscardPile(itemData) {
  const pile = getDiscardPile();

  const stored = foundry.utils.deepClone(itemData);

  delete stored._id;

  stored.id = stored.id || foundry.utils.randomID();
  stored.system.equipment.equipped = false;
  stored.system.equipment.slot = "";

  let position = findPosition(pile, stored);

  while (!position) {
    pile.width += 1;
    pile.height += 1;
    position = findPosition(pile, stored);
  }

  stored.x = position.x;
  stored.y = position.y;

  pile.items.push(stored);

  await saveDiscardPile(pile);
}

export async function removeItemFromDiscardPile(itemId) {
  const pile = getDiscardPile();

  pile.items = (pile.items ?? []).filter(item => item.id !== itemId);

  shrinkDiscardPile(pile);

  await saveDiscardPile(pile);
}

export function shrinkDiscardPile(pile) {
  let changed = true;

  while (changed) {
    changed = false;

    if (pile.width > MIN_SIZE) {
      const rightColumnUsed = pile.items.some(item => {
        const size = getItemSize(item);
        return Number(item.x) + size.width >= pile.width;
      });

      if (!rightColumnUsed) {
        pile.width -= 1;
        changed = true;
      }
    }

    if (pile.height > MIN_SIZE) {
      const bottomRowUsed = pile.items.some(item => {
        const size = getItemSize(item);
        return Number(item.y) + size.height >= pile.height;
      });

      if (!bottomRowUsed) {
        pile.height -= 1;
        changed = true;
      }
    }
  }
}

export async function clearDiscardPile() {
  await saveDiscardPile({
    width: MIN_SIZE,
    height: MIN_SIZE,
    items: []
  });
}

export async function moveItemInDiscardPile(itemId, x, y) {
    const pile = getDiscardPile();
  
    const items = pile.items ?? [];
  
    const index =
      items.findIndex(item => item.id === itemId);
  
    if (index === -1) return false;
  
    const moved =
      foundry.utils.deepClone(items[index]);
  
    const tempItems =
      items.filter(item => item.id !== itemId);
  
    const tempPile = foundry.utils.deepClone(pile);
    tempPile.items = tempItems;
  
    if (!doesItemFit(tempPile, moved, x, y)) {
      return false;
    }
  
    moved.x = x;
    moved.y = y;
  
    tempItems.push(moved);
  
    pile.items = tempItems;
  
    await saveDiscardPile(pile);
  
    return true;
  }
  
  export async function removeItemFromDiscardPileAndReturn(itemId) {
    const pile = getDiscardPile();
  
    const items = pile.items ?? [];
  
    const item =
      items.find(item => item.id === itemId);
  
    if (!item) return null;
  
    pile.items =
      items.filter(item => item.id !== itemId);
  
    shrinkDiscardPile(pile);
  
    await saveDiscardPile(pile);
  
    return foundry.utils.deepClone(item);
  }
  
  export async function addItemToDiscardPileAt(itemData, x, y) {
    const pile = getDiscardPile();
  
    const stored =
      foundry.utils.deepClone(itemData);
  
    delete stored._id;
    
    stored.system.equipment.equipped = false;
    stored.system.equipment.slot = "";

    stored.id =
      stored.id || foundry.utils.randomID();
  
    if (!doesItemFit(pile, stored, x, y)) {
      return false;
    }
  
    stored.x = x;
    stored.y = y;
  
    pile.items.push(stored);
  
    await saveDiscardPile(pile);
  
    return true;
  }