import type { Project, Receipt } from "./model";
import type { Language } from "./examples";
import { validateProject, calculate } from "./engine";
import { ProjectError, MAX_PROJECT_BYTES } from "./model";
import { strings, money } from "./i18n";

export function parseProject(source: string): Project {
  if (new TextEncoder().encode(source).length > MAX_PROJECT_BYTES)
    throw new ProjectError("fileSize");
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new ProjectError("json");
  }
  const p = validateProject(value);
  calculate(p); // Validate the schedule horizon before replacing an existing draft.
  return p;
}

/** Compact JSON keeps accepted projects portable within the same import budget. */
export function serializeProject(p: Project): string {
  return JSON.stringify(validateProject(p));
}

export function escapeHTML(text: string): string {
  const chars: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return text.replace(/[&<>"']/g, (c) => chars[c]);
}

const markdownText = (value: string) =>
  value
    .replace(/[\r\n]+/g, " ")
    .replace(/([\\`*_{}\[\]()#+.!|<>~\-])/g, "\\$1");

export function receiptMarkdown(
  p: Project,
  r: Receipt,
  lang: Language,
): string {
  const s = strings(lang);
  const m = (value: number) => money(value, p.settings.currency, lang);
  const lines = [
    `# ${s.app}`,
    "",
    `## ${markdownText(p.title)}`,
    "",
    `${s.requested}: ${markdownText(p.requester || s.unspecified)}`,
    "",
    markdownText(p.reason),
    "",
    `### ${s.work}`,
    "",
    `| ${s.taskName} | ${s.effort} | ${s.labor} |`,
    "| --- | ---: | ---: |",
    ...p.changes.map(
      (t) =>
        `| ${markdownText(t.name)} | ${t.hours} | ${m(r.lineCosts.find((line) => line.id === t.id)!.cost)} |`,
    ),
    "",
    `${s.labor}: ${m(r.laborCost)}`,
    `${s.contingency} (${p.settings.bufferPercent}%): ≈${r.bufferHours} ${s.hours} / ${m(r.bufferCost)}`,
    "",
    `**${s.total}: ${m(r.cost)}**`,
    "",
    `### ${s.timing}`,
    "",
    `- ${s.originalFinish}: ${r.baseline.finishDate}`,
    `- ${s.newFinish}: ${r.revised.finishDate}`,
    `- ${s.delay}: ${r.deltaDays}`,
    `- ${s.deadline}: ${p.settings.deadline}`,
    `- ${r.deadlineSlip === 0 ? s.onTime : `${r.deadlineSlip} ${s.late}`}`,
    "",
    `### ${s.why}`,
    "",
    ...(r.impactedTasks.length
      ? r.impactedTasks.map(
          (t) => `- ${markdownText(t.name)}: ${t.delay} ${s.taskDelay}`,
        )
      : [s.nothingMoves]),
    "",
    `### ${s.decision}`,
    "",
    `${s.accept}: ${r.revised.finishDate}.`,
    r.requiredDailyHours === null
      ? s.impossible
      : `${s.capacityHintAlt} ${r.requiredDailyHours} ${s.hours}.`,
    ...r.deferrals.map(
      (d) =>
        `${s.defer} ${markdownText(d.name)}: ${d.finishDate}; ${d.savedDays} ${s.saves}; ${d.meetsDeadline ? s.meets : s.stillLate}.`,
    ),
    "",
    `### ${s.assumptions}`,
    "",
    `${s.start}: ${p.settings.startDate}. ${s.daily}: ${p.settings.dailyHours}. ${s.rate}: ${m(p.settings.hourlyRate)}. ${s.buffer}: ${p.settings.bufferPercent}.`,
    "",
    s.assumptionsText,
    "",
    s.costNote,
    "",
    "Scope Creep Receipt — https://github.com/lsj0914/scope-creep-receipt",
    "",
  ];
  return lines.join("\n");
}

export function download(filename: string, source: string, mime: string) {
  const url = URL.createObjectURL(new Blob([source], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
