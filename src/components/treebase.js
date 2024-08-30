import { html } from "uhtml";
import * as Props from "./props";
import "css/treebase.css";
import WeakValue from "weak-value";
import { styleString } from "./style";
import { session } from "./persist";
import { errorHandler } from "./errors";
import { friendlyName } from "./names";

export class TreeBase {
  /** @type {TreeBase[]} */
  children = [];
  /** @type {TreeBase | null} */
  parent = null;
  /** @type {string[]} */
  allowedChildren = [];
  allowDelete = true;

  // every component has a unique id
  static treeBaseCounter = 0;
  id = `TreeBase-${TreeBase.treeBaseCounter++}`;

  // values here are stored in sessionStorage
  persisted = session(this.id, {
    settingsDetailsOpen: false,
  });

  // map from id to the component
  static idMap = new WeakValue();

  /** @param {string} id
   * @returns {TreeBase | null} */
  static componentFromId(id) {
    // strip off any added bits of the id
    const match = id.match(/TreeBase-\d+/);
    if (match) {
      return this.idMap.get(match[0]);
    }
    return null;
  }

  designer = {};

  /** A mapping from the external class name to the class */
  static nameToClass = new Map();
  /** A mapping from the class to the external class name */
  static classToName = new Map();

  /** @param {typeof TreeBase} cls
   * @param {string} externalName
   * */
  static register(cls, externalName) {
    this.nameToClass.set(externalName, cls);
    this.classToName.set(cls, externalName);
  }

  get className() {
    return TreeBase.classToName.get(this.constructor);
  }

  /**
   * Extract the class fields that are Props and return their values as an Object
   * @returns {Object<string, any>}
   */
  get props() {
    return Object.fromEntries(
      Object.entries(this)
        .filter(([_, prop]) => prop instanceof Props.Prop)
        .map(([name, prop]) => [name, prop.value]),
    );
  }

  /**
   * Extract the values of the fields that are Props
   * @returns {Object<string, Props.Prop>}
   */
  get propsAsProps() {
    return Object.fromEntries(
      Object.entries(this).filter(([_, prop]) => prop instanceof Props.Prop),
    );
  }
  /**
   * Prepare a TreeBase tree for external storage by converting to simple objects and arrays
   * @param {Object} [options]
   * @param {string[]} options.omittedProps - class names of props to omit
   * @returns {Object}
   * */
  toObject(options = { omittedProps: [] }) {
    const props = Object.fromEntries(
      Object.entries(this)
        .filter(
          ([_, prop]) =>
            prop instanceof Props.Prop &&
            !options.omittedProps.includes(prop.constructor.name),
        )
        .map(([name, prop]) => [name, prop.value]),
    );
    const children = this.children.map((child) => child.toObject(options));
    const result = {
      className: this.className,
      props,
      children,
    };
    return result;
  }

  /**
   * An opportunity for the component to initialize itself. This is
   * called in fromObject after the children have been added. If you
   * call create directly you should call init afterward.
   */
  init() {}

  /**
   *   Create a TreeBase object
   *   @template {TreeBase} TB
   *   @param {string|(new()=>TB)} constructorOrName
   *   @param {TreeBase | null} parent
   *   @param {Object<string,string|number|boolean>} props
   *   @returns {TB}
   *   */
  static create(constructorOrName, parent = null, props = {}) {
    const constructor =
      typeof constructorOrName == "string"
        ? TreeBase.nameToClass.get(constructorOrName)
        : constructorOrName;
    /** @type {TB} */
    const result = new constructor();

    // initialize the props
    for (const [name, prop] of Object.entries(result.propsAsProps)) {
      prop.initialize(name, props[name], result);
    }

    // link it to its parent
    if (parent) {
      result.parent = parent;
      parent.children.push(result);
    }

    // remember the relationship between id and component
    TreeBase.idMap.set(result.id, result);

    return result;
  }

  /**
   * Instantiate a TreeBase tree from its external representation
   * @param {Object} obj
   * @param {TreeBase | null} parent
   * @returns {TreeBase} - should be {this} but that isn't supported for some reason
   * */
  static fromObject(obj, parent = null) {
    // Get the constructor from the class map
    if (!obj) console.trace("fromObject", obj);
    const className = obj.className;
    const constructor = this.nameToClass.get(className);
    if (!constructor) {
      console.trace("className not found", className, obj);
      throw new Error("className not found");
    }

    // Create the object and link it to its parent
    const result = this.create(constructor, parent, obj.props);

    // Link in the children
    for (const childObj of obj.children) {
      if (childObj instanceof TreeBase) {
        childObj.parent = result;
        result.children.push(childObj);
      } else {
        TreeBase.fromObject(childObj, result);
      }
    }

    // allow the component to initialize itself
    result.init();

    // Validate the type is what was expected
    if (result instanceof this) return result;

    // Die if not
    console.error("expected", this);
    console.error("got", result);
    throw new Error(`fromObject failed`);
  }

  /**
   * Signal nodes above that something has been updated
   */
  update() {
    let start = this;
    /** @type {TreeBase | null} */
    let p = start;
    while (p) {
      p.onUpdate(start);
      p = p.parent;
    }
  }

  /**
   * Called when something below is updated
   * @param {TreeBase} _start
   */
  onUpdate(_start) {}

  /**
   * Render the designer interface and return the resulting Hole
   * @returns {Hole}
   */
  settings() {
    const detailsId = this.id + "-details";
    const settingsId = this.id + "-settings";
    return html`<div class="settings">
      <details
        class=${this.className}
        id=${detailsId}
        ?open=${this.persisted.settingsDetailsOpen}
        ontoggle=${({ target }) =>
          (this.persisted.settingsDetailsOpen = target.open)}
      >
        <summary id=${settingsId}>${this.settingsSummary()}</summary>
        ${this.settingsDetails()}
      </details>
      ${this.settingsChildren()}
    </div>`;
  }

  /**
   * Render the summary of a components settings
   * @returns {Hole}
   */
  settingsSummary() {
    const name = Object.hasOwn(this, "name") ? this["name"].value : "";
    return html`<h3>${friendlyName(this.className)} ${name}</h3>`;
  }

  /**
   * Render the details of a components settings
   * @returns {Hole|Hole[]}
   */
  settingsDetails() {
    const props = this.propsAsProps;
    const inputs = Object.values(props).map((prop) => prop.input());
    return inputs;
  }

  settingsChildren() {
    return this.orderedChildren();
  }

  /**
   * Render the user interface and return the resulting Hole
   * @returns {Hole|Hole[]}
   */
  template() {
    return this.empty;
  }

  /**
   * Render the user interface catching errors and return the resulting Hole
   * @returns {Hole|Hole[]}
   */
  safeTemplate() {
    try {
      return this.template();
    } catch (error) {
      errorHandler(error, ` safeTemplate ${this.className}`);
      let classes = [this.className.toLowerCase()];
      classes.push("error");
      return html`<div class=${classes.join(" ")} id=${this.id}>ERROR</div>`;
    }
  }

  /** @typedef {Object} ComponentAttrs
   * @property {string[]} [classes]
   * @property {Object} [style]
   */

  /**
   * Wrap the body of a component
   *
   * @param {ComponentAttrs} attrs
   * @param {Hole|Hole[]} body
   * @returns {Hole}
   */
  component(attrs, body) {
    attrs = { style: {}, ...attrs };
    let classes = [this.className.toLowerCase()];
    if ("classes" in attrs) {
      classes = classes.concat(attrs.classes);
    }
    return html`<div
      class=${classes.join(" ")}
      id=${this.id}
      style=${styleString(attrs.style)}
    >
      ${body}
    </div>`;
  }

  /**
   * Swap two of my children
   * @param {number} i
   * @param {number} j
   */
  swap(i, j) {
    const A = this.children;
    [A[i], A[j]] = [A[j], A[i]];
  }

  /**
   * Move me to given position in my parent
   * @param {number} i
   */
  moveTo(i) {
    const peers = this.parent?.children || [];
    peers.splice(this.index, 1);
    peers.splice(i, 0, this);
  }

  /**
   * Move me up or down by 1 position if possible
   * @param {boolean} up
   */
  moveUpDown(up) {
    const parent = this.parent;
    if (!parent) return;
    const peers = parent.children;
    if (peers.length > 1) {
      const index = this.index;
      const step = up ? -1 : 1;
      if ((up && index > 0) || (!up && index < peers.length - 1)) {
        parent.swap(index, index + step);
      }
    }
  }

  /**
   * Get the index of this component in its parent
   * @returns {number}
   */
  get index() {
    return (this.parent && this.parent.children.indexOf(this)) || 0;
  }

  /**
   *  * Remove this child from their parent and return the id of the child to receive focus
   *  @returns {string}
   *  */
  remove() {
    if (!this.parent) return "";
    const peers = this.parent.children;
    const index = peers.indexOf(this);
    const parent = this.parent;
    this.parent = null;
    peers.splice(index, 1);
    if (peers.length > index) {
      return peers[index].id;
    } else if (peers.length > 0) {
      return peers[peers.length - 1].id;
    } else {
      return parent.id;
    }
  }

  /**
   * Create HTML LI nodes from the children
   */
  listChildren(children = this.children) {
    return children.map(
      (child) => html.for(child)`<li>${child.settings()}</li>`,
    );
  }

  /**
   * Create an HTML ordered list from the children
   */
  orderedChildren(children = this.children) {
    return html`<ol>
      ${this.listChildren(children)}
    </ol>`;
  }

  /**
   * Create an HTML unordered list from the children
   * */
  unorderedChildren(children = this.children) {
    return html`<ul>
      ${this.listChildren(children)}
    </ul>`;
  }

  /**
   * Return the nearest parent of the given type
   * @template T
   * @param {new() => T} type
   * @returns {T}
   * */
  nearestParent(type) {
    let p = this.parent;
    while (p) {
      if (p instanceof type) {
        return p;
      }
      p = p.parent;
    }
    throw new Error("No such parent");
  }

  /**
   * Filter children by their type
   * @template T
   * @param {new() => T} type
   * @returns {T[]}
   */
  filterChildren(type) {
    /** @type {T[]} */
    const result = [];
    for (const child of this.children) {
      if (child instanceof type) {
        result.push(child);
      }
    }
    return result;
  }

  /* Methods from original Base many not used */

  /** Return matching strings from props
   * @param {RegExp} pattern
   * @param {string[]} [props]
   * @returns {Set<string>}
   */
  all(pattern, props) {
    const matches = new Set();
    for (const [name, theProp] of Object.entries(this.props)) {
      if (!props || props.indexOf(name) >= 0) {
        if (theProp instanceof Props.String) {
          for (const [match] of theProp.value.matchAll(pattern)) {
            matches.add(match);
          }
        }
      }
    }
    for (const child of this.children) {
      for (const match of child.all(pattern, props)) {
        matches.add(match);
      }
    }
    return matches;
  }

  /** @returns {Set<string>} */
  allStates() {
    return this.all(/\$\w+/g);
  }

  get empty() {
    return html`<!--empty-->`;
  }
}

/**
 * A variant of TreeBase that allows replacing a node with one of a similar type
 */
export class TreeBaseSwitchable extends TreeBase {
  init() {
    // find the TypeSelect property and set its value
    for (const prop of Object.values(this.propsAsProps)) {
      if (prop instanceof Props.TypeSelect) {
        if (!prop.value) {
          prop.set(this.className);
        }
      }
    }
  }

  /** Replace this node with one of a compatible type
   * @param {string} className */
  replace(className) {
    if (!this.parent) return;
    if (this.className == className) return;
    // extract the values of the old props
    const props = this.props;
    const replacement = TreeBase.create(className, null, props);
    replacement.init();
    const index = this.parent.children.indexOf(this);
    this.parent.children[index] = replacement;
    replacement.parent = this.parent;
    this.update();
  }
}
