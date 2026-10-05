// Navigation badges must not flood the connection used by the active board.
type Job = {
  run: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  signal: AbortSignal;
  abort: () => void;
};
const queue: Job[] = [];
let running = 0;
const MAX_CONCURRENT_NAVIGATION_REQUESTS = 2;
function aborted(signal: AbortSignal) {
  return signal.reason ?? new DOMException('Aborted', 'AbortError');
}
function drain() {
  while (running < MAX_CONCURRENT_NAVIGATION_REQUESTS && queue.length) {
    const job = queue.shift()!;
    job.signal.removeEventListener('abort', job.abort);
    if (job.signal.aborted) { job.reject(aborted(job.signal)); continue; }
    running++;
    Promise.resolve().then(() => {
      if (job.signal.aborted) throw aborted(job.signal);
      return job.run();
    }).then(job.resolve, job.reject).finally(() => { running--; drain(); });
  }
}
export function runNavigationTask<T>(run: () => Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(aborted(signal));
  return new Promise<T>((resolve, reject) => {
    const job: Job = {run, resolve: value => resolve(value as T), reject, signal, abort: () => {
      const index = queue.indexOf(job);
      if (index !== -1) { queue.splice(index, 1); reject(aborted(signal)); }
    }};
    signal.addEventListener('abort', job.abort, {once: true});
    queue.push(job);
    drain();
  });
}
