import { SecretBox } from './secret-box';

describe('SecretBox (AES-256-GCM)', () => {
  const box = new SecretBox('11'.repeat(32));

  it('round-trips and never stores the plaintext', () => {
    const stored = box.encrypt('sk-live-abc123');
    expect(stored).not.toContain('sk-live');
    expect(box.decrypt(stored)).toBe('sk-live-abc123');
  });

  it('uses a fresh IV per encryption', () => {
    expect(box.encrypt('same')).not.toBe(box.encrypt('same'));
  });

  it('detects tampering via the auth tag', () => {
    const [v, iv, tag, ct] = box.encrypt('secret').split(':');
    const flipped = Buffer.from(ct, 'base64');
    flipped[0] ^= 0xff;
    expect(() => box.decrypt([v, iv, tag, flipped.toString('base64')].join(':'))).toThrow();
  });

  it('cannot decrypt with a different key', () => {
    const other = new SecretBox('22'.repeat(32));
    expect(() => other.decrypt(box.encrypt('secret'))).toThrow();
  });

  it('rejects keys of the wrong length', () => {
    expect(() => new SecretBox('abcd')).toThrow(/32 bytes/);
  });
});
