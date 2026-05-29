export class Throttle {
  private last = new Map<string, number>();
  constructor(private readonly windowMs: number) {}
  allow(key: string, now = Date.now()): boolean {
    const prev = this.last.get(key);
    if (prev != null && now - prev < this.windowMs) return false;
    this.last.set(key, now);
    return true;
  }
}
