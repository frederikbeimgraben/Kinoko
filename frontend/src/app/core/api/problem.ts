/** The RFC 9457 error body. Each backend error is `application/problem+json`, never a FastAPI `detail`. */
export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  code?: string;
  errors?: { field: string; msg: string }[];
}

// The code of a 401 after a failed silent renewal. The sign-in sheet is open, so the ApiClient
// shows no toast for this code.
export const SIGN_IN_REQUIRED = 'anmeldung_noetig';

/** Checks that a response body is a problem+json. */
export function isProblemDetail(value: unknown): value is ProblemDetail {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<ProblemDetail>;
  return typeof candidate.title === 'string' && typeof candidate.status === 'number';
}
