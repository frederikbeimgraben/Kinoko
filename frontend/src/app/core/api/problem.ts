/**
 * Error body as per RFC 9457. The backend sends `application/problem+json` on each error path, never the FastAPI `detail`.
 */
export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  code?: string;
  errors?: { field: string; msg: string }[];
}

/**
 * Code of a 401 that the sign-in sheet handles after a failed silent renewal. The ApiClient shows no toast for this code, because the sheet is already open.
 */
export const SIGN_IN_REQUIRED = 'anmeldung_noetig';

/** Checks that a response body is a problem+json. */
export function isProblemDetail(value: unknown): value is ProblemDetail {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<ProblemDetail>;
  return typeof candidate.title === 'string' && typeof candidate.status === 'number';
}
