import type { paths } from './contract';

/** Ein Weg des Vertrags, der diese Methode trägt. */
type PathWith<M extends string> = {
  [P in keyof paths]: paths[P] extends Record<M, object> ? P : never;
}[keyof paths];

type Operation<P extends keyof paths, M extends string> = paths[P] extends Record<M, infer O> ? O : never;

type Success<O> = O extends { responses: { 200: { content: { 'application/json': infer T } } } }
  ? T
  : O extends { responses: { 201: { content: { 'application/json': infer T } } } }
    ? T
    : undefined;

type Payload<O> = O extends { requestBody: { content: { 'application/json': infer T } } } ? T : never;

/** Pfadwerte, Parameter und Abbruch eines Aufrufs. */
export interface CallOptions {
  path?: Record<string, string | number>;
  params?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
}

/** Ein Fehler des Vertrags: `application/problem+json` mit englischem Code. */
export class ProblemError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

/** Setzt die Pfadwerte ein und hängt die Parameter an. */
export function contractUrl(base: string, path: string, options?: CallOptions): string {
  const filled = path.replace(/\{(\w+)\}/g, (_, name: string) =>
    encodeURIComponent(String(options?.path?.[name] ?? '')),
  );
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(options?.params ?? {})) {
    if (value !== undefined) params.set(name, String(value));
  }
  const tail = params.toString();
  return `${base}${filled}${tail ? `?${tail}` : ''}`;
}

/** Ruft die API über die Wege des Vertrags auf. Ein anderer Weg ist ein Typfehler. */
export class ContractClient {
  constructor(
    private readonly base = '/api',
    private readonly send: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {}

  get<P extends PathWith<'get'>>(path: P, options?: CallOptions): Promise<Success<Operation<P, 'get'>>> {
    return this.call(path, 'GET', undefined, options);
  }

  post<P extends PathWith<'post'>>(
    path: P,
    payload: Payload<Operation<P, 'post'>>,
    options?: CallOptions,
  ): Promise<Success<Operation<P, 'post'>>> {
    return this.call(path, 'POST', payload, options);
  }

  private async call<T>(path: string, method: string, payload: unknown, options?: CallOptions): Promise<T> {
    const response = await this.send(contractUrl(this.base, path, options), {
      method,
      signal: options?.signal,
      headers: payload === undefined ? {} : { 'content-type': 'application/json' },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    const content: unknown = response.status === 204 ? undefined : await response.json();
    const problem = content as { code?: string } | undefined;
    if (!response.ok) throw new ProblemError(response.status, problem?.code ?? 'unknown');
    return content as T;
  }
}
