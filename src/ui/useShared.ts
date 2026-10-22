import { useRef } from 'react';
import { replaceEqualDeep } from '@/src/lib/equal';

/** 实时查询结果的结构共享：没变的部分沿用上一次的引用，供 React.memo 跳过重渲染 */
export function useShared<T>(value: T): T {
  const ref = useRef<T>(value);
  const shared = replaceEqualDeep(ref.current, value);
  ref.current = shared;
  return shared;
}
