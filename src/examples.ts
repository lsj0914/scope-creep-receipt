import type { Project, Task, ChangeTask } from './model';

export type Language = 'en' | 'zh';
export type ExampleId = 'launch' | 'parallel' | 'tradeoff';
const names: Record<Language, Record<string, string>> = {
  en: { design: 'Confirm scope & design', build: 'Build the booking page', polish: 'Add launch animation', qa: 'Test & hand over', export: 'Add CSV export', dashboard: 'Weekly operations dashboard', data: 'Prepare source data', report: 'Build the report', review: 'Stakeholder review', glossary: 'Write a data glossary', event: 'Campus workshop launch', venue: 'Confirm venue & budget', program: 'Prepare the program', social: 'Create social media pack', ready: 'Final readiness check', livestream: 'Set up a livestream' },
  zh: { design: '确认范围与设计', build: '搭建预约页面', polish: '加入发布动画', qa: '测试与交接', export: '增加 CSV 导出', dashboard: '每周运营看板', data: '整理数据源', report: '搭建报告', review: '利益相关者审阅', glossary: '编写数据字典', event: '校园工作坊启动', venue: '确认场地与预算', program: '准备活动内容', social: '制作社交媒体素材', ready: '最终就绪检查', livestream: '增加直播功能' },
};

export function example(id: ExampleId, lang: Language = 'en'): Project {
  const n = names[lang];
  const t = (key: string, hours: number, dependsOn: string[] = [], optional = false): Task => ({ id: key, name: n[key], hours, dependsOn, optional });
  const c = (key: string, hours: number, dependsOn: string[], blocks: string[]): ChangeTask => ({ ...t(key, hours, dependsOn), blocks });
  const shared = {
    version: 1 as const, requester: lang === 'en' ? 'Project sponsor' : '项目发起人',
    settings: { startDate: '2026-10-05', deadline: '2026-10-09', dailyHours: 6, hourlyRate: 75, bufferPercent: 0, currency: 'USD' as const },
  };
  if (id === 'parallel') return {
    ...shared, title: n.dashboard, reason: lang === 'en' ? 'A glossary would help new team members understand the report.' : '数据字典可以帮助新成员理解报告。',
    baseline: [t('data', 12), t('report', 12, ['data']), t('review', 6, ['report'])],
    changes: [c('glossary', 12, [], [])],
  };
  if (id === 'tradeoff') return {
    ...shared, title: n.event, reason: lang === 'en' ? 'We want remote students to join the workshop, too.' : '希望远程学生也能参加工作坊。',
    baseline: [t('venue', 6), t('program', 12, ['venue']), t('social', 6, ['program'], true), t('ready', 6, ['social'])],
    changes: [c('livestream', 6, ['program'], ['social'])],
  };
  return {
    ...shared, title: lang === 'en' ? 'Pet-care booking launch' : '宠物护理预约服务上线',
    reason: lang === 'en' ? '“Can we just add an export button before launch?”' : '“上线前能不能顺便加一个导出按钮？”',
    baseline: [t('design', 12), t('build', 12, ['design']), t('qa', 6, ['build'])],
    changes: [c('export', 12, ['build'], ['qa'])],
  };
}

export function blankProject(lang: Language): Project {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return { version: 1, title: lang === 'en' ? 'My project' : '我的项目', requester: '', reason: '', settings: { startDate: today, deadline: today, dailyHours: 6, hourlyRate: 75, bufferPercent: 0, currency: 'USD' }, baseline: [{ id: 'first', name: lang === 'en' ? 'First deliverable' : '第一个交付物', hours: 6, dependsOn: [], optional: false }], changes: [] };
}
