import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen, Edit3, Plus, Moon, Sun,
  Sparkles, X, Feather, Menu, MessageSquare, Users,
  UserPlus, Send, MessageCircle, User, Save,
  Award, BarChart2, RotateCcw
} from 'lucide-react';

const LIVROS_INICIAIS = [
  {
    id: 'b1',
    title: 'A Sombra do Tempo',
    genre: 'Ficção Científica',
    coverColor: 'from-purple-600 to-indigo-800',
    progress: 68,
    status: 'Em Andamento',
    updatedAt: '2026-03-28',
    wordCount: 18450,
    synopsis: 'Uma jornada através das fendas temporais da Via Láctea, onde o passado e o futuro se colidem em uma estação espacial abandonada.',
    chapters: [
      {
        id: 'c1',
        title: 'Capítulo 1: O Despertar',
        content: '# Capítulo 1: O Despertar\n\nO silêncio na estação espacial era quase ensurdecedor. Lucas olhou através da janela de quartzo e observou as estrelas distantes se contorcendo na dobra espacial.\n\n"Tudo pronto para o salto?", perguntou a inteligência artificial da nave, sua voz ecoando suavemente pelo painel de controle.',
        comments: [
          { id: 'cm1', author: 'Mariana Lima', text: 'Início fantástico! Adorei a atmosfera de suspense.', date: '2026-03-29' },
          { id: 'cm2', author: 'Carlos Ramos', text: 'A descrição da dobra espacial ficou impecável.', date: '2026-03-30' }
        ]
      },
      {
        id: 'c2',
        title: 'Capítulo 2: Fronteiras Invisíveis',
        content: '# Capítulo 2: Fronteiras Invisíveis\n\nA poeira estelar cobria a fiação do módulo principal. Nada naquelas coordenadas batia com os mapas galácticos antigos.\n\n"Precisamos calibrar o reator secundário antes de avançar," alertou Lucas, ajustando as chaves do console.',
        comments: []
      }
    ],
    characters: [
      { id: 'ch1', name: 'Lucas Vance', role: 'Protagonista', description: 'Engenheiro de salto espacial, 34 anos.' }
    ],
    notes: []
  },
  {
    id: 'b2',
    title: 'Manual do Escritor Moderno',
    genre: 'Não-Ficção / Guia',
    coverColor: 'from-amber-500 to-rose-700',
    progress: 35,
    status: 'Rascunho',
    updatedAt: '2026-04-01',
    wordCount: 6200,
    synopsis: 'Técnicas essenciais de estruturação narrativa e produtividade para autores independentes.',
    chapters: [
      {
        id: 'c101',
        title: 'Introdução à Estrutura',
        content: '# Introdução\n\nEscrever um livro exige mais do que inspiração momentânea; exige consistência e método.',
        comments: []
      }
    ],
    characters: [],
    notes: []
  }
];

// pendingRequest = solicitação RECEBIDA (posso aceitar)
// requestSent    = solicitação ENVIADA por mim (aguardando resposta)
const AMIGOS_INICIAIS = [
  { id: 'u1', name: 'Mariana Lima', handle: '@marilima', status: 'online', isFriend: true },
  { id: 'u2', name: 'Carlos Ramos', handle: '@carlos_writer', status: 'offline', isFriend: true },
  { id: 'u3', name: 'Beatriz Costa', handle: '@biacosta', status: 'online', isFriend: false, pendingRequest: true, requestSent: false },
  { id: 'u4', name: 'Gabriel Mendes', handle: '@gmendes', status: 'offline', isFriend: false, pendingRequest: false, requestSent: false }
];

const MENSAGENS_INICIAIS = {
  'u1': [
    { id: 'm1', sender: 'u1', text: 'Olá! Li o primeiro capítulo de "A Sombra do Tempo", ficou incrível!', time: '10:30' },
    { id: 'm2', sender: 'me', text: 'Muito obrigado, Mariana! Estou revisando o segundo capítulo agora.', time: '10:32' }
  ],
  'u2': [
    { id: 'm3', sender: 'u2', text: 'Você aceita fazer uma leitura crítica do meu novo conto?', time: 'Ontem' }
  ]
};

const PERFIL_INICIAL = {
  name: 'Alexandre Souza',
  handle: '@alex_autor',
  bio: 'Escritor de ficção científica e fantasia sombria. Explorando mundos distantes e narrativas complexas.',
  favoriteGenre: 'Ficção Científica',
  joinedDate: 'Março de 2026',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
};

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Estante Virtual', icon: BookOpen },
  { id: 'editor', label: 'Estúdio de Escrita', icon: Edit3 },
  { id: 'social', label: 'Social & Amigos', icon: Users },
  { id: 'profile', label: 'Meu Perfil', icon: User }
];

const PAGE_TITLES = {
  dashboard: 'Estante Virtual & Visão Geral',
  editor: 'Estúdio de Escrita',
  social: 'Comunidade & Mensagens',
  profile: 'Perfil do Autor'
};

const STORAGE_KEYS = {
  theme: 'estudio_theme',
  profile: 'estudio_profile',
  books: 'estudio_books',
  friends: 'estudio_friends',
  messages: 'estudio_messages'
};

// ---------- Helpers ----------

// CORREÇÃO: além de try/catch, valida o formato dos dados salvos.
// Dados corrompidos no localStorage (ex.: books não ser um array) derrubavam o app.
const loadStorage = (key, fallback, isValid = () => true) => {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return fallback;
    const parsed = JSON.parse(saved);
    return isValid(parsed) ? parsed : fallback;
  } catch (e) {
    console.error(`Erro ao carregar chave ${key} do LocalStorage`, e);
    return fallback;
  }
};

// CORREÇÃO: setItem também pode lançar erro (cota cheia, modo privado, etc.).
const saveStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Erro ao salvar chave ${key} no LocalStorage`, e);
  }
};

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isValidBooks = (v) => Array.isArray(v) && v.every(b => b && Array.isArray(b.chapters));

// CORREÇÃO: toISOString() devolve a data em UTC. No Brasil (UTC-3), depois das 21h
// a data "pulava" para o dia seguinte. Aqui usamos a data local.
const todayISO = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const formatNumber = (n) => (n || 0).toLocaleString('pt-BR');

export default function App() {
  // ---------- Estados ----------
  const [theme, setTheme] = useState(() =>
    loadStorage(STORAGE_KEYS.theme, 'dark', (v) => v === 'dark' || v === 'light')
  );
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [profile, setProfile] = useState(() => loadStorage(STORAGE_KEYS.profile, PERFIL_INICIAL, isPlainObject));
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [tempProfile, setTempProfile] = useState(PERFIL_INICIAL);
  const [avatarError, setAvatarError] = useState(false);

  const [books, setBooks] = useState(() => loadStorage(STORAGE_KEYS.books, LIVROS_INICIAIS, isValidBooks));
  const [selectedBookId, setSelectedBookId] = useState(() => books[0]?.id || null);
  const [selectedChapterId, setSelectedChapterId] = useState(() => books[0]?.chapters?.[0]?.id || null);
  const [editorTab, setEditorTab] = useState('write');

  const [friends, setFriends] = useState(() => loadStorage(STORAGE_KEYS.friends, AMIGOS_INICIAIS, Array.isArray));
  const [messages, setMessages] = useState(() => loadStorage(STORAGE_KEYS.messages, MENSAGENS_INICIAIS, isPlainObject));
  const [selectedChatUserId, setSelectedChatUserId] = useState(() => friends.find(f => f.isFriend)?.id || null);
  const [newMessageText, setNewMessageText] = useState('');
  const [socialTab, setSocialTab] = useState('friends');

  const [newCommentText, setNewCommentText] = useState('');
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const chatScrollRef = useRef(null);

  const isDark = theme === 'dark';

  // CORREÇÃO: o tema claro estava quebrado porque quase todas as classes eram fixas do tema escuro.
  // Estes tokens dependem apenas do estado `theme` (não exigem configuração de darkMode no Tailwind).
  const ui = isDark ? {
    page: 'bg-slate-950 text-slate-100',
    sidebar: 'bg-slate-900/90 border-slate-800',
    header: 'bg-slate-900/40 border-slate-800',
    panel: 'bg-slate-900/50 border-slate-800',
    item: 'bg-slate-900/80 border-slate-800/60',
    input: 'bg-slate-900 border-slate-800',
    divider: 'border-slate-800',
    title: 'text-white',
    body: 'text-slate-300',
    muted: 'text-slate-400',
    faint: 'text-slate-500',
    accent: 'text-indigo-400',
    accentSoft: 'bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white',
    badge: 'bg-indigo-600/20 text-indigo-400',
    avatar: 'bg-indigo-500/20 text-indigo-400',
    navIdle: 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200',
    tabIdle: 'text-slate-400 hover:text-slate-200',
    resetBtn: 'text-slate-500 hover:text-rose-400 bg-slate-800/50 border-slate-800',
    chatHeader: 'bg-slate-900/60',
    chatItemIdle: 'bg-slate-900/40 text-slate-300 hover:bg-slate-800/50',
    bubbleOther: 'bg-slate-800 text-slate-200'
  } : {
    page: 'bg-slate-50 text-slate-900',
    sidebar: 'bg-white/90 border-slate-200',
    header: 'bg-white border-slate-200',
    panel: 'bg-white border-slate-200',
    item: 'bg-slate-50 border-slate-200',
    input: 'bg-white border-slate-300',
    divider: 'border-slate-200',
    title: 'text-slate-900',
    body: 'text-slate-700',
    muted: 'text-slate-600',
    faint: 'text-slate-500',
    accent: 'text-indigo-600',
    accentSoft: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-600 hover:text-white',
    badge: 'bg-indigo-100 text-indigo-700',
    avatar: 'bg-indigo-100 text-indigo-700',
    navIdle: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
    tabIdle: 'text-slate-500 hover:text-slate-800',
    resetBtn: 'text-slate-500 hover:text-rose-500 bg-slate-100 border-slate-200',
    chatHeader: 'bg-slate-50',
    chatItemIdle: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
    bubbleOther: 'bg-slate-200 text-slate-800'
  };

  const inputClass = `w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-indigo-500 ${ui.input}`;
  const labelClass = `text-xs block mb-1 ${ui.muted}`;

  // ---------- Persistência ----------
  useEffect(() => {
    saveStorage(STORAGE_KEYS.theme, theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => { saveStorage(STORAGE_KEYS.profile, profile); }, [profile]);
  useEffect(() => { saveStorage(STORAGE_KEYS.books, books); }, [books]);
  useEffect(() => { saveStorage(STORAGE_KEYS.friends, friends); }, [friends]);
  useEffect(() => { saveStorage(STORAGE_KEYS.messages, messages); }, [messages]);

  // Se a URL da foto mudar, tenta carregar de novo
  useEffect(() => { setAvatarError(false); }, [profile.avatarUrl]);

  // CORREÇÃO: vários avisos seguidos se cancelavam (o timer do primeiro apagava o segundo).
  const showNotification = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // ---------- Valores derivados ----------
  const currentBook = books.find(b => b.id === selectedBookId) || books[0] || null;
  const currentChapter = currentBook?.chapters?.find(c => c.id === selectedChapterId) || currentBook?.chapters?.[0] || null;
  // CORREÇÃO: só amigos confirmados podem ser abertos no chat
  const selectedFriend = friends.find(f => f.id === selectedChatUserId && f.isFriend) || null;
  const currentChatMessages = messages[selectedChatUserId] || [];

  // CORREÇÃO: o chat não rolava até a mensagem mais recente
  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [currentChatMessages.length, selectedChatUserId, activeTab, socialTab]);

  // ---------- Ações: livros e capítulos ----------
  const handleSelectBook = (bookId) => {
    const targetBook = books.find(b => b.id === bookId);
    setSelectedBookId(bookId);
    setSelectedChapterId(targetBook?.chapters?.[0]?.id || null);
    setActiveTab('editor');
  };

  const handleAddChapter = () => {
    if (!currentBook) return;
    const bookId = currentBook.id;
    const newChapNum = (currentBook.chapters?.length || 0) + 1;
    const newChapter = {
      id: `c_${Date.now()}`,
      title: `Capítulo ${newChapNum}: Sem Título`,
      content: `# Capítulo ${newChapNum}\n\nEscreva seu texto aqui...`,
      comments: []
    };

    setBooks(prev => prev.map(b =>
      b.id === bookId ? { ...b, chapters: [...(b.chapters || []), newChapter] } : b
    ));

    setSelectedBookId(bookId);
    setSelectedChapterId(newChapter.id);
    showNotification('Novo capítulo adicionado!');
  };

  // CORREÇÃO: usa os ids do livro/capítulo que estão realmente na tela (currentBook/currentChapter).
  // Antes usava selectedBookId/selectedChapterId, que podiam estar desatualizados
  // (ex.: livro sem capítulos) e fazer a digitação não ser salva em lugar nenhum.
  const updateChapterContent = (newContent) => {
    if (!currentBook || !currentChapter) return;
    const bookId = currentBook.id;
    const chapterId = currentChapter.id;

    setBooks(prev => prev.map(book => {
      if (book.id !== bookId) return book;

      const updatedChapters = book.chapters.map(chap =>
        chap.id === chapterId ? { ...chap, content: newContent } : chap
      );

      const wordCount = updatedChapters.reduce((acc, chap) => {
        const content = chap.content ? chap.content.trim() : '';
        return acc + (content ? content.split(/\s+/).filter(Boolean).length : 0);
      }, 0);

      return { ...book, chapters: updatedChapters, wordCount, updatedAt: todayISO() };
    }));
  };

  const handleAddComment = (e) => {
    e.preventDefault();
    if (!newCommentText.trim() || !currentBook || !currentChapter) return;
    const bookId = currentBook.id;
    const chapterId = currentChapter.id;

    const commentObj = {
      id: `cm_${Date.now()}`,
      author: `${profile.name} (Autor)`,
      text: newCommentText.trim(),
      date: todayISO()
    };

    setBooks(prev => prev.map(book => {
      if (book.id !== bookId) return book;
      return {
        ...book,
        chapters: book.chapters.map(chap =>
          chap.id === chapterId
            ? { ...chap, comments: [...(chap.comments || []), commentObj] }
            : chap
        )
      };
    }));

    setNewCommentText('');
    showNotification('Comentário publicado com sucesso!');
  };

  // ---------- Ações: social ----------
  const handleAcceptFriendRequest = (userId) => {
    setFriends(prev => prev.map(u =>
      u.id === userId ? { ...u, isFriend: true, pendingRequest: false, requestSent: false } : u
    ));
    showNotification('Solicitação de amizade aceita!');
  };

  // CORREÇÃO: antes marcava `pendingRequest: true`, o que fazia o botão "Aceitar" aparecer
  // para uma solicitação que eu mesmo enviei. Agora usa `requestSent` e mostra "Pendente".
  const handleSendFriendRequest = (userId) => {
    setFriends(prev => prev.map(u => u.id === userId ? { ...u, requestSent: true } : u));
    showNotification('Solicitação enviada!');
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessageText.trim() || !selectedFriend) return;
    const chatUserId = selectedFriend.id;

    const msgObj = {
      id: `m_${Date.now()}`,
      sender: 'me',
      text: newMessageText.trim(),
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => ({
      ...prev,
      [chatUserId]: [...(prev[chatUserId] || []), msgObj]
    }));

    setNewMessageText('');
  };

  // ---------- Ações: perfil ----------
  const handleSaveProfile = (e) => {
    e.preventDefault();
    setProfile(tempProfile);
    setIsEditingProfile(false);
    showNotification('Perfil atualizado com sucesso!');
  };

  // CORREÇÃO: localStorage.clear() apagava TODAS as chaves da origem (inclusive de outros apps
  // rodando em localhost). Além disso era inútil: os useEffect regravam os dados padrão logo depois.
  // Agora só o estado é redefinido, e o tema escolhido é mantido.
  const handleResetData = () => {
    if (window.confirm('Deseja redefinir os dados para o padrão inicial? Suas edições atuais serão sobrescritas.')) {
      setProfile(PERFIL_INICIAL);
      setBooks(LIVROS_INICIAIS);
      setFriends(AMIGOS_INICIAIS);
      setMessages(MENSAGENS_INICIAIS);
      setSelectedBookId(LIVROS_INICIAIS[0].id);
      setSelectedChapterId(LIVROS_INICIAIS[0].chapters[0].id);
      setSelectedChatUserId('u1');
      setIsEditingProfile(false);
      showNotification('Dados restaurados com sucesso!');
    }
  };

  // ---------- Estatísticas ----------
  const totalWords = books.reduce((acc, book) => acc + (book.wordCount || 0), 0);
  const totalComments = books.reduce((acc, book) => {
    return acc + (book.chapters || []).reduce((chapAcc, chap) => chapAcc + (chap.comments?.length || 0), 0);
  }, 0);

  const stats = [
    { icon: BookOpen, value: books.length, label: 'Livros Criados' },
    { icon: BarChart2, value: formatNumber(totalWords), label: 'Total de Palavras' },
    { icon: Users, value: friends.filter(f => f.isFriend).length, label: 'Amigos Conectados' },
    { icon: MessageSquare, value: totalComments, label: 'Comentários Recebidos' }
  ];

  return (
    <div className={`min-h-screen font-sans antialiased transition-colors duration-300 ${ui.page}`}>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-indigo-600 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 border border-indigo-400/30">
          <Sparkles className="w-5 h-5 text-amber-300" />
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}

      <div className="flex h-screen overflow-hidden">

        {/* Mobile Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar Menu */}
        <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 ${ui.sidebar} border-r backdrop-blur-md flex flex-col justify-between transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}>
          <div>
            <div className="p-6 flex items-center justify-between border-b border-slate-800/20">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30">
                  <Feather className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="font-bold text-base leading-none tracking-tight">Estúdio do Autor</h1>
                  <span className={`text-[10px] font-medium tracking-wide uppercase ${ui.accent}`}>Comunidade & Escrita</span>
                </div>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                aria-label="Fechar menu"
                className={`lg:hidden ${ui.muted} hover:text-indigo-500`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="p-4 space-y-1.5">
              {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => { setActiveTab(id); setSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                    activeTab === id
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : ui.navIdle
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="p-4 border-t border-slate-800/20">
            <div className="flex items-center justify-between">
              <span className={`text-xs font-medium ${ui.muted}`}>Tema do Sistema</span>
              <button
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
                className={`p-2 rounded-xl transition-all ${
                  isDark ? 'bg-slate-800 text-amber-400 hover:bg-slate-700' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

          <header className={`h-16 px-6 flex items-center justify-between border-b ${ui.header}`}>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                aria-label="Abrir menu"
                className={`lg:hidden p-2 rounded-lg hover:bg-slate-500/10 ${ui.muted}`}
              >
                <Menu className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                {PAGE_TITLES[activeTab]}
              </h2>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-6">

            {/* MEU PERFIL */}
            {activeTab === 'profile' && (
              <div className="max-w-4xl mx-auto space-y-6">
                <div className={`p-6 rounded-2xl border flex flex-col md:flex-row items-center md:items-start gap-6 relative ${ui.panel}`}>
                  {/* CORREÇÃO: se a URL da foto falhar, mostra a inicial do nome em vez de imagem quebrada */}
                  {profile.avatarUrl && !avatarError ? (
                    <img
                      src={profile.avatarUrl}
                      alt={profile.name}
                      onError={() => setAvatarError(true)}
                      className="w-24 h-24 rounded-full object-cover border-2 border-indigo-500 shadow-xl"
                    />
                  ) : (
                    <div className={`w-24 h-24 rounded-full border-2 border-indigo-500 shadow-xl flex items-center justify-center text-3xl font-bold ${ui.avatar}`}>
                      {profile.name?.charAt(0)}
                    </div>
                  )}

                  <div className="flex-1 text-center md:text-left space-y-2">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <div>
                        <h3 className="text-xl font-bold">{profile.name}</h3>
                        <p className={`text-xs font-medium ${ui.accent}`}>{profile.handle}</p>
                      </div>
                      <div className="flex items-center gap-2 justify-center">
                        <button
                          onClick={() => {
                            setTempProfile(profile);
                            setIsEditingProfile(!isEditingProfile);
                          }}
                          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all border border-indigo-500/30 ${ui.accentSoft}`}
                        >
                          {isEditingProfile ? 'Cancelar' : 'Editar Perfil'}
                        </button>
                        <button
                          onClick={handleResetData}
                          title="Redefinir Dados de Demonstração"
                          aria-label="Redefinir dados de demonstração"
                          className={`p-2 rounded-xl border ${ui.resetBtn}`}
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <p className={`text-sm max-w-xl ${ui.body}`}>{profile.bio}</p>

                    <div className={`flex flex-wrap justify-center md:justify-start gap-4 text-xs pt-2 ${ui.muted}`}>
                      <span><strong>Gênero favorito:</strong> {profile.favoriteGenre}</span>
                      <span>•</span>
                      <span>Membro desde {profile.joinedDate}</span>
                    </div>
                  </div>
                </div>

                {/* Form de Edição */}
                {isEditingProfile && (
                  <form onSubmit={handleSaveProfile} className={`p-6 rounded-2xl border space-y-4 ${ui.panel}`}>
                    <h4 className={`text-sm font-bold ${ui.accent}`}>Editar Informações Pessoais</h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Nome Completo</label>
                        <input
                          type="text"
                          value={tempProfile.name}
                          onChange={(e) => setTempProfile({ ...tempProfile, name: e.target.value })}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Usuário (@handle)</label>
                        <input
                          type="text"
                          value={tempProfile.handle}
                          onChange={(e) => setTempProfile({ ...tempProfile, handle: e.target.value })}
                          className={inputClass}
                        />
                      </div>
                    </div>

                    <div>
                      <label className={labelClass}>URL da Foto de Perfil</label>
                      <input
                        type="text"
                        value={tempProfile.avatarUrl}
                        onChange={(e) => setTempProfile({ ...tempProfile, avatarUrl: e.target.value })}
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Gênero Literário Favorito</label>
                      <input
                        type="text"
                        value={tempProfile.favoriteGenre}
                        onChange={(e) => setTempProfile({ ...tempProfile, favoriteGenre: e.target.value })}
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Biografia</label>
                      <textarea
                        rows="3"
                        value={tempProfile.bio}
                        onChange={(e) => setTempProfile({ ...tempProfile, bio: e.target.value })}
                        className={`${inputClass} resize-none`}
                      />
                    </div>

                    <div className="flex justify-end">
                      <button type="submit" className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700">
                        <Save className="w-4 h-4" />
                        Salvar Alterações
                      </button>
                    </div>
                  </form>
                )}

                {/* Estatísticas */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {stats.map(({ icon: Icon, value, label }) => (
                    <div key={label} className={`p-4 rounded-2xl border text-center ${ui.panel}`}>
                      <Icon className={`w-5 h-5 mx-auto mb-1 ${ui.accent}`} />
                      <span className="text-xl font-bold block">{value}</span>
                      <span className={`text-[10px] uppercase ${ui.muted}`}>{label}</span>
                    </div>
                  ))}
                </div>

                {/* Obras */}
                <div className={`p-6 rounded-2xl border space-y-4 ${ui.panel}`}>
                  <h4 className={`text-sm font-bold flex items-center gap-2 ${ui.title}`}>
                    <Award className={`w-4 h-4 ${ui.accent}`} />
                    Obras Publicadas / Em Produção
                  </h4>
                  <div className="space-y-3">
                    {books.map(book => (
                      <div key={book.id} className={`p-3.5 rounded-xl border flex items-center justify-between ${ui.item}`}>
                        <div>
                          <p className={`text-xs font-bold ${ui.title}`}>{book.title}</p>
                          <p className={`text-[10px] ${ui.muted}`}>{book.genre} • {formatNumber(book.wordCount)} palavras</p>
                        </div>
                        <span className={`px-2.5 py-1 text-[10px] font-semibold rounded-lg ${ui.badge}`}>
                          {book.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ESTÚDIO DE ESCRITA */}
            {activeTab === 'editor' && (
              currentBook ? (
                <div className="flex flex-col h-full gap-4">
                  <div className={`flex flex-wrap justify-between items-center p-3 rounded-xl border gap-3 ${ui.panel}`}>
                    <div className="flex items-center gap-2">
                      {/* CORREÇÃO: os selects mostram o livro/capítulo que está de fato em edição */}
                      <select
                        value={currentBook.id}
                        onChange={(e) => handleSelectBook(e.target.value)}
                        className={`border text-xs font-bold px-2.5 py-1.5 rounded-lg focus:outline-none ${ui.input} ${ui.accent}`}
                      >
                        {books.map(b => (
                          <option key={b.id} value={b.id}>{b.title}</option>
                        ))}
                      </select>

                      <span className={`text-xs ${ui.faint}`}>/</span>

                      <select
                        value={currentChapter?.id || ''}
                        onChange={(e) => setSelectedChapterId(e.target.value)}
                        className={`border text-xs font-medium px-2.5 py-1.5 rounded-lg focus:outline-none ${ui.input} ${ui.body}`}
                      >
                        {currentBook.chapters?.map(c => (
                          <option key={c.id} value={c.id}>{c.title}</option>
                        ))}
                      </select>

                      <button
                        onClick={handleAddChapter}
                        className={`p-1.5 rounded-lg transition-all ${ui.accentSoft}`}
                        title="Adicionar Novo Capítulo"
                        aria-label="Adicionar novo capítulo"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditorTab('write')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${editorTab === 'write' ? 'bg-indigo-600 text-white' : ui.tabIdle}`}
                      >
                        Escrita
                      </button>
                      <button
                        onClick={() => setEditorTab('comments')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${editorTab === 'comments' ? 'bg-indigo-600 text-white' : ui.tabIdle}`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Comentários ({currentChapter?.comments?.length || 0})
                      </button>
                    </div>
                  </div>

                  {editorTab === 'write' && (
                    currentChapter ? (
                      <textarea
                        value={currentChapter.content || ''}
                        onChange={(e) => updateChapterContent(e.target.value)}
                        placeholder="Comece a escrever..."
                        className={`w-full flex-1 p-6 rounded-2xl border focus:outline-none focus:border-indigo-500 resize-none font-mono text-sm leading-relaxed ${ui.panel}`}
                      />
                    ) : (
                      <div className={`text-center py-12 text-sm ${ui.faint}`}>
                        Este livro ainda não tem capítulos. Use o botão + para criar o primeiro.
                      </div>
                    )
                  )}

                  {editorTab === 'comments' && (
                    <div className="flex flex-col h-full max-w-3xl mx-auto w-full space-y-6">
                      <form onSubmit={handleAddComment} className="flex gap-3">
                        <input
                          type="text"
                          placeholder="Deixe um comentário sobre este capítulo..."
                          value={newCommentText}
                          onChange={(e) => setNewCommentText(e.target.value)}
                          className={`flex-1 px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:border-indigo-500 ${ui.input}`}
                        />
                        <button type="submit" className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700">
                          Publicar
                        </button>
                      </form>

                      <div className="space-y-4 overflow-y-auto flex-1">
                        {currentChapter?.comments && currentChapter.comments.length > 0 ? (
                          currentChapter.comments.map(comment => (
                            <div key={comment.id} className={`p-4 rounded-xl border space-y-1 ${ui.item}`}>
                              <div className="flex justify-between items-center">
                                <span className={`text-xs font-bold ${ui.accent}`}>{comment.author}</span>
                                <span className={`text-[10px] ${ui.faint}`}>{comment.date}</span>
                              </div>
                              <p className={`text-sm ${ui.body}`}>{comment.text}</p>
                            </div>
                          ))
                        ) : (
                          <div className={`text-center py-12 text-sm ${ui.faint}`}>
                            Nenhum comentário neste capítulo ainda.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className={`text-center py-12 ${ui.faint}`}>Nenhum livro selecionado.</div>
              )
            )}

            {/* SOCIAL */}
            {activeTab === 'social' && (
              <div className="flex flex-col lg:flex-row h-full gap-6">
                <div className={`w-full lg:w-80 rounded-2xl border p-4 flex flex-col gap-4 ${ui.panel}`}>
                  <div className={`flex border-b pb-3 gap-2 ${ui.divider}`}>
                    <button
                      onClick={() => setSocialTab('friends')}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg ${socialTab === 'friends' ? 'bg-indigo-600 text-white' : ui.tabIdle}`}
                    >
                      Amigos
                    </button>
                    <button
                      onClick={() => setSocialTab('chat')}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg ${socialTab === 'chat' ? 'bg-indigo-600 text-white' : ui.tabIdle}`}
                    >
                      Conversas
                    </button>
                  </div>

                  {socialTab === 'friends' && (
                    <div className="space-y-3 overflow-y-auto flex-1">
                      <span className={`text-xs font-bold uppercase tracking-wider ${ui.muted}`}>Conexões</span>
                      {friends.map(user => (
                        <div key={user.id} className={`p-3 rounded-xl border flex items-center justify-between ${ui.item}`}>
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${ui.avatar}`}>
                              {user.name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-xs font-semibold">{user.name}</p>
                              <p className={`text-[10px] ${ui.faint}`}>{user.handle}</p>
                            </div>
                          </div>
                          {user.isFriend ? (
                            <button
                              onClick={() => { setSelectedChatUserId(user.id); setSocialTab('chat'); }}
                              aria-label={`Conversar com ${user.name}`}
                              className={`p-1.5 ${ui.muted} hover:text-indigo-500`}
                            >
                              <MessageCircle className="w-4 h-4" />
                            </button>
                          ) : user.pendingRequest ? (
                            <button
                              onClick={() => handleAcceptFriendRequest(user.id)}
                              className="px-2 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-semibold"
                            >
                              Aceitar
                            </button>
                          ) : user.requestSent ? (
                            <span className={`px-2 py-1 rounded-lg text-[10px] font-semibold ${ui.badge}`}>
                              Pendente
                            </span>
                          ) : (
                            <button
                              onClick={() => handleSendFriendRequest(user.id)}
                              aria-label={`Enviar solicitação de amizade para ${user.name}`}
                              className={`p-1.5 rounded-lg hover:bg-indigo-600/20 ${ui.accent}`}
                            >
                              <UserPlus className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {socialTab === 'chat' && (
                    <div className="space-y-2 overflow-y-auto flex-1">
                      {friends.filter(f => f.isFriend).map(friend => (
                        <button
                          key={friend.id}
                          onClick={() => setSelectedChatUserId(friend.id)}
                          className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all ${
                            selectedChatUserId === friend.id ? 'bg-indigo-600 text-white' : ui.chatItemIdle
                          }`}
                        >
                          <div className="w-8 h-8 rounded-full bg-slate-500/30 flex items-center justify-center text-xs font-bold">
                            {friend.name.charAt(0)}
                          </div>
                          <div className="text-left">
                            <p className="text-xs font-bold">{friend.name}</p>
                            <p className="text-[10px] opacity-70">{friend.handle}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className={`flex-1 rounded-2xl border flex flex-col h-full overflow-hidden min-h-[300px] ${ui.panel}`}>
                  {selectedFriend ? (
                    <>
                      <div className={`p-4 border-b flex items-center gap-3 ${ui.divider} ${ui.chatHeader}`}>
                        <div className="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                          {selectedFriend.name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="text-sm font-bold">{selectedFriend.name}</h3>
                          {/* CORREÇÃO: "offline" aparecia em verde, igual a "online" */}
                          <span className={`text-[10px] ${selectedFriend.status === 'online' ? 'text-emerald-500' : ui.faint}`}>
                            {selectedFriend.status === 'online' ? 'Online' : 'Offline'}
                          </span>
                        </div>
                      </div>

                      <div ref={chatScrollRef} className="flex-1 p-4 space-y-3 overflow-y-auto">
                        {currentChatMessages.map(msg => (
                          <div
                            key={msg.id}
                            className={`flex flex-col ${msg.sender === 'me' ? 'items-end' : 'items-start'}`}
                          >
                            <div className={`max-w-xs px-4 py-2.5 rounded-2xl text-xs ${
                              msg.sender === 'me'
                                ? 'bg-indigo-600 text-white rounded-br-none'
                                : `${ui.bubbleOther} rounded-bl-none`
                            }`}>
                              {msg.text}
                            </div>
                            <span className={`text-[9px] mt-1 ${ui.faint}`}>{msg.time}</span>
                          </div>
                        ))}
                      </div>

                      <form onSubmit={handleSendMessage} className={`p-3 border-t flex gap-2 ${ui.divider}`}>
                        <input
                          type="text"
                          placeholder="Escreva uma mensagem..."
                          value={newMessageText}
                          onChange={(e) => setNewMessageText(e.target.value)}
                          className={`flex-1 px-4 py-2 border rounded-xl text-xs focus:outline-none focus:border-indigo-500 ${ui.input}`}
                        />
                        <button
                          type="submit"
                          aria-label="Enviar mensagem"
                          className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </form>
                    </>
                  ) : (
                    <div className={`flex-1 flex items-center justify-center text-xs ${ui.faint}`}>
                      Selecione um amigo para iniciar uma conversa.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ESTANTE VIRTUAL */}
            {activeTab === 'dashboard' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {books.map(book => (
                  <div key={book.id} className={`p-5 rounded-2xl border flex flex-col justify-between space-y-4 ${ui.panel}`}>
                    <div>
                      <span className={`text-[10px] uppercase font-bold ${ui.accent}`}>{book.genre}</span>
                      <h3 className={`text-base font-bold mt-1 ${ui.title}`}>{book.title}</h3>
                      <p className={`text-xs line-clamp-2 mt-2 ${ui.muted}`}>{book.synopsis}</p>
                    </div>
                    <div className={`flex justify-between items-center border-t pt-3 ${ui.divider}`}>
                      <span className={`text-xs ${ui.faint}`}>{formatNumber(book.wordCount)} palavras</span>
                      <button
                        onClick={() => handleSelectBook(book.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${ui.accentSoft}`}
                      >
                        Abrir Estúdio
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
