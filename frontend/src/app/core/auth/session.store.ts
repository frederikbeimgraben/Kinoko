import { Injectable, signal, untracked } from '@angular/core';
import type { Permission } from '../api/models';

/** Der letzte bekannte Stand der Sitzung. Kein Geheimnis liegt darin. */
export interface SessionMemory {
  name: string;
  permissions: readonly Permission[];
}

const KEY = 'pilzkarte.session.v1';

function parse(raw: string | null): SessionMemory | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const { name, permissions } = value as Partial<SessionMemory>;
    if (typeof name !== 'string' || name === '' || !Array.isArray(permissions)) return null;
    return { name, permissions: permissions.filter((right) => typeof right === 'string') as Permission[] };
  } catch {
    return null;
  }
}

function read(): SessionMemory | null {
  try {
    return parse(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

/** Hält Name und Rechte der letzten Sitzung im Gerät. Kein Token liegt darin. */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly held = signal<SessionMemory | null>(read());

  readonly memory = this.held.asReadonly();

  // Der Aufrufer schreibt aus einem Effekt heraus. Ein verfolgter Lesezugriff
  // machte daraus eine Schleife.
  keep(part: Partial<SessionMemory>): void {
    const known = untracked(this.held);
    const next: SessionMemory = { name: '', permissions: [], ...known, ...part };
    if (next.name === '') return;
    this.held.set(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Ohne Speicher trägt der Stand nur diese Sitzung.
    }
  }

  forget(): void {
    this.held.set(null);
    try {
      localStorage.removeItem(KEY);
    } catch {
      // Ein gesperrter Speicher hat nichts abzulegen.
    }
  }
}
