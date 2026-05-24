const OPEN_DIALOGS = new Map();

function safeBringToFront(dialog) {
  try {
    dialog?.bringToFront?.();
  } catch {
    // Window may be closing or not fully rendered.
  }
}

export async function waitK8SingletonDialog(key, options) {
  const existing = OPEN_DIALOGS.get(key);

  if (existing) {
    safeBringToFront(existing.dialog);
    return existing.promise;
  }

  let resolvePromise;

  const promise = new Promise(resolve => {
    resolvePromise = resolve;
  });

  const settle = value => {
    OPEN_DIALOGS.delete(key);
    resolvePromise(value);
  };

  const buttons = (options.buttons ?? []).map(button => ({
    ...button,

    callback: async (event, htmlButton, dialog) => {
      const value = await button.callback?.(event, htmlButton, dialog);
      settle(value);
      return value;
    }
  }));

  const dialog = new foundry.applications.api.DialogV2({
    ...options,
    buttons,

    close: (...args) => {
      const value = options.close?.(...args);
      settle(null);
      return value;
    }
  });

  const originalClose = dialog.close.bind(dialog);

  dialog.close = async (...args) => {
    OPEN_DIALOGS.delete(key);
    return originalClose(...args);
  };

  OPEN_DIALOGS.set(key, {
    dialog,
    promise
  });

  await dialog.render(true);
  safeBringToFront(dialog);

  return promise;
}