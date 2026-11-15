import { describe, expect, it, vi } from 'vitest';
import { checkDiaryTranslations, translateDiaryTexts } from './translate';

const EN = ['Pillow A could not be hydrated and was swapped with a spare pillow.', 'The lights were on for 16 hours a day.'];
const KO = ['필로우 A에 물이 스며들지 않아 여분의 필로우로 바꿨다.', '조명은 하루 16시간 켜져 있었다.'];

describe('checkDiaryTranslations', () => {
  it('keeps good Korean texts in order', () => {
    expect(checkDiaryTranslations(EN, KO)).toEqual(KO);
  });

  it('drops a text that is still English, lost a number, or uses a wrong term', () => {
    const result = checkDiaryTranslations(EN, [EN[0], '조명은 하루 종일 켜져 있었다.', KO[0]]);
    expect(result).toEqual([null, null]);
    expect(checkDiaryTranslations([EN[0]], ['양배추 필로우에 물이 스며들지 않았다.'])).toEqual([null]);
  });

  it('gives null for every text when the reply is not a list or a text is not a string', () => {
    expect(checkDiaryTranslations(EN, { texts: KO })).toEqual([null, null]);
    expect(checkDiaryTranslations(EN, [KO[0], 3])).toEqual([KO[0], null]);
  });
});

describe('translateDiaryTexts', () => {
  it('translates, remembers the result and does not ask twice for the same text', async () => {
    const translator = vi.fn(async (texts: string[]) => texts.map((t) => KO[EN.indexOf(t)]));
    const cache = new Map<string, string>();
    expect(await translateDiaryTexts(EN, { translator, cache })).toEqual(KO);
    expect(await translateDiaryTexts([EN[1], EN[0]], { translator, cache })).toEqual([KO[1], KO[0]]);
    expect(translator).toHaveBeenCalledTimes(1);
  });

  it('sends a repeated text once', async () => {
    const translator = vi.fn(async (texts: string[]) => texts.map((t) => KO[EN.indexOf(t)]));
    await translateDiaryTexts([EN[0], EN[0]], { translator });
    expect(translator).toHaveBeenCalledWith([EN[0]], expect.any(AbortSignal));
  });

  it('answers null when there is no translator or it fails', async () => {
    expect(await translateDiaryTexts(EN, {})).toEqual([null, null]);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const failing = async () => {
      throw new Error('model down');
    };
    expect(await translateDiaryTexts(EN, { translator: failing })).toEqual([null, null]);
  });

  it('does not cache a rejected translation', async () => {
    const cache = new Map<string, string>();
    await translateDiaryTexts([EN[0]], { translator: async () => [EN[0]], cache });
    expect(cache.size).toBe(0);
  });
});
