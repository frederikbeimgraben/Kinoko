/** Typen für die `.mjs`-Werkzeuge aus den Tests unter `src/tools`. */

declare module '*/tools/check-comments.mjs' {
  export interface Violation {
    path: string;
    line: number;
    rule: string;
    text: string;
    reason: string;
  }
  export function findViolations(root: string): Violation[];
  export function report(root: string, allowPath: string): Violation[];
  export function allowKey(violation: Violation): string;
}

declare module '*/tools/check-german.mjs' {
  export interface Violation {
    path: string;
    line: number;
    text: string;
  }
  export function findViolations(root: string): Violation[];
  export function report(root: string, allowPath: string): Violation[];
  export function allowKey(violation: Violation): string;
}

declare module '*/tools/check-selectors.mjs' {
  export interface Violation {
    path: string;
    line: number;
    key: string;
    reason: string;
  }
  export function findViolations(root: string): Violation[];
  export function report(root: string, allowPath: string): Violation[];
}

declare module '*/tools/check-size.mjs' {
  export interface Violation {
    path: string;
    lines: number;
    limit: number;
  }
  export function findViolations(root: string): Violation[];
  export function report(root: string, allowPath: string): Violation[];
}

declare module '*/tools/check-boards.mjs' {
  export interface BoardCoverage {
    checked: string[];
    pending: string[];
    missing: string[];
  }
  export function checkBoards(root: string): BoardCoverage;
}

declare module '*/tools/sync-boards.mjs' {
  export interface BoardFile {
    name: string;
    action: 'copy' | 'skip-same' | 'skip-excluded';
  }
  export interface SyncResult {
    from: string;
    target: string;
    fresh: number;
    same: number;
    files: BoardFile[];
  }
  export function sync(root: string): SyncResult | null;
}
