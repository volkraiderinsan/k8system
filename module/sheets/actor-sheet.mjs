export class K8ActorSheet extends ActorSheet {
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        classes: ["k8system", "sheet", "actor"],
        template: "systems/k8system/templates/actor/actor-sheet.hbs",
        width: 720,
        height: 680,
        tabs: [
          {
            navSelector: ".sheet-tabs",
            contentSelector: ".sheet-body",
            initial: "main"
          }
        ]
      });
    }
  
    getData(options) {
      const context = super.getData(options);
  
      context.system = this.actor.system;
  
      context.genderOptions = {
        male: "Male",
        female: "Female"
      };
  
      return context;
    }
  }