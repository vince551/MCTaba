import { useCallback, useEffect, useMemo, useState } from 'react';
import AuthPortal from './AuthPortal.jsx';
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, Bell, BookMarked, BookOpen,
  CalendarDays, Check, ChevronDown, CircleHelp, Clock3, Command, Download,
  Ellipsis, FileBarChart, Filter, LayoutDashboard, Menu, Plus,
  Search, Settings2, ShieldCheck, Sparkles, Users, X, ArrowLeftRight,
  CircleAlert, CheckCircle2, Bookmark, Mail, CreditCard, ScanLine
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { apiRequest, getAuthToken, normalizeBook, normalizeUser, setAuthToken } from './api.js';

const initialBooks = [
  { id: 'BK-001', title: 'Things Fall Apart', author: 'Chinua Achebe', category: 'Literature', isbn: '9780385474542', copies: 12, available: 8, status: 'Available', color: 'sage' },
  { id: 'BK-002', title: 'Atomic Habits', author: 'James Clear', category: 'Personal development', isbn: '9780735211292', copies: 8, available: 3, status: 'Low stock', color: 'peach' },
  { id: 'BK-003', title: 'A Brief History of Time', author: 'Stephen Hawking', category: 'Science', isbn: '9780553380163', copies: 6, available: 4, status: 'Available', color: 'lavender' },
  { id: 'BK-004', title: 'The River and the Source', author: 'Margaret Ogola', category: 'Literature', isbn: '9789966467033', copies: 10, available: 0, status: 'All borrowed', color: 'blue' },
  { id: 'BK-005', title: 'The Psychology of Money', author: 'Morgan Housel', category: 'Finance', isbn: '9780857197689', copies: 5, available: 2, status: 'Available', color: 'yellow' },
];

const initialMembers = [
  { name: 'Amara Wanjiku', initials: 'AW', id: 'MB-0241', type: 'Student', borrowed: 3, status: 'Active', color: 'sage' },
  { name: 'Brian Otieno', initials: 'BO', id: 'MB-0240', type: 'Staff', borrowed: 1, status: 'Active', color: 'blue' },
  { name: 'Faith Njeri', initials: 'FN', id: 'MB-0239', type: 'Student', borrowed: 2, status: 'Active', color: 'peach' },
  { name: 'Kevin Mwangi', initials: 'KM', id: 'MB-0238', type: 'Community', borrowed: 0, status: 'Pending', color: 'lavender' },
];

const initialLoans = [
  { book: 'The River and the Source', member: 'Amara Wanjiku', initials: 'AW', due: 'Today, 4:00 PM', state: 'Due today' },
  { book: 'Atomic Habits', member: 'Brian Otieno', initials: 'BO', due: 'Tomorrow', state: 'On track' },
  { book: 'Things Fall Apart', member: 'Faith Njeri', initials: 'FN', due: 'Oct 25, 2026', state: 'On track' },
  { book: 'The Psychology of Money', member: 'Kevin Mwangi', initials: 'KM', due: 'Oct 19, 2026', state: 'Overdue' },
];

const weeklyActivity = [
  { day: 'Mon', issued: 18, returned: 12 },
  { day: 'Tue', issued: 24, returned: 19 },
  { day: 'Wed', issued: 16, returned: 22 },
  { day: 'Thu', issued: 31, returned: 18 },
  { day: 'Fri', issued: 26, returned: 24 },
  { day: 'Sat', issued: 14, returned: 11 },
  { day: 'Sun', issued: 8, returned: 6 },
];

const navGroups = [
  { label: 'WORKSPACE', items: [
    { id: 'Overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'Inventory', label: 'Book inventory', icon: BookOpen, count: '248' },
    { id: 'Circulation', label: 'Circulation', icon: ArrowLeftRight, count: '18' },
    { id: 'Members', label: 'Members', icon: Users },
  ]},
  { label: 'MANAGE', items: [
    { id: 'Reports', label: 'Reports & insights', icon: FileBarChart },
    { id: 'Notifications', label: 'Notifications', icon: Bell, count: '3' },
    { id: 'Subscriptions', label: 'Subscription & billing', icon: CreditCard },
    { id: 'Settings', label: 'Library settings', icon: Settings2 },
  ]},
];

function Badge({ children, tone = 'neutral' }) {
  return <span className={`badge badge--${tone}`}><span className="badge-dot" />{children}</span>;
}

function SectionHeading({ eyebrow, title, subtitle, action }) {
  return <div className="section-heading">
    <div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
    {action}
  </div>;
}

function Dashboard({ user, library, onSwitchLibrary }) {
  const [activePage, setActivePage] = useState('Overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [books, setBooks] = useState([]);
  const [showAddBook, setShowAddBook] = useState(false);
  const [toast, setToast] = useState('');
  const [newBook, setNewBook] = useState({ title: '', author: '', category: 'Literature', isbn: '', copies: '1' });
  const [range, setRange] = useState('This week');

  useEffect(() => {
    let cancelled = false;
    async function loadBooks() {
      if (!library?.id) return;
      try {
        const result = await apiRequest(`/api/libraries/${library.id}/books`);
        if (!cancelled) setBooks((result.data || []).map(normalizeBook));
      } catch (error) {
        if (!cancelled) setToast(error.message || 'Could not load books from the Mctaba API.');
      }
    }
    loadBooks();
    return () => { cancelled = true; };
  }, [library?.id]);

  const filteredBooks = useMemo(() => books.filter(book =>
    [book.title, book.author, book.category, book.isbn].some(value => value.toLowerCase().includes(query.toLowerCase()))
  ), [books, query]);

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3200);
  };

  const handleAddBook = async (event) => {
    event.preventDefault();
    if (!newBook.title.trim() || !newBook.author.trim()) return;
    const copies = Math.max(1, Number(newBook.copies) || 1);
    try {
      await apiRequest(`/api/libraries/${library.id}/books`, {
        method: 'POST',
        body: {
          title: newBook.title.trim(),
          author: newBook.author.trim(),
          category: newBook.category,
          isbn: newBook.isbn.trim() || null,
          copies,
        },
      });
      const refreshed = await apiRequest(`/api/libraries/${library.id}/books`);
      setBooks((refreshed.data || []).map(normalizeBook));
    } catch (error) {
      setToast(error.message || 'Could not save the book to Firestore. Please try again.');
      return;
    }
    setNewBook({ title: '', author: '', category: 'Literature', isbn: '', copies: '1' });
    setShowAddBook(false);
    setActivePage('Inventory');
    notify('Book and physical copies saved to Mctaba.');
  };

  const pageSubtitle = {
    Overview: 'Here’s what’s happening in your library today.',
    Inventory: 'Keep your collection organized and easy to find.',
    Circulation: 'Track checkouts, returns and upcoming due dates.',
    Members: 'Manage your readers and their library activity.',
    Reports: 'Understand how your library is being used.',
    Notifications: 'Keep up with reminders and important updates.',
    Settings: 'Manage your library profile and workspace preferences.',
    Subscriptions: 'Manage your plan, renewal cycle and subscription status.',
  }[activePage];

  const exportBooks = () => {
    const rows = [['ID', 'Title', 'Author', 'Category', 'ISBN', 'Copies', 'Available'], ...filteredBooks.map(b => [b.id, b.title, b.author, b.category, b.isbn, b.copies, b.available])];
    const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mctaba-book-inventory.csv';
    link.click();
    URL.revokeObjectURL(url);
    notify('Inventory export downloaded.');
  };

  return <div className="app-shell">
    {mobileNavOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
    <aside className={`sidebar ${mobileNavOpen ? 'sidebar--open' : ''}`}>
      <div className="brand-lockup">
        <img className="brand-mark" src="/icons/mctaba-logo.jpg" alt="Mctaba logo" />
        <div className="brand-word">mctaba<span>.</span><small>LIBRARY WORKSPACE</small></div>
        <button className="icon-button sidebar-close" onClick={() => setMobileNavOpen(false)} aria-label="Close menu"><X size={18}/></button>
      </div>

      <button className="workspace-switcher" onClick={onSwitchLibrary}>
        <div className="workspace-avatar">G</div>
        <div className="workspace-info"><strong>{library.name}</strong><span>{library.location || (library.type ? library.type.charAt(0).toUpperCase() + library.type.slice(1) + ' library' : 'Library workspace')}</span></div>
        <ChevronDown size={16} className="muted-icon"/>
      </button>

      <div className="nav-scroll">
        {navGroups.map(group => <div className="nav-group" key={group.label}>
          <div className="nav-label">{group.label}</div>
          {group.items.map(item => {
            const Icon = item.icon;
            return <button key={item.id} className={`nav-item ${activePage === item.id ? 'nav-item--active' : ''}`} onClick={() => { setActivePage(item.id); setMobileNavOpen(false); }}>
              <Icon size={18} strokeWidth={1.8}/><span>{item.label}</span>{item.count && <span className="nav-count">{item.count}</span>}
            </button>;
          })}
        </div>)}
      </div>

      <div className="sidebar-bottom">
        <div className="help-card">
          <div className="help-icon"><Sparkles size={16}/></div>
          <strong>Your library, in sync.</strong>
          <p>Everything your team needs to keep knowledge moving.</p>
          <button onClick={() => notify('Help centre is coming soon.')}>Explore Mctaba <ArrowRight size={14}/></button>
        </div>
        <button className="profile-button" onClick={onSwitchLibrary}>
          <div className="profile-avatar">{(user.displayName || user.email || 'L').slice(0, 2).toUpperCase()}</div><div className="profile-meta"><strong>{user.displayName || user.email}</strong><span>Library administrator · switch workspace</span></div><Ellipsis size={19} className="muted-icon"/>
        </button>
      </div>
    </aside>

    <main className="main-area">
      <header className="topbar">
        <div className="topbar-left">
          <button className="icon-button mobile-menu" aria-label="Open menu" onClick={() => setMobileNavOpen(true)}><Menu size={21}/></button>
          <div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>{activePage}</strong></div>
        </div>
        <div className="topbar-actions">
          <div className="global-search"><Search size={16}/><input aria-label="Search books" placeholder="Search anything..." value={query} onChange={e => { setQuery(e.target.value); if (e.target.value) setActivePage('Inventory'); }}/><kbd><Command size={11}/> K</kbd></div>
          <button className="icon-button notification-button" aria-label="Notifications" onClick={() => setActivePage('Notifications')}><Bell size={19}/><i/></button>
          <div className="topbar-divider"/>
          <div className="date-chip"><CalendarDays size={15}/><span>Oct 22, 2026</span></div>
        </div>
      </header>

      <div className="page-content">
        <div className="welcome-row">
          <div className="welcome-copy"><div className="welcome-kicker"><span className="live-dot"/> THURSDAY, OCTOBER 22, 2026</div><h1>{activePage === 'Overview' ? <>A good day to <em>grow minds.</em></> : activePage}</h1><p>{pageSubtitle}</p></div>
          <div className="welcome-actions">
            <button className="button button--secondary" onClick={exportBooks}><Download size={16}/> Export</button>
            <button className="button button--primary" onClick={() => setShowAddBook(true)}><Plus size={17}/> Add a book</button>
          </div>
        </div>

        <div className="demo-banner"><div className="demo-banner-icon"><ShieldCheck size={17}/></div><div><strong>Workspace preview</strong><span>Book inventory is connected to the Laravel API. Reports, notifications, billing and settings are still being migrated.</span></div><button onClick={() => notify('Inventory is connected to the Laravel API. Other modules are being migrated.')} >Setup guide <ArrowRight size={14}/></button></div>

        {activePage === 'Overview' && <Overview books={books} setActivePage={setActivePage} notify={notify} range={range} setRange={setRange}/>}
        {activePage === 'Inventory' && <Inventory books={filteredBooks} query={query} setQuery={setQuery} onAdd={() => setShowAddBook(true)} onExport={exportBooks} notify={notify}/>}
        {activePage === 'Circulation' && <Circulation notify={notify} library={library} user={user} />}
        {activePage === 'Members' && <Members notify={notify} library={library} user={user} />}
        {activePage === 'Reports' && <Reports range={range} setRange={setRange} notify={notify}/>}
        {activePage === 'Notifications' && <Notifications notify={notify}/>}
        {activePage === 'Settings' && <Settings notify={notify}/>}
        {activePage === 'Subscriptions' && <Subscriptions notify={notify} library={library} />}
      </div>
      <footer className="app-footer"><span>© 2026 Mctaba</span><span><span className="footer-status"/> All systems previewing normally</span><span>Made for the love of libraries <BookOpen size={13}/></span></footer>
    </main>

    {showAddBook && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setShowAddBook(false); }}>
      <form className="modal-card" onSubmit={handleAddBook}>
        <div className="modal-heading"><div><span className="eyebrow">INVENTORY</span><h2>Add a new book</h2><p>Add a title to the {library.name} catalogue.</p></div><button type="button" className="icon-button" onClick={() => setShowAddBook(false)} aria-label="Close dialog"><X size={19}/></button></div>
        <label>Book title <input required autoFocus value={newBook.title} onChange={e => setNewBook({ ...newBook, title: e.target.value })} placeholder="e.g. The River and the Source"/></label>
        <label>Author <input required value={newBook.author} onChange={e => setNewBook({ ...newBook, author: e.target.value })} placeholder="Author's full name"/></label>
        <div className="form-row"><label>Category<select value={newBook.category} onChange={e => setNewBook({ ...newBook, category: e.target.value })}><option>Literature</option><option>Science</option><option>History</option><option>Technology</option><option>Finance</option><option>Personal development</option><option>Reference</option></select></label><label>Number of copies<input type="number" min="1" max="300" value={newBook.copies} onChange={e => setNewBook({ ...newBook, copies: e.target.value })}/></label></div>
        <label>ISBN <span className="optional-label">OPTIONAL</span><input value={newBook.isbn} onChange={e => setNewBook({ ...newBook, isbn: e.target.value })} placeholder="ISBN-13"/></label>
        <div className="modal-actions"><button type="button" className="button button--secondary" onClick={() => setShowAddBook(false)}>Cancel</button><button className="button button--primary" type="submit"><Plus size={16}/> Add to inventory</button></div>
      </form>
    </div>}
    {toast && <div className="toast"><CheckCircle2 size={18}/>{toast}<button aria-label="Dismiss" onClick={() => setToast('')}><X size={15}/></button></div>}
  </div>;
}

function Overview({ books, setActivePage, notify, range, setRange }) {
  const stats = [
    { label: 'Books in collection', value: '2,480', delta: '+8.2%', detail: 'vs. last month', icon: BookOpen, color: 'green', trend: 'up' },
    { label: 'Active members', value: '342', delta: '+12.5%', detail: 'vs. last month', icon: Users, color: 'purple', trend: 'up' },
    { label: 'Currently on loan', value: '186', delta: '+4.3%', detail: 'vs. last week', icon: ArrowLeftRight, color: 'orange', trend: 'up' },
    { label: 'Overdue returns', value: '12', delta: '3 need attention', detail: 'past due date', icon: Clock3, color: 'red', trend: 'down' },
  ];
  return <>
    <div className="stats-grid">{stats.map((stat, i) => { const Icon = stat.icon; return <article className="stat-card" key={stat.label}><div className="stat-top"><span>{stat.label}</span><div className={`stat-icon stat-icon--${stat.color}`}><Icon size={18}/></div></div><div className="stat-value">{stat.value}</div><div className="stat-bottom">{i === 3 ? <span className="stat-alert"><CircleAlert size={13}/>{stat.delta}</span> : <span className="stat-positive"><ArrowUpRight size={14}/>{stat.delta}</span>}<span className="stat-detail">{stat.detail}</span></div><div className={`stat-sparkline stat-sparkline--${stat.color}`}><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/></div></article>; })}</div>

    <div className="dashboard-grid">
      <section className="panel activity-panel">
        <div className="panel-heading"><div><h3>Circulation activity</h3><p>Books issued and returned over time</p></div><select className="select-compact" value={range} onChange={e => setRange(e.target.value)}><option>This week</option><option>This month</option><option>This year</option></select></div>
        <div className="chart-legend"><span><i className="legend-dot legend-dot--issued"/> Issued</span><span><i className="legend-dot legend-dot--returned"/> Returned</span><span className="chart-total"><strong>137</strong><small>total this week</small></span></div>
        <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={weeklyActivity} barGap={5} margin={{ top: 12, right: 4, left: -22, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0ed"/><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#8b948e', fontSize: 12 }} dy={10}/><YAxis axisLine={false} tickLine={false} tick={{ fill: '#8b948e', fontSize: 11 }} ticks={[0,10,20,30,40]}/><Tooltip cursor={{ fill: '#f5f7f5' }} contentStyle={{ border: '1px solid #e6eae6', borderRadius: 12, fontSize: 12 }}/><Bar dataKey="issued" name="Issued" fill="#245c4b" radius={[5,5,0,0]} maxBarSize={18}/><Bar dataKey="returned" name="Returned" fill="#b8d7c9" radius={[5,5,0,0]} maxBarSize={18}/></BarChart></ResponsiveContainer></div>
      </section>

      <section className="panel attention-panel">
        <div className="panel-heading"><div><h3>Needs your attention <span className="attention-count">3</span></h3><p>A few things to keep moving</p></div><button className="text-link" onClick={() => setActivePage('Circulation')}>View all <ArrowRight size={14}/></button></div>
        <div className="attention-list">
          <div className="attention-item"><div className="attention-symbol attention-symbol--red"><Clock3 size={17}/></div><div className="attention-copy"><strong>12 overdue books</strong><span>Some books are past their due date.</span><button onClick={() => setActivePage('Circulation')}>Review overdue loans <ArrowRight size={13}/></button></div></div>
          <div className="attention-item"><div className="attention-symbol attention-symbol--orange"><BookMarked size={17}/></div><div className="attention-copy"><strong>4 titles running low</strong><span>Consider reviewing these collections.</span><button onClick={() => setActivePage('Inventory')}>Check inventory <ArrowRight size={13}/></button></div></div>
          <div className="attention-item"><div className="attention-symbol attention-symbol--purple"><Users size={17}/></div><div className="attention-copy"><strong>3 new member requests</strong><span>New readers are waiting for approval.</span><button onClick={() => setActivePage('Members')}>Review requests <ArrowRight size={13}/></button></div></div>
        </div>
      </section>
    </div>

    <section className="panel books-panel">
      <div className="panel-heading"><div><h3>Popular in your library</h3><p>Titles readers are checking out most</p></div><button className="text-link" onClick={() => setActivePage('Inventory')}>View inventory <ArrowRight size={14}/></button></div>
      <div className="popular-books">{books.slice(0, 4).map((book, i) => <div className="popular-book" key={book.id}><div className={`book-cover book-cover--${book.color}`}><span>{book.title.split(' ').slice(0,3).map(w => w[0]).join('')}</span><small>{book.category}</small></div><div className="popular-book-info"><strong>{book.title}</strong><span>{book.author}</span><div className="book-meta"><span>{book.available} available</span><span className="book-meta-separator">·</span><span>{book.copies} copies</span></div></div><button className="icon-button book-more" aria-label={`More options for ${book.title}`} onClick={() => notify(`Selected ${book.title}. Book actions will be available with live data.`)}><Ellipsis size={18}/></button></div>)}</div>
    </section>

    <div className="bottom-grid">
      <section className="panel mini-panel"><div className="panel-heading"><div><h3>Quick actions</h3><p>Common tasks, right at hand</p></div><Sparkles size={18} className="muted-icon"/></div><div className="quick-actions"><button onClick={() => notify('Use “Add a book” to add a title to the catalogue.')}><span className="quick-icon quick-icon--green"><Plus size={17}/></span><span><strong>Add new book</strong><small>Expand your collection</small></span><ArrowRight size={15}/></button><button onClick={() => setActivePage('Members')}><span className="quick-icon quick-icon--purple"><Users size={17}/></span><span><strong>Register a member</strong><small>Welcome a new reader</small></span><ArrowRight size={15}/></button><button onClick={() => setActivePage('Circulation')}><span className="quick-icon quick-icon--orange"><ArrowLeftRight size={17}/></span><span><strong>Issue or return</strong><small>Manage book movement</small></span><ArrowRight size={15}/></button></div></section>
      <section className="quote-card"><div className="quote-mark">“</div><blockquote>A library is not a luxury but one of the necessities of life.</blockquote><div className="quote-author"><span/> Henry Ward Beecher</div><div className="quote-decoration"><BookOpen size={94}/></div></section>
    </div>
  </>;
}

function Inventory({ books, query, setQuery, onAdd, onExport, notify }) {
  return <><div className="inventory-toolbar"><div className="inventory-search"><Search size={17}/><input placeholder="Search title, author, ISBN..." value={query} onChange={e => setQuery(e.target.value)}/><kbd>/</kbd></div><button className="button button--secondary" onClick={() => notify('Category filters will be connected to the live catalogue.')}><Filter size={15}/> Filters</button><button className="button button--secondary" onClick={onExport}><Download size={15}/> Export</button><button className="button button--primary" onClick={onAdd}><Plus size={16}/> Add a book</button></div><section className="panel table-panel"><div className="panel-heading"><div><h3>All books <span className="subtle-count">{books.length}</span></h3><p>Manage titles in your collection</p></div><button className="icon-button" aria-label="More inventory actions" onClick={() => notify('More inventory actions are coming soon.')}><Ellipsis size={20}/></button></div><div className="table-scroll"><table><thead><tr><th>BOOK</th><th>ISBN</th><th>CATEGORY</th><th>COPIES</th><th>AVAILABILITY</th><th/></tr></thead><tbody>{books.map(book => <tr key={book.id}><td><div className="table-book"><div className={`table-book-cover book-cover--${book.color}`}><BookOpen size={17}/></div><div><strong>{book.title}</strong><span>{book.author}</span></div></div></td><td className="isbn-cell">{book.isbn}</td><td><span className="category-pill">{book.category}</span></td><td><strong>{book.copies}</strong></td><td><div className="availability-cell"><span className="availability-track"><i style={{ width: `${book.copies ? (book.available / book.copies) * 100 : 0}%` }}/></span><span>{book.available}/{book.copies}</span></div></td><td><button className="icon-button" aria-label={`Book actions for ${book.title}`} onClick={() => notify(`Book actions for “${book.title}” will be enabled with live data.`)}><Ellipsis size={18}/></button></td></tr>)}</tbody></table>{books.length === 0 && <div className="empty-state"><BookOpen size={28}/><strong>No books found</strong><span>Try a different search or add a new book.</span></div>}</div><div className="table-footer"><span>Showing {books.length} {books.length === 1 ? 'title' : 'titles'}</span><span>Live Mctaba inventory</span></div></section></>;
}

function Circulation({ notify, library, user }) {
  const [books, setBooks] = useState([]);
  const [readers, setReaders] = useState([]);
  const [copies, setCopies] = useState([]);
  const [loans, setLoans] = useState([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedCopy, setSelectedCopy] = useState('');
  const [selectedReader, setSelectedReader] = useState('');
  const [dueAt, setDueAt] = useState(() => new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 16));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadCirculation() {
      if (!library?.id) return;
      try {
        const [bookResult, readerResult, copyResult, loanResult] = await Promise.all([
          apiRequest(`/api/libraries/${library.id}/books`),
          apiRequest(`/api/libraries/${library.id}/readers`),
          apiRequest(`/api/libraries/${library.id}/copies`),
          apiRequest(`/api/libraries/${library.id}/loans`),
        ]);
        if (cancelled) return;
        setBooks((bookResult.data || []).map(normalizeBook));
        setReaders((readerResult.data || []).map((reader) => ({
          ...reader, id: String(reader.id), type: reader.type || 'community',
          status: String(reader.status || 'active').toLowerCase(),
        })));
        setCopies((copyResult.data || []).map((copy) => ({
          ...copy, id: String(copy.id), bookId: String(copy.book_id), copyNumber: copy.barcode,
        })));
        setLoans((loanResult.data || []).map((loan) => ({
          ...loan, id: String(loan.id), bookId: String(loan.copy?.book?.id || ''),
          readerId: String(loan.reader_id), dueAt: loan.due_at ? { toDate: () => new Date(loan.due_at) } : null,
          reader: loan.reader, book: loan.copy?.book,
        })));
      } catch (error) {
        if (!cancelled) notify(error.message || 'Could not load circulation records from the Mctaba API.');
      }
    }
    loadCirculation();
    return () => { cancelled = true; };
  }, [library?.id]);

  const activeLoans = loans.filter((loan) => loan.status === 'active');
  const availableCopies = copies.filter((copy) => copy.status === 'available');
  const bookById = new Map(books.map((book) => [book.id, book]));
  const readerById = new Map(readers.map((reader) => [reader.id, reader]));
  const dueToday = activeLoans.filter((loan) => loan.dueAt?.toDate && loan.dueAt.toDate().toDateString() === new Date().toDateString()).length;
  const overdue = activeLoans.filter((loan) => loan.dueAt?.toDate && loan.dueAt.toDate().getTime() < Date.now()).length;

  const checkout = async (event) => {
    event.preventDefault();
    if (!selectedCopy || !selectedReader || !dueAt) {
      notify('Choose an available copy, a reader and a due date.');
      return;
    }
    setSaving(true);
    try {
      const result = await apiRequest(`/api/libraries/${library.id}/loans/checkout`, {
        method: 'POST',
        body: { copy_id: Number(selectedCopy), reader_id: Number(selectedReader), due_at: new Date(dueAt).toISOString() },
      });
      const loan = result.data;
      setLoans((current) => [{
        ...loan,
        id: String(loan.id),
        bookId: String(loan.copy?.book?.id || ''),
        readerId: String(loan.reader_id),
        dueAt: loan.due_at ? { toDate: () => new Date(loan.due_at) } : null,
        reader: loan.reader,
        book: loan.copy?.book,
      }, ...current]);
      setCopies((current) => current.map((copy) => String(copy.id) === String(selectedCopy) ? { ...copy, status: 'borrowed' } : copy));
      setShowCheckout(false);
      setSelectedCopy('');
      setSelectedReader('');
      notify('Book checked out successfully.');
      setShowCheckout(false);
      setSelectedCopy('');
      setSelectedReader('');
      notify('Book checked out successfully.');
    } catch (error) {
      notify(error.message || 'Checkout failed. Verify that the reader is active and the copy is available.');
    } finally {
      setSaving(false);
    }
  };

  const returnLoan = async (loanId) => {
    setSaving(true);
    try {
      await apiRequest(`/api/libraries/${library.id}/loans/${loanId}/return`, { method: 'POST' });
      const returnedLoan = loans.find((loan) => String(loan.id) === String(loanId));
      setLoans((current) => current.map((loan) => String(loan.id) === String(loanId)
        ? { ...loan, status: 'returned', returned_at: new Date().toISOString() }
        : loan));
      if (returnedLoan?.copy_id) {
        setCopies((current) => current.map((copy) => String(copy.id) === String(returnedLoan.copy_id) ? { ...copy, status: 'available' } : copy));
      }
      notify('Book returned and its physical copy released.');
    } catch (error) {
      notify(error.message || 'Could not process this return.');
    } finally {
      setSaving(false);
    }
  };

  return <>
    <div className="stats-grid stats-grid--three">
      <article className="stat-card"><div className="stat-top"><span>Active loans</span><div className="stat-icon stat-icon--green"><ArrowLeftRight size={18}/></div></div><div className="stat-value">{activeLoans.length}</div><div className="stat-bottom"><span className="stat-detail">Currently borrowed</span></div></article>
      <article className="stat-card"><div className="stat-top"><span>Due today</span><div className="stat-icon stat-icon--orange"><Clock3 size={18}/></div></div><div className="stat-value">{dueToday}</div><div className="stat-bottom"><span className="stat-detail">Return reminders needed</span></div></article>
      <article className="stat-card"><div className="stat-top"><span>Overdue</span><div className="stat-icon stat-icon--red"><CircleAlert size={18}/></div></div><div className="stat-value">{overdue}</div><div className="stat-bottom"><span className="stat-alert">Requires follow-up</span></div></article>
    </div>
    {showCheckout && <form className="panel circulation-checkout" onSubmit={checkout}>
      <div className="panel-heading"><div><h3>New checkout</h3><p>Issue an available physical copy to an active reader.</p></div><button className="icon-button" type="button" aria-label="Close checkout form" onClick={() => setShowCheckout(false)}><X size={18}/></button></div>
      <div className="circulation-form-grid">
        <label>Available copy<select required value={selectedCopy} onChange={(event) => setSelectedCopy(event.target.value)}><option value="">Choose a book copy</option>{availableCopies.map((copy) => <option key={copy.id} value={copy.id}>{bookById.get(copy.bookId)?.title || 'Unknown title'} · Copy {copy.copyNumber || '—'}</option>)}</select></label>
        <label>Reader<select required value={selectedReader} onChange={(event) => setSelectedReader(event.target.value)}><option value="">Choose a reader</option>{readers.filter((reader) => reader.status === 'active').map((reader) => <option key={reader.id} value={reader.id}>{reader.name}</option>)}</select></label>
        <label>Due date and time<input required type="datetime-local" value={dueAt} min={new Date().toISOString().slice(0, 16)} onChange={(event) => setDueAt(event.target.value)}/></label>
      </div>
      {availableCopies.length === 0 && <p className="circulation-help">No copies are currently available. Add a book with copies in Inventory first.</p>}
      {readers.filter((reader) => reader.status === 'active').length === 0 && <p className="circulation-help">Register an active reader in Members before checking out books.</p>}
      <div className="modal-actions"><button className="button button--secondary" type="button" onClick={() => setShowCheckout(false)}>Cancel</button><button className="button button--primary" type="submit" disabled={saving || !availableCopies.length || !readers.some((reader) => reader.status === 'active')}><ScanLine size={16}/>{saving ? 'Processing…' : 'Confirm checkout'}</button></div>
    </form>}
    <section className="panel table-panel">
      <div className="panel-heading"><div><h3>Current loans <span className="subtle-count">{activeLoans.length}</span></h3><p>Live circulation records for {library.name}</p></div><button className="button button--primary" onClick={() => setShowCheckout((open) => !open)}><ScanLine size={16}/> New checkout</button></div>
      <div className="table-scroll"><table><thead><tr><th>BOOK & MEMBER</th><th>DUE DATE</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>
        {activeLoans.map((loan, index) => {
          const book = bookById.get(loan.bookId);
          const reader = readerById.get(loan.readerId);
          const due = loan.dueAt?.toDate ? loan.dueAt.toDate() : null;
          const isOverdue = due && due.getTime() < Date.now();
          const isDueToday = due && due.toDateString() === new Date().toDateString();
          return <tr key={loan.id}><td><div className="loan-cell"><div className={`member-avatar member-avatar--${['sage', 'blue', 'peach', 'lavender'][index % 4]}`}>{(reader?.name || 'R').split(/\s+/).slice(0,2).map((part) => part[0]).join('').toUpperCase()}</div><div><strong>{book?.title || 'Book title unavailable'}</strong><span>{reader?.name || 'Reader unavailable'}</span></div></div></td><td>{due ? due.toLocaleString() : 'No due date'}</td><td><Badge tone={isOverdue ? 'danger' : isDueToday ? 'warning' : 'success'}>{isOverdue ? 'Overdue' : isDueToday ? 'Due today' : 'On loan'}</Badge></td><td><button className="text-link" disabled={saving} onClick={() => returnLoan(loan.id)}>Process return <ArrowRight size={13}/></button></td></tr>;
        })}
      </tbody></table>{activeLoans.length === 0 && <div className="empty-state"><ArrowLeftRight size={28}/><strong>No active loans</strong><span>Use New checkout to issue an available copy to a registered reader.</span></div>}</div>
      <div className="table-footer"><span>{activeLoans.length} active {activeLoans.length === 1 ? 'loan' : 'loans'}</span><span>Live Laravel API transactions</span></div>
    </section>
  </>;
}

function Members({ notify, library, user }) {
  const [members, setMembers] = useState([]);
  const [query, setQuery] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', email: '', type: 'Student' });

  useEffect(() => {
    let cancelled = false;
    async function loadMembers() {
      if (!library?.id) return;
      try {
        const result = await apiRequest(`/api/libraries/${library.id}/readers`);
        if (!cancelled) setMembers((result.data || []).map((member) => ({ ...member, id: String(member.id), type: member.type || 'community' })));
      } catch (error) {
        if (!cancelled) notify(error.message || 'Could not load members from the Mctaba API.');
      }
    }
    loadMembers();
    return () => { cancelled = true; };
  }, [library?.id]);

  const filteredMembers = members.filter((member) =>
    [member.name || '', member.email || '', member.type || '', member.id || '']
      .some((value) => value.toLowerCase().includes(query.toLowerCase()))
  );

  const handleAddMember = async (event) => {
    event.preventDefault();
    if (!newMember.name.trim()) return;
    setSaving(true);
    try {
      await apiRequest(`/api/libraries/${library.id}/readers`, {
        method: 'POST',
        body: {
          name: newMember.name.trim(),
          email: newMember.email.trim() || null,
          type: newMember.type.toLowerCase(),
        },
      });
      const refreshed = await apiRequest(`/api/libraries/${library.id}/readers`);
      setMembers((refreshed.data || []).map((member) => ({ ...member, id: String(member.id), type: member.type || 'community' })));
      setNewMember({ name: '', email: '', type: 'Student' });
      setShowAddMember(false);
      notify('Member registered successfully.');
    } catch (error) {
      notify(error.code === 'permission-denied' ? 'You do not have permission to add members.' : 'Could not save this member. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return <>
    <div className="inventory-toolbar">
      <div className="inventory-search"><Search size={17}/><input placeholder="Search members..." value={query} onChange={(e) => setQuery(e.target.value)}/><kbd>/</kbd></div>
      <button className="button button--secondary" onClick={() => {
        const rows = [['Name', 'Email', 'Type', 'Status'], ...filteredMembers.map((member) => [member.name, member.email || '', member.type, member.status])];
        const csv = rows.map((row) => row.map((value) => `"${String(value || '').replaceAll('"', '""')}"`).join(',')).join('\n');
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
        const link = document.createElement('a'); link.href = url; link.download = 'mctaba-members.csv'; link.click(); URL.revokeObjectURL(url);
      }}><Download size={15}/> Export</button>
      <button className="button button--primary" onClick={() => setShowAddMember(true)}><Plus size={16}/> Add member</button>
    </div>
    <section className="panel table-panel">
      <div className="panel-heading"><div><h3>Library members <span className="subtle-count">{members.length}</span></h3><p>Readers registered with {library.name}</p></div><Badge tone="success">Live Firestore</Badge></div>
      <div className="table-scroll"><table><thead><tr><th>MEMBER</th><th>MEMBER ID</th><th>TYPE</th><th>ACTIVE LOANS</th><th>STATUS</th></tr></thead><tbody>
        {filteredMembers.map((member, index) => {
          const initials = (member.name || 'Reader').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
          const status = member.status === 'active';
          return <tr key={member.id}><td><div className="loan-cell"><div className={`member-avatar member-avatar--${['sage', 'blue', 'peach', 'lavender'][index % 4]}`}>{initials}</div><div className="member-table-name"><strong>{member.name}</strong><span>{member.email || 'No email provided'}</span></div></div></td><td className="isbn-cell">MB-{member.id.slice(0, 6).toUpperCase()}</td><td>{member.type || 'Community'}</td><td>—</td><td><Badge tone={status ? 'success' : 'warning'}>{status ? 'Active' : 'Inactive'}</Badge></td></tr>;
        })}
      </tbody></table>{filteredMembers.length === 0 && <div className="empty-state"><Users size={28}/><strong>{query ? 'No matching members' : 'No members yet'}</strong><span>{query ? 'Try another name or email.' : 'Register your first reader to start building your member directory.'}</span></div>}</div>
      <div className="table-footer"><span>Showing {filteredMembers.length} {filteredMembers.length === 1 ? 'member' : 'members'}</span><span>Live Mctaba API records</span></div>
    </section>
    {showAddMember && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowAddMember(false); }}>
      <form className="modal-card" onSubmit={handleAddMember}>
        <div className="modal-heading"><div><span className="eyebrow">MEMBERS</span><h2>Register a reader</h2><p>Add a reader to {library.name}.</p></div><button type="button" className="icon-button" onClick={() => setShowAddMember(false)} aria-label="Close dialog"><X size={19}/></button></div>
        <label>Full name<input required autoFocus maxLength={120} value={newMember.name} onChange={(event) => setNewMember({ ...newMember, name: event.target.value })} placeholder="Reader's full name"/></label>
        <label>Email <span className="optional-label">OPTIONAL</span><input type="email" maxLength={180} value={newMember.email} onChange={(event) => setNewMember({ ...newMember, email: event.target.value })} placeholder="reader@example.com"/></label>
        <label>Member type<select value={newMember.type} onChange={(event) => setNewMember({ ...newMember, type: event.target.value })}><option>Student</option><option>Staff</option><option>Community</option><option>Teacher</option><option>Researcher</option><option>Other</option></select></label>
        <div className="modal-actions"><button type="button" className="button button--secondary" onClick={() => setShowAddMember(false)}>Cancel</button><button className="button button--primary" type="submit" disabled={saving}><Plus size={16}/>{saving ? 'Saving…' : 'Register member'}</button></div>
      </form>
    </div>}
  </>;
}

function Reports({ range, setRange, notify }) {
  return <><div className="report-controls"><span className="muted-copy">Your library's performance at a glance.</span><select className="select-compact" value={range} onChange={e => setRange(e.target.value)}><option>This week</option><option>This month</option><option>This year</option></select></div><div className="stats-grid"><article className="stat-card"><div className="stat-top"><span>Books issued</span><div className="stat-icon stat-icon--green"><ArrowLeftRight size={18}/></div></div><div className="stat-value">137</div><div className="stat-bottom"><span className="stat-positive"><ArrowUpRight size={14}/>8.4%</span><span className="stat-detail">vs. previous period</span></div></article><article className="stat-card"><div className="stat-top"><span>Returns completed</span><div className="stat-icon stat-icon--purple"><Check size={18}/></div></div><div className="stat-value">112</div><div className="stat-bottom"><span className="stat-positive"><ArrowUpRight size={14}/>5.1%</span><span className="stat-detail">vs. previous period</span></div></article><article className="stat-card"><div className="stat-top"><span>New readers</span><div className="stat-icon stat-icon--orange"><Users size={18}/></div></div><div className="stat-value">28</div><div className="stat-bottom"><span className="stat-positive"><ArrowUpRight size={14}/>11.2%</span><span className="stat-detail">vs. previous period</span></div></article><article className="stat-card"><div className="stat-top"><span>Return rate</span><div className="stat-icon stat-icon--blue"><Bookmark size={18}/></div></div><div className="stat-value">94.6%</div><div className="stat-bottom"><span className="stat-detail">Sample performance</span></div></article></div><section className="panel activity-panel report-chart-panel"><div className="panel-heading"><div><h3>Circulation overview</h3><p>Daily book movement · {range.toLowerCase()}</p></div><button className="button button--secondary" onClick={() => notify('Reports export will use verified Firestore data once connected.')}><Download size={15}/> Export report</button></div><div className="chart-wrap chart-wrap--large"><ResponsiveContainer width="100%" height="100%"><BarChart data={weeklyActivity} barGap={7} margin={{ top: 15, right: 12, left: -18, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0ed"/><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#8b948e', fontSize: 12 }} dy={10}/><YAxis axisLine={false} tickLine={false} tick={{ fill: '#8b948e', fontSize: 11 }}/><Tooltip contentStyle={{ border: '1px solid #e6eae6', borderRadius: 12, fontSize: 12 }}/><Bar dataKey="issued" name="Issued" fill="#245c4b" radius={[5,5,0,0]} maxBarSize={24}/><Bar dataKey="returned" name="Returned" fill="#b8d7c9" radius={[5,5,0,0]} maxBarSize={24}/></BarChart></ResponsiveContainer></div></section></>;
}

function Notifications({ notify }) {
  const items = [
    { icon: Clock3, tone: 'orange', title: 'Books due today', body: '8 borrowed books are due back today.', time: 'Today · 8:30 AM', action: 'Review loans' },
    { icon: BookMarked, tone: 'red', title: 'Overdue returns', body: '12 loans have passed their due date.', time: 'Today · 8:00 AM', action: 'View overdue' },
    { icon: Users, tone: 'purple', title: 'New member requests', body: '3 readers are waiting for registration approval.', time: 'Yesterday', action: 'Review members' },
    { icon: CheckCircle2, tone: 'green', title: 'Weekly summary ready', body: 'Your weekly circulation snapshot is available.', time: 'Oct 20, 2026', action: 'View reports' },
  ];
  return <section className="panel notification-list-panel"><div className="panel-heading"><div><h3>Recent notifications</h3><p>Updates from your library workspace</p></div><button className="text-link" onClick={() => notify('Notifications are sample items until Firebase is configured.')}>Mark all as read <Check size={14}/></button></div>{items.map((item,i) => { const Icon = item.icon; return <div className="notification-row" key={item.title}><div className={`attention-symbol attention-symbol--${item.tone}`}><Icon size={17}/></div><div className="notification-content"><strong>{item.title}</strong><p>{item.body}</p><span>{item.time}</span></div>{i < 3 && <span className="unread-dot"/>}<button className="text-link" onClick={() => notify(`“${item.title}” will open the related records when connected.`)}>{item.action} <ArrowRight size={13}/></button></div>;})}</section>;
}

function Subscriptions({ notify, library }) {
  return <div className="subscription-page">
    <section className="subscription-hero"><div className="subscription-hero-copy"><span className="eyebrow">MCTABA BILLING</span><h2>Your library. Your plan.</h2><p>Subscription management for {library.name} will be connected after the core Laravel API migration is validated.</p></div>
      <div className="subscription-status-card"><div className="subscription-status-top"><CreditCard size={18}/><span>Current subscription</span></div><strong>Billing setup pending</strong><Badge tone="warning">Not connected</Badge><div className="subscription-status-meta"><span>Payment status</span><strong>No payment will be taken</strong></div></div>
    </section>
    <div className="subscription-notice"><ShieldCheck size={18}/><div><strong>Secure billing by design</strong><span>Billing is temporarily disabled during the backend migration. No subscription or payment will be created from this screen.</span></div></div>
    <SectionHeading eyebrow="BILLING CYCLE" title="Plans are being migrated" subtitle="Pricing and verified payment activation will return after the billing API and provider webhooks are tested." />
    <div className="empty-state"><CreditCard size={28}/><strong>Billing is temporarily unavailable</strong><span>Your library workspace and inventory are separate from this migration step. No billing records have been changed.</span><button className="button button--secondary" onClick={() => notify('Billing will be re-enabled after payment verification tests pass.')}>Why is this disabled?</button></div>
  </div>;
}

function Settings({ notify }) {
  return <div className="settings-grid"><section className="panel settings-panel"><div className="panel-heading"><div><h3>Library profile</h3><p>Details readers and staff see about your library</p></div><div className="settings-profile-mark"><LibraryBig size={22}/></div></div><div className="settings-fields"><label>Library name<input defaultValue="Greenwood Academy Library"/></label><label>Library type<select defaultValue="School library"><option>School library</option><option>University library</option><option>Public library</option><option>Community library</option><option>Private library</option></select></label><label>Contact email<input defaultValue="library@greenwood.example" type="email"/></label><label>Location<input defaultValue="Nairobi, Kenya"/></label></div><div className="settings-actions"><button className="button button--primary" onClick={() => notify('Profile changes are preview-only until Firebase is configured.')}>Save changes</button></div></section><section className="panel settings-panel"><div className="panel-heading"><div><h3>Workspace & access</h3><p>Manage security and library preferences</p></div><ShieldCheck size={20} className="muted-icon"/></div><div className="settings-option"><div><strong>Staff & permissions</strong><span>Invite librarians and assign roles</span></div><button className="button button--secondary" onClick={() => notify('Staff invitations will use Firebase Authentication and trusted backend functions.')}>Manage <ArrowRight size={14}/></button></div><div className="settings-option"><div><strong>Loan policy</strong><span>Default loan period and borrowing limits</span></div><button className="button button--secondary" onClick={() => notify('Loan policy settings will be added with circulation workflows.')}>Configure <ArrowRight size={14}/></button></div><div className="settings-option"><div><strong>Subscription plan</strong><span>Starter preview · billing not connected</span></div><button className="button button--secondary" onClick={() => notify('Subscription plans and payments are planned after core workflows.')}>View plans <ArrowRight size={14}/></button></div><div className="settings-option"><div><strong>Security & audit</strong><span>Access controls and activity history</span></div><button className="button button--secondary" onClick={() => notify('Security rules are included as a starter and require Firebase Emulator testing before production.')}>Review <ArrowRight size={14}/></button></div></section></div>;
}

function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [library, setLibrary] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function restoreSession() {
      if (!getAuthToken()) {
        setAuthReady(true);
        return;
      }
      try {
        const result = await apiRequest('/api/auth/me');
        if (!cancelled) setUser(normalizeUser(result.user));
      } catch {
        setAuthToken(null);
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    }
    restoreSession();
    return () => { cancelled = true; };
  }, []);

  const handleAuthReady = useCallback((nextUser) => {
    setUser(nextUser);
    setLibrary(null);
  }, []);
  const handleLibraryReady = useCallback((nextLibrary) => setLibrary(nextLibrary), []);
  const switchLibrary = useCallback(() => setLibrary(null), []);

  if (!authReady) {
    return <div className="auth-shell"><section className="auth-card"><div className="auth-brand"><img className="auth-logo-image" src="/icons/mctaba-logo.jpg" alt="Mctaba logo" /><span>mctaba<span className="auth-period">.</span></span></div><p className="auth-description">Loading your secure library workspace…</p></section></div>;
  }

  if (!user || !library) {
    return <AuthPortal user={user} onAuthReady={handleAuthReady} onLibraryReady={handleLibraryReady} />;
  }

  return <Dashboard user={user} library={library} onSwitchLibrary={switchLibrary} />;
}

export default App;
