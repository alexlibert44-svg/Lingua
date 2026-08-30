import { useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch, useLocation, useParams } from 'wouter';
import {
  ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, CircleAlert, Flame, Headphones,
  Home as HomeIcon, Library, ListChecks, Loader2, Menu, Mic, Pencil, Play, Plus,
  RotateCcw, Settings, Sparkles, Target, Trash2, Volume2, X
} from 'lucide-react';
import {
  Skill, getGetDashboardQueryKey, getGetProfileQueryKey, getGetReviewQueryKey,
  getGetWordQueryKey, getGetWordSetQueryKey, getListWordSetsQueryKey,
  useCreatePracticeAttempt, useCreateWordSet, useDeleteWordSet, useGetDashboard,
  useGetProfile, useGetReview, useGetWord, useGetWordSet, useListWordSets,
  useUpdateProfile, useUpdateWordSet
} from '@workspace/api-client-react';
import type { Profile, Word, WordSetSummary } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  languageLabel, languageOptions, localeFromLanguage, normalizeLanguageCode, translate, type Locale
} from '@/lib/i18n';

const queryClient = new QueryClient();
const goalOptions = [5, 10, 15, 20, 30];

function useCopy(locale: Locale) {
  return (key: string, values?: Record<string, string | number>) => translate(locale, key, values);
}

function Initial({ label }: { label: string }) {
  return <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-muted-foreground" data-testid="status-loading">
    <div className="h-10 w-10 rounded-full border-2 border-primary/25 border-t-primary animate-spin" />
    <span className="text-sm">{label}</span>
  </div>;
}

function ErrorState({ locale, retry }: { locale: Locale; retry?: () => void }) {
  const t = useCopy(locale);
  return <div className="min-h-[45vh] flex flex-col items-center justify-center text-center gap-3 p-8" data-testid="status-error">
    <div className="h-12 w-12 rounded-2xl bg-destructive/10 text-destructive grid place-items-center"><CircleAlert size={22} /></div>
    <h2 className="font-serif text-2xl">{t('common.errorTitle')}</h2>
    <p className="text-sm text-muted-foreground max-w-xs">{t('common.errorBody')}</p>
    {retry && <button onClick={retry} className="text-primary text-sm font-semibold underline underline-offset-4" data-testid="button-retry">{t('common.retry')}</button>}
  </div>;
}

function Logo() {
  return <Link href="/" className="flex items-center gap-2.5" data-testid="link-logo">
    <span className="relative grid place-items-center h-9 w-9 rounded-[13px] bg-primary text-primary-foreground shadow-sm">
      <span className="font-serif text-xl leading-none">l</span><span className="absolute right-[8px] top-[8px] h-1.5 w-1.5 rounded-full bg-accent" />
    </span>
    <span className="font-serif text-xl tracking-tight">LingoFlow</span>
  </Link>;
}

function getGreetingKey() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'home.greetingMorning';
  if (hour >= 12 && hour < 18) return 'home.greetingAfternoon';
  if (hour >= 18 && hour < 23) return 'home.greetingEvening';
  return 'home.greetingNight';
}

function formatToday(locale: Locale) {
  return new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
}

const navKeys = [
  { href: '/', key: 'nav.home', icon: HomeIcon },
  { href: '/sets', key: 'nav.sets', icon: Library },
  { href: '/add', key: 'nav.add', icon: Plus },
  { href: '/review', key: 'nav.review', icon: ListChecks },
  { href: '/profile', key: 'nav.profile', icon: Target },
] as const;

function Shell({ children, locale, hideNav = false }: { children: React.ReactNode; locale: Locale; hideNav?: boolean }) {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const t = useCopy(locale);
  if (hideNav) return <div className="app-grain min-h-[100dvh]">{children}</div>;
  return <div className="app-grain min-h-[100dvh] bg-background">
    <aside className="hidden md:flex fixed inset-y-0 left-0 w-[228px] p-5 flex-col border-r border-border bg-card/70">
      <Logo />
      <p className="text-[10px] font-mono uppercase tracking-[.18em] text-muted-foreground mt-12 mb-4 px-3">{t('shell.practiceSpace')}</p>
      <nav className="space-y-1">
        {navKeys.map(({ href, key, icon: Icon }) => {
          const label = t(key);
          return <Link key={href} href={href} className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-colors ${location === href ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`} data-testid={`link-nav-${href === '/' ? 'home' : href.slice(1)}`}>
            <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
          </Link>;
        })}
      </nav>
      <div className="mt-auto p-4 rounded-2xl bg-secondary/70">
        <Sparkles size={17} className="text-accent mb-2" />
        <p className="font-serif text-lg leading-tight whitespace-pre-line">{t('shell.promise')}</p>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{t('shell.promiseBody')}</p>
      </div>
      <Link href="/profile" className="mt-5 flex items-center gap-3 px-2 py-2 text-sm font-semibold" data-testid="link-sidebar-profile">
        <span className="h-8 w-8 rounded-full bg-accent/20 text-accent-foreground grid place-items-center font-mono text-xs">LF</span>
        <span>{t('shell.space')}</span><ChevronRight className="ml-auto text-muted-foreground" size={15} />
      </Link>
    </aside>
    <header className="md:hidden h-[72px] px-5 flex items-center justify-between border-b border-border bg-card/70 sticky top-0 z-30 backdrop-blur">
      <Logo />
      <button onClick={() => setMenuOpen(!menuOpen)} className="h-10 w-10 grid place-items-center rounded-xl bg-secondary" data-testid="button-mobile-menu" aria-label={t('nav.home')}>{menuOpen ? <X size={19} /> : <Menu size={19} />}</button>
      {menuOpen && <div className="absolute right-5 top-[62px] bg-card border border-border rounded-2xl p-2 shadow-md w-48 animate-rise">
        {navKeys.map(({ href, key, icon: Icon }) => <Link key={href} href={href} onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold hover:bg-secondary" data-testid={`link-mobile-${key}`}><Icon size={17} />{t(key)}</Link>)}
      </div>}
    </header>
    <main className="md:ml-[228px] pb-24 md:pb-10">{children}</main>
    <nav className="md:hidden fixed bottom-0 inset-x-0 h-[72px] z-30 bg-card/90 backdrop-blur border-t border-border flex items-center justify-around px-3">
      {navKeys.map(({ href, key, icon: Icon }) => <Link key={href} href={href} className={`flex flex-col items-center gap-1 py-2 px-3 text-[10px] font-semibold ${key === 'nav.add' ? 'text-accent' : location === href ? 'text-primary' : 'text-muted-foreground'}`} data-testid={`link-bottom-${key}`}><Icon size={key === 'nav.add' ? 21 : 19} /><span>{t(key)}</span></Link>)}
    </nav>
  </div>;
}

function PageHeading({ locale, eyebrow, title, children }: { locale: Locale; eyebrow?: string; title: string; children?: React.ReactNode }) {
  return <div className="flex items-end justify-between gap-4 mb-8 animate-rise">
    <div>{eyebrow && <p className="font-mono text-[10px] tracking-[.18em] uppercase text-primary mb-3">{eyebrow}</p>}<h1 className="font-serif text-4xl md:text-5xl tracking-tight leading-[.95]" data-testid="text-page-title">{title}</h1></div>
    {children}
  </div>;
}

function Meter({ value, className = '' }: { value: number; className?: string }) {
  return <div className={`progress-track h-2 ${className}`}><div className="progress-fill transition-all duration-700" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}

function SetCard({ set, locale }: { set: WordSetSummary; locale: Locale }) {
  const t = useCopy(locale);
  const hasProgress = set.mastery > 0;
  return <Link href={`/sets/${set.id}`} className="group block rounded-2xl border border-card-border bg-card hover:-translate-y-0.5 hover:shadow-md transition-all p-5" data-testid={`card-word-set-${set.id}`}>
    <div className="flex items-start justify-between gap-3">
      <span className="grid place-items-center rounded-xl text-primary bg-primary/10 h-11 w-11"><BookOpen size={19} /></span>
      <span className="text-muted-foreground group-hover:text-primary transition-colors"><ArrowRight size={17} /></span>
    </div>
    <h3 className="font-semibold mt-4 truncate" data-testid={`text-set-name-${set.id}`}>{set.name}</h3>
    <p className="text-xs text-muted-foreground mt-1">{t('common.words', { count: set.wordCount })} <span className="mx-1 text-border">/</span> {t('sets.wordsDue', { words: '', due: set.dueCount }).replace(' · ', ' ')}</p>
    <div className="flex items-center gap-3 mt-4">{hasProgress ? <><Meter value={set.mastery} className="flex-1" /><span className="font-mono text-[11px] text-muted-foreground">{t('home.setProgress', { count: Math.round(set.mastery) })}</span></> : <span className="text-xs text-muted-foreground">{t('sets.notStarted')}</span>}</div>
  </Link>;
}

function Home({ locale }: { locale: Locale }) {
  const q = useGetDashboard();
  const dashboard = q.data;
  const t = useCopy(locale);
  if (q.isLoading) return <Shell locale={locale}><Initial label={t('common.loading')} /></Shell>;
  if (q.isError || !dashboard) return <Shell locale={locale}><ErrorState locale={locale} retry={() => q.refetch()} /></Shell>;
  const goalPercent = dashboard.dailyGoal ? Math.min(100, (dashboard.minutesLearned / dashboard.dailyGoal) * 100) : 0;
  const remaining = Math.max(0, dashboard.dailyGoal - dashboard.minutesLearned);
  return <Shell locale={locale}><div className="max-w-6xl mx-auto px-5 md:px-10 pt-8 md:pt-12">
    <div className="flex justify-between items-start animate-rise"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-primary mb-3">{formatToday(locale)}</p><h1 className="font-serif text-[2.65rem] md:text-6xl tracking-tight leading-none" data-testid="text-greeting">{t(getGreetingKey())}</h1><p className="text-muted-foreground mt-3">{t('home.subheading')}</p></div><div className="hidden md:grid h-12 w-12 rounded-full bg-accent/15 text-accent-foreground place-items-center font-mono text-xs">LF</div></div>
    <section className="mt-9 grid md:grid-cols-[1.35fr_.65fr] gap-4">
      <div className="rounded-[1.65rem] p-6 md:p-8 bg-primary text-primary-foreground relative overflow-hidden animate-float stagger-1">
        <div className="absolute -right-8 -top-12 h-48 w-48 rounded-full border-[22px] border-primary-foreground/10" /><div className="absolute right-16 bottom-[-48px] h-32 w-32 rounded-full bg-accent/80" />
        <div className="relative"><div className="flex items-center gap-2 text-primary-foreground/75 text-xs font-mono uppercase tracking-wider"><Sparkles size={14} /> {t('home.momentum')}</div>
          <h2 className="font-serif text-3xl md:text-4xl mt-5 max-w-sm">{dashboard.minutesLearned > 0 ? t('home.keepThread') : t('home.startWord')}</h2>
          <p className="text-primary-foreground/75 text-sm mt-2 max-w-sm">{dashboard.reviewItems ? t('home.reviewReady', { count: dashboard.reviewItems }) : t('home.nextWord')}</p>
          <Link href={dashboard.reviewItems ? '/review' : (dashboard.continueSet ? `/learn/${dashboard.continueSet.id}` : '/sets')} className="inline-flex items-center gap-2 bg-accent text-accent-foreground rounded-xl px-4 py-3 mt-7 text-sm font-bold hover:brightness-105" data-testid="link-today-action">{dashboard.reviewItems ? t('home.reviewNow') : t('home.continueLearning')}<ArrowRight size={16} /></Link>
        </div>
      </div>
      <div className="rounded-[1.65rem] border border-card-border bg-card p-6 animate-float stagger-2"><div className="flex justify-between items-center"><span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{t('home.dailyPractice')}</span><Target size={18} className="text-accent" /></div>
        <div className="flex items-end gap-2 mt-7"><span className="font-serif text-5xl">{dashboard.minutesLearned}</span><span className="text-sm text-muted-foreground mb-2">/ {dashboard.dailyGoal} {t('common.minutes', { count: dashboard.dailyGoal }).replace(String(dashboard.dailyGoal), '').trim()}</span></div><Meter value={goalPercent} className="mt-4" /><p className="text-xs text-muted-foreground mt-3">{remaining ? t('home.toGoal', { count: remaining }) : t('home.goalComplete')}</p>
      </div>
    </section>
    <section className="grid md:grid-cols-2 gap-4 mt-4">
      {dashboard.streak > 0 && <div className="rounded-2xl border border-card-border bg-card p-5 animate-float stagger-3"><div className="flex items-center gap-2 text-sm font-semibold"><Flame size={18} className="text-accent" />{t('home.streak', { count: dashboard.streak })}</div><p className="text-xs text-muted-foreground mt-5">{t('home.streakBody')}</p></div>}
      <div className={`rounded-2xl border border-card-border bg-card p-5 flex items-center gap-5 animate-float stagger-4 ${dashboard.streak > 0 ? '' : 'md:col-span-2'}`}><div className="h-14 w-14 rounded-2xl bg-accent/15 text-accent-foreground grid place-items-center"><ListChecks size={22} /></div><div className="flex-1"><p className="font-semibold">{t('home.todayReview')}</p><p className="text-xs text-muted-foreground mt-1">{dashboard.reviewItems ? t('home.reviewReady', { count: dashboard.reviewItems }) : t('home.allCaughtUp')}</p></div>{dashboard.reviewItems > 0 && <Link href="/review" className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-bold grid place-items-center" data-testid="link-review-queue">{t('home.startReview')}</Link>}</div>
    </section>
    <section className="mt-10 pb-5"><h2 className="font-serif text-2xl mb-4">{t('home.currentLearning')}</h2>{dashboard.continueSet ? <div className="rounded-2xl bg-secondary/70 p-5 flex items-center gap-4"><div className="h-12 w-12 rounded-xl bg-card grid place-items-center text-primary"><BookOpen size={19} /></div><div className="flex-1"><p className="font-semibold">{dashboard.continueSet.name}</p><p className="text-xs text-muted-foreground mt-1">{t('common.words', { count: dashboard.continueSet.wordCount })}</p></div><Link href={`/learn/${dashboard.continueSet.id}`} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-bold grid place-items-center" data-testid="link-continue-practice">{t('common.practice')}</Link></div> : <EmptyState locale={locale} title={t('home.noActiveSet')} body={t('home.noActiveSetBody')} action={t('home.createFirst')} href="/add" />}</section>
  </div></Shell>;
}

function EmptyState({ locale, title, body, action, href }: { locale: Locale; title: string; body: string; action?: string; href?: string }) {
  return <div className="rounded-2xl border border-dashed border-card-border bg-card/50 p-10 text-center" data-testid="status-empty"><div className="h-12 w-12 rounded-2xl bg-secondary grid place-items-center mx-auto text-primary"><BookOpen size={20} /></div><h3 className="font-serif text-xl mt-4">{title}</h3><p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">{body}</p>{action && href && <Link href={href} className="inline-flex items-center gap-2 mt-5 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-bold" data-testid="link-empty-action">{action}<ArrowRight size={15} /></Link>}</div>;
}

function SetsPage({ locale }: { locale: Locale }) {
  const q = useListWordSets();
  const t = useCopy(locale);
  if (q.isLoading) return <Shell locale={locale}><Initial label={t('common.loading')} /></Shell>;
  if (q.isError) return <Shell locale={locale}><ErrorState locale={locale} retry={() => q.refetch()} /></Shell>;
  const sets = q.data ?? [];
  return <Shell locale={locale}><div className="max-w-6xl mx-auto px-5 md:px-10 pt-9 md:pt-12"><PageHeading locale={locale} eyebrow={t('sets.eyebrow')} title={t('sets.title')}><Link href="/add" className="flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-3 text-sm font-bold" data-testid="link-create-set"><Plus size={16} /> <span className="hidden sm:inline">{t('sets.new')}</span></Link></PageHeading>{sets.length ? <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{sets.map((set, i) => <div className={`animate-rise stagger-${Math.min(4, i + 1)}`} key={set.id}><SetCard set={set} locale={locale} /></div>)}</div> : <EmptyState locale={locale} title={t('sets.noSets')} body={t('sets.noSetsBody')} action={t('sets.createFirst')} href="/add" />}</div></Shell>;
}

function SetDetail({ locale }: { locale: Locale }) {
  const { id } = useParams<{ id: string }>();
  const setId = Number(id);
  const q = useGetWordSet(setId, { query: { enabled: Number.isFinite(setId) && setId > 0, queryKey: getGetWordSetQueryKey(setId) } });
  const update = useUpdateWordSet();
  const remove = useDeleteWordSet();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const t = useCopy(locale);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  if (q.isLoading) return <Shell locale={locale}><Initial label={t('common.loading')} /></Shell>;
  if (q.isError || !q.data) return <Shell locale={locale}><ErrorState locale={locale} retry={() => q.refetch()} /></Shell>;
  const set = q.data;
  const saveName = () => { if (!name.trim()) return; update.mutate({ setId, data: { name: name.trim() } }, { onSuccess: () => { setEditing(false); qc.invalidateQueries({ queryKey: getGetWordSetQueryKey(setId) }); qc.invalidateQueries({ queryKey: getListWordSetsQueryKey() }); } }); };
  const deleteSet = () => { if (window.confirm(t('sets.deleteConfirm', { name: set.name }))) remove.mutate({ setId }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListWordSetsQueryKey() }); navigate('/sets'); } }); };
  return <Shell locale={locale}><div className="max-w-5xl mx-auto px-5 md:px-10 pt-8 md:pt-12"><Link href="/sets" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8" data-testid="link-back-sets"><ArrowLeft size={16} /> {t('sets.back')}</Link>
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 animate-rise"><div><div className="flex items-center gap-2 text-primary text-xs font-mono uppercase tracking-wider"><BookOpen size={14} /> {t('common.words', { count: set.wordCount })}</div>{editing ? <div className="flex gap-2 mt-3"><input value={name} onChange={e => setName(e.target.value)} className="text-4xl font-serif bg-transparent border-b-2 border-primary outline-none w-full max-w-md" data-testid="input-rename-set" autoFocus /><button onClick={saveName} className="text-primary" data-testid="button-save-rename" aria-label={t('common.save')}><Check /></button></div> : <h1 className="font-serif text-5xl tracking-tight mt-3" data-testid="text-set-title">{set.name}</h1>}<p className="text-sm text-muted-foreground mt-3">{set.dueCount ? t('sets.wordsDue', { words: '', due: set.dueCount }).replace(' · ', ' ') : ''}{set.lastPracticed ? ` · ${t('sets.lastPracticed', { date: new Date(set.lastPracticed).toLocaleDateString(locale) })}` : ` · ${t('common.notYet')}`}</p></div><div className="flex gap-2"><button onClick={() => { setName(set.name); setEditing(true); }} className="h-11 w-11 grid place-items-center rounded-xl border border-border hover:bg-secondary" data-testid="button-rename-set" aria-label={t('sets.rename')}><Pencil size={17} /></button><button onClick={deleteSet} className="h-11 w-11 grid place-items-center rounded-xl border border-border hover:bg-destructive/10 text-destructive" data-testid="button-delete-set" aria-label={t('sets.delete')}><Trash2 size={17} /></button><Link href={`/learn/${set.id}`} className="flex items-center gap-2 h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-bold" data-testid="link-practice-set"><Play size={15} fill="currentColor" /> {t('common.practice')}</Link></div></div>
    <div className="grid grid-cols-3 gap-3 mt-9"><Stat locale={locale} label={t('sets.mastery')} value={set.mastery > 0 ? `${Math.round(set.mastery)}%` : t('sets.notStarted')} /><Stat locale={locale} label={t('sets.dueNow')} value={set.dueCount} /><Stat locale={locale} label={t('sets.words')} value={set.wordCount} /></div>
    <div className="mt-10"><div className="flex items-center justify-between mb-4"><h2 className="font-serif text-2xl">{t('sets.wordsIn')}</h2><span className="text-xs text-muted-foreground">{t('sets.explore')}</span></div>{set.words?.length ? <div className="space-y-2">{set.words.map((word, i) => <WordRow word={word} locale={locale} key={word.id} index={i} />)}</div> : <EmptyState locale={locale} title={t('sets.noWords')} body={t('sets.noWordsBody')} />}</div>
  </div></Shell>;
}

function Stat({ locale, label, value }: { locale: Locale; label: string; value: string | number }) {
  return <div className="rounded-2xl border border-card-border bg-card p-4"><p className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">{label}</p><p className="font-serif text-2xl md:text-3xl mt-2" data-testid={`text-stat-${label}`}>{value}</p></div>;
}

function WordRow({ word, locale, index }: { word: Word; locale: Locale; index: number }) {
  const t = useCopy(locale);
  return <Link href={`/words/${word.id}`} className="flex items-center gap-4 rounded-2xl border border-card-border bg-card p-4 hover:shadow-sm transition-shadow animate-rise" style={{ animationDelay: `${index * .04}s` }} data-testid={`link-word-${word.id}`}><span className="font-mono text-xs text-muted-foreground w-5">{String(index + 1).padStart(2, '0')}</span><div className="flex-1 min-w-0"><p className="font-semibold truncate">{word.text}</p><p className="text-xs text-muted-foreground mt-0.5 truncate">{word.translation || t('common.translationPending')}</p></div><div className="w-20 hidden sm:block">{word.mastery > 0 && <Meter value={word.mastery} />}</div><span className="text-[10px] font-mono uppercase text-muted-foreground">{word.status}</span><ChevronRight size={16} className="text-muted-foreground" /></Link>;
}

function WordDetail({ locale }: { locale: Locale }) {
  const { id } = useParams<{ id: string }>();
  const wordId = Number(id);
  const q = useGetWord(wordId, { query: { enabled: wordId > 0, queryKey: getGetWordQueryKey(wordId) } });
  const t = useCopy(locale);
  if (q.isLoading) return <Shell locale={locale}><Initial label={t('common.loading')} /></Shell>;
  if (q.isError || !q.data) return <Shell locale={locale}><ErrorState locale={locale} retry={() => q.refetch()} /></Shell>;
  const word = q.data;
  return <Shell locale={locale}><div className="max-w-4xl mx-auto px-5 md:px-10 pt-8 md:pt-12"><Link href={`/sets/${word.setId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-10" data-testid="link-back-word-set"><ArrowLeft size={16} /> {t('word.back')}</Link><div className="grid md:grid-cols-[1.2fr_.8fr] gap-6"><div className="rounded-[1.75rem] bg-primary text-primary-foreground p-7 md:p-10 animate-rise"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-primary-foreground/70">{t('word.label')} / {word.status}</p><h1 className="font-serif text-6xl md:text-7xl mt-12 tracking-tight" data-testid="text-word-title">{word.text}</h1><div className="flex items-center gap-3 mt-4 text-primary-foreground/80"><span className="font-mono text-sm">{word.pronunciation}</span><button className="h-8 w-8 rounded-full bg-primary-foreground/10 grid place-items-center hover:bg-primary-foreground/20" data-testid="button-listen-word" aria-label={t('common.listen')}><Volume2 size={15} /></button></div><div className="mt-16 pt-5 border-t border-primary-foreground/15"><p className="text-xs text-primary-foreground/60 uppercase tracking-wider font-mono">{t('word.translation')}</p><p className="text-xl mt-2">{word.translation || t('common.translationPending')}</p></div></div><div className="space-y-4"><div className="rounded-2xl border border-card-border bg-card p-6 animate-rise stagger-1"><p className="text-xs uppercase tracking-wider font-mono text-muted-foreground">{t('word.sentence')}</p><p className="font-serif text-2xl leading-snug mt-5">“{word.sentence}”</p><button className="mt-5 text-primary text-sm font-semibold flex items-center gap-2" data-testid="button-listen-sentence"><Headphones size={15} /> {t('word.listenSentence')}</button><div className="mt-6 pt-5 border-t border-border"><p className="text-xs uppercase tracking-wider font-mono text-muted-foreground">{t('word.sentenceTranslation')}</p><p className="text-sm mt-2 text-muted-foreground">{word.sentenceTranslation || t('common.translationPending')}</p></div></div><div className="rounded-2xl border border-card-border bg-card p-6 animate-rise stagger-2"><p className="text-xs uppercase tracking-wider font-mono text-muted-foreground">{t('word.skillBreakdown')}</p><SkillBars word={word} locale={locale} /></div><Link href={`/learn/${word.setId}`} className="w-full h-12 rounded-xl bg-accent text-accent-foreground font-bold grid place-items-center gap-2 hover:brightness-105" data-testid="link-practice-word">{t('word.practiceWord')} <ArrowRight size={16} /></Link></div></div></div></Shell>;
}

function SkillBars({ word, locale }: { word: Word; locale: Locale }) {
  const t = useCopy(locale);
  const rows = [[t('word.writing'), word.writing], [t('word.speaking'), word.speaking], [t('word.recall'), word.recall]] as const;
  return <div className="space-y-4 mt-5">{rows.map(([label, value]) => <div key={label}><div className="flex justify-between text-xs mb-2"><span>{label}</span><span className="font-mono text-muted-foreground">{Math.round(value)}%</span></div><Meter value={value} /></div>)}</div>;
}

function AddPage({ locale, profile }: { locale: Locale; profile: { nativeLanguage: string; targetLanguage: string } }) {
  const create = useCreateWordSet();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const t = useCopy(locale);
  const [name, setName] = useState('');
  const [words, setWords] = useState(['', '', '', '']);
  const filled = words.filter(word => word.trim()).length;
  const submit = () => { if (!name.trim() || filled < 4) return; create.mutate({ data: { name: name.trim(), nativeLanguage: normalizeLanguageCode(profile.nativeLanguage), targetLanguage: normalizeLanguageCode(profile.targetLanguage), words: words.map(word => word.trim()).filter(Boolean) } }, { onSuccess: (set) => { qc.invalidateQueries({ queryKey: getListWordSetsQueryKey() }); navigate(`/sets/${set.id}`); } }); };
  return <Shell locale={locale}><div className="max-w-3xl mx-auto px-5 md:px-10 pt-8 md:pt-12"><Link href="/sets" className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-8" data-testid="link-cancel-add"><ArrowLeft size={16} /> {t('add.back')}</Link><PageHeading locale={locale} eyebrow={t('add.eyebrow')} title={t('add.title')}><span className="font-mono text-xs text-muted-foreground">{t('add.minimum', { count: filled })}</span></PageHeading>
    <div className="rounded-[1.7rem] bg-card border border-card-border p-5 md:p-8"><label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{t('add.setName')}</label><input value={name} onChange={e => setName(e.target.value)} placeholder={t('add.setPlaceholder')} maxLength={80} className="w-full bg-transparent border-b border-border py-3 text-xl outline-none focus:border-primary placeholder:text-muted-foreground/50" data-testid="input-set-name" /><div className="flex items-center justify-between mt-9 mb-4"><div><label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{t('add.words')}</label><p className="text-sm text-muted-foreground mt-1">{t('add.wordsHint')}</p></div><span className="text-xs text-primary font-semibold">{t('add.added', { count: filled })}</span></div><div className="space-y-2">{words.map((word, i) => <div className="flex items-center gap-3" key={i}><span className="font-mono text-xs text-muted-foreground w-5">{String(i + 1).padStart(2, '0')}</span><input value={word} onChange={e => setWords(words.map((item, index) => index === i ? e.target.value : item))} placeholder={i < 4 ? t('add.wordPlaceholder') : t('add.anotherPlaceholder')} className="flex-1 rounded-xl bg-secondary/70 border border-transparent focus:border-primary px-4 py-3 outline-none text-sm" data-testid={`input-word-${i}`} /><button onClick={() => words.length > 4 && setWords(words.filter((_, index) => index !== i))} className="text-muted-foreground hover:text-destructive disabled:opacity-30" disabled={words.length <= 4} data-testid={`button-remove-word-${i}`} aria-label={t('common.remove')}><X size={17} /></button></div>)}</div><button onClick={() => setWords([...words, ''])} className="mt-4 text-sm text-primary font-semibold flex items-center gap-2" data-testid="button-add-word"><Plus size={16} /> {t('add.addAnother')}</button><div className="mt-9 pt-5 border-t border-border flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground">{t('add.practicePath')}</p><button onClick={submit} disabled={!name.trim() || filled < 4 || create.isPending} className="h-12 rounded-xl bg-primary text-primary-foreground px-6 font-bold disabled:opacity-45 flex items-center justify-center gap-2" data-testid="button-save-set">{create.isPending ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />} {create.isPending ? t('add.preparing') : t('add.create')}</button></div>{create.isError && <p className="mt-4 text-sm text-destructive" data-testid="status-create-error">{t('add.error')}</p>}</div>
  </div></Shell>;
}

function ReviewPage({ locale }: { locale: Locale }) {
  const q = useGetReview();
  const setsQuery = useListWordSets();
  const [, navigate] = useLocation();
  const t = useCopy(locale);
  if (q.isLoading) return <Shell locale={locale}><Initial label={t('common.loading')} /></Shell>;
  if (q.isError || !q.data) return <Shell locale={locale}><ErrorState locale={locale} retry={() => q.refetch()} /></Shell>;
  const review = q.data;
  const reviewSet = setsQuery.data?.find(set => set.id === review.dueSetId) ?? setsQuery.data?.find(set => set.dueCount > 0);
  return <Shell locale={locale}><div className="max-w-5xl mx-auto px-5 md:px-10 pt-9 md:pt-12"><PageHeading locale={locale} eyebrow={t('review.eyebrow')} title={t('review.title')} /><div className="rounded-[1.7rem] bg-primary text-primary-foreground p-7 md:p-10 flex flex-col md:flex-row md:items-end justify-between gap-7 animate-rise"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-primary-foreground/70">{review.total > 0 ? t('review.ready') : t('review.caughtUp')}</p><h2 className="font-serif text-4xl mt-5">{review.total > 0 ? t('review.readyBody', { count: review.total }) : t('review.caughtUp')}</h2><p className="text-sm text-primary-foreground/70 mt-3 max-w-xs">{review.total > 0 ? t('review.readyBody', { count: review.total }) : t('review.caughtUpBody')}</p></div>{review.total > 0 && <button onClick={() => reviewSet ? navigate(`/learn/${reviewSet.id}`) : navigate('/sets')} className="h-12 px-5 rounded-xl bg-accent text-accent-foreground font-bold flex items-center justify-center gap-2" data-testid="button-start-review"><Play size={16} fill="currentColor" /> {t('review.start')}</button>}</div></div></Shell>;
}

function ProfilePage({ locale, profile }: { locale: Locale; profile: Profile }) {
  const p = profile;
  const t = useCopy(locale);
  const update = useUpdateProfile();
  const qc = useQueryClient();
  const [native, setNative] = useState(normalizeLanguageCode(p.nativeLanguage));
  const [target, setTarget] = useState(normalizeLanguageCode(p.targetLanguage));
  const [goal, setGoal] = useState(String(p.dailyGoal));
  const [audio, setAudio] = useState(true);
  const [notifications, setNotifications] = useState(false);
  const save = (data: { nativeLanguage?: string; targetLanguage?: string; dailyGoal?: number }) => update.mutate({ data }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getGetProfileQueryKey() }); qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); } });
  const changeNative = (value: string) => { if (value !== native && !window.confirm(t('profile.nativeConfirm'))) return; setNative(value); save({ nativeLanguage: value }); };
  const changeTarget = (value: string) => { if (value !== target && !window.confirm(t('profile.languageConfirm'))) return; setTarget(value); save({ targetLanguage: value }); };
  return <Shell locale={locale}><div className="max-w-5xl mx-auto px-5 md:px-10 pt-9 md:pt-12"><PageHeading locale={locale} eyebrow={t('profile.eyebrow')} title={t('profile.title')}><Settings size={20} className="text-muted-foreground" /></PageHeading><div className="rounded-[1.7rem] bg-secondary p-7 animate-rise"><div className="h-16 w-16 rounded-full bg-accent/25 grid place-items-center font-mono text-lg">LF</div><h2 className="font-serif text-3xl mt-8">{p.userName}</h2>{!p.hasPracticeHistory && <p className="text-sm text-muted-foreground mt-2">{t('profile.noHistory')}</p>}</div>
    <section className="mt-9"><h2 className="font-serif text-2xl mb-4">{t('profile.learningLanguages')}</h2><div className="grid md:grid-cols-3 gap-3"><PreferenceSelect locale={locale} label={t('profile.native')} value={native} onChange={changeNative} options={languageOptions} /><PreferenceSelect locale={locale} label={t('profile.target')} value={target} onChange={changeTarget} options={languageOptions.filter(item => item.code !== native)} /><div className="rounded-2xl border border-card-border bg-card p-5"><label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{t('profile.dailyGoal')}</label><select value={goal} onChange={e => { setGoal(e.target.value); save({ dailyGoal: Number(e.target.value) }); }} className="w-full bg-transparent mt-4 text-lg outline-none"><option value="" disabled>{t('onboarding.selectLanguage')}</option>{goalOptions.map(item => <option key={item} value={item}>{t('common.minutes', { count: item })}</option>)}</select></div></div></section>
    <section className="mt-9"><h2 className="font-serif text-2xl mb-4">{t('profile.settings')}</h2><div className="space-y-2"><SettingRow locale={locale} label={t('profile.audio')} body={t('profile.audioBody')} checked={audio} onChange={setAudio} /><SettingRow locale={locale} label={t('profile.notifications')} body={t('profile.notificationsBody')} checked={notifications} onChange={setNotifications} /><SettingRow locale={locale} label={t('profile.appearance')} body={t('profile.appearanceBody')} checked={true} onChange={() => undefined} disabled /></div></section>
    <section className="mt-9"><h2 className="font-serif text-2xl mb-4">{t('profile.account')}</h2><button className="w-full text-left rounded-2xl border border-card-border bg-card p-5 text-sm font-semibold text-destructive" data-testid="button-sign-out">{t('profile.signOut')}</button></section>
  </div></Shell>;
}

function PreferenceSelect({ locale, label, value, onChange, options }: { locale: Locale; label: string; value: string; onChange: (value: string) => void; options: typeof languageOptions }) {
  return <div className="rounded-2xl border border-card-border bg-card p-5"><label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{label}</label><select value={value} onChange={e => onChange(e.target.value)} className="w-full bg-transparent mt-4 text-lg outline-none">{options.map(item => <option key={item.code} value={item.code}>{languageLabel(item.code, locale)}</option>)}</select></div>;
}

function SettingRow({ locale: _locale, label, body, checked, onChange, disabled = false }: { locale: Locale; label: string; body: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return <label className={`flex items-center gap-4 rounded-2xl border border-card-border bg-card p-5 ${disabled ? 'opacity-70' : 'cursor-pointer'}`}><div className="flex-1"><p className="font-semibold">{label}</p><p className="text-xs text-muted-foreground mt-1">{body}</p></div><input type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} className="h-5 w-5 accent-[hsl(var(--primary))]" /></label>;
}

type SessionStep = 'intro' | 'writing' | 'speaking' | 'recall' | 'done';
function LearnPage({ locale }: { locale: Locale }) {
  const { setId } = useParams<{ setId: string }>();
  const id = Number(setId);
  const q = useGetWordSet(id, { query: { enabled: id > 0, queryKey: getGetWordSetQueryKey(id) } });
  const attempt = useCreatePracticeAttempt();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const t = useCopy(locale);
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState<SessionStep>('intro');
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<'idle' | 'wrong' | 'correct'>('idle');
  const [speaking, setSpeaking] = useState(false);
  const [spokenResult, setSpokenResult] = useState(false);
  const stepStarted = useRef(Date.now());
  const words = q.data?.words ?? [];
  const word = words[index];
  const duration = () => Math.max(0, Math.floor((Date.now() - stepStarted.current) / 1000));
  const record = (skill: 'writing' | 'speaking' | 'recall', correct: boolean, supplied?: string) => {
    if (!word) return;
    attempt.mutate({ data: { wordId: word.id, skill: Skill[skill], correct, answer: supplied ?? null, durationSeconds: duration() } }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getGetWordSetQueryKey(id) }); qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); qc.invalidateQueries({ queryKey: getGetReviewQueryKey() }); qc.invalidateQueries({ queryKey: getGetProfileQueryKey() }); } });
  };
  const nextStep = (next: SessionStep) => { stepStarted.current = Date.now(); setStep(next); };
  const nextWord = () => { if (index >= words.length - 1) nextStep('done'); else { setIndex(index + 1); setAnswer(''); setResult('idle'); setSpokenResult(false); nextStep('intro'); } };
  if (q.isLoading) return <Shell locale={locale} hideNav><Initial label={t('learn.setup')} /></Shell>;
  if (q.isError || !q.data) return <Shell locale={locale} hideNav><ErrorState locale={locale} retry={() => q.refetch()} /></Shell>;
  if (!word && step !== 'done') return <Shell locale={locale} hideNav><EmptyState locale={locale} title={t('learn.noWords')} body={t('learn.noWordsBody')} action={t('common.back')} href="/sets" /></Shell>;
  if (step === 'done') return <Shell locale={locale} hideNav><div className="min-h-[100dvh] grid place-items-center px-5"><div className="text-center max-w-sm animate-rise"><div className="h-20 w-20 rounded-[26px] bg-accent/20 text-accent-foreground grid place-items-center mx-auto"><Check size={32} /></div><p className="font-mono text-xs uppercase tracking-[.18em] text-primary mt-8">{t('learn.sessionComplete')}</p><h1 className="font-serif text-5xl mt-3">{t('learn.stick')}</h1><p className="text-muted-foreground mt-4">{t('learn.sessionBody', { count: words.length })}</p><div className="flex gap-3 mt-8"><button onClick={() => { setIndex(0); setAnswer(''); setResult('idle'); nextStep('intro'); }} className="flex-1 h-12 rounded-xl border border-border font-bold flex gap-2 items-center justify-center" data-testid="button-repeat-session"><RotateCcw size={16} /> {t('common.again')}</button><button onClick={() => navigate(`/sets/${id}`)} className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground font-bold" data-testid="button-finish-session">{t('common.done')}</button></div></div></div></Shell>;
  return <Shell locale={locale} hideNav><div className="min-h-[100dvh] max-w-2xl mx-auto px-5 py-6 md:py-10 flex flex-col"><header className="flex items-center gap-4"><button onClick={() => navigate(`/sets/${id}`)} className="h-10 w-10 grid place-items-center rounded-xl bg-secondary" data-testid="button-exit-session" aria-label={t('learn.exit')}><X size={18} /></button><div className="flex-1"><div className="flex justify-between text-[10px] uppercase font-mono tracking-wider text-muted-foreground mb-2"><span>{q.data.name}</span><span>{index + 1} / {words.length}</span></div><Meter value={((index + (step === 'intro' ? 0 : .65)) / words.length) * 100} /></div></header><main className="flex-1 flex flex-col justify-center py-12">{step === 'intro' && word && <div className="animate-rise"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">{t('learn.meet')}</p><h1 className="font-serif text-6xl md:text-8xl tracking-tight mt-7">{word.text}</h1><div className="flex items-center gap-3 mt-4 text-muted-foreground"><span className="font-mono">{word.pronunciation}</span><button className="h-9 w-9 rounded-full bg-secondary grid place-items-center hover:bg-accent/20" data-testid="button-session-listen" aria-label={t('common.listen')}><Volume2 size={16} /></button></div><div className="rounded-2xl bg-secondary/70 p-5 mt-12"><p className="text-xs uppercase font-mono tracking-wider text-muted-foreground">{t('learn.inContext')}</p><p className="font-serif text-2xl mt-4 leading-snug">“{word.sentence}”</p><p className="text-sm text-muted-foreground mt-4">{word.translation || t('common.translationPending')}</p></div><button onClick={() => nextStep('writing')} className="w-full h-13 mt-6 rounded-xl bg-primary text-primary-foreground font-bold flex gap-2 items-center justify-center" data-testid="button-start-word">{t('learn.ready')} <ArrowRight size={17} /></button></div>}{step === 'writing' && word && <div className="animate-rise"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">{t('learn.write')}</p><h2 className="font-serif text-4xl mt-6">{t('learn.useWord', { word: word.text })}</h2><p className="text-sm text-muted-foreground mt-4">{t('learn.completeSentence')}</p><div className={`mt-9 rounded-2xl border-2 ${result === 'wrong' ? 'border-destructive bg-destructive/5' : result === 'correct' ? 'border-primary bg-primary/5' : 'border-border'} p-5`}><p className="font-serif text-xl">{word.sentence.split(new RegExp(`(${word.text})`, 'ig')).map((part, i) => part.toLowerCase() === word.text.toLowerCase() ? <span key={i} className="text-primary underline decoration-accent decoration-2 underline-offset-4">{answer || '_____'} </span> : part)}</p><input autoFocus value={answer} onChange={e => { setAnswer(e.target.value); setResult('idle'); }} placeholder={t('learn.missingWord')} className="mt-6 w-full border-b border-border bg-transparent py-2 outline-none text-sm" data-testid="input-writing-answer" />{result === 'wrong' && <p className="text-sm text-destructive mt-3">{t('learn.notQuite', { word: word.text })}</p>}{result === 'correct' && <p className="text-sm text-primary mt-3 flex items-center gap-2"><Check size={15} /> {t('learn.exactly')}</p>}</div><button onClick={() => { const correct = answer.trim().toLowerCase() === word.text.toLowerCase(); setResult(correct ? 'correct' : 'wrong'); record('writing', correct, answer); if (correct) setTimeout(() => nextStep('speaking'), 500); }} disabled={!answer.trim() || attempt.isPending || result === 'correct'} className="w-full h-13 mt-6 rounded-xl bg-primary text-primary-foreground font-bold disabled:opacity-45" data-testid="button-check-writing">{result === 'correct' ? t('learn.niceWork') : t('common.check')}</button></div>}{step === 'speaking' && word && <div className="animate-rise text-center"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">{t('learn.say')}</p><h2 className="font-serif text-4xl mt-6">{t('learn.voiceTurn')}</h2><p className="text-sm text-muted-foreground mt-4 max-w-xs mx-auto">{t('learn.readNaturally')}</p><div className="rounded-2xl bg-secondary/70 p-6 mt-9 text-left"><p className="text-xs uppercase font-mono tracking-wider text-muted-foreground">{t('learn.yourPrompt')}</p><p className="font-serif text-2xl mt-4 leading-snug">{word.sentence}</p></div><button onPointerDown={() => setSpeaking(true)} onPointerUp={() => { setSpeaking(false); setSpokenResult(true); record('speaking', true, word.sentence); }} onPointerLeave={() => setSpeaking(false)} className={`h-24 w-24 rounded-full mx-auto mt-8 grid place-items-center transition-transform ${speaking ? 'scale-110 bg-accent' : 'bg-primary'} text-primary-foreground`} data-testid="button-hold-speak" aria-label={t('learn.hold')}><Mic size={29} /></button><p className="text-xs text-muted-foreground mt-4">{spokenResult ? t('learn.recorded') : speaking ? t('learn.listening') : t('learn.hold')}</p><button onClick={() => nextStep('recall')} disabled={!spokenResult} className="w-full h-13 mt-7 rounded-xl bg-primary text-primary-foreground font-bold disabled:opacity-40" data-testid="button-continue-speaking">{t('learn.continue')} <ArrowRight size={16} className="inline ml-1" /></button></div>}{step === 'recall' && word && <div className="animate-rise"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">{t('learn.recall')}</p><h2 className="font-serif text-4xl mt-6">{t('learn.meaningQuestion', { word: word.text })}</h2><div className="grid gap-2 mt-9">{[word.translation || t('common.translationPending'), word.meaning, t('home.noActiveSet')].filter((option, i, all) => Boolean(option) && all.indexOf(option) === i).map((option, i) => <button key={`${option}-${i}`} onClick={() => { record('recall', option === word.translation, option); nextWord(); }} className="text-left rounded-2xl border border-border bg-card px-5 py-4 text-sm hover:border-primary hover:bg-primary/5 transition-colors" data-testid={`button-recall-option-${i}`}>{option}</button>)}</div></div>}</main><div className="flex justify-center gap-1.5 pb-2">{['intro', 'writing', 'speaking', 'recall'].map((name, i) => <span key={name} className={`h-1.5 rounded-full transition-all ${step === name ? 'w-8 bg-primary' : i < ['intro', 'writing', 'speaking', 'recall'].indexOf(step) ? 'w-3 bg-accent' : 'w-3 bg-secondary'}`} />)}</div></div></Shell>;
}

function Onboarding({ profile }: { profile: Profile }) {
  const update = useUpdateProfile();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [native, setNative] = useState('');
  const [target, setTarget] = useState('');
  const [goal, setGoal] = useState(15);
  const [search, setSearch] = useState('');
  const locale = localeFromLanguage(native);
  const t = useCopy(locale);
  const filtered = useMemo(() => languageOptions.filter(item => item.englishName.toLowerCase().includes(search.toLowerCase()) || languageLabel(item.code, locale).toLowerCase().includes(search.toLowerCase())), [search, locale]);
  const choose = (code: string) => { if (step === 0) setNative(code); else if (step === 1) setTarget(code); };
  const continueStep = () => { if (step === 0 && native) { setSearch(''); setStep(1); } else if (step === 1 && target && target !== native) { setSearch(''); setStep(2); } else if (step === 2) update.mutate({ data: { nativeLanguage: native, targetLanguage: target, dailyGoal: goal, onboardingComplete: true } }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getGetProfileQueryKey() }); qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); } }); };
  useEffect(() => { if (profile.nativeLanguage && !native) setNative(normalizeLanguageCode(profile.nativeLanguage)); }, [profile.nativeLanguage, native]);
  useEffect(() => { document.documentElement.lang = locale; document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'; }, [locale]);
  return <div className="app-grain min-h-[100dvh] bg-background px-5 py-8 md:py-12"><div className="max-w-xl mx-auto min-h-[calc(100dvh-4rem)] flex flex-col"><div className="flex items-center justify-between"><Logo /><span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{t('onboarding.step', { current: step + 1, total: 3 })}</span></div><div className="flex gap-1 mt-10">{[0, 1, 2].map(item => <span key={item} className={`h-1.5 flex-1 rounded-full ${item <= step ? 'bg-primary' : 'bg-secondary'}`} />)}</div><main className="flex-1 flex flex-col justify-center py-12 animate-rise">{step < 2 ? <><p className="font-mono text-[10px] uppercase tracking-[.2em] text-primary mb-4">{step === 0 ? t('onboarding.selectLanguage') : t('onboarding.targetTitle')}</p><h1 className="font-serif text-5xl md:text-6xl tracking-tight">{step === 0 ? t('onboarding.nativeTitle') : t('onboarding.targetTitle')}</h1><p className="text-muted-foreground mt-4">{step === 0 ? t('onboarding.nativeHint') : t('onboarding.targetHint')}</p><div className="mt-9"><input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('onboarding.search')} className="w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:border-primary" data-testid="input-language-search" /><div className="grid grid-cols-2 gap-2 mt-3 max-h-72 overflow-y-auto">{filtered.map(item => <button key={item.code} onClick={() => choose(item.code)} className={`text-left rounded-xl border px-4 py-3 text-sm transition-colors ${((step === 0 ? native : target) === item.code) ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border bg-card hover:border-primary'}`} disabled={step === 1 && item.code === native} data-testid={`button-language-${item.code}`}>{languageLabel(item.code, locale)}</button>)}</div></div>{((step === 0 && !native) || (step === 1 && (!target || target === native))) && <p className="text-sm text-destructive mt-3">{step === 0 ? t('onboarding.chooseOne') : t('onboarding.chooseDifferent')}</p>}</> : <><p className="font-mono text-[10px] uppercase tracking-[.2em] text-primary mb-4">{t('onboarding.goalTitle')}</p><h1 className="font-serif text-5xl md:text-6xl tracking-tight">{t('onboarding.goalTitle')}</h1><p className="text-muted-foreground mt-4">{t('onboarding.goalHint')}</p><div className="grid gap-2 mt-9">{goalOptions.map(item => <button key={item} onClick={() => setGoal(item)} className={`flex items-center justify-between rounded-2xl border px-5 py-4 text-left ${goal === item ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}><span className="font-semibold">{t('common.minutes', { count: item })}</span>{goal === item && <Check size={18} className="text-primary" />}</button>)}</div></>}</main><button onClick={continueStep} disabled={(step === 0 && !native) || (step === 1 && (!target || target === native)) || update.isPending} className="w-full h-13 rounded-xl bg-primary text-primary-foreground font-bold disabled:opacity-40 flex items-center justify-center gap-2" data-testid="button-onboarding-continue">{update.isPending ? <Loader2 size={17} className="animate-spin" /> : null}{step === 2 ? t('common.startLearning') : t('common.continue')}<ArrowRight size={17} /></button></div></div>;
}

function Router({ locale, profile }: { locale: Locale; profile: Profile }) {
  return <ErrorBoundary resetKey={location.pathname}><Switch><Route path="/" component={() => <Home locale={locale} />} /><Route path="/sets" component={() => <SetsPage locale={locale} />} /><Route path="/sets/:id" component={() => <SetDetail locale={locale} />} /><Route path="/words/:id" component={() => <WordDetail locale={locale} />} /><Route path="/add" component={() => <AddPage locale={locale} profile={profile} />} /><Route path="/review" component={() => <ReviewPage locale={locale} />} /><Route path="/profile" component={() => <ProfilePage locale={locale} profile={profile} />} /><Route path="/learn/:setId" component={() => <LearnPage locale={locale} />} /><Route component={NotFound} /></Switch></ErrorBoundary>;
}

function AppContent() {
  const q = useGetProfile();
  if (q.isLoading) return <Initial label={translate('en', 'common.loading')} />;
  if (q.isError || !q.data) return <ErrorState locale="en" retry={() => q.refetch()} />;
  const profile = q.data;
  if (!profile.onboardingComplete || !profile.nativeLanguage || !profile.targetLanguage) return <Onboarding profile={profile} />;
  const locale = localeFromLanguage(profile.nativeLanguage);
  useEffect(() => { document.documentElement.lang = locale; document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'; }, [locale]);
  return <Router locale={locale} profile={profile} />;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><AppContent /><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;