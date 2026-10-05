import type { Project, Task, ChangeTask } from "./model";
import type { Language } from "./examples";
import { escapeHTML as e } from "./documents";
import { strings } from "./i18n";

export type Tab = "baseline" | "changes";

export function editorHTML(p: Project, lang: Language, tab: Tab): string {
  const s = strings(lang);
  const field = (
    label: string,
    key: string,
    value: string | number,
    type = "text",
    extra = "",
  ) =>
    `<label class="field"><span>${label}</span><input data-project="${key}" type="${type}" value="${e(String(value))}" ${extra}></label>`;
  return `<details class="settings" open>
    <summary>${s.projectSettings}<span class="disclosure" aria-hidden="true">⌄</span></summary>
    <div class="settings-body">
      ${field(s.projectName, "title", p.title, "text", 'maxlength="120" required')}
      ${field(s.requester, "requester", p.requester, "text", 'maxlength="120"')}
      <div class="field-grid">${field(s.start, "startDate", p.settings.startDate, "date", 'min="2000-01-01" max="2099-12-31" required')}${field(s.deadline, "deadline", p.settings.deadline, "date", 'min="2000-01-01" max="2099-12-31" required')}</div>
      <div class="field-grid three">${field(s.daily, "dailyHours", p.settings.dailyHours, "number", 'min="0.25" max="24" step="any" required')}${field(s.rate, "hourlyRate", p.settings.hourlyRate, "number", 'min="0" max="100000" step="0.01" required')}${field(s.buffer, "bufferPercent", p.settings.bufferPercent, "number", 'min="0" max="100" step="any" required')}</div>
      <label class="field currency-field"><span>${s.currency}</span><select data-project="currency">${["USD", "CNY", "EUR", "GBP"].map((c) => `<option ${c === p.settings.currency ? "selected" : ""}>${c}</option>`).join("")}</select></label>
      <p class="hint">${s.capacityHint}</p>
    </div>
  </details>
  <div class="tasks-editor">
    <div class="tabs" role="tablist" aria-label="${s.projectSettings}">
      <button id="baseline-tab" role="tab" aria-selected="${tab === "baseline"}" aria-controls="task-panel" tabindex="${tab === "baseline" ? 0 : -1}" data-tab="baseline">${s.baseline} <span>${p.baseline.length}</span></button>
      <button id="changes-tab" role="tab" aria-selected="${tab === "changes"}" aria-controls="task-panel" tabindex="${tab === "changes" ? 0 : -1}" data-tab="changes">${s.added} <span>${p.changes.length}</span></button>
    </div>
    <div id="task-panel" role="tabpanel" aria-labelledby="${tab === "baseline" ? "baseline-tab" : "changes-tab"}">
      <p class="panel-description">${tab === "baseline" ? s.baselineHint : s.addedHint}</p>
      ${tab === "changes" ? `<label class="field reason"><span>${s.reason}</span><textarea data-project="reason" maxlength="2000" rows="2">${e(p.reason)}</textarea></label>` : ""}
      <div class="task-list">${(tab === "baseline" ? p.baseline : p.changes).map((t, i) => taskHTML(t, i, p, lang, tab)).join("") || `<p class="empty-state">${s.noChanges}</p>`}</div>
      <button class="add-task" data-action="add" ${tab === "baseline" ? (p.baseline.length >= 60 ? "disabled" : "") : p.changes.length >= 40 ? "disabled" : ""}><span aria-hidden="true">＋</span> ${tab === "baseline" ? s.addTask : s.addChange}</button>
    </div>
  </div>`;
}

function taskHTML(
  t: Task | ChangeTask,
  index: number,
  p: Project,
  lang: Language,
  tab: Tab,
): string {
  const s = strings(lang);
  const attrs = `data-group="${tab}" data-index="${index}"`;
  const picker = (
    label: string,
    key: "dependsOn" | "blocks",
    candidates: Task[],
    selected: string[],
  ) =>
    `<details class="link-picker" data-link-group="${key}"><summary><span>${label}</span><span class="link-count">${selected.length}</span></summary><div class="link-options">${candidates.length ? candidates.map((candidate) => `<label class="check"><input type="checkbox" ${attrs} data-task="${key}" value="${e(candidate.id)}" ${selected.includes(candidate.id) ? "checked" : ""}><span>${e(candidate.name)}</span></label>`).join("") : `<p class="hint">${s.none}</p>`}</div></details>`;
  return `<article class="task-row ${tab === "changes" ? "change-row" : ""}" aria-label="${e(t.name)}">
    <div class="task-main"><label class="field task-name"><span>${s.taskName}</span><input ${attrs} data-task="name" type="text" value="${e(t.name)}" maxlength="120" required></label>
    <label class="field task-effort"><span>${s.effort}</span><input ${attrs} data-task="hours" type="number" value="${t.hours}" min="0.25" max="10000" step="any" required></label>
    <button class="remove-task" ${attrs} data-action="remove" aria-label="${s.remove} ${e(t.name)}" ${tab === "baseline" && p.baseline.length === 1 ? "disabled" : ""}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13M10 10v7M14 10v7"/></svg></button></div>
    <div class="task-links">${picker(
      s.depends,
      "dependsOn",
      (tab === "baseline" ? p.baseline : [...p.baseline, ...p.changes]).filter(
        (c) => c.id !== t.id,
      ),
      t.dependsOn,
    )}
    ${tab === "changes" ? picker(s.blocks, "blocks", p.baseline, (t as ChangeTask).blocks) : `<label class="check optional-check"><input ${attrs} data-task="optional" type="checkbox" ${t.optional ? "checked" : ""}><span title="${s.optionalHint}">${s.optional}</span></label>`}</div>
  </article>`;
}
