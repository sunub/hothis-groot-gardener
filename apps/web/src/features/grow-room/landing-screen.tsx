'use client';

/* eslint-disable @next/next/no-img-element -- pixel art on a scaled artboard; next/image adds nothing here */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ROUTES, routeForPhase } from '@/features/mission/routes';
import { useMission } from '@/features/mission/use-mission';
import type { MissionMode, MissionState } from '@/lib/contract/types';
import { CULTIVATION_DAYS, GAME_DAYS, MAX_CARE_OPS_PER_DAY, cultivationDayOf } from '@/lib/game/rules';
import { format, useDictionary, useLocale } from '@/lib/i18n';
import { cn } from '@/lib/utils/cn';
import { LandingBriefingPanel, LandingSavedPanel, type LandingTab } from './landing-panels';
import { AutoFocusButton, SceneModal, SceneSteps } from './scene-ui';
import './landing.css';

/**
 * Landing scene (landing concept v0.6.3). The A-plan landing text sits in the
 * monitors of the grow-room background: the main monitor has three tabs
 * (Mission, How it works, Before you start) and the lower monitor holds the
 * start buttons. On a first visit the monitors power on, the plant's line types
 * itself, then a briefing popup opens. "Don't show this again today" hides the
 * popup until tomorrow in this browser.
 */

const ART_W = 1600;
const ART_H = 900;
/** Below this window width the monitor content moves under the scene. */
const NARROW_MAX = 768;
const BRIEF_KEY = 'sg_brief_hidden';
const BRIEF_FALLBACK_MS = 3500;
const FINISHED = new Set<MissionState['phase']>(['report', 'failed']);

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function readStore(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStore(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage is blocked: the popup simply opens again next time.
  }
}

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';
function subscribeReduced(listener: () => void): () => void {
  const query = window.matchMedia(REDUCED_QUERY);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}
function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false,
  );
}

/** Scale of the 1600×900 artboard so it fits the stage width and the window height. */
function useArtboardScale() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ scale: number; left: number; narrow: boolean } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const stage = stageRef.current;
      if (!stage) return;
      const width = stage.clientWidth;
      const narrow = window.innerWidth < NARROW_MAX;
      const room = window.innerHeight - stage.getBoundingClientRect().top - 16;
      const scale = narrow ? width / ART_W : Math.min(width / ART_W, Math.max(room, 360) / ART_H);
      setFit({ scale, left: Math.max(0, (width - ART_W * scale) / 2), narrow });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  return { stageRef, fit };
}

interface Mote {
  left: number;
  top: number;
  size: number;
  duration: number;
  delay: number;
}

function makeMotes(): Mote[] {
  return Array.from({ length: 7 }, (_, i) => ({
    left: 280 + Math.random() * 500,
    top: 470 + Math.random() * 180,
    size: i % 3 === 0 ? 4 : 6,
    duration: 6 + Math.random() * 5,
    delay: -Math.random() * 10,
  }));
}

export function LandingScreen() {
  const t = useDictionary();
  const s = t.mission.start;
  const { locale } = useLocale();
  const router = useRouter();
  const { ready, mission, actions } = useMission();
  const reduced = useReducedMotion();
  const { stageRef, fit } = useArtboardScale();

  const [tab, setTab] = useState<LandingTab>('mission');
  const [confirming, setConfirming] = useState<MissionMode | null>(null);
  const [motes, setMotes] = useState<Mote[]>([]);
  const [booting, setBooting] = useState(false);

  // --- Briefing popup --------------------------------------------------------
  const [brief, setBrief] = useState<'closed' | 'open' | 'closing'>('closed');
  const [hideToday, setHideToday] = useState(false);
  const briefShown = useRef(false);
  const showBrief = useCallback(() => {
    if (briefShown.current) return;
    briefShown.current = true;
    if (readStore(BRIEF_KEY) === today()) return;
    setHideToday(false);
    setBrief('open');
  }, []);
  const closeBrief = useCallback(() => {
    setBrief((state) => {
      if (state !== 'open') return state;
      return 'closing';
    });
  }, []);
  useEffect(() => {
    if (brief !== 'closing') return;
    if (hideToday) writeStore(BRIEF_KEY, today());
    const id = window.setTimeout(() => setBrief('closed'), reduced ? 0 : 300);
    return () => window.clearTimeout(id);
  }, [brief, hideToday, reduced]);

  // --- Speech typewriter -----------------------------------------------------
  const [typing, setTyping] = useState<{ text: string; shown: number; caret: boolean } | null>(null);
  const typeTimer = useRef<number | undefined>(undefined);
  const afterTyped = useRef<(() => void) | null>(null);
  const finishTyping = useCallback(() => {
    const done = afterTyped.current;
    afterTyped.current = null;
    done?.();
  }, []);

  const typeSpeech = useCallback(
    (text: string, done?: () => void) => {
      window.clearInterval(typeTimer.current);
      if (done) afterTyped.current = done;
      const chars = [...text];
      if (reduced) {
        setTyping({ text, shown: chars.length, caret: false });
        finishTyping();
        return;
      }
      const step = Math.min(35, Math.max(12, 900 / chars.length));
      let i = 0;
      setTyping({ text, shown: 0, caret: true });
      typeTimer.current = window.setInterval(() => {
        i += 1;
        setTyping({ text, shown: i, caret: true });
        if (i >= chars.length) {
          window.clearInterval(typeTimer.current);
          window.setTimeout(() => setTyping((cur) => (cur && cur.text === text ? { ...cur, caret: false } : cur)), 700);
          window.setTimeout(finishTyping, 450);
        }
      }, step);
    },
    [reduced, finishTyping],
  );

  const skipTyping = () => {
    if (!typing) return;
    window.clearInterval(typeTimer.current);
    setTyping({ ...typing, shown: [...typing.text].length, caret: false });
    finishTyping();
  };

  // First visit order: monitors power on -> speech types -> popup swooshes in.
  const started = useRef(false);
  // Keyed on "measured once", not on the fit object: a later re-measure must not cancel the sequence.
  const measured = fit !== null;
  useEffect(() => {
    if (started.current || !measured) return;
    // `started` is set inside the first timer, so a dev-mode remount (which
    // clears the timers) still starts the sequence on its second run.
    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms));
    later(showBrief, BRIEF_FALLBACK_MS);
    later(() => {
      started.current = true;
      setMotes(makeMotes());
      if (reduced) {
        typeSpeech(s.speech, showBrief);
        return;
      }
      setBooting(true);
      later(() => setBooting(false), 2200);
      later(() => typeSpeech(s.speech, showBrief), 500);
    }, 0);
    return () => timers.forEach((id) => window.clearTimeout(id));
    // Runs once, when the artboard has been measured.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measured]);

  // Retype the line when the language changes (after the first typing started).
  const lastSpeech = useRef(s.speech);
  useEffect(() => {
    if (lastSpeech.current === s.speech) return;
    lastSpeech.current = s.speech;
    if (started.current) typeSpeech(s.speech);
  }, [s.speech, typeSpeech]);

  useEffect(() => () => window.clearInterval(typeTimer.current), []);

  // --- Mission actions -------------------------------------------------------
  const begin = (mode: MissionMode) => {
    actions.start(mode);
    router.push(ROUTES.mission);
  };
  const request = (mode: MissionMode) => {
    if (mission) setConfirming(mode);
    else begin(mode);
  };

  const steps = s.steps.map((step) => ({
    title: step.title,
    body: format(step.body, {
      ops: MAX_CARE_OPS_PER_DAY,
      harvest_day: CULTIVATION_DAYS[CULTIVATION_DAYS.length - 1],
    }),
  }));

  const narrow = fit?.narrow ?? false;
  const fade = (i: number, screen: number) =>
    booting ? { className: 'lp-fade', style: { animationDelay: `${0.5 + screen * 0.18 + i * 0.08}s` } } : {};

  const mainMonitor = (
    <section
      aria-label={s.briefing_label}
      className={cn('lp-screen lp-main', booting && 'lp-boot')}
      style={booting ? { animationDelay: '0s' } : undefined}
    >
      {booting ? <div className="lp-scan" style={{ animationDelay: '0.35s' }} /> : null}
      <div role="tablist" aria-label={s.briefing_label} className={cn('lp-tabs', fade(0, 0).className)} style={fade(0, 0).style}>
        {(
          [
            ['mission', s.tab_mission],
            ['how', s.tab_how],
            ['before', s.notices_title],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`lp-tab-${key}`}
            aria-selected={tab === key}
            aria-controls={`lp-pane-${key}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="lp-pane" id="lp-pane-mission" role="tabpanel" aria-labelledby="lp-tab-mission" hidden={tab !== 'mission'}>
        <p className={cn('lp-kicker', fade(1, 0).className)} style={fade(1, 0).style}>{s.eyebrow}</p>
        <h1 className={cn('lp-title', fade(2, 0).className)} style={fade(2, 0).style}>{s.title}</h1>
        <p className={fade(3, 0).className} style={fade(3, 0).style}>{format(s.intro, { days: GAME_DAYS })}</p>
        <p className={fade(4, 0).className} style={fade(4, 0).style}>{s.intro_second}</p>
      </div>

      <div className="lp-pane" id="lp-pane-how" role="tabpanel" aria-labelledby="lp-tab-how" hidden={tab !== 'how'}>
        <SceneSteps steps={steps} />
      </div>

      <div className="lp-pane" id="lp-pane-before" role="tabpanel" aria-labelledby="lp-tab-before" hidden={tab !== 'before'}>
        <ul className="lp-bullets">
          {s.notices.map((notice) => (
            <li key={notice}>{notice}</li>
          ))}
        </ul>
        <p className="lp-note">{s.demo_note}</p>
        <div className="lp-evid">
          <Link href={ROUTES.sources}>{s.sources_link}</Link>
          <span>{s.sources_note}</span>
        </div>
      </div>
    </section>
  );

  const stripMonitor = (
    <section
      aria-label={s.saved_title}
      className={cn('lp-screen lp-strip', booting && 'lp-boot')}
      style={booting ? { animationDelay: '0.18s' } : undefined}
    >
      {booting ? <div className="lp-scan" style={{ animationDelay: '0.53s' }} /> : null}
      <div className={cn('lp-info', fade(0, 1).className)} style={fade(0, 1).style}>
        <span className="lp-lab">{s.saved_title}</span>
        {!ready ? (
          <span className="lp-val lp-muted" role="status">{s.loading}</span>
        ) : mission ? (
          <span className="lp-val">
            {FINISHED.has(mission.phase)
              ? format(s.saved_finished, { mode: s.mode[mission.mode] })
              : format(s.saved_summary, {
                  day: mission.game_day,
                  days: GAME_DAYS,
                  cultivation_day: cultivationDayOf(mission.game_day),
                  mode: s.mode[mission.mode],
                })}
          </span>
        ) : (
          <span className="lp-val lp-muted">{s.saved_none}</span>
        )}
      </div>
      {ready ? (
        <div className={cn('lp-row', fade(1, 1).className)} style={fade(1, 1).style}>
          {mission ? (
            <>
              <Link href={routeForPhase(mission.phase)} className="lp-btn lp-primary lp-pulse">
                {FINISHED.has(mission.phase) ? s.open_finished : s.continue}
              </Link>
              <button type="button" className="lp-btn" onClick={() => request('standard')}>
                {s.new_mission}
              </button>
              <button type="button" className="lp-btn" onClick={() => request('demo')}>
                {s.demo_short}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="lp-btn lp-primary lp-pulse" onClick={() => request('standard')}>
                {s.start_standard}
              </button>
              <button type="button" className="lp-btn" onClick={() => request('demo')}>
                {s.start_demo}
              </button>
            </>
          )}
        </div>
      ) : null}
    </section>
  );

  const chars = typing ? [...typing.text] : [];

  return (
    <>
      <div className="lp" lang={locale}>
        <div ref={stageRef} className="lp-stage" style={{ height: fit ? ART_H * fit.scale : undefined }}>
          <div
            aria-label={s.scene_label}
            className={cn('lp-art', !fit && 'lp-measuring')}
            style={fit ? { transform: `scale(${fit.scale})`, left: fit.left } : undefined}
          >
            <img className="lp-world" src="/bg/landing-growth-normal.webp" alt="" />
            <div className="lp-glow" aria-hidden />
            <div className="lp-glow lp-side" aria-hidden />
            <div className="lp-glow lp-side lp-r" aria-hidden />
            <div aria-hidden>
              {motes.map((m, i) => (
                <i
                  key={i}
                  className="lp-mote"
                  style={{
                    left: m.left,
                    top: m.top,
                    width: m.size,
                    height: m.size,
                    animationDuration: `${m.duration}s`,
                    animationDelay: `${m.delay}s`,
                  }}
                />
              ))}
            </div>
            <img className="lp-plant" src="/sprites/H0_harvest_ready.png" alt={s.plant_alt} />
            <div className="lp-speech" aria-live="polite" onClick={skipTyping}>
              {typing ? (
                <>
                  <span>{chars.slice(0, typing.shown).join('')}</span>
                  {typing.caret ? <span className="lp-caret" aria-hidden>▌</span> : null}
                </>
              ) : null}
            </div>

            {narrow ? null : mainMonitor}
            {narrow ? null : stripMonitor}

            <span className="lp-help">
              <img src="/icons/info.png" alt="" />
              <span>{s.notices[0]}</span>
            </span>
            <span className="lp-aimark">{s.ai_mark}</span>
          </div>
        </div>

        {brief !== 'closed' ? (
          <SceneModal
            labelledBy="lp-brief-title"
            state={brief}
            onClose={closeBrief}
          >
            <h2 id="lp-brief-title">
              <img src="/icons/sprout.png" alt="" />
              <span>{s.brief_title}</span>
            </h2>
            <p className="lp-lead">{s.brief_lead}</p>
            <h3>{s.steps_title}</h3>
            <SceneSteps steps={steps} />
            <h3>{s.notices_title}</h3>
            <ul className="lp-bullets">
              {s.notices.map((notice) => (
                <li key={notice}>{notice}</li>
              ))}
            </ul>
            <p className="lp-ev">
              <Link href={ROUTES.sources}>{s.sources_link}</Link>
              <span>{s.sources_note}</span>
            </p>
            <div className="lp-modal-foot">
              <label>
                <input type="checkbox" checked={hideToday} onChange={(e) => setHideToday(e.target.checked)} />
                <span>{s.hide_today}</span>
              </label>
              <div className="lp-end">
                <AutoFocusButton className="lp-btn lp-primary" onClick={closeBrief}>
                  {s.got_it}
                </AutoFocusButton>
              </div>
            </div>
          </SceneModal>
        ) : null}

        {confirming && mission ? (
          <SceneModal labelledBy="lp-confirm-title" state="open" onClose={() => setConfirming(null)}>
            <h2 id="lp-confirm-title">{s.confirm_title}</h2>
            <p className="lp-lead">{format(s.confirm_body, { mode: s.confirm_mode[confirming] })}</p>
            <p className="lp-lead">
              {FINISHED.has(mission.phase)
                ? format(s.saved_finished, { mode: s.mode[mission.mode] })
                : format(s.saved_summary, {
                    day: mission.game_day,
                    days: GAME_DAYS,
                    cultivation_day: cultivationDayOf(mission.game_day),
                    mode: s.mode[mission.mode],
                  })}
            </p>
            <div className="lp-modal-foot">
              <div className="lp-end">
                <button type="button" className="lp-btn lp-primary" onClick={() => begin(confirming)}>
                  {s.confirm_yes}
                </button>
                <AutoFocusButton className="lp-btn" onClick={() => setConfirming(null)}>
                  {s.confirm_no}
                </AutoFocusButton>
              </div>
            </div>
          </SceneModal>
        ) : null}
      </div>

      {/* Below the scene the text is page UI: design-system parts, outside the .lp scope. */}
      {narrow ? (
        <div className="mt-3 flex flex-col gap-2">
          <LandingBriefingPanel tab={tab} onTab={setTab} steps={steps} />
          <LandingSavedPanel ready={ready} mission={mission} onRequest={request} />
        </div>
      ) : null}
    </>
  );
}
