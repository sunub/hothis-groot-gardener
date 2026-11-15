import { describe, expect, it } from 'vitest';
import { findBannedClaims } from './claims';

describe('findBannedClaims: Korean', () => {
  it.each([
    '이 수확물은 먹어도 됩니다.',
    '먹어도 괜찮아요.',
    '섭취 가능한 상태입니다.',
    '식용으로 가능합니다.',
    '미생물 검사를 통과했습니다.',
    '합격입니다.',
    '지상 분석에서 승인되었습니다.',
    '인증 완료',
    '적합 판정을 받았습니다.',
    '이 수확물은 안전합니다.',
    '범위 안이라서 안전하다고 봅니다.',
  ])('rejects: %s', (text) => {
    expect(findBannedClaims(text)).not.toEqual([]);
  });

  it.each([
    '범위 안이라고 해서 안전하다는 뜻은 아닙니다.',
    '이 도구는 수확물의 안전을 보장하지 않습니다.',
    '안전하다고 말할 수 없습니다.',
    '상추 잎에 물방울이 맺혀 있어요.',
  ])('allows: %s', (text) => {
    expect(findBannedClaims(text)).toEqual([]);
  });
});
