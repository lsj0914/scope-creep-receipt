import type { Project, Receipt } from "./model";
import type { Language } from "./examples";
import { escapeHTML as e } from "./documents";
import { strings, money, formatDate, formatNumber } from "./i18n";

export function receiptHTML(p: Project, r: Receipt, lang: Language): string {
  const s = strings(lang);
  const m = (value: number) => money(value, p.settings.currency, lang);
  const d = (value: string) => formatDate(value, lang);
  const n = (value: number) => formatNumber(value, lang);
  const status =
    r.deadlineSlip > 0 ? `${n(r.deadlineSlip)} ${s.late}` : s.onTime;
  return `<article id="receipt" class="receipt-paper" aria-label="${s.yourReceipt}">
    <header class="receipt-header"><span class="receipt-symbol" aria-hidden="true">＋</span><p>${s.estimate}</p><h2>${s.yourReceipt}</h2><p class="receipt-project">${e(p.title)}</p></header>
    <div class="receipt-meta"><span>${s.requested}</span><strong>${e(p.requester || s.unspecified)}</strong></div>
    ${p.reason ? `<p class="receipt-reason">${e(p.reason)}</p>` : ""}
    <section class="receipt-section"><h3>${s.work}</h3><div class="receipt-items">
      ${p.changes.map((t) => `<div class="receipt-item"><div><strong>${e(t.name)}</strong><small>${n(t.hours)} ${s.hours} × ${m(p.settings.hourlyRate)}</small></div><span>${m(r.lineCosts.find((line) => line.id === t.id)!.cost)}</span></div>`).join("") || `<p class="hint">${s.noChanges}</p>`}
    </div><div class="subtotal"><span>${s.labor}</span><span>${m(r.laborCost)}</span></div>
    <div class="subtotal"><span>${s.contingency} <small>${p.settings.bufferPercent}% / ≈${n(r.bufferHours)} ${s.hours}</small></span><span>${m(r.bufferCost)}</span></div>
    <div class="receipt-total"><span>${s.total}</span><strong data-testid="receipt-total">${m(r.cost)}</strong></div>
    ${p.settings.hourlyRate === 0 ? `<p class="hint">${s.zeroCost}</p>` : ""}</section>
    <section class="receipt-section timing"><h3>${s.timing}</h3><div class="dates"><div><span>${s.originalFinish}</span><strong>${d(r.baseline.finishDate)}</strong></div><span class="date-arrow" aria-hidden="true">→</span><div><span>${s.newFinish}</span><strong data-testid="new-finish">${d(r.revised.finishDate)}</strong></div></div>
    <div class="delay-line"><span>${s.delay}</span><strong><span data-testid="delay-days">${n(r.deltaDays)}</span><span aria-hidden="true"> d</span></strong></div>
    <p class="deadline-status ${r.deadlineSlip > 0 ? "late" : "on-time"}">${status}</p>
    <p class="hint">${s.deadline}: ${d(p.settings.deadline)}</p>
    ${r.baseline.finishDate > p.settings.deadline ? `<p class="baseline-warning">${s.baselineLate}</p>` : ""}
    </section>
    <section class="receipt-section impact"><h3>${s.why}</h3>${r.impactedTasks.length ? `<ul>${r.impactedTasks.map((t) => `<li><span>${e(t.name)}</span><strong>+${n(t.delay)} ${s.taskDelay}</strong></li>`).join("")}</ul>` : `<p>${s.nothingMoves}</p>`}</section>
    <details class="method"><summary>${s.assumptions}</summary><p>${s.assumptionsText}</p><p>${s.start}: ${d(p.settings.startDate)}. ${s.daily}: ${n(p.settings.dailyHours)}. ${s.rate}: ${m(p.settings.hourlyRate)}. ${s.buffer}: ${n(p.settings.bufferPercent)}.</p></details>
    <p class="receipt-footnote">${s.costNote}</p><div class="receipt-signoff">Scope Creep Receipt <span aria-hidden="true">✦</span></div>
  </article>
  <section class="timeline-section" aria-labelledby="timeline-heading"><h2 id="timeline-heading">${s.timeline}</h2><p class="hint">${s.timelineHint}</p>${timelineHTML(p, r, lang)}</section>
  <section class="alternatives" aria-labelledby="tradeoffs-heading"><h2 id="tradeoffs-heading">${s.decision}</h2>
    <div class="alternative"><h3>${s.accept}</h3><p>${s.acceptHint}</p><strong>${d(r.revised.finishDate)}</strong></div>
    <div class="alternative"><h3>${s.capacity}</h3>${r.requiredDailyHours === null ? `<p>${s.impossible}</p>` : r.requiredDailyHours <= p.settings.dailyHours ? `<p>${s.alreadyFits}</p>` : `<p>${s.capacityHintAlt} <strong>${n(r.requiredDailyHours)} ${s.hours}</strong></p><button data-action="capacity" class="secondary small">${s.applyCapacity}</button>`}</div>
    ${r.deferrals.length ? r.deferrals.map((def) => `<div class="alternative"><h3>${s.defer} ${e(def.name)}</h3><p>${n(def.savedDays)} ${s.saves}. ${d(def.finishDate)}.</p><span class="tradeoff-status ${def.meetsDeadline ? "meets" : ""}">${def.meetsDeadline ? s.meets : s.stillLate}</span><button data-action="defer" data-id="${e(def.id)}" class="secondary small" aria-label="${s.defer} ${e(def.name)}">${s.defer}</button></div>`).join("") : `<p class="hint">${s.noOptional}</p>`}
  </section>`;
}

function timelineHTML(p: Project, r: Receipt, lang: Language): string {
  const s = strings(lang);
  const max = Math.max(r.baseline.days, r.revised.days);
  return `<div class="timeline-legend"><span><i class="old-key"></i>${s.originalBar}</span><span><i class="new-key"></i>${s.revisedBar}</span><span><i class="critical-key"></i>${s.critical}</span></div><div class="timeline-rows">${r.revised.tasks
    .map((t) => {
      const old = r.baseline.tasks.find((b) => b.id === t.id);
      const isNew = p.changes.some((c) => c.id === t.id);
      const bar = (start: number, duration: number, variant: string) =>
        `<span class="timeline-bar ${variant}" style="margin-left:${(start / max) * 100}%;width:${(duration / max) * 100}%"></span>`;
      return `<div class="timeline-row"><div class="timeline-name">${e(t.name)} ${isNew ? `<span class="new-tag">${s.newTask}</span>` : ""}</div><div class="timeline-track" role="img" aria-label="${e(t.name)}: ${s.revisedBar} ${t.start + 1}–${t.end}; ${s.originalBar} ${old ? `${old.start + 1}–${old.end}` : "—"}${t.critical ? `; ${s.critical}` : ""}"><div>${old ? bar(old.start, old.duration, "old") : ""}</div><div>${bar(t.start, t.duration, t.critical ? "revised critical" : "revised")}</div></div><span class="timeline-duration">${t.duration} d</span></div>`;
    })
    .join(
      "",
    )}<div class="timeline-scale"><span>1</span><span>${max} ${lang === "zh" ? "工作日" : "working days"}</span></div></div>`;
}
