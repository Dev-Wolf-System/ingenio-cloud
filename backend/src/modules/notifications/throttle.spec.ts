import { Throttle } from './throttle';

describe('Throttle', () => {
  it('permite el primer envío y bloquea repetido dentro de la ventana', () => {
    const t = new Throttle(30 * 60_000);
    const now = Date.now();
    expect(t.allow('s1', now)).toBe(true);
    expect(t.allow('s1', now + 1000)).toBe(false);
  });
  it('permite de nuevo pasada la ventana', () => {
    const t = new Throttle(30 * 60_000);
    const now = Date.now();
    expect(t.allow('s1', now)).toBe(true);
    expect(t.allow('s1', now + 31 * 60_000)).toBe(true);
  });
});
