import { useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch, useLocation, useParams } from 'wouter';
import {
  ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, CircleAlert, Flame, Headphones,
  Home as HomeIcon, Library, ListChecks, Loader2, Menu, Mic, Pencil,
  Play, Plus, RotateCcw, Settings, Sparkles, Target, Trash2, Trophy, Volume2, X, Zap
} from 'lucide-react';
import {
  Skill, getGetDashboardQueryKey, getGetProfileQueryKey, getGetReviewQueryKey,
  getGetWordQueryKey, getGetWordSetQueryKey, getListWordSetsQueryKey,
  useCreatePracticeAttempt, useCreateWordSet, useDeleteWordSet, useGetDashboard,
  useGetProfile, useGetReview, useGetWord, useGetWordSet, useListWordSets,
  useUpdateWordSet
} from '@workspace/api-client-react';
import type { Word, WordSetSummary } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

function Initial({ label = 'Loading your practice space' }: { label?: string }) {
  return <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-muted-foreground" data-testid="status-loading">
    <div className="h-10 w-10 rounded-full border-2 border-primary/25 border-t-primary animate-spin" />
    <span className="text-sm">{label}</span>
  </div>;
}

function ErrorState({ retry }: { retry?: () => void }) {
  return <div className="min-h-[45vh] flex flex-col items-center justify-center text-center gap-3 p-8" data-testid="status-error">
    <div className="h-12 w-12 rounded-2xl bg-destructive/10 text-destructive grid place-items-center"><CircleAlert size={22} /></div>
    <h2 className="font-serif text-2xl">A small detour.</h2>
    <p className="text-sm text-muted-foreground max-w-xs">We couldn’t bring that practice moment in. Try once more.</p>
    {retry && <button onClick={retry} className="text-primary text-sm font-semibold underline underline-offset-4" data-testid="button-retry">Try again</button>}
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

const navItems = [
  { href: '/', label: 'Home', icon: HomeIcon },
  { href: '/sets', label: 'My Sets', icon: Library },
  { href: '/add', label: 'Add', icon: Plus },
  { href: '/review', label: 'Review', icon: ListChecks },
  { href: '/profile', label: 'Profile', icon: Target },
];

function Shell({ children, hideNav = false }: { children: React.ReactNode; hideNav?: boolean }) {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  if (hideNav) return <div className="app-grain min-h-[100dvh]">{children}</div>;
  return <div className="app-grain min-h-[100dvh] bg-background">
    <aside className="hidden md:flex fixed inset-y-0 left-0 w-[228px] p-5 flex-col border-r border-border bg-card/70">
      <Logo />
      <p className="text-[10px] font-mono uppercase tracking-[.18em] text-muted-foreground mt-12 mb-4 px-3">Your practice</p>
      <nav className="space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-colors ${location === href ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`} data-testid={`link-nav-${label.toLowerCase().replace(' ', '-')}`}>
          <Icon size={18} strokeWidth={1.8} /><span>{label}</span>{label === 'Review' && <span className="ml-auto h-5 min-w-5 px-1 rounded-full bg-accent text-accent-foreground text-[10px] grid place-items-center">!</span>}
        </Link>)}
      </nav>
      <div className="mt-auto p-4 rounded-2xl bg-secondary/70">
        <Sparkles size={17} className="text-accent mb-2" />
        <p className="font-serif text-lg leading-tight">Small words.<br />Real fluency.</p>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">Say it, write it, make it yours.</p>
      </div>
      <Link href="/profile" className="mt-5 flex items-center gap-3 px-2 py-2 text-sm font-semibold" data-testid="link-sidebar-profile">
        <span className="h-8 w-8 rounded-full bg-accent/20 text-accent-foreground grid place-items-center font-mono text-xs">AL</span>
        <span>Alex’s space</span><ChevronRight className="ml-auto text-muted-foreground" size={15} />
      </Link>
    </aside>
    <header className="md:hidden h-[72px] px-5 flex items-center justify-between border-b border-border bg-card/70 sticky top-0 z-30 backdrop-blur">
      <Logo />
      <button onClick={() => setMenuOpen(!menuOpen)} className="h-10 w-10 grid place-items-center rounded-xl bg-secondary" data-testid="button-mobile-menu">{menuOpen ? <X size={19} /> : <Menu size={19} />}</button>
      {menuOpen && <div className="absolute right-5 top-[62px] bg-card border border-border rounded-2xl p-2 shadow-md w-44 animate-rise">
        {navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold hover:bg-secondary" data-testid={`link-mobile-${label.toLowerCase().replace(' ', '-')}`}><Icon size={17} />{label}</Link>)}
      </div>}
    </header>
    <main className="md:ml-[228px] pb-24 md:pb-10">{children}</main>
    <nav className="md:hidden fixed bottom-0 inset-x-0 h-[72px] z-30 bg-card/90 backdrop-blur border-t border-border flex items-center justify-around px-3">
      {navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`flex flex-col items-center gap-1 py-2 px-3 text-[10px] font-semibold ${label === 'Add' ? 'text-accent' : location === href ? 'text-primary' : 'text-muted-foreground'}`} data-testid={`link-bottom-${label.toLowerCase().replace(' ', '-')}`}><Icon size={label === 'Add' ? 21 : 19} /><span>{label}</span></Link>)}
    </nav>
  </div>;
}

function PageHeading({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return <div className="flex items-end justify-between gap-4 mb-8 animate-rise">
    <div>{eyebrow && <p className="font-mono text-[10px] tracking-[.18em] uppercase text-primary mb-3">{eyebrow}</p>}<h1 className="font-serif text-4xl md:text-5xl tracking-tight leading-[.95]" data-testid="text-page-title">{title}</h1></div>
    {children}
  </div>;
}

function Meter({ value, className = '' }: { value: number; className?: string }) {
  return <div className={`progress-track h-2 ${className}`}><div className="progress-fill transition-all duration-700" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}

function SetCard({ set, compact = false }: { set: WordSetSummary; compact?: boolean }) {
  return <Link href={`/sets/${set.id}`} className={`group block rounded-2xl border border-card-border bg-card hover:-translate-y-0.5 hover:shadow-md transition-all ${compact ? 'p-4' : 'p-5'}`} data-testid={`card-word-set-${set.id}`}>
    <div className="flex items-start justify-between gap-3">
      <span className={`grid place-items-center rounded-xl text-primary bg-primary/10 ${compact ? 'h-9 w-9' : 'h-11 w-11'}`}><BookOpen size={compact ? 17 : 19} /></span>
      <span className="text-muted-foreground group-hover:text-primary transition-colors"><ArrowRight size={17} /></span>
    </div>
    <h3 className="font-semibold mt-4 truncate" data-testid={`text-set-name-${set.id}`}>{set.name}</h3>
    <p className="text-xs text-muted-foreground mt-1">{set.wordCount} words <span className="mx-1 text-border">/</span> {set.dueCount} due</p>
    <div className="flex items-center gap-3 mt-4"><Meter value={set.mastery} className="flex-1" /><span className="font-mono text-[11px] text-muted-foreground">{Math.round(set.mastery)}%</span></div>
  </Link>;
}

function Home() {
  const q = useGetDashboard();
  const dashboard = q.data;
  if (q.isLoading) return <Shell><Initial /></Shell>;
  if (q.isError || !dashboard) return <Shell><ErrorState retry={() => q.refetch()} /></Shell>;
  const goalPercent = Math.min(100, (dashboard.minutesLearned / dashboard.dailyGoal) * 100);
  return <Shell><div className="max-w-6xl mx-auto px-5 md:px-10 pt-8 md:pt-12">
    <div className="flex justify-between items-start animate-rise"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-primary mb-3">Tuesday, October 15</p><h1 className="font-serif text-[2.65rem] md:text-6xl tracking-tight leading-none" data-testid="text-greeting">{dashboard.greeting || 'Good morning, Alex.'}</h1><p className="text-muted-foreground mt-3">A few focused minutes can change what sticks.</p></div><div className="hidden md:grid h-12 w-12 rounded-full bg-accent/15 text-accent-foreground place-items-center font-mono text-xs">AL</div></div>
    <section className="mt-9 grid md:grid-cols-[1.35fr_.65fr] gap-4">
      <div className="rounded-[1.65rem] p-6 md:p-8 bg-primary text-primary-foreground relative overflow-hidden animate-float stagger-1">
        <div className="absolute -right-8 -top-12 h-48 w-48 rounded-full border-[22px] border-primary-foreground/10" /><div className="absolute right-16 bottom-[-48px] h-32 w-32 rounded-full bg-accent/80" />
        <div className="relative"><div className="flex items-center gap-2 text-primary-foreground/75 text-xs font-mono uppercase tracking-wider"><Zap size={14} /> Today’s momentum</div>
          <h2 className="font-serif text-3xl md:text-4xl mt-5 max-w-sm">{dashboard.minutesLearned > 0 ? 'Keep the thread going.' : 'Start with one good word.'}</h2>
          <p className="text-primary-foreground/75 text-sm mt-2 max-w-sm">{dashboard.reviewItems ? `${dashboard.reviewItems} items are ready for a quick review.` : 'Your next familiar word is waiting.'}</p>
          <Link href={dashboard.reviewItems ? '/review' : (dashboard.continueSet ? `/learn/${dashboard.continueSet.id}` : '/sets')} className="inline-flex items-center gap-2 bg-accent text-accent-foreground rounded-xl px-4 py-3 mt-7 text-sm font-bold hover:brightness-105" data-testid="link-today-action">{dashboard.reviewItems ? 'Review now' : 'Continue learning'}<ArrowRight size={16} /></Link>
        </div>
      </div>
      <div className="rounded-[1.65rem] border border-card-border bg-card p-6 animate-float stagger-2"><div className="flex justify-between items-center"><span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Daily practice</span><Target size={18} className="text-accent" /></div>
        <div className="flex items-end gap-2 mt-7"><span className="font-serif text-5xl">{dashboard.minutesLearned}</span><span className="text-sm text-muted-foreground mb-2">/ {dashboard.dailyGoal} min</span></div><Meter value={goalPercent} className="mt-4" /><p className="text-xs text-muted-foreground mt-3">{Math.max(0, dashboard.dailyGoal - dashboard.minutesLearned)} minutes to your daily goal</p>
      </div>
    </section>
    <section className="grid md:grid-cols-[.8fr_1.2fr] gap-4 mt-4">
      <div className="rounded-2xl border border-card-border bg-card p-5 animate-float stagger-3"><div className="flex items-center gap-2 text-sm font-semibold"><Flame size={18} className="text-accent" />{dashboard.streak} day streak</div><div className="flex gap-1.5 mt-5">{Array.from({ length: 7 }).map((_, i) => <div key={i} className={`h-7 flex-1 rounded-md ${i < Math.min(7, dashboard.streak) ? 'bg-accent' : 'bg-secondary'}`} />)}</div><p className="text-xs text-muted-foreground mt-3">Consistency is a quiet superpower.</p></div>
      <Link href="/review" className="rounded-2xl border border-card-border bg-card p-5 flex items-center gap-5 hover:shadow-md transition-shadow animate-float stagger-4" data-testid="link-review-queue"><div className="h-14 w-14 rounded-2xl bg-accent/15 text-accent-foreground grid place-items-center font-serif text-2xl">{dashboard.reviewItems}</div><div className="flex-1"><p className="font-semibold">Your review queue</p><p className="text-xs text-muted-foreground mt-1">{dashboard.reviewBreakdown.words} words · {dashboard.reviewBreakdown.writing} writing · {dashboard.reviewBreakdown.speaking} speaking</p><div className="flex gap-1 mt-3"><span className="h-1.5 flex-1 rounded-full bg-primary" /><span className="h-1.5 flex-1 rounded-full bg-accent" /><span className="h-1.5 flex-1 rounded-full bg-secondary" /></div></div><ChevronRight size={19} className="text-muted-foreground" /></Link>
    </section>
    {dashboard.continueSet && <section className="mt-10"><div className="flex items-center justify-between mb-4"><h2 className="font-serif text-2xl">Pick up where you left off</h2><Link href={`/sets/${dashboard.continueSet.id}`} className="text-xs text-primary font-semibold" data-testid="link-continue-set">See set</Link></div><div className="rounded-2xl bg-secondary/70 p-5 flex items-center gap-4"><div className="h-12 w-12 rounded-xl bg-card grid place-items-center text-primary"><BookOpen size={19} /></div><div className="flex-1"><p className="font-semibold">{dashboard.continueSet.name}</p><p className="text-xs text-muted-foreground mt-1">{dashboard.continueSet.wordCount} words · {Math.round(dashboard.continueSet.mastery)}% familiar</p></div><Link href={`/learn/${dashboard.continueSet.id}`} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-bold grid place-items-center" data-testid="link-continue-practice">Practice</Link></div></section>}
    <section className="mt-10 pb-5"><div className="flex items-center justify-between mb-4"><h2 className="font-serif text-2xl">Recent sets</h2><Link href="/sets" className="text-xs text-primary font-semibold" data-testid="link-see-all-sets">View all</Link></div>{dashboard.recentSets?.length ? <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{dashboard.recentSets.slice(0, 3).map(set => <SetCard set={set} key={set.id} compact />)}</div> : <EmptyState title="Your word shelf is empty" body="Save your first set and it will live here." action="Create a set" href="/add" />}</section>
  </div></Shell>;
}

function EmptyState({ title, body, action, href }: { title: string; body: string; action?: string; href?: string }) {
  return <div className="rounded-2xl border border-dashed border-card-border bg-card/50 p-10 text-center" data-testid="status-empty"><div className="h-12 w-12 rounded-2xl bg-secondary grid place-items-center mx-auto text-primary"><BookOpen size={20} /></div><h3 className="font-serif text-xl mt-4">{title}</h3><p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">{body}</p>{action && href && <Link href={href} className="inline-flex items-center gap-2 mt-5 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-bold" data-testid="link-empty-action">{action}<ArrowRight size={15} /></Link>}</div>;
}

function SetsPage() {
  const q = useListWordSets();
  if (q.isLoading) return <Shell><Initial /></Shell>;
  if (q.isError) return <Shell><ErrorState retry={() => q.refetch()} /></Shell>;
  const sets = q.data ?? [];
  return <Shell><div className="max-w-6xl mx-auto px-5 md:px-10 pt-9 md:pt-12"><PageHeading eyebrow="Your library" title="Word sets"><Link href="/add" className="flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-3 text-sm font-bold" data-testid="link-create-set"><Plus size={16} /> <span className="hidden sm:inline">New set</span></Link></PageHeading>{sets.length ? <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{sets.map((set, i) => <div className={`animate-rise stagger-${Math.min(4, i + 1)}`} key={set.id}><SetCard set={set} /></div>)}</div> : <EmptyState title="A shelf waiting for words" body="Collect words around a trip, a book, or a conversation you want to have." action="Create your first set" href="/add" />}</div></Shell>;
}

function SetDetail() {
  const { id } = useParams<{ id: string }>();
  const setId = Number(id);
  const q = useGetWordSet(setId, { query: { enabled: Number.isFinite(setId) && setId > 0, queryKey: getGetWordSetQueryKey(setId) } });
  const update = useUpdateWordSet();
  const remove = useDeleteWordSet();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  if (q.isLoading) return <Shell><Initial /></Shell>;
  if (q.isError || !q.data) return <Shell><ErrorState retry={() => q.refetch()} /></Shell>;
  const set = q.data;
  const startEdit = () => { setName(set.name); setEditing(true); };
  const saveName = () => { if (!name.trim()) return; update.mutate({ setId, data: { name: name.trim() } }, { onSuccess: () => { setEditing(false); qc.invalidateQueries({ queryKey: getGetWordSetQueryKey(setId) }); qc.invalidateQueries({ queryKey: getListWordSetsQueryKey() }); } }); };
  const deleteSet = () => { if (window.confirm(`Delete “${set.name}” and its words?`)) remove.mutate({ setId }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListWordSetsQueryKey() }); navigate('/sets'); } }); };
  return <Shell><div className="max-w-5xl mx-auto px-5 md:px-10 pt-8 md:pt-12"><Link href="/sets" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8" data-testid="link-back-sets"><ArrowLeft size={16} /> All word sets</Link>
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 animate-rise"><div><div className="flex items-center gap-2 text-primary text-xs font-mono uppercase tracking-wider"><BookOpen size={14} /> {set.wordCount} words</div>{editing ? <div className="flex gap-2 mt-3"><input value={name} onChange={e => setName(e.target.value)} className="text-4xl font-serif bg-transparent border-b-2 border-primary outline-none w-full max-w-md" data-testid="input-rename-set" autoFocus /><button onClick={saveName} className="text-primary" data-testid="button-save-rename"><Check /></button></div> : <h1 className="font-serif text-5xl tracking-tight mt-3" data-testid="text-set-title">{set.name}</h1>}<p className="text-sm text-muted-foreground mt-3">{set.dueCount} ready for review · last practiced {set.lastPracticed ? new Date(set.lastPracticed).toLocaleDateString() : 'not yet'}</p></div><div className="flex gap-2"><button onClick={startEdit} className="h-11 w-11 grid place-items-center rounded-xl border border-border hover:bg-secondary" data-testid="button-rename-set"><Pencil size={17} /></button><button onClick={deleteSet} className="h-11 w-11 grid place-items-center rounded-xl border border-border hover:bg-destructive/10 text-destructive" data-testid="button-delete-set"><Trash2 size={17} /></button><Link href={`/learn/${set.id}`} className="flex items-center gap-2 h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-bold" data-testid="link-practice-set"><Play size={15} fill="currentColor" /> Practice</Link></div></div>
    <div className="grid grid-cols-3 gap-3 mt-9"><Stat label="Mastery" value={`${Math.round(set.mastery)}%`} /><Stat label="Due now" value={set.dueCount} /><Stat label="Words" value={set.wordCount} /></div>
    <div className="mt-10"><div className="flex items-center justify-between mb-4"><h2 className="font-serif text-2xl">Words in this set</h2><span className="text-xs text-muted-foreground">Tap a word to explore it</span></div>{set.words?.length ? <div className="space-y-2">{set.words.map((word, i) => <WordRow word={word} key={word.id} index={i} />)}</div> : <EmptyState title="No words yet" body="This set is ready for its first words." />}</div>
  </div></Shell>;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-2xl border border-card-border bg-card p-4"><p className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">{label}</p><p className="font-serif text-3xl mt-2" data-testid={`text-stat-${label.toLowerCase().replace(' ', '-')}`}>{value}</p></div>;
}

function WordRow({ word, index }: { word: Word; index: number }) {
  return <Link href={`/words/${word.id}`} className="flex items-center gap-4 rounded-2xl border border-card-border bg-card p-4 hover:shadow-sm transition-shadow animate-rise" style={{ animationDelay: `${index * .04}s` }} data-testid={`link-word-${word.id}`}><span className="font-mono text-xs text-muted-foreground w-5">{String(index + 1).padStart(2, '0')}</span><div className="flex-1 min-w-0"><p className="font-semibold truncate">{word.text}</p><p className="text-xs text-muted-foreground mt-0.5 truncate">{word.meaning}</p></div><div className="w-20 hidden sm:block"><Meter value={word.mastery} /></div><span className={`text-[10px] font-mono uppercase ${word.mastery >= 70 ? 'text-primary' : 'text-accent-foreground'}`}>{word.status}</span><ChevronRight size={16} className="text-muted-foreground" /></Link>;
}

function WordDetail() {
  const { id } = useParams<{ id: string }>();
  const wordId = Number(id);
  const q = useGetWord(wordId, { query: { enabled: wordId > 0, queryKey: getGetWordQueryKey(wordId) } });
  if (q.isLoading) return <Shell><Initial /></Shell>;
  if (q.isError || !q.data) return <Shell><ErrorState retry={() => q.refetch()} /></Shell>;
  const word = q.data;
  return <Shell><div className="max-w-4xl mx-auto px-5 md:px-10 pt-8 md:pt-12"><Link href={`/sets/${word.setId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-10" data-testid="link-back-word-set"><ArrowLeft size={16} /> Back to set</Link><div className="grid md:grid-cols-[1.2fr_.8fr] gap-6"><div className="rounded-[1.75rem] bg-primary text-primary-foreground p-7 md:p-10 animate-rise"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-primary-foreground/70">Word / {word.status}</p><h1 className="font-serif text-6xl md:text-7xl mt-12 tracking-tight" data-testid="text-word-title">{word.text}</h1><div className="flex items-center gap-3 mt-4 text-primary-foreground/80"><span className="font-mono text-sm">{word.pronunciation}</span><button className="h-8 w-8 rounded-full bg-primary-foreground/10 grid place-items-center hover:bg-primary-foreground/20" data-testid="button-listen-word" aria-label="Listen to pronunciation"><Volume2 size={15} /></button></div><div className="mt-16 pt-5 border-t border-primary-foreground/15"><p className="text-xs text-primary-foreground/60 uppercase tracking-wider font-mono">Meaning</p><p className="text-xl mt-2">{word.meaning}</p></div></div><div className="space-y-4"><div className="rounded-2xl border border-card-border bg-card p-6 animate-rise stagger-1"><p className="text-xs uppercase tracking-wider font-mono text-muted-foreground">In a sentence</p><p className="font-serif text-2xl leading-snug mt-5">“{word.sentence}”</p><button className="mt-5 text-primary text-sm font-semibold flex items-center gap-2" data-testid="button-listen-sentence"><Headphones size={15} /> Listen to sentence</button></div><div className="rounded-2xl border border-card-border bg-card p-6 animate-rise stagger-2"><p className="text-xs uppercase tracking-wider font-mono text-muted-foreground">Skill breakdown</p><SkillBars word={word} /></div><Link href={`/learn/${word.setId}`} className="w-full h-12 rounded-xl bg-accent text-accent-foreground font-bold grid place-items-center gap-2 hover:brightness-105" data-testid="link-practice-word">Practice this word <ArrowRight size={16} /></Link></div></div></div></Shell>;
}

function SkillBars({ word }: { word: Word }) {
  const rows = [['Writing', word.writing], ['Speaking', word.speaking], ['Recall', word.recall]];
  return <div className="space-y-4 mt-5">{rows.map(([label, value]) => <div key={label as string}><div className="flex justify-between text-xs mb-2"><span>{label as string}</span><span className="font-mono text-muted-foreground">{Math.round(value as number)}%</span></div><Meter value={value as number} /></div>)}</div>;
}

function AddPage() {
  const create = useCreateWordSet();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [name, setName] = useState('');
  const [words, setWords] = useState(['', '', '', '']);
  const filled = words.filter(word => word.trim()).length;
  const addWord = () => setWords([...words, '']);
  const removeWord = (i: number) => setWords(words.length > 4 ? words.filter((_, index) => index !== i) : words);
  const updateWord = (i: number, value: string) => setWords(words.map((word, index) => index === i ? value : word));
  const submit = () => { if (!name.trim() || filled < 4) return; create.mutate({ data: { name: name.trim(), words: words.map(word => word.trim()).filter(Boolean) } }, { onSuccess: (set) => { qc.invalidateQueries({ queryKey: getListWordSetsQueryKey() }); navigate(`/sets/${set.id}`); } }); };
  return <Shell><div className="max-w-3xl mx-auto px-5 md:px-10 pt-8 md:pt-12"><Link href="/sets" className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-8" data-testid="link-cancel-add"><ArrowLeft size={16} /> Word sets</Link><PageHeading eyebrow="Build a practice space" title="Add a new set"><span className="font-mono text-xs text-muted-foreground">{filled} / 4 minimum</span></PageHeading>
    <div className="rounded-[1.7rem] bg-card border border-card-border p-5 md:p-8"><label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Set name</label><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Words for the weekend" maxLength={80} className="w-full bg-transparent border-b border-border py-3 text-xl outline-none focus:border-primary placeholder:text-muted-foreground/50" data-testid="input-set-name" /><div className="flex items-center justify-between mt-9 mb-4"><div><label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Your words</label><p className="text-sm text-muted-foreground mt-1">Add words you want to actually use.</p></div><span className="text-xs text-primary font-semibold">{filled} added</span></div><div className="space-y-2">{words.map((word, i) => <div className="flex items-center gap-3" key={i}><span className="font-mono text-xs text-muted-foreground w-5">{String(i + 1).padStart(2, '0')}</span><input value={word} onChange={e => updateWord(i, e.target.value)} placeholder={i < 4 ? 'Type a word' : 'Another word'} className="flex-1 rounded-xl bg-secondary/70 border border-transparent focus:border-primary px-4 py-3 outline-none text-sm" data-testid={`input-word-${i}`} /><button onClick={() => removeWord(i)} className="text-muted-foreground hover:text-destructive disabled:opacity-30" disabled={words.length <= 4} data-testid={`button-remove-word-${i}`}><X size={17} /></button></div>)}</div><button onClick={addWord} className="mt-4 text-sm text-primary font-semibold flex items-center gap-2" data-testid="button-add-word"><Plus size={16} /> Add another word</button><div className="mt-9 pt-5 border-t border-border flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground">LingoFlow will build a practice path for each word.</p><button onClick={submit} disabled={!name.trim() || filled < 4 || create.isPending} className="h-12 rounded-xl bg-primary text-primary-foreground px-6 font-bold disabled:opacity-45 flex items-center justify-center gap-2" data-testid="button-save-set">{create.isPending ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />} {create.isPending ? 'Preparing set…' : 'Create practice set'}</button></div>{create.isError && <p className="mt-4 text-sm text-destructive" data-testid="status-create-error">Couldn’t create this set. Check your words and try again.</p>}</div>
  </div></Shell>;
}

function ReviewPage() {
  const q = useGetReview();
  const setsQuery = useListWordSets();
  const [, navigate] = useLocation();
  if (q.isLoading) return <Shell><Initial /></Shell>;
  if (q.isError || !q.data) return <Shell><ErrorState retry={() => q.refetch()} /></Shell>;
  const review = q.data;
  const reviewSet = setsQuery.data?.find(set => set.dueCount > 0) ?? setsQuery.data?.[0];
  const breakdown = [['Words', review.words, BookOpen], ['Sentences', review.sentences, Pencil], ['Writing', review.writing, Library], ['Speaking', review.speaking, Mic], ['Recall', review.recall, RotateCcw], ['Forms', review.forms, ListChecks]] as const;
  return <Shell><div className="max-w-5xl mx-auto px-5 md:px-10 pt-9 md:pt-12"><PageHeading eyebrow="Keep it alive" title="Review time"><span className="h-12 min-w-12 px-3 rounded-2xl bg-accent/15 text-accent-foreground grid place-items-center font-serif text-2xl">{review.total}</span></PageHeading><div className="rounded-[1.7rem] bg-primary text-primary-foreground p-7 md:p-10 flex flex-col md:flex-row md:items-end justify-between gap-7 animate-rise"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-primary-foreground/70">Your queue</p><h2 className="font-serif text-4xl mt-5">A little revisit<br />goes a long way.</h2><p className="text-sm text-primary-foreground/70 mt-3 max-w-xs">Review in context to turn recognition into something you can reach for.</p></div><button onClick={() => reviewSet ? navigate(`/learn/${reviewSet.id}`) : navigate('/sets')} className="h-12 px-5 rounded-xl bg-accent text-accent-foreground font-bold flex items-center justify-center gap-2" data-testid="button-start-review"><Play size={16} fill="currentColor" /> Start review</button></div><div className="mt-9"><h2 className="font-serif text-2xl mb-4">What’s waiting</h2><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{breakdown.map(([label, value, Icon]) => <div key={label} className="border border-card-border bg-card rounded-2xl p-5 animate-rise"><div className="flex justify-between items-start"><div className="h-9 w-9 rounded-xl bg-secondary grid place-items-center text-primary"><Icon size={17} /></div><span className="font-serif text-3xl">{value}</span></div><p className="font-semibold mt-5">{label}</p><p className="text-xs text-muted-foreground mt-1">{value === 1 ? 'item' : 'items'} to strengthen</p></div>)}</div></div></div></Shell>;
}

function ProfilePage() {
  const q = useGetProfile();
  if (q.isLoading) return <Shell><Initial /></Shell>;
  if (q.isError || !q.data) return <Shell><ErrorState retry={() => q.refetch()} /></Shell>;
  const p = q.data;
  const stats = [['Words learned', p.wordsLearned, BookOpen], ['Sentences practiced', p.sentencesPracticed, Pencil], ['Speaking practice', p.speakingPractice, Mic], ['Writing practice', p.writingPractice, Library]] as const;
  return <Shell><div className="max-w-5xl mx-auto px-5 md:px-10 pt-9 md:pt-12"><PageHeading eyebrow="Your arc" title="Profile"><button className="h-11 w-11 rounded-xl border border-border grid place-items-center hover:bg-secondary" data-testid="button-profile-settings"><Settings size={18} /></button></PageHeading><div className="grid md:grid-cols-[.9fr_1.1fr] gap-4"><div className="rounded-[1.7rem] bg-secondary p-7 animate-rise"><div className="flex justify-between"><div className="h-16 w-16 rounded-full bg-accent/25 grid place-items-center font-mono text-lg">AL</div><div className="flex items-center gap-2 text-sm font-semibold"><Flame size={18} className="text-accent" /> {p.currentStreak} days</div></div><h2 className="font-serif text-3xl mt-10">You’re building<br />a language habit.</h2><p className="text-sm text-muted-foreground mt-2">Longest streak: {p.longestStreak} days</p></div><div className="rounded-[1.7rem] border border-card-border bg-card p-7 animate-rise stagger-1"><div className="flex items-center justify-between"><p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Overall progress</p><span className="font-serif text-4xl">{Math.round(p.overallProgress)}%</span></div><Meter value={p.overallProgress} className="h-3 mt-7" /><p className="text-sm text-muted-foreground mt-4">{p.wordsLearned} words are becoming available to you.</p><div className="grid grid-cols-2 gap-3 mt-8"><Stat label="Daily goal" value={`${p.dailyGoal} min`} /><Stat label="Longest streak" value={`${p.longestStreak} days`} /></div></div></div><div className="mt-9"><h2 className="font-serif text-2xl mb-4">Practice ledger</h2><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">{stats.map(([label, value, Icon]) => <div className="border border-card-border bg-card rounded-2xl p-5" key={label}><Icon size={17} className="text-primary" /><p className="font-serif text-3xl mt-5">{value}</p><p className="text-xs text-muted-foreground mt-1">{label}</p></div>)}</div></div><div className="mt-9"><h2 className="font-serif text-2xl mb-4">Achievements</h2>{p.achievements?.length ? <div className="flex flex-wrap gap-2">{p.achievements.map((achievement, i) => <div key={i} className="flex items-center gap-2 rounded-xl bg-accent/15 text-accent-foreground px-4 py-3 text-sm font-semibold"><Trophy size={15} />{achievement}</div>)}</div> : <div className="rounded-2xl border border-dashed border-card-border p-7 text-center text-sm text-muted-foreground">Your first achievement is closer than it feels.</div>}</div></div></Shell>;
}

type SessionStep = 'intro' | 'writing' | 'speaking' | 'recall' | 'done';
function LearnPage() {
  const { setId } = useParams<{ setId: string }>();
  const id = Number(setId);
  const q = useGetWordSet(id, { query: { enabled: id > 0, queryKey: getGetWordSetQueryKey(id) } });
  const attempt = useCreatePracticeAttempt();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState<SessionStep>('intro');
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<'idle' | 'wrong' | 'correct'>('idle');
  const [speaking, setSpeaking] = useState(false);
  const [spokenResult, setSpokenResult] = useState(false);
  const words = q.data?.words ?? [];
  const word = words[index];
  const record = (skill: 'writing' | 'speaking' | 'recall', correct: boolean, supplied?: string) => {
    if (!word) return;
    attempt.mutate({ data: { wordId: word.id, skill: Skill[skill], correct, answer: supplied ?? null } }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getGetWordSetQueryKey(id) }); qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); qc.invalidateQueries({ queryKey: getGetReviewQueryKey() }); qc.invalidateQueries({ queryKey: getGetProfileQueryKey() }); } });
  };
  const nextWord = () => { if (index >= words.length - 1) setStep('done'); else { setIndex(index + 1); setStep('intro'); setAnswer(''); setResult('idle'); setSpokenResult(false); } };
  if (q.isLoading) return <Shell hideNav><Initial label="Setting up your focus session" /></Shell>;
  if (q.isError || !q.data) return <Shell hideNav><ErrorState retry={() => q.refetch()} /></Shell>;
  if (!word && step !== 'done') return <Shell hideNav><EmptyState title="Nothing to practice yet" body="Add at least four words to start a session." action="Back to sets" href="/sets" /></Shell>;
  if (step === 'done') return <Shell hideNav><div className="min-h-[100dvh] grid place-items-center px-5"><div className="text-center max-w-sm animate-rise"><div className="h-20 w-20 rounded-[26px] bg-accent/20 text-accent-foreground grid place-items-center mx-auto"><Trophy size={32} /></div><p className="font-mono text-xs uppercase tracking-[.18em] text-primary mt-8">Session complete</p><h1 className="font-serif text-5xl mt-3">That will stick.</h1><p className="text-muted-foreground mt-4">You gave {words.length} {words.length === 1 ? 'word' : 'words'} a real place in your memory.</p><div className="flex gap-3 mt-8"><button onClick={() => { setIndex(0); setStep('intro'); }} className="flex-1 h-12 rounded-xl border border-border font-bold flex gap-2 items-center justify-center" data-testid="button-repeat-session"><RotateCcw size={16} /> Again</button><button onClick={() => navigate(`/sets/${id}`)} className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground font-bold" data-testid="button-finish-session">Done</button></div></div></div></Shell>;
  return <Shell hideNav><div className="min-h-[100dvh] max-w-2xl mx-auto px-5 py-6 md:py-10 flex flex-col"><header className="flex items-center gap-4"><button onClick={() => navigate(`/sets/${id}`)} className="h-10 w-10 grid place-items-center rounded-xl bg-secondary" data-testid="button-exit-session"><X size={18} /></button><div className="flex-1"><div className="flex justify-between text-[10px] uppercase font-mono tracking-wider text-muted-foreground mb-2"><span>{q.data.name}</span><span>{index + 1} / {words.length}</span></div><Meter value={((index + (step === 'intro' ? 0 : .65)) / words.length) * 100} /></div></header><main className="flex-1 flex flex-col justify-center py-12">{step === 'intro' && <div className="animate-rise"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">Meet this word</p><h1 className="font-serif text-6xl md:text-8xl tracking-tight mt-7">{word?.text}</h1><div className="flex items-center gap-3 mt-4 text-muted-foreground"><span className="font-mono">{word?.pronunciation}</span><button className="h-9 w-9 rounded-full bg-secondary grid place-items-center hover:bg-accent/20" data-testid="button-session-listen"><Volume2 size={16} /></button></div><div className="rounded-2xl bg-secondary/70 p-5 mt-12"><p className="text-xs uppercase font-mono tracking-wider text-muted-foreground">In context</p><p className="font-serif text-2xl mt-4 leading-snug">“{word?.sentence}”</p><p className="text-sm text-muted-foreground mt-4">{word?.meaning}</p></div><button onClick={() => setStep('writing')} className="w-full h-13 mt-6 rounded-xl bg-primary text-primary-foreground font-bold flex gap-2 items-center justify-center" data-testid="button-start-word">I’m ready <ArrowRight size={17} /></button></div>}{step === 'writing' && word && <div className="animate-rise"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">Write it back</p><h2 className="font-serif text-4xl mt-6">How would you use<br /><span className="text-primary">{word.text}</span>?</h2><p className="text-sm text-muted-foreground mt-4">Complete the sentence in your own words.</p><div className={`mt-9 rounded-2xl border-2 ${result === 'wrong' ? 'border-destructive bg-destructive/5' : result === 'correct' ? 'border-primary bg-primary/5' : 'border-border'} p-5`}><p className="font-serif text-xl">{word.sentence.split(new RegExp(`(${word.text})`, 'ig')).map((part, i) => part.toLowerCase() === word.text.toLowerCase() ? <span key={i} className="text-primary underline decoration-accent decoration-2 underline-offset-4">{answer || '_____'} </span> : part)}</p><input autoFocus value={answer} onChange={e => { setAnswer(e.target.value); setResult('idle'); }} placeholder="type the missing word" className="mt-6 w-full border-b border-border bg-transparent py-2 outline-none text-sm" data-testid="input-writing-answer" />{result === 'wrong' && <p className="text-sm text-destructive mt-3">Not quite. The word was “{word.text}”. Try again.</p>}{result === 'correct' && <p className="text-sm text-primary mt-3 flex items-center gap-2"><Check size={15} /> Exactly. You used it in context.</p>}</div><button onClick={() => { const correct = answer.trim().toLowerCase() === word.text.toLowerCase(); setResult(correct ? 'correct' : 'wrong'); record('writing', correct, answer); if (correct) setTimeout(() => setStep('speaking'), 500); }} disabled={!answer.trim() || attempt.isPending || result === 'correct'} className="w-full h-13 mt-6 rounded-xl bg-primary text-primary-foreground font-bold disabled:opacity-45" data-testid="button-check-writing">{result === 'correct' ? 'Nice work' : 'Check answer'}</button></div>}{step === 'speaking' && word && <div className="animate-rise text-center"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">Say it out loud</p><h2 className="font-serif text-4xl mt-6">Give your voice<br />a turn.</h2><p className="text-sm text-muted-foreground mt-4 max-w-xs mx-auto">Read this sentence naturally. Hold the button while you speak.</p><div className="rounded-2xl bg-secondary/70 p-6 mt-9 text-left"><p className="text-xs uppercase font-mono tracking-wider text-muted-foreground">Your prompt</p><p className="font-serif text-2xl mt-4 leading-snug">{word.sentence}</p></div><button onPointerDown={() => setSpeaking(true)} onPointerUp={() => { setSpeaking(false); setSpokenResult(true); record('speaking', true, word.sentence); }} onPointerLeave={() => setSpeaking(false)} className={`h-24 w-24 rounded-full mx-auto mt-8 grid place-items-center transition-transform ${speaking ? 'scale-110 bg-accent' : 'bg-primary'} text-primary-foreground`} data-testid="button-hold-speak" aria-label="Hold to speak"><Mic size={29} /></button><p className="text-xs text-muted-foreground mt-4">{spokenResult ? 'Practice recorded. Nice and clear.' : speaking ? 'Listening…' : 'Hold to speak'}</p><button onClick={() => setStep('recall')} disabled={!spokenResult} className="w-full h-13 mt-7 rounded-xl bg-primary text-primary-foreground font-bold disabled:opacity-40" data-testid="button-continue-speaking">Continue <ArrowRight size={16} className="inline ml-1" /></button></div>}{step === 'recall' && word && <div className="animate-rise"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">One last reach</p><h2 className="font-serif text-4xl mt-6">What does<br /><span className="text-primary">{word.text}</span> mean?</h2><div className="grid gap-2 mt-9">{[word.meaning, 'A moment that happens before breakfast', 'To move quietly through a crowded place'].sort(() => .5 - Math.random()).map((option, i) => <button key={`${option}-${i}`} onClick={() => { record('recall', option === word.meaning, option); nextWord(); }} className="text-left rounded-2xl border border-border bg-card px-5 py-4 text-sm hover:border-primary hover:bg-primary/5 transition-colors" data-testid={`button-recall-option-${i}`}>{option}</button>)}</div></div>}</main><div className="flex justify-center gap-1.5 pb-2">{['intro', 'writing', 'speaking', 'recall'].map((name, i) => <span key={name} className={`h-1.5 rounded-full transition-all ${step === name ? 'w-8 bg-primary' : i < ['intro', 'writing', 'speaking', 'recall'].indexOf(step) ? 'w-3 bg-accent' : 'w-3 bg-secondary'}`} />)}</div></div></Shell>;
}

function Router() {
  return <ErrorBoundary resetKey={location.pathname}><Switch><Route path="/" component={Home} /><Route path="/sets" component={SetsPage} /><Route path="/sets/:id" component={SetDetail} /><Route path="/words/:id" component={WordDetail} /><Route path="/add" component={AddPage} /><Route path="/review" component={ReviewPage} /><Route path="/profile" component={ProfilePage} /><Route path="/learn/:setId" component={LearnPage} /><Route component={NotFound} /></Switch></ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><Router /><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;