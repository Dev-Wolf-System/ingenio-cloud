import { sevLabel, sevOrder, normalizeSeverity } from './severity';

describe('severity helpers', () => {
  it('normaliza warning legacy a warn', () => {
    expect(normalizeSeverity('warning')).toBe('warn');
    expect(normalizeSeverity('warn')).toBe('warn');
    expect(normalizeSeverity('critical')).toBe('critical');
    expect(normalizeSeverity('info')).toBe('info');
    expect(normalizeSeverity('xxx')).toBe('info');
  });
  it('ordena critical < warn < info', () => {
    expect(sevOrder('critical')).toBeLessThan(sevOrder('warn'));
    expect(sevOrder('warn')).toBeLessThan(sevOrder('info'));
  });
  it('label en español', () => {
    expect(sevLabel('warn')).toBe('de advertencia');
    expect(sevLabel('critical')).toBe('crítica');
    expect(sevLabel('info')).toBe('informativa');
  });
});
