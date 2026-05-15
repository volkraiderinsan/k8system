import { calculateActorDerived } from "../system/actor-derived.mjs";

const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

const DEFAULT_ACTOR_IMAGE = "icons/svg/mystery-man.svg";

function isRealImage(path) {
  return Boolean(path) && path !== DEFAULT_ACTOR_IMAGE && !path.includes("mystery-man");
}

export class K8ActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
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
    
    return context;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

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
  }
}