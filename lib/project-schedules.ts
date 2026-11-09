import registration from '../data/operations/schedules.json';

export const scheduleRevision = 'xingzhun-schedules-20261107';
export const scheduleProjectUrl = 'https://chatgpt.com/space/page_6aef0181cd08819180fe2102e435c9e3';
const repo = 'poias45652-creator/arena-sports-board';
const source = 'https://raw.githubusercontent.com/' + repo + '/schedule-status/data/operations/';
const actions = 'https://api.github.com/repos/' + repo + '/actions/workflows/';

type Task = {
  key: string;
  name: string;
  enabled: boolean;
  timing: string;
  schedule: string;
  timezone: string;
  lastRunAt: string | null;
  asOf: string;
};

type Receipt = {
  key: string;
  reportedAt: string | null;
  outcome: 'completed' | 'partial' | 'blocked' | null;
  checked: number | null;
  issues: number | null;
};

export const siteSchedules = [
  {file: 'international-daily.yml', name: '台日韓職棒更新、韓澳職籃賽前收錄', timing: '每日 08:17、14:17、17:17、23:17'},
  {file: 'nba-player-strength-sync.yml', name: 'NBA 球員實力資料更新', timing: '每 3 小時，第 15 分'},
  {file: 'wnba-player-strength-sync.yml', name: 'WNBA 球員實力資料更新', timing: '每 3 小時，第 35 分'},
  {file: 'football-fotmob-sync.yml', name: '足球 xG 資料更新', timing: '每日 04:25'},
];

function validTime(value: unknown) {
  return typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value) && Number.isFinite(Date.parse(value));
}
function shortText(value: unknown, max: number) {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}
export function validScheduleCatalog(value: unknown): value is Task[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 64) return false;
  const valid = value.every(task => task && typeof task.key === 'string' && /^[a-z][a-z0-9-]{1,47}$/.test(task.key)
    && shortText(task.name, 96) && typeof task.enabled === 'boolean' && shortText(task.timing, 160)
    && shortText(task.schedule, 1000) && shortText(task.timezone, 96) && validTime(task.asOf)
    && (task.lastRunAt === null || validTime(task.lastRunAt)));
  return valid && new Set(value.map(task => task.key)).size === value.length;
}
function validCount(value: unknown) {
  return value === null || typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
export function validScheduleReceipt(value: unknown, key: string): value is Receipt {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  if (row.key !== key || !validCount(row.checked) || !validCount(row.issues)) return false;
  if (row.outcome === null) return row.reportedAt === null && row.checked === null && row.issues === null;
  return (row.outcome === 'completed' || row.outcome === 'partial' || row.outcome === 'blocked') && validTime(row.reportedAt);
}

async function readJson(url: string) {
  try {
    const response = await fetch(url, {
      headers: {Accept: 'application/json', 'User-Agent': 'xingzhun-schedule-monitor'},
      signal: AbortSignal.timeout(4500),
      next: {revalidate: 180},
    });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

export async function scheduleCatalog() {
  const live = await readJson(source + 'schedules.json');
  return validScheduleCatalog(live) ? {tasks: live, synced: true} : {tasks: registration as Task[], synced: false};
}

async function workflowStatus(workflow: typeof siteSchedules[number]) {
  const listing = await readJson(actions + workflow.file + '/runs?event=schedule&branch=main&per_page=1');
  const observed = Array.isArray(listing?.workflow_runs);
  const run = observed ? listing.workflow_runs[0] : null;
  return {
    ...workflow,
    url: 'https://github.com/' + repo + '/actions/workflows/' + workflow.file,
    observed,
    started: run?.run_started_at ?? run?.created_at ?? null,
    state: run?.conclusion ?? run?.status ?? null,
  };
}

export async function projectScheduleReport() {
  const [catalog, workflows] = await Promise.all([scheduleCatalog(), Promise.all(siteSchedules.map(workflowStatus))]);
  const tasks = await Promise.all(catalog.tasks.map(async task => {
    const row = await readJson(source + 'runs/' + task.key + '.json');
    return {...task, receipt: validScheduleReceipt(row, task.key) ? row : null};
  }));
  return {tasks, workflows, synced: catalog.synced};
}
