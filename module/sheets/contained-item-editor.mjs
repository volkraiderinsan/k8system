const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
import {
    prepareK8ItemEditorContext,
    activateK8ItemEditorTabs,
    resizeK8ItemEditorToContent
  } from "./item-editor-context.mjs";

export class K8ContainedItemEditor extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    tag: "form",

    classes: ["k8system", "sheet", "item"],

    position: {
      width: 620,
      height: 720
    },

    window: {
      resizable: true
    },

    form: {
      submitOnChange: true,
      closeOnSubmit: false
    }
  };

  static PARTS = {
    form: {
      template: "systems/k8system/templates/item/item-sheet.hbs"
    }
  };

  constructor(containerItem, containedItemId, options = {}) {
    super(options);

    this.containerItem = containerItem;
    this.containedItemId = containedItemId;
  }

  get containedItem() {
    const items =
      this.containerItem.system?.container?.items ?? [];

    return items.find(
      item => item.id === this.containedItemId
    );
  }

  get title() {
    return this.containedItem?.name ?? "Contained Item";
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    const containedItem = this.containedItem;

    if (!containedItem) {
    ui.notifications.warn("Contained item no longer exists.");
    await this.close();
    return context;
    }

    const item =
    foundry.utils.deepClone(containedItem);

    Object.assign(
    context,
    await prepareK8ItemEditorContext(item)
    );

    return context;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
  
    const imageButton = this.element.querySelector("[data-action='edit-image-hidden']");
    if (!imageButton) return;
  
    imageButton.addEventListener("click", async event => {
      event.preventDefault();
      event.stopPropagation();
  
      const containedItem = this.containedItem;
      if (!containedItem) return;
  
      new FilePicker({
        type: "image",
        current: containedItem.img ?? "",
        callback: async path => {
          if (!path) return;
  
          const container = foundry.utils.deepClone(this.containerItem.system.container);
          const items = container.items ?? [];
  
          const index = items.findIndex(item => item.id === this.containedItemId);
          if (index === -1) return;
  
          items[index].img = path;
  
          await this.containerItem.update({
            "system.container.items": items
          });
  
          await this.render(true);
        }
      }).browse();
    });
    activateK8ItemEditorTabs(this);
    await resizeK8ItemEditorToContent(this);
  }

  async _onSubmitForm(formConfig, event) {
    event.preventDefault();

    const formData =
      new foundry.applications.ux.FormDataExtended(
        this.element
      );

    const updateData = foundry.utils.expandObject(
      formData.object
    );

    const container =
      foundry.utils.deepClone(
        this.containerItem.system.container
      );

    const items = container.items ?? [];

    const index = items.findIndex(
      item => item.id === this.containedItemId
    );

    if (index === -1) return;

    foundry.utils.mergeObject(
      items[index],
      updateData
    );

    await this.containerItem.update({
      "system.container.items": items
    });

    await this.render(true);
  }
}