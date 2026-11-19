import type {
  InitResponse,
  PartyBeat,
  PartyScore,
  PartyState,
  SocialResponse,
  SubmitRequest,
  SubmitResponse,
} from '../shared/api';

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return (await res.json()) as T;
}

export const api = {
  init: () => call<InitResponse>('/api/init'),
  submit: (b: SubmitRequest) => call<SubmitResponse>('/api/submit', b),
  partyBeat: (b: PartyBeat) => call<PartyState>('/api/party/beat', b),
  partyStart: (b: PartyBeat) => call<PartyState>('/api/party/start', b),
  partyScore: (b: PartyScore) => call<PartyState>('/api/party/score', b),
  share: () => call<SocialResponse>('/api/share', {}),
  join: () => call<SocialResponse>('/api/join', {}),
  flair: () => call<SocialResponse>('/api/flair', {}),
};

export const fmt = (n: number) => n.toLocaleString('en-US');
