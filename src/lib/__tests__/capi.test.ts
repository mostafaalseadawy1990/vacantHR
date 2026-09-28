import { describe, it, expect } from 'vitest';
import { normalizeUser, splitName, newEventId } from '../capi';
describe('capi', () => {
  it('normalises email/phone/name per Meta rules', () => {
    const n = normalizeUser({ email: ' Ahmed@Test.com ', phone: '01012345678', ...splitName('أحمد محمد علي') });
    expect(n.email).toBe('ahmed@test.com');
    expect(n.phone).toBe('201012345678');
    expect(n.firstName).toBe('أحمد');
    expect(n.lastName).toBe('محمد علي');
    expect(normalizeUser({ phone: '+20 10 1234 5678' }).phone).toBe('201012345678');
    expect(normalizeUser({ phone: '00201012345678' }).phone).toBe('201012345678');
  });
  it('event ids are unique', () => { expect(newEventId()).not.toBe(newEventId()); });
});
