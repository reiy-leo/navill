import { describe, expect, it } from 'vitest';
import { classifyTone } from './tone';

const px = (rgba: number[], count: number) => Array.from({ length: count }, () => rgba).flat();

describe('classifyTone', () => {
  it('black glyph on transparent → dark', () => expect(classifyTone([...px([0, 0, 0, 255], 40), ...px([0, 0, 0, 0], 60)])).toBe('dark'));
  it('white glyph on transparent → light', () => expect(classifyTone([...px([250, 250, 250, 255], 40), ...px([0, 0, 0, 0], 60)])).toBe('light'));
  it('colored glyph → null', () => expect(classifyTone([...px([230, 40, 40, 255], 40), ...px([0, 0, 0, 0], 60)])).toBeNull());
  it('opaque square background → null', () => expect(classifyTone(px([0, 0, 0, 255], 100))).toBeNull());
});
