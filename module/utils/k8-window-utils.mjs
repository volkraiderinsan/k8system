export async function closeK8WindowsByClass(className) {
    for (const app of Object.values(ui.windows ?? {})) {
      const element = app.element;
  
      if (element?.classList?.contains(className)) {
        await app.close?.();
      }
    }
  }