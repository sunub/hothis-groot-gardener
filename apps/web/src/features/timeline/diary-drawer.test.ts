import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LocaleProvider } from '@/lib/i18n';
import { en } from '@/lib/i18n/en';
import { ko } from '@/lib/i18n/ko';
import { DiaryDrawer } from './diary-drawer';

const html = (el: ReactElement) => renderToStaticMarkup(createElement(LocaleProvider, null, el));
const drawer = () => html(createElement(DiaryDrawer, null, createElement('p', null, 'diary body')));

describe('DiaryDrawer', () => {
  it('starts closed: the tab says collapsed, and the drawer is out of the keyboard and screen reader', () => {
    const out = drawer();
    expect(out).toContain('aria-expanded="false"');
    expect(out).toContain(`aria-label="${en.mission.diary.open}"`);
    expect(out).toMatch(/<aside[^>]*inert/);
    expect(out).toContain('invisible');
    expect(out).toContain('translate-x-full');
  });

  it('ties the tab to the drawer it opens', () => {
    const out = drawer();
    const id = out.match(/aria-controls="([^"]+)"/)?.[1];
    expect(id).toBeTruthy();
    expect(out).toContain(`id="${id}"`);
  });

  it('keeps the diary content inside the drawer', () => {
    expect(drawer()).toContain('diary body');
  });

  it('has Korean and English labels for the tab and the close button', () => {
    for (const dict of [en, ko]) {
      expect(dict.mission.diary.open.length).toBeGreaterThan(0);
      expect(dict.mission.diary.close.length).toBeGreaterThan(0);
    }
  });

  it('includes the visible title in the tab accessible name when open and closed (WCAG 2.5.3)', () => {
    for (const dict of [en, ko]) {
      const title = dict.mission.diary.title.toLowerCase();
      expect(dict.mission.diary.open.toLowerCase()).toContain(title);
      expect(`${dict.mission.diary.title} (${dict.mission.diary.close})`.toLowerCase()).toContain(title);
    }
  });
});
