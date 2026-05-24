const { ItemSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;
import {
    prepareK8ItemEditorContext,
    activateK8ItemEditorTabs,
    resizeK8ItemEditorToContent
  } from "./item-editor-context.mjs";

export class K8ItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    tag: "form",

    classes: ["k8system", "sheet", "item", "k8-item-sheet-app"],

    position: {
      width: 720,
      height: 760
    },

    window: {
      resizable: true
    },

    form: {
      handler: async function (event, form, formData) {
        event.preventDefault();
        await this.document.update(formData.object);
        await this.render(false);
      },

      submitOnChange: false,
      closeOnSubmit: false
    }
  };

  static PARTS = {
    form: {
      template: "systems/k8system/templates/item/item-sheet.hbs"
    }
  };

  get title() {
    return this.item.name || "Item";
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    Object.assign(
        context,
        await prepareK8ItemEditorContext(this.item)
      );
      
      return context;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const imageButton = this.element.querySelector("[data-action='edit-image-hidden']");

    if (imageButton) {
      imageButton.addEventListener("click", async event => {
        event.preventDefault();

        new FilePicker({
          type: "image",
          current: this.item.img,
          callback: async path => {
            if (!path) return;

            await this.item.update({ img: path });
            await this.render(false);
          }
        }).browse();
      });
    }
    activateK8ItemEditorTabs(this);
    await resizeK8ItemEditorToContent(this);
  }
}