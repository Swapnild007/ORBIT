'use client';

import { useMemo, useState } from 'react';

type AppId = 'files' | 'orbit-ai' | 'projects' | 'notes' | 'calendar' | 'settings';
type OrbitApp = { id: AppId; name: string; glyph: string; tint: string; subtitle: string };
const apps: OrbitApp[] = [
  { id: 'files', name: 'Files', glyph: '▤', tint: 'sky', subtitle: 'Browse your workspace' },
  { id: 'orbit-ai', name: 'ORBIT AI', glyph: '✳', tint: 'violet', subtitle: 'Your personal assistant' },
  { id: 'projects', name: 'Projects', glyph: '▦', tint: 'blue', subtitle: 'Workspaces and activity' },
  { id: 'notes', name: 'Notes', glyph: '▧', tint: 'yellow', subtitle: 'Quick thoughts and drafts' },
  { id: 'calendar', name: 'Calendar', glyph: '▦', tint: 'green', subtitle: 'Your upcoming schedule' },
  { id: 'settings', name: 'Settings', glyph: '⚙', tint: 'gray', subtitle: 'Personalize ORBIT' },
];
const initialTasks = ['Review the ORBIT environment brief', 'Map the workspace flow', 'Collect interface references'];
const initialNotes = ['ORBIT should feel like a space of its own.', 'Keep navigation simple and predictable.'];

function AppIcon({ app, onClick, compact = false }: { app: OrbitApp; onClick: () => void; compact?: boolean }) {
  return <button className={`desktop-app ${compact ? 'compact' : ''}`} onClick={onClick} aria-label={`Open ${app.name}`}>
    <span className={`app-glyph ${app.tint}`}>{app.glyph}</span><span className="app-label">{app.name}</span>
  </button>;
}

export default function Page() {
  const [opened, setOpened] = useState<AppId | null>(null);
  const [startOpen, setStartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [tasks, setTasks] = useState(initialTasks.map((title, i) => ({ id: i + 1, title, done: i === 2 })));
  const [notes, setNotes] = useState(initialNotes);
  const [noteDraft, setNoteDraft] = useState('');
  const [taskDraft, setTaskDraft] = useState('');
  const [chatDraft, setChatDraft] = useState('');
  const [chat, setChat] = useState<string[]>([]);
  const filteredApps = useMemo(() => apps.filter(a => a.name.toLowerCase().includes(search.toLowerCase())), [search]);
  const current = apps.find(a => a.id === opened);

  function launch(id: AppId) { setOpened(id); setStartOpen(false); setSearchOpen(false); }
  function addTask() { if (!taskDraft.trim()) return; setTasks(old => [...old, { id: Date.now(), title: taskDraft.trim(), done: false }]); setTaskDraft(''); }
  function addNote() { if (!noteDraft.trim()) return; setNotes(old => [noteDraft.trim(), ...old]); setNoteDraft(''); }
  function sendChat() { if (!chatDraft.trim()) return; setChat(old => [...old, chatDraft.trim()]); setChatDraft(''); }

  return <main className="orbit-os">
    <div className="wallpaper-glow glow-one" /><div className="wallpaper-glow glow-two" />
    <header className="os-topline"><div className="os-brand"><span className="brand-orbit">O</span><span>ORBIT <small>PERSONAL ENVIRONMENT</small></span></div><div className="top-center">MONDAY, SEPTEMBER 28 <i>•</i> WORKSPACE</div><div className="system-tray"><span>◉</span><span>⌁</span><span>▮▮</span><span className="tray-time">10:53 AM</span></div></header>

    <section className="desktop-area" aria-label="ORBIT desktop">
      <div className="desktop-icons">
        {apps.map(app => <AppIcon key={app.id} app={app} onClick={() => launch(app.id)} />)}
      </div>
      <div className="desktop-welcome"><div className="welcome-eyebrow">YOUR SPACE. YOUR RULES.</div><h1>Good to see you, Swapnil.</h1><p>A focused place for your work, ideas, and everyday tools.</p><button className="welcome-open" onClick={() => setStartOpen(true)}>Open app launcher <span>↗</span></button></div>
      <div className="desktop-widget"><div className="widget-head"><span>YOUR DAY</span><span className="widget-date">MON · 28</span></div><div className="widget-clock">10:53<span> AM</span></div><p>Make a little room for what matters.</p><div className="widget-rule" /><div className="widget-foot"><span>{tasks.filter(t => t.done).length} of {tasks.length} tasks complete</span><button onClick={() => launch('projects')}>View tasks ↗</button></div></div>
      <div className="desktop-hint">Double click an app to open <span>•</span> All your work stays inside ORBIT</div>
    </section>

    {opened && current && <div className="app-window" role="dialog" aria-label={current.name}>
      <div className="window-titlebar"><div className="window-app-title"><span className={`window-mini-icon ${current.tint}`}>{current.glyph}</span>{current.name}</div><div className="window-controls"><button aria-label="Minimize window" onClick={() => setOpened(null)}>—</button><button aria-label="Close window" onClick={() => setOpened(null)}>×</button></div></div>
      <div className="window-content">
        {opened === 'files' && <><div className="module-heading"><div><small>ORBIT WORKSPACE</small><h2>Files</h2><p>Your saved materials, all in one place.</p></div><span className="module-chip">LOCAL DEMO</span></div><div className="file-toolbar"><button className="soft-button">＋ New folder</button><span>⌕ <input aria-label="Search files" placeholder="Search this space" /></span></div><div className="file-grid">{['Documents','Projects','Images','Shared with me'].map((name,i)=><button className="file-tile" key={name}><span className={`file-folder folder-${i}`}>▰</span><b>{name}</b><small>{['4 items','3 items','12 items','No items'][i]}</small></button>)}</div><div className="module-empty">Files and cloud connections will appear here when storage is connected.</div></>}
        {opened === 'orbit-ai' && <><div className="module-heading"><div><small>PERSONAL ASSISTANT</small><h2>ORBIT AI</h2><p>Ask, plan, and think through your next step.</p></div><span className="module-chip">DEMO MODE</span></div><div className="chat-history"><div className="assistant-bubble"><b>✳ Hello, Swapnil.</b><p>I’m your ORBIT assistant preview. I can help organize a plan or explain how this environment works. Replies here are sample interactions, not connected to a live AI model.</p></div>{chat.map((m,i)=><div className="user-bubble" key={i}>{m}</div>)}</div><form className="composer" onSubmit={e=>{e.preventDefault();sendChat();}}><input value={chatDraft} onChange={e=>setChatDraft(e.target.value)} placeholder="Message ORBIT…" aria-label="Message ORBIT" /><button type="submit" disabled={!chatDraft.trim()}>↑</button></form></>}
        {opened === 'projects' && <><div className="module-heading"><div><small>WORKSPACE</small><h2>Projects & tasks</h2><p>Keep your active work moving.</p></div><span className="module-chip">{tasks.length} TASKS</span></div><form className="inline-add" onSubmit={e=>{e.preventDefault();addTask();}}><input value={taskDraft} onChange={e=>setTaskDraft(e.target.value)} placeholder="Add a task…" aria-label="New task" /><button type="submit" disabled={!taskDraft.trim()}>Add task</button></form><div className="task-list">{tasks.map(task=><label className={`os-task ${task.done?'done':''}`} key={task.id}><input type="checkbox" checked={task.done} onChange={e=>setTasks(old=>old.map(t=>t.id===task.id?{...t,done:e.target.checked}:t))}/><span className="task-box" /><span>{task.title}</span></label>)}</div><div className="module-empty">Projects are currently sample workspace data. Persistent project storage is a later integration step.</div></>}
        {opened === 'notes' && <><div className="module-heading"><div><small>PERSONAL SPACE</small><h2>Notes</h2><p>Capture a thought before it disappears.</p></div><span className="module-chip">PRIVATE BY DESIGN</span></div><form className="note-compose" onSubmit={e=>{e.preventDefault();addNote();}}><textarea value={noteDraft} onChange={e=>setNoteDraft(e.target.value)} placeholder="Write a quick note…" aria-label="Write a note" rows={3}/><button type="submit" disabled={!noteDraft.trim()}>Save note</button></form><div className="notes-list">{notes.map((note,i)=><article className="note-card" key={i}><span>▧</span><p>{note}</p><small>Saved in this preview</small></article>)}</div></>}
        {opened === 'calendar' && <><div className="module-heading"><div><small>TIME & ROUTINE</small><h2>Calendar</h2><p>A simple view of what’s coming up.</p></div><span className="module-chip">SEPTEMBER 2026</span></div><div className="calendar-card"><div className="calendar-day"><strong>28</strong><span>MONDAY</span></div><div><b>Today</b><p>No events scheduled in this preview.</p></div></div><div className="module-empty">Calendar sync can be added later with explicit account permissions.</div></>}
        {opened === 'settings' && <><div className="module-heading"><div><small>ENVIRONMENT</small><h2>Settings</h2><p>Control how your ORBIT space behaves.</p></div></div><div className="setting-cards"><div><b>Appearance</b><p>Bright workspace theme · System-aware layout</p><span>ACTIVE</span></div><div><b>Privacy & data</b><p>Preview data stays in the current page session.</p><span>LOCAL PREVIEW</span></div><div><b>Connections</b><p>No accounts or external services connected.</p><span>NOT CONNECTED</span></div></div></>}
      </div>
    </div>}

    {startOpen && <div className="launcher-panel"><div className="launcher-search">⌕ <input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search apps and tools" aria-label="Search apps" /></div><div className="launcher-caption"><b>PINNED</b><span>All apps ↗</span></div><div className="launcher-grid">{filteredApps.map(app=><AppIcon key={app.id} app={app} compact onClick={()=>launch(app.id)} />)}</div><div className="launcher-bottom"><span className="profile-chip"><span className="profile-avatar">SD</span> Swapnil Dalvi</span><button onClick={()=>launch('settings')} aria-label="Settings">⚙</button></div></div>}

    {searchOpen && <div className="quick-search"><label>Search ORBIT<input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="Type an app name…" /></label><div>{filteredApps.map(app=><button key={app.id} onClick={()=>launch(app.id)}><span className={`window-mini-icon ${app.tint}`}>{app.glyph}</span>{app.name}<span>↵</span></button>)}</div></div>}

    <nav className="os-taskbar" aria-label="ORBIT taskbar"><button className={`start-button ${startOpen?'pressed':''}`} onClick={()=>{setStartOpen(v=>!v);setSearchOpen(false);}} aria-label="Open app launcher"><span className="orbit-mark-small">O</span></button><button className="taskbar-search" onClick={()=>{setSearchOpen(v=>!v);setStartOpen(false);}}>⌕ <span>Search</span></button><div className="taskbar-pins">{apps.slice(0,5).map(app=><button key={app.id} className={`taskbar-pin ${opened===app.id?'running':''}`} onClick={()=>launch(app.id)} aria-label={app.name}><span className={`taskbar-glyph ${app.tint}`}>{app.glyph}</span></button>)}</div><div className="taskbar-tray"><span>⌃</span><span>◉</span><span className="taskbar-clock">10:53<br/><small>28/09/2026</small></span><button className="exit-button" onClick={()=>{setOpened(null);setStartOpen(false);setSearchOpen(false);}}>Exit ORBIT <span>↗</span></button></div></nav>
    <div className="mobile-exit"><button onClick={()=>{setOpened(null);setStartOpen(false);setSearchOpen(false);}}>‹ <span>Exit ORBIT</span></button><span>ORBIT ENVIRONMENT</span><button onClick={()=>setStartOpen(v=>!v)} aria-label="Open app launcher">⊞</button></div>
  </main>;
}
