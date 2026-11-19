// Stand-in for `@devvit/web/client` when running against tools/mock-server.
type Opts = { channel: string; onMessage: (data: any) => void; onConnect?: (c: string) => void };
const sources = new Map<string, EventSource>();

export const context = { postId: 't3_mockpost', postData: undefined, username: undefined };

export function connectRealtime(opts: Opts) {
  const es = new EventSource(`/mock/realtime?channel=${encodeURIComponent(opts.channel)}`);
  es.onopen = () => opts.onConnect?.(opts.channel);
  es.onmessage = (e) => opts.onMessage(JSON.parse(e.data));
  sources.set(opts.channel, es);
  return { disconnect: async () => es.close() };
}
export function disconnectRealtime(channel: string) {
  sources.get(channel)?.close();
}
export function requestExpandedMode(_e: MouseEvent, entry: string) {
  location.href = `${entry}.html${location.search}`;
}
