import { ContractClient, ProblemError, contractUrl } from './contract-client';

function reply(status: number, body: unknown): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('contractUrl', () => {
  it('setzt Pfadwerte ein', () => {
    expect(contractUrl('/api', '/species/{slug}', { path: { slug: 'boletus edulis' } })).toBe(
      '/api/species/boletus%20edulis',
    );
  });

  it('lässt einen fehlenden Pfadwert leer', () => {
    expect(contractUrl('/api', '/species/{slug}')).toBe('/api/species/');
  });

  it('hängt die Parameter an und lässt Unbestimmtes weg', () => {
    expect(contractUrl('/api', '/species', { params: { limit: 40, q: undefined, lead: true } })).toBe(
      '/api/species?limit=40&lead=true',
    );
  });
});

describe('ContractClient', () => {
  it('holt einen Weg des Vertrags', async () => {
    const send = vi.fn().mockResolvedValue(reply(200, { status: 'ok' }));
    const client = new ContractClient('/api', send);

    await expect(client.get('/health')).resolves.toEqual({ status: 'ok' });
    expect(send).toHaveBeenCalledWith('/api/health', expect.objectContaining({ method: 'GET' }));
  });

  it('sendet eine Nutzlast als JSON', async () => {
    const send = vi.fn().mockResolvedValue(reply(201, { id: 'a' }));
    const client = new ContractClient('/api', send);

    await client.post('/terms', { kind: 'trigger', slug: 'pressure', name: 'Druck' });

    expect(send).toHaveBeenCalledWith(
      '/api/terms',
      expect.objectContaining({
        method: 'POST',
        body: '{"kind":"trigger","slug":"pressure","name":"Druck"}',
        headers: { 'content-type': 'application/json' },
      }),
    );
  });

  it('liest 204 ohne Körper', async () => {
    const send = vi.fn().mockResolvedValue(reply(204, null));
    const client = new ContractClient('/api', send);

    await expect(client.get('/health')).resolves.toBeUndefined();
  });

  it('wirft den Code des Problems', async () => {
    const send = vi.fn().mockResolvedValue(reply(404, { code: 'not_found' }));
    const client = new ContractClient('/api', send);

    await expect(client.get('/species/{slug}', { path: { slug: 'x' } })).rejects.toThrow(ProblemError);
  });

  it('nennt einen Fehler ohne Code unbekannt', async () => {
    const send = vi.fn().mockResolvedValue(reply(500, {}));
    const client = new ContractClient('/api', send);

    await expect(client.get('/health')).rejects.toMatchObject({ status: 500, code: 'unknown' });
  });
});
