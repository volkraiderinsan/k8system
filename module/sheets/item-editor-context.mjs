import {
  renderK8Markdown
} from "../utils/k8-markdown.mjs";

export async function prepareK8ItemEditorContext(item) {
    return {
      descriptionHtml:
        await renderK8Markdown(item.system?.description ?? ""),
      item,
      system: item.system,
      type: item.type,
  
      itemEditorTabs: [
        { key: "core", label: "Core" },
        { key: "container", label: "Container" },
        { key: "text", label: "Text" },
        { key: "effects", label: "Effects" }
      ],
  
      equipmentSlots: [
        "head",
        "torso",
        "arms",
        "legs",
        "outfit",
        "back",
        "battery",
        "shoulder-1",
        "shoulder-2",
        "quick",
        "tactical",
        "social"
      ],
  
      containerKindOptions: {
        "": "",
        equipment: "EquipmentContainer",
        grid: "GridContainer"
      }
      
    };
  }
  
  export function activateK8ItemEditorTabs(app) {
    app._k8ItemEditorMode ??= "readonly";
    app._k8ActiveItemTab ??= "core";
  
    const root = app.element.querySelector(".k8-item-sheet-body");
  
    const editButton =
      app.element.querySelector("[data-action='toggle-edit-mode']");
  
    const image =
      app.element.querySelector(".k8-item-image");
  
    const tabButtons =
      app.element.querySelectorAll("[data-k8-item-tab]");
  
    const tabPanels =
      app.element.querySelectorAll("[data-k8-item-tab-panel]");
  
    const activateTab = tabKey => {
      app._k8ActiveItemTab = tabKey;
  
      for (const button of tabButtons) {
        button.classList.toggle(
          "active",
          button.dataset.k8ItemTab === tabKey
        );
      }
  
      for (const panel of tabPanels) {
        panel.classList.toggle(
          "active",
          panel.dataset.k8ItemTabPanel === tabKey
        );
      }
    };
  
    const applyMode = () => {
      const isEdit = app._k8ItemEditorMode === "edit";
  
      root?.classList.toggle("is-edit", isEdit);
      root?.classList.toggle("is-readonly", !isEdit);
  
      if (editButton) {
        editButton.textContent = isEdit ? "Save" : "Edit";
      }
  
      activateTab(app._k8ActiveItemTab);
    };
  
    for (const button of tabButtons) {
      button.addEventListener("click", event => {
        event.preventDefault();
        activateTab(button.dataset.k8ItemTab);
      });
    }
  
    editButton?.addEventListener("click", event => {
      event.preventDefault();
  
      if (app._k8ItemEditorMode === "readonly") {
        app._k8ItemEditorMode = "edit";
        applyMode();
        return;
      }
  
      app._k8ItemEditorMode = "readonly";
  
      const form =
        app.element.closest("form") ?? app.element;
  
      form.requestSubmit?.();
  
      applyMode();
    });
  
    image?.addEventListener("click", event => {
      event.preventDefault();
  
      if (app._k8ItemEditorMode === "edit") {
        app.element
          .querySelector("[data-action='edit-image-hidden']")
          ?.click();
  
        return;
      }
  
      new ImagePopout(image.src, {
        title: app.title
      }).render(true);
    });
  
    applyMode();
  }

  export async function resizeK8ItemEditorToContent(app) {
    await new Promise(resolve => requestAnimationFrame(resolve));
  
    const body =
      app.element.querySelector(".k8-item-sheet-body");
  
    const windowEl =
      app.element.closest(".application");
  
    const contentEl =
      windowEl?.querySelector(".window-content");
  
    if (!body || !windowEl || !contentEl) return;
  
    const extraWidth =
      windowEl.offsetWidth - contentEl.clientWidth;
  
    const extraHeight =
      windowEl.offsetHeight - contentEl.clientHeight;
  
    const clamp = (value, min, max) =>
      Math.max(min, Math.min(max, value));
  
    const width = clamp(
      Math.ceil(body.scrollWidth + extraWidth + 24),
      500,
      800
    );
  
    const height = clamp(
      Math.ceil(body.scrollHeight + extraHeight + 24),
      330,
      600
    );
  
    const left = Math.max(
      0,
      Math.round((window.innerWidth - width) / 2)
    );
  
    const top = Math.max(
      0,
      Math.round((window.innerHeight - height) / 2)
    );
  
    await app.setPosition({
      left,
      top,
      width,
      height
    });
  }