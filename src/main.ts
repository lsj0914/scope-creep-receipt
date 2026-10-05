import "./style.css";
import type { Project, Receipt, Settings, ChangeTask } from "./model";
import { ProjectError } from "./model";
import { calculate, deferTask, removeTask } from "./engine";
import { example, blankProject } from "./examples";
import type { Language, ExampleId } from "./examples";
import { strings, errorMessage, money } from "./i18n";
import { editorHTML } from "./editor";
import type { Tab } from "./editor";
import { receiptHTML } from "./receipt";
import {
  download,
  parseProject,
  serializeProject,
  receiptMarkdown,
  escapeHTML as e,
} from "./documents";

const PROJECT_KEY = "scope-creep-receipt.project.v1";
const LANGUAGE_KEY = "scope-creep-receipt.language";
const app = document.querySelector<HTMLDivElement>("#app")!;
let lang: Language = "en";
let project: Project;
let receipt: Receipt | null = null;
let tab: Tab = "baseline";
let edited = false;
let storageAvailable = true;
let startupError: unknown;
let storedDraft: string | null = null;
let rejectedDraft: string | null = null;
let selectedExample: ExampleId = "launch";
let confirmAction: (() => void) | null = null;
let toastTimer: ReturnType<typeof setTimeout>;

try {
  lang = localStorage.getItem(LANGUAGE_KEY) === "zh" ? "zh" : "en";
  storedDraft = localStorage.getItem(PROJECT_KEY);
  project = storedDraft ? parseProject(storedDraft) : example("launch", lang);
  edited = !!storedDraft;
} catch (error) {
  if (error instanceof ProjectError) {
    startupError = error;
    rejectedDraft = storedDraft;
    edited = true;
  } else storageAvailable = false;
  project = example("launch", lang);
}

function render() {
  const s = strings(lang);
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  document.title = `${s.app} — ${lang === "zh" ? "看见新增需求的代价" : "The cost of just one more thing"}`;
  app.innerHTML = `<a class="skip-link" href="#planner">${s.skip}</a>
    <div class="page-shell">
      <header class="topbar"><a class="brand" href="./" aria-label="Scope Creep Receipt"><svg aria-hidden="true" width="29" height="32" viewBox="0 0 29 32" fill="none"><path d="M4 2h21v27l-4-2-4 2-4-2-4 2-5-2z" stroke="currentColor" stroke-width="2"/><path d="M9 9h11M9 15h11M9 21h6" stroke="currentColor" stroke-width="2"/></svg><span>Scope Creep<br><strong>Receipt</strong></span></a>
      <nav class="top-actions" aria-label="${s.app}"><button data-action="save" class="quiet">${s.saveProject}</button><button data-action="import" class="quiet">${s.importProject}</button><button data-action="language" class="language-button" lang="${lang === "en" ? "zh-CN" : "en"}">${lang === "en" ? "中文" : "English"}</button></nav></header>
      <main><div class="hero"><div><h1>${s.app}</h1><p class="hero-question">${s.hero}</p><p class="hero-description">${s.intro}</p></div><div class="privacy-note"><span class="privacy-dot" aria-hidden="true"></span>${s.privacy}</div></div>
      ${rejectedDraft !== null ? `<aside class="recovery-banner" data-testid="draft-recovery"><h2>${s.recoveryTitle}</h2><p>${s.recoveryHint}</p><div><button data-action="download-rejected" class="secondary small">${s.downloadRejected}</button><button data-action="replace-rejected" class="secondary small">${s.useCurrent}</button></div></aside>` : ""}
      <div class="example-strip"><div><span class="example-hint">${s.exampleHint}</span><label class="sr-only" for="example-picker">${s.example}</label><select id="example-picker"><option value="launch" ${selectedExample === "launch" ? "selected" : ""}>${s.launchExample}</option><option value="parallel" ${selectedExample === "parallel" ? "selected" : ""}>${s.parallelExample}</option><option value="tradeoff" ${selectedExample === "tradeoff" ? "selected" : ""}>${s.tradeoffExample}</option></select><button data-action="example" class="secondary small">${s.load}</button></div><button data-action="new" class="quiet">${s.newProject}</button></div>
      <div class="workspace"><section id="planner" class="planner" aria-label="${s.projectSettings}" tabindex="-1"><div id="editor">${editorHTML(project, lang, tab)}</div><p id="save-status" class="save-status" aria-live="polite"></p></section>
      <div class="output"><div class="output-tools"><button data-action="download" class="primary">${s.download}</button><button data-action="copy" class="secondary">${s.copy}</button><button data-action="print" class="secondary">${s.print}</button></div><div id="result"></div></div></div>
      </main><footer class="footer"><span>${s.footer}</span><a href="https://github.com/lsj0914/scope-creep-receipt" target="_blank" rel="noopener noreferrer">${s.source}</a></footer>
    </div><input id="import-file" type="file" accept=".json,application/json" hidden>
    <div id="notification" class="notification" hidden></div>
    <dialog id="confirm-dialog" aria-labelledby="confirm-title"><h2 id="confirm-title">${s.confirmTitle}</h2><p id="confirm-description"></p><div class="dialog-actions"><button data-action="cancel" class="secondary">${s.cancel}</button><button data-action="confirm" class="primary">${s.apply}</button></div></dialog>
    <div id="receipt-announcement" class="sr-only" aria-live="polite"></div>`;
  updateResult();
}

function saveDraft() {
  const status = document.querySelector<HTMLParagraphElement>("#save-status")!;
  const s = strings(lang);
  if (rejectedDraft !== null) {
    status.textContent = s.recoveryPaused;
    status.classList.add("unsaved");
    return;
  }
  if (!receipt) {
    status.textContent = s.notSaved;
    status.classList.add("unsaved");
    return;
  }
  try {
    localStorage.setItem(PROJECT_KEY, serializeProject(project));
    localStorage.setItem(LANGUAGE_KEY, lang);
    storageAvailable = true;
  } catch {
    storageAvailable = false;
  }
  status.textContent = storageAvailable ? s.local : s.storageFailed;
  status.classList.toggle("unsaved", !storageAvailable);
}

function updateResult() {
  const result = document.querySelector<HTMLDivElement>("#result")!;
  const s = strings(lang);
  try {
    receipt = calculate(project);
    result.innerHTML = receiptHTML(project, receipt, lang);
  } catch (error) {
    receipt = null;
    result.innerHTML = `<section class="calculation-error" data-testid="calculation-error" role="alert"><h2>${s.fix}</h2><p>${e(errorMessage(error, lang))}</p><p class="hint">${s.fixHint}</p></section>`;
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    '[data-action="save"], [data-action="download"], [data-action="copy"], [data-action="print"]',
  ))
    button.disabled = !receipt;
  saveDraft();
}

function refreshEditor() {
  document.querySelector("#editor")!.innerHTML = editorHTML(project, lang, tab);
}

function notify(message: string, isError = false) {
  clearTimeout(toastTimer);
  const notice = document.querySelector<HTMLDivElement>("#notification")!;
  notice.textContent = message;
  notice.hidden = false;
  notice.setAttribute("role", isError ? "alert" : "status");
  notice.classList.toggle("error", isError);
  toastTimer = setTimeout(
    () => {
      notice.hidden = true;
    },
    isError ? 8000 : 3500,
  );
}

function confirm(description: string, action: () => void) {
  confirmAction = action;
  document.querySelector("#confirm-description")!.textContent = description;
  document.querySelector<HTMLDialogElement>("#confirm-dialog")!.showModal();
}

function replaceDraft(next: Project, message: string) {
  const run = () => {
    project = next;
    rejectedDraft = null;
    edited = false;
    tab = "baseline";
    render();
    notify(message);
  };
  if (edited) confirm(strings(lang).replaceHint, run);
  else run();
}

function inputChanged(target: EventTarget | null) {
  if (!(
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ))
    return;
  if (target.id === "example-picker") {
    selectedExample = target.value as ExampleId;
    return;
  }
  const key = target.dataset.project;
  if (key) {
    if (key === "title" || key === "requester" || key === "reason")
      project[key] = target.value;
    else if (
      key === "dailyHours" ||
      key === "hourlyRate" ||
      key === "bufferPercent"
    )
      project.settings[key] =
        target instanceof HTMLInputElement
          ? target.valueAsNumber
          : Number(target.value);
    else if (key === "currency")
      project.settings.currency = target.value as Settings["currency"];
    else if (key === "startDate" || key === "deadline")
      project.settings[key] = target.value;
    else return;
  } else if (target.dataset.task) {
    const group = target.dataset.group as Tab;
    const t = project[group][Number(target.dataset.index)];
    if (!t) return;
    const field = target.dataset.task;
    if (field === "name") {
      t.name = target.value;
      const row = target.closest(".task-row");
      row?.setAttribute("aria-label", target.value);
      row
        ?.querySelector('button[data-action="remove"]')
        ?.setAttribute("aria-label", `${strings(lang).remove} ${target.value}`);
    } else if (field === "hours" && target instanceof HTMLInputElement)
      t.hours = target.valueAsNumber;
    else if (field === "optional" && target instanceof HTMLInputElement)
      t.optional = target.checked;
    else if (
      (field === "dependsOn" || field === "blocks") &&
      target instanceof HTMLInputElement
    ) {
      const task = t as ChangeTask;
      const current = task[field];
      task[field] = target.checked
        ? [...new Set([...current, target.value])]
        : current.filter((id) => id !== target.value);
      const count = target
        .closest(".link-picker")
        ?.querySelector(".link-count");
      if (count) count.textContent = String(task[field].length);
    } else return;
  } else return;
  edited = true;
  updateResult();
}

app.addEventListener("input", (event) => inputChanged(event.target));
app.addEventListener("change", async (event) => {
  const target = event.target;
  if (target instanceof HTMLSelectElement) inputChanged(target);
  if (!(target instanceof HTMLInputElement) || target.id !== "import-file")
    return;
  const file = target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 256_000) throw new ProjectError("fileSize");
    const next = parseProject(await file.text());
    replaceDraft(next, strings(lang).imported);
  } catch (error) {
    notify(errorMessage(error, lang), true);
  }
  target.value = "";
});

app.addEventListener("keydown", (event) => {
  const target = event.target;
  if (
    !(target instanceof HTMLElement) ||
    !target.dataset.tab ||
    !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
  )
    return;
  event.preventDefault();
  tab =
    event.key === "Home"
      ? "baseline"
      : event.key === "End"
        ? "changes"
        : tab === "baseline"
          ? "changes"
          : "baseline";
  refreshEditor();
  document.querySelector<HTMLButtonElement>(`[data-tab="${tab}"]`)!.focus();
});

app.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest<HTMLButtonElement>("button");
  if (!button || button.disabled) return;
  const s = strings(lang);
  if (button.dataset.tab) {
    tab = button.dataset.tab as Tab;
    refreshEditor();
    document.querySelector<HTMLButtonElement>(`[data-tab="${tab}"]`)!.focus();
    return;
  }
  switch (button.dataset.action) {
    case "language":
      lang = lang === "en" ? "zh" : "en";
      render();
      break;
    case "example":
      replaceDraft(example(selectedExample, lang), s.exampleLoaded);
      break;
    case "new":
      replaceDraft(blankProject(lang), s.fresh);
      break;
    case "import":
      document.querySelector<HTMLInputElement>("#import-file")!.click();
      break;
    case "save":
      if (receipt) {
        download(
          "scope-creep-project.json",
          serializeProject(project),
          "application/json",
        );
        notify(s.downloaded);
      }
      break;
    case "download":
      if (receipt) {
        download(
          "scope-creep-receipt.md",
          receiptMarkdown(project, receipt, lang),
          "text/markdown;charset=utf-8",
        );
        notify(s.downloaded);
      }
      break;
    case "copy":
      if (receipt) {
        try {
          await navigator.clipboard.writeText(
            receiptMarkdown(project, receipt, lang),
          );
          notify(s.copied);
        } catch {
          notify(s.copyFailed, true);
        }
      }
      break;
    case "print":
      if (receipt) window.print();
      break;
    case "add": {
      if (
        (tab === "baseline" && project.baseline.length >= 60) ||
        (tab === "changes" && project.changes.length >= 40)
      ) {
        notify(s.limit, true);
        break;
      }
      const t = {
        id: crypto.randomUUID(),
        name: tab === "baseline" ? s.untitledTask : s.untitledChange,
        hours: 6,
        dependsOn: [],
        optional: false,
      };
      if (tab === "baseline") project.baseline.push(t);
      else project.changes.push({ ...t, blocks: [] });
      edited = true;
      refreshEditor();
      updateResult();
      document
        .querySelector<HTMLInputElement>(
          '.task-row:last-child [data-task="name"]',
        )
        ?.focus();
      break;
    }
    case "remove": {
      const group = button.dataset.group as Tab;
      const t = project[group][Number(button.dataset.index)];
      confirm(s.removeHint, () => {
        try {
          project = removeTask(project, t.id);
        } catch (error) {
          notify(errorMessage(error, lang), true);
          return;
        }
        edited = true;
        refreshEditor();
        updateResult();
      });
      break;
    }
    case "download-rejected":
      if (rejectedDraft !== null)
        download(
          "scope-creep-recovered-draft.json",
          rejectedDraft,
          "application/json",
        );
      break;
    case "replace-rejected":
      confirm(s.replaceHint, () => {
        rejectedDraft = null;
        edited = true;
        render();
      });
      break;
    case "capacity":
      if (receipt?.requiredDailyHours) {
        project.settings.dailyHours = receipt.requiredDailyHours;
        edited = true;
        refreshEditor();
        updateResult();
      }
      break;
    case "defer":
      confirm(s.removeHint, () => {
        try {
          project = deferTask(project, button.dataset.id!);
          edited = true;
          refreshEditor();
          updateResult();
        } catch (error) {
          notify(errorMessage(error, lang), true);
        }
      });
      break;
    case "cancel":
      document.querySelector<HTMLDialogElement>("#confirm-dialog")!.close();
      confirmAction = null;
      break;
    case "confirm": {
      const action = confirmAction;
      confirmAction = null;
      document.querySelector<HTMLDialogElement>("#confirm-dialog")!.close();
      action?.();
      break;
    }
  }
});

let previouslyOpen: boolean[] = [];
window.addEventListener("beforeprint", () => {
  const details = [
    ...document.querySelectorAll<HTMLDetailsElement>("#receipt details"),
  ];
  previouslyOpen = details.map((d) => d.open);
  details.forEach((d) => {
    d.open = true;
  });
});
window.addEventListener("afterprint", () => {
  document
    .querySelectorAll<HTMLDetailsElement>("#receipt details")
    .forEach((d, i) => {
      d.open = previouslyOpen[i] ?? false;
    });
});

render();
if (startupError) notify(errorMessage(startupError, lang), true);
if (!storageAvailable) notify(strings(lang).storageFailed, true);
app.addEventListener("focusout", () => {
  if (receipt)
    document.querySelector("#receipt-announcement")!.textContent =
      `${strings(lang).total}: ${money(receipt.cost, project.settings.currency, lang)}. ${strings(lang).delay}: ${receipt.deltaDays}.`;
});
