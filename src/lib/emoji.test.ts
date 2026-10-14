import { describe, expect, it } from 'vitest';
import { limitIcon, splitEmoji } from './emoji';

describe('splitEmoji', () => {
  it('前置 emoji 作为图标', () => expect(splitEmoji('🎮 游戏')).toEqual({ emoji: '🎮', name: '游戏' }));
  it('中间与末尾 emoji 都去掉，前两个作图标', () => expect(splitEmoji('工作💼 资料📚')).toEqual({ emoji: '💼📚', name: '工作 资料' }));
  it('超过两个只取前两个', () => expect(splitEmoji('🎮👾🕹️ 游戏')).toEqual({ emoji: '🎮👾', name: '游戏' }));
  it('limitIcon 按字素截断，丢弃非 emoji', () => expect(limitIcon('a👨‍💻🇯🇵🎮')).toBe('👨‍💻🇯🇵'));
  it('复合 emoji 保持完整', () => expect(splitEmoji('👨‍💻开发')).toEqual({ emoji: '👨‍💻', name: '开发' }));
  it('国旗', () => expect(splitEmoji('🇯🇵 日本')).toEqual({ emoji: '🇯🇵', name: '日本' }));
  it('没有 emoji', () => expect(splitEmoji(' 学习 ')).toEqual({ emoji: undefined, name: '学习' }));
  it('数字与符号不算 emoji', () => expect(splitEmoji('2024 #1')).toEqual({ emoji: undefined, name: '2024 #1' }));
});
