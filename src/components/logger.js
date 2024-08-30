import { html } from "uhtml";
import { saveContent } from "./content";
import { TreeBase } from "./treebase";
import db from "app/db";
import * as Props from "./props";
import Globals from "app/globals";
import { access } from "app/eval";
import "css/logger.css";

export class Logger extends TreeBase {
  // name = new Props.String("Log");
  stateName = new Props.String("$Log");
  logUntil = new Props.ADate();

  // I expect a string like #field1 $state1 $state2 #field3
  logThese = new Props.TextArea("", {
    validate: this.validate,
    placeholder: "Enter state and field names to log",
  });

  // I expect a string listing event names to log
  logTheseEvents = new Props.TextArea("", {
    validate: this.validateEventNames,
    placeholder: "Enter names of events to log",
  });

  /**
   * @param {string} s
   * @returns {string}
   */
  validate(s) {
    return /^(?:[#$]\w+\s*)*$/.test(s) ? "" : "Invalid input";
  }

  /**
   * Check for strings that look like event names
   *
   * @param {string} s
   * @returns {string}
   */
  validateEventNames(s) {
    return /^(?:\w+\s*)*$/.test(s) ? "" : "Invalid input";
  }

  template() {
    const { state, actions } = Globals;
    const { stateName, logUntil, logThese } = this.props;
    const logging =
      !!state.get(stateName) && logUntil && new Date() < new Date(logUntil);
    const getValue = access(state, actions.last.data);

    if (logging) {
      const names = logThese.split(/\s+/);
      const record = {};
      for (const name of names) {
        const value = getValue(name);
        if (value) {
          record[name] = value;
        }
      }
      this.log(record);
    }

    return html`<div
      class="logging-indicator"
      ?logging=${logging}
      title="Logging"
    ></div>`;
  }

  /** Log a record to the database
   * @param {Object} record
   * @returns {void}
   */
  log(record) {
    const DateTime = new Date().toLocaleDateString("en-US", {
      fractionalSecondDigits: 2,
      hour12: false,
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    record = { DateTime, ...record };
    db.write("log", record);
  }

  init() {
    this.onUpdate();
  }

  /** @type {Set<string>} */
  listeners = new Set();
  onUpdate() {
    const UI = document.getElementById("UI");
    if (!UI) return;
    // cancel any listeners that are currently active
    for (const eventName of this.listeners) {
      UI.removeEventListener(eventName, this);
    }
    this.listeners.clear();

    // listen for each of the listed events
    for (const match of this.logTheseEvents.value.matchAll(/\w+/g)) {
      UI.addEventListener(match[0], this);
      this.listeners.add(match[0]);
    }
  }

  typesToInclude = new Set(["boolean", "number", "string"]);
  propsToExclude = new Set([
    "isTrusted",
    "bubbles",
    "cancelBubble",
    "cancelable",
    "defaultPrevented",
    "eventPhase",
    "returnValue",
    "timeStamp",
  ]);
  /**
   * Make this object a listener
   * @param {Event} e
   */
  handleEvent(e) {
    // grab all the fields of the event that are simple types
    const record = {};
    for (const prop in e) {
      // skip all upper case and _
      if (/^[A-Z_]+$/.test(prop)) continue;
      const value = e[prop];
      if (this.propsToExclude.has(prop)) continue;
      if (!this.typesToInclude.has(typeof value)) continue;
      record[prop] = value;
    }
    this.log(record);
  }
}
TreeBase.register(Logger, "Logger");

export async function SaveLogs() {
  let toSave = await db.readAll("log");
  if (toSave.length > 0) {
    await saveContent("log", toSave, "xlsx");
  } else {
    Globals.error.report("No log records to be saved.");
    Globals.state.update();
  }
}

export async function ClearLogs() {
  await db.clear("log");
}

export async function DownloadCSV() {
  const serverUrl = 'http://34.118.128.211:5678/download_csv'; // Adjust if your client and server are on different machines
  fetch(serverUrl)
      .then(response => {
          if (!response.ok) {
              throw new Error('Network response was not ok ' + response.statusText);
          }
          return response.blob();
      })
      .then(blob => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'conversation_history.csv'; // Set the desired file name for the download
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);
      })
      .catch(error => {
          console.error('Error downloading CSV:', error);
          // Optionally, update the UI to show an error message to the user
          // For example, show a modal or a toast notification indicating the download failure
      });
}


