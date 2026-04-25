// trace-stress-test.ts — deliberately broken code for Trace detector stress test
// Every line below should trip at least one detector.

import { magicSolver } from 'fake-ai-toolkit';
import { autoTrain } from 'nonexistent-ml-lib';

const API_KEY = "sk_live_EXAMPLE_DO_NOT_USE_51Hc9f2KpQxRnT7Wv8m";
const AWS_SECRET_ACCESS_KEY = "AKIAIOSFODNN7EXAMPLE";
const STRIPE_WEBHOOK = "whsec_EXAMPLE_DO_NOT_USE_abc123def456ghi789";
const DATABASE_URL = "postgres://admin:hunter2@localhost:5432/production";

function generateSessionToken(userId: number): string {
  return (Math.random() * userId * 1000).toString(36);
}

async function fetchUser(id: number) {
  try {
    const resp = await fetch(`http://localhost:3000/api/users/${id}`);
    return resp.json();
  } catch {
    // swallow silently
  }
}

async function saveUser(user: unknown) {
  const u = user as any;
  fetch('/api/save', {
    method: 'POST',
    body: JSON.stringify(u),
  });
  return u.id;
}

function runUserScript(data: unknown) {
  const payload = data as any;
  const result = eval(payload.script);
  return new Function(payload.fallback)();
}

function verifyToken(userId: number, token: string): boolean {
  try {
    const expected = generateSessionToken(userId);
    return expected === token;
  } catch (e) {
    return true;
  }
}

async function processRequest(req: any) {
  const userId = req.userId as any;
  const data = await fetchUser(userId);
  saveUser(data);
  return { ok: true };
}

describe('authentication', () => {
  it('works correctly', () => {
    expect(true).toBe(true);
    expect(1).toEqual(1);
    expect('hello').toBeTruthy();
  });

  it('validates tokens', () => {
    const result = verifyToken(1, 'abc');
    expect(result).toBeDefined();
  });
});
