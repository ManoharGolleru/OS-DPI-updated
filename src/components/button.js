import { html } from "uhtml";
import { TreeBase } from "./treebase";
import * as Props from "./props";
import { styleString } from "./style";
import "css/button.css";
import { Subject } from "rxjs";

const keyEvent$ = new Subject(); // RxJS Subject to handle key events

class Button extends TreeBase {
  label = new Props.String("click me");
  name = new Props.String("button");
  background = new Props.Color("");
  scale = new Props.Float(1);
  isActive = new Props.Boolean(false); // State to track active status

  constructor() {
    super();
    // Ensure isActive is set to false initially
    this.isActive = false;
    this.subscription = keyEvent$.subscribe(this.handleKeyEvent.bind(this));
  }

  handleKeyEvent(event) {
    const { label } = this.props;
    // Toggle active state based on key events
    if (event.access && event.access.label === label) {
      if (event.type === "keydown") {
        this.isActive = true;
      } else if (event.type === "keyup") {
        this.isActive = false;
      }
      this.update();
    }
  }

  template() {
    const style = styleString({ backgroundColor: this.props.background });
    const { name, label } = this.props;
    const isActive = this.isActive; // Get the current state
    return this.component(
      {},
      html`<button
        class=${`button ${isActive ? "active" : ""}`}
        name=${name}
        style=${style}
        .dataset=${{
          name: name,
          label: label,
          ComponentName: this.props.name,
          ComponentType: this.constructor.name,
        }}
        @focus=${() => keyEvent$.next({ type: 'keydown', access: { label: label }})}
        @blur=${() => keyEvent$.next({ type: 'keyup', access: { label: label }})}
      >
        ${label}
      </button>`
    );
  }

  getChildren() {
    return [];
  }

  disconnectedCallback() {
    this.subscription.unsubscribe();
  }
}
TreeBase.register(Button, "Button");


