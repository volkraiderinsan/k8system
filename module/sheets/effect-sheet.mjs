import { closeK8WindowsByClass } from "../utils/k8-window-utils.mjs";
import { activateK8MarkdownDrop, renderK8Markdown } from "../utils/k8-markdown.mjs";
import {
  K8_MODIFIER_TYPE_OPTIONS,
  K8_ROLL_CONTEXT_OPTIONS,
  getK8StatContextOptions,
  hasK8StatContextOptions
} from "../system/k8-modifier-resolver.mjs";

function makeModifierKey(name) {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const { ItemSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

export class K8EffectSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["k8system", "sheet", "item", "k8-effect-sheet-app"],

    position: {
      width: 520,
      height: 560
    },

    window: {
      resizable: true
    },

    form: {
      handler: async function (event, form, formData) {
        event.preventDefault();

        const closeAfterSave = this._closeAfterSave === true;
        this._closeAfterSave = false;

        const modifiers = [];
        const rows = form.querySelectorAll(".k8-effect-modifier-row");

        for (const row of rows) {
          const key = makeModifierKey(this.document.name);
          const type = row.dataset.modifierType ?? "stat";
          const target = row.querySelector('[name$=".target"]')?.value ?? "";
          const context = row.querySelector('[name$=".context"]')?.value ?? "";
          const value = Number(row.querySelector('[name$=".value"]')?.value) || 0;
          const useSeverity = row.querySelector('[name$=".useSeverity"]')?.checked === true;

          if (type === "stat" && !target) continue;
          if (type === "roll" && !context) continue;

          modifiers.push({
            key,
            type,
            target,
            context,
            value,
            useSeverity
          });
        }

        const data = foundry.utils.expandObject(formData.object);

        data.system ??= {};
        data.system.modifiers = modifiers;

        await this.document.update(data);

        this._editing = false;

        this.document.parent?.sheet?.render(false);

        if (closeAfterSave) {
          await this.close();
          return;
        }

        await this.render(false);
        this.bringToFront?.();
      },

      submitOnChange: false,
      closeOnSubmit: false
    }
  };

  static PARTS = {
    form: {
      template: "systems/k8system/templates/item/effect-sheet.hbs"
    }
  };

  constructor(options = {}) {
    super(options);
    this._editing = false;
    this._closeAfterSave = false;
  }

  get title() {
    return this.item.name || "Effect";
  }

  setEditMode(value) {
    this._editing = Boolean(value);
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    context.item = this.item;
    context.system = this.item.system;
    context.editMode = this._editing;

    context.categoryOptions = {
      condition: "Condition"
    };

    context.polarityOptions = {
      positive: "Positive",
      negative: "Negative"
    };

    context.durationUnitOptions = {
      round: "Round",
      day: "Day",
      permanent: "Perma"
    };

    context.modifierTargetOptions = {
      "conditions.fatigue": "Fatigue",
      "conditions.stress": "Stress",

      move: "Move",
      fpr: "FPR",
      perception: "Perception",
      bacc: "BACC",
      macc: "MACC",
      beff: "BEff",
      strmod: "StrMod",
      fitmod: "FitMod",
      focusres: "FocusRes",
      staminares: "StaminaRes",

      "focus.max": "Focus Max",
      "stamina.max": "Stamina Max",
      "blood.max": "Blood Max",

      "defense.repulse": "Repulse",
      "defense.head.hp": "Head HP",
      "defense.arms.hp": "Arms HP",
      "defense.torso.hp": "Torso HP",
      "defense.legs.hp": "Legs HP"
    };

    context.modifierTypeOptions = K8_MODIFIER_TYPE_OPTIONS;
    context.modifierRollContextOptions = K8_ROLL_CONTEXT_OPTIONS;

    context.modifiers = this.#prepareModifierRows(
      this.item.system.modifiers ?? [],
      context.modifierTargetOptions
    );

    context.modifierLabels = {
      ...context.modifierTargetOptions,
      ...K8_ROLL_CONTEXT_OPTIONS
    };

    context.readonlyModifierText = this.#buildReadonlyModifierText(
      this.item.system.modifiers ?? [],
      context.modifierTargetOptions
    );

    context.descriptionHtml = await renderK8Markdown(this.item.system.description ?? "");

    return context;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const saveButton = this.element.querySelector(".k8-effect-save");

    if (saveButton) {
      saveButton.addEventListener("click", event => {
        this._closeAfterSave = event.shiftKey;
      });
    }

    const editButton = this.element.querySelector(".k8-effect-edit");

    if (editButton) {
      editButton.addEventListener("click", async event => {
        event.preventDefault();

        this._editing = true;
        await this.render(false);
        this.bringToFront?.();
      });
    }

    activateK8MarkdownDrop(this.element.querySelector(".k8-effect-description-input"));

    const image = this.element.querySelector(".k8-effect-image");

    if (image) {
      image.addEventListener("click", async event => {
        event.preventDefault();

        if (!this._editing) return;

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

    const addModifier = this.element.querySelector(".k8-effect-modifier-add");

    if (addModifier) {
      addModifier.addEventListener("click", async event => {
        event.preventDefault();

        const modifiers = this.#collectModifierRows();

        const type = await this.#chooseModifierType();
        if (!type) return;

        modifiers.push(
          type === "roll"
            ? {
                key: makeModifierKey(this.document.name),
                type: "roll",
                target: "",
                context: "checks",
                value: 0,
                useSeverity: false
              }
            : {
                key: makeModifierKey(this.document.name),
                type: "stat",
                target: "conditions.fatigue",
                context: "",
                value: 0,
                useSeverity: false
              }
        );

        await this.item.update({
          "system.modifiers": modifiers
        });

        await this.render(false);
      });
    }

    const deleteModifiers = this.element.querySelectorAll(".k8-effect-modifier-delete");

    for (const button of deleteModifiers) {
      button.addEventListener("click", async event => {
        event.preventDefault();

        const index = Number(button.dataset.index);
        const modifiers = this.#collectModifierRows();

        modifiers.splice(index, 1);

        await this.item.update({
          "system.modifiers": modifiers
        });

        await this.render(false);
      });
    }

    const modifierTargetSelects = this.element.querySelectorAll(
      '.k8-effect-modifier-row.is-stat-mod select[name$=".target"]'
    );
    
    for (const select of modifierTargetSelects) {
      select.addEventListener("change", async () => {
        const modifiers = this.#collectModifierRows();
    
        await this.item.update({
          "system.modifiers": modifiers
        });
    
        await this.render(false);
      });
    }

    const stepperButtons = this.element.querySelectorAll(".k8-stepper-button");

    for (const button of stepperButtons) {
      button.addEventListener("click", event => {
        event.preventDefault();

        const target = button.dataset.target;
        const step = Number(button.dataset.step) || 0;

        if (!target) return;

        const input = this.element.querySelector(`input[name="${target}"]`);
        if (!input) return;

        const current = Number(input.value) || 0;
        const min = input.min !== "" ? Number(input.min) : -Infinity;

        input.value = Math.max(min, current + step);
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
    }
  }

  #prepareModifierRows(modifiers, targetOptions) {
    return modifiers.map(modifier => {
      const type = modifier.type ?? (modifier.appliesTo ? "roll" : "stat");
      const target = modifier.target ?? "";
      const context = modifier.context ?? modifier.appliesTo ?? "";
  
      const statContextOptions = getK8StatContextOptions(target);
      const showStatContext = type === "stat" && hasK8StatContextOptions(target);
  
      return {
        ...modifier,
        type,
        target,
        context,
        isRoll: type === "roll",
        isStat: type === "stat",
        showStatContext,
        statContextOptions
      };
    });
  }
  
  async #chooseModifierType() {
    await closeK8WindowsByClass("k8-add-modifier-window");
    return foundry.applications.api.DialogV2.wait({
      window: {
        title: "Add modifier"
      },
  
      classes: ["k8system", "k8-add-modifier-window"],
  
      content: `
        <select class="k8-add-modifier-select" name="type">
          <option value="stat" selected>Stat mod</option>
          <option value="roll">Roll mod</option>
        </select>
      `,
  
      buttons: [
        {
          action: "ok",
          label: "Ok",
          callback: (event, button, dialog) => {
            const select = dialog.element.querySelector('select[name="type"]');
            return select?.value ?? "stat";
          }
        }
      ],
  
      rejectClose: false
    });
  }

  #collectModifierRows() {
    const rows = this.element.querySelectorAll(".k8-effect-modifier-row");
    const modifiers = [];

    for (const row of rows) {
      const key = makeModifierKey(this.document.name);
      const type = row.dataset.modifierType ?? "stat";
      const target = row.querySelector('[name$=".target"]')?.value ?? "";
      const context = row.querySelector('[name$=".context"]')?.value ?? "";
      const value = Number(row.querySelector('[name$=".value"]')?.value) || 0;
      const useSeverity = row.querySelector('[name$=".useSeverity"]')?.checked === true;

      if (type === "stat" && !target) continue;
      if (type === "roll" && !context) continue;

      modifiers.push({
        key,
        type,
        target,
        context,
        value,
        useSeverity
      });
    }

    return modifiers;
  }

  #isNegativeGoodTarget(target) {
    return [
      "beff",
      "conditions.fatigue",
      "conditions.stress"
    ].includes(target);
  }

  #modifierColor(target, value) {
    const positiveColor = "rgb(0, 232, 220)";
    const negativeColor = "rgb(232, 89, 0)";

    if (this.#isNegativeGoodTarget(target)) {
      return value <= 0 ? positiveColor : negativeColor;
    }

    return value >= 0 ? positiveColor : negativeColor;
  }

  #modifierContextLabel(context) {
    const labels = {
      checks: "All rolls",
      "checks.attribute": "All attributes",
      "checks.attribute.str": "STR",
      "checks.attribute.for": "FOR",
      "checks.attribute.ref": "REF",
      "checks.attribute.fit": "FIT",
      "checks.attribute.sp": "SP",
      "checks.stress": "Stress",
      "checks.attack": "All attacks",
      "checks.attack.ranged": "Ranged attacks",
      "checks.attack.melee": "Melee attacks",
      "checks.profession": "All professions"
    };
  
    return labels[context] ?? context;
  }

  #buildReadonlyModifierText(modifiers, labels) {
    if (!Array.isArray(modifiers) || modifiers.length === 0) {
      return `<em>No modifiers.</em>`;
    }
  
    return modifiers.map(modifier => {
      const type = modifier.type ?? (modifier.appliesTo ? "roll" : "stat");
      const target = modifier.target ?? "";
      const context = modifier.context ?? modifier.appliesTo ?? "";
      const value = Number(modifier.value) || 0;
      const signed = value >= 0 ? `+${value}` : `${value}`;
  
      const contextLabel = this.#modifierContextLabel(context);

      const label = type === "roll"
        ? contextLabel
        : context
          ? `${labels[target] ?? target}/${contextLabel}`
          : labels[target] ?? target;
  
      const color = this.#modifierColor(target, value);
  
      return `<span style="color: ${color};">${label} (${signed})</span>`;
    }).join("; ");
  }
}