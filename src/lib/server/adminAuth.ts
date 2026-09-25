import { createHmac, timingSafeEqual } from 'node:crypto';

const DAYS = 5;

/** blob has no accounts, so /admin is gated by one shared password instead of a firebase uid */
export const adminAuthEnabled = () => Boolean(process.env.ADMIN_PASSWORD);

const sign = (v: string) => createHmac('sha256', process.env.ADMIN_PASSWORD!).update(v).digest('hex');

const equals = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export const checkPassword = (given: string) =>
  adminAuthEnabled() && equals(given, process.env.ADMIN_PASSWORD!);

export function issueToken(): { value: string; maxAge: number } {
  const exp = Date.now() + DAYS * 86_400_000;
  return { value: `${exp}.${sign(String(exp))}`, maxAge: DAYS * 86_400 };
}

export function validToken(token?: string): boolean {
  if (!token || !adminAuthEnabled()) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || !Number(exp) || Number(exp) < Date.now()) return false;
  return equals(sig, sign(exp));
}
