'use client';

import { useEffect, useState } from 'react';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const MOODS = [
  { score: 1, emoji: '😭', label: '최악' },
  { score: 2, emoji: '😟', label: '별로' },
  { score: 3, emoji: '😐', label: '보통' },
  { score: 4, emoji: '😊', label: '좋음' },
  { score: 5, emoji: '🥰', label: '최고' },
];

interface Mood {
  id: number;
  score: number;
  emoji: string;
  note: string;
  day: string;
  createdAt: string;
}

/** 브라우저 로컬 시간 기준 YYYY-MM-DD */
function dayKey(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

export default function Home() {
  const [moods, setMoods] = useState<Mood[]>([]);
  const [score, setScore] = useState(3);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  // 날짜는 마운트 후에만 계산 (프리렌더 시 new Date() 사용 불가)
  const [today, setToday] = useState('');

  useEffect(() => {
    setToday(dayKey(new Date()));
    load(true);
  }, []);

  if (!today) return <main className={styles.main}><h1>오늘 기분 기록기</h1></main>;

  // 하루 한 개: 같은 날짜는 가장 최근 기록만 사용
  const byDay = new Map<string, Mood>();
  for (const m of moods) if (!byDay.has(m.day)) byDay.set(m.day, m);
  const todayMood = byDay.get(today);
  const entries = [...byDay.values()];

  // 연속 기록: 오늘 기록이 아직 없으면 어제부터 센다
  let streak = 0;
  for (let i = todayMood ? 0 : 1; byDay.has(dayKey(daysAgo(i))); i++) streak++;

  const week = Array.from({ length: 7 }, (_, i) => {
    const d = daysAgo(6 - i);
    return { d, mood: byDay.get(dayKey(d)) };
  });

  const avg = entries.length
    ? (entries.reduce((s, m) => s + m.score, 0) / entries.length).toFixed(1)
    : null;

  async function load(prefill = false) {
    try {
      const res = await fetch(`${API}/moods`);
      const data: Mood[] = await res.json();
      setMoods(data);
      setError('');
      if (prefill) {
        const t = data.find((m) => m.day === dayKey(new Date()));
        if (t) {
          setScore(t.score);
          setNote(t.note);
        }
      }
    } catch {
      setError('서버에 연결할 수 없어요.');
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const mood = MOODS.find((m) => m.score === score)!;
    const res = await fetch(`${API}/moods`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score, emoji: mood.emoji, note, day: today }),
    });
    if (!res.ok) return setError('저장에 실패했어요.');
    load();
  }

  async function remove(m: Mood) {
    await fetch(`${API}/moods/${m.id}`, { method: 'DELETE' });
    if (m.day === today) setNote('');
    load();
  }

  return (
    <main className={styles.main}>
      <h1>오늘 기분 기록기</h1>

      {streak > 0 && <p className={styles.streak}>🔥 {streak}일 연속 기록 중</p>}

      <form onSubmit={save} className={styles.form}>
        <div className={styles.picker}>
          {MOODS.map((m) => (
            <button
              type="button"
              key={m.score}
              className={m.score === score ? styles.active : ''}
              onClick={() => setScore(m.score)}
            >
              <span className={styles.emoji}>{m.emoji}</span>
              {m.label}
            </button>
          ))}
        </div>
        <textarea
          value={note}
          maxLength={500}
          placeholder="오늘 하루는 어땠나요? (선택)"
          onChange={(e) => setNote(e.target.value)}
        />
        <button type="submit" className={styles.save}>
          {todayMood ? '오늘 기록 수정하기' : '기록하기'}
        </button>
      </form>

      {error && <p className={styles.error}>{error}</p>}

      <section className={styles.chart} aria-label="최근 7일 기분">
        {week.map(({ d, mood }) => (
          <div key={dayKey(d)} className={styles.bar}>
            <span className={styles.barEmoji}>{mood?.emoji ?? ''}</span>
            <div className={styles.track}>
              <div
                className={styles.fill}
                style={{ height: mood ? `${mood.score * 20}%` : '0%' }}
              />
            </div>
            <span className={styles.barLabel}>
              {d.toLocaleDateString('ko-KR', { weekday: 'short' })}
            </span>
          </div>
        ))}
      </section>

      {avg && (
        <p className={styles.avg}>
          평균 기분 {avg} / 5 · 총 {entries.length}일
        </p>
      )}

      <ul className={styles.list}>
        {entries.map((m) => (
          <li key={m.id}>
            <span className={styles.emoji}>{m.emoji}</span>
            <div>
              <time>{new Date(m.day + 'T00:00:00').toLocaleDateString('ko-KR', { dateStyle: 'full' })}</time>
              {m.note && <p>{m.note}</p>}
            </div>
            <button onClick={() => remove(m)} aria-label="삭제">
              ✕
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
