import { describe, expect, it } from 'vitest';
import { presetName } from './presetNames';

describe('presetName', () => {
  it('未改过的预设名随语言显示（测试环境为中文）', () => {
    expect(presetName('mode-work', 'Work')).toBe('工作');
    expect(presetName('tag-todo', '待办')).toBe('待办');
  });
  it('改过的名称原样保留', () => {
    expect(presetName('mode-work', '上班')).toBe('上班');
    expect(presetName('ws-x', 'Work')).toBe('Work');
  });
});
