import { html } from "uhtml";
import { TreeBase } from "./treebase";
import * as Props from "./props";
import { styleString } from "./style";
import "css/radio.css";
import Globals from "app/globals";
import { GridFilter } from "./gridFilter";

class Option extends TreeBase {
  name = new Props.String("");
  value = new Props.String("");
  selectedColor = new Props.Color("pink"); // Add selectedColor property
  unselectedColor = new Props.Color("lightgray"); // Add unselectedColor property
  cache = {};
}
TreeBase.register(Option, "Option");

class Radio extends TreeBase {
  scale = new Props.Float(1);
  label = new Props.String("");
  primaryStateName = new Props.String("$radio");
  secondaryStateName = new Props.String("$secondaryRadio");
  lastClickedStateName = new Props.String("$LastClicked"); // Track the last clicked button

  allowedChildren = ["Option", "GridFilter"];

  /** @type {(Option | GridFilter)[]} */
  children = [];

  get options() {
    return this.filterChildren(Option);
  }

  /**
   * true if there exist rows with the this.filters and the value
   * @arg {Option} option
   * @returns {boolean}
   */
  valid(option) {
    const { data, state } = Globals;
    const filters = GridFilter.toContentFilters(
      this.filterChildren(GridFilter),
    );
    return (
      !filters.length ||
      data.hasMatchingRows(
        filters,
        state.clone({ [this.props.primaryStateName]: option.props.value }),
        option.cache,
      )
    );
  }

  /**
   * handle clicks on the chooser
   * @param {MouseEvent} event
   */
  handleClick({ target }) {
    if (target instanceof HTMLButtonElement) {
      const value = target.value;
      const lastClicked = Globals.state.get(this.props.lastClickedStateName);
      const stateUpdates = {};

      if (lastClicked === value) {
        stateUpdates[this.props.primaryStateName] = null;
        stateUpdates[this.props.secondaryStateName] = null;
      } else {
        stateUpdates[this.props.primaryStateName] = value;
        stateUpdates[this.props.secondaryStateName] = value;
        stateUpdates[this.props.lastClickedStateName] = value; // Update last clicked button
      }

      Globals.state.update(stateUpdates);
    }
  }

  template() {
    const { state } = Globals;
    const primaryStateName = this.props.primaryStateName;
    const secondaryStateName = this.props.secondaryStateName;
    let current = state.get(primaryStateName);
    const choices = this.options.map((child, index) => {
      const disabled = !this.valid(/** @type {Option}*/ (child));
      if (primaryStateName && !current && !disabled && child.props.value) {
        current = child.props.value;
        state.update({ [primaryStateName]: current, [secondaryStateName]: current });
      }
      const color =
        child.props.value == current || (!current && index == 0)
          ? child.props.selectedColor
          : child.props.unselectedColor;
      return html`<button
        style=${styleString({ backgroundColor: color })}
        value=${child.props.value}
        ?disabled=${disabled}
        .dataset=${{
          ComponentType: this.className,
          ComponentName: this.name,
          label: child.props.name,
        }}
        click
        onClick=${this.debouncedClick(() => {
          const stateUpdates = {};
          const lastClicked = state.get(this.props.lastClickedStateName);
          if (lastClicked === child.props.value) {
            stateUpdates[primaryStateName] = null;
            stateUpdates[secondaryStateName] = null;
          } else {
            stateUpdates[primaryStateName] = child.props.value;
            stateUpdates[secondaryStateName] = child.props.value;
            stateUpdates[this.props.lastClickedStateName] = child.props.value; // Update last clicked button
          }
          state.update(stateUpdates);
        })}
      >
        ${child.props.name}
      </button>`;
    });

    return this.component(
      {},
      html`<fieldset class="flex">
        ${(this.props.label && html`<legend>${this.props.label}</legend>`) ||
        this.empty}
        ${choices}
      </fieldset>`,
    );
  }

  get name() {
    return this.props.name || this.props.label || this.props.primaryStateName;
  }

  settingsDetails() {
    const props = this.propsAsProps;
    const inputs = Object.values(props).map((prop) => prop.input());
    const filters = this.filterChildren(GridFilter);
    const editFilters = !filters.length
      ? this.empty
      : GridFilter.FilterSettings(filters);
    const options = this.filterChildren(Option);
    const editOptions = html`<fieldset>
      <legend>Options</legend>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>Value</th>
            <th>Selected Color</th>
            <th>Unselected Color</th>
          </tr>
        </thead>
        <tbody>
          ${options.map(
            (option, index) => html`
              <tr>
                <td>${index + 1}</td>
                <td>${option.name.input()}</td>
                <td>${option.value.input()}</td>
                <td>${option.selectedColor.input()}</td> <!-- Add selected color input -->
                <td>${option.unselectedColor.input()}</td> <!-- Add unselected color input -->
              </tr>
            `,
          )}
        </tbody>
      </table>
    </fieldset>`;
    return html`<div>${editFilters}${editOptions}${inputs}</div>`;
  }

  settingsChildren() {
    return this.empty;
  }

  /**
   * Debounce function to ensure single event handling
   * @param {Function} func
   * @param {number} timeout
   * @returns {Function}
   */
  debouncedClick(func, timeout = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
  }
}
TreeBase.register(Radio, "Radio");


