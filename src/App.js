import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  Edit3, FileText, Plus, Moon, Sun,
  X, Feather, Menu, FileUp,
  GraduationCap, Compass, Users, Lightbulb, TrendingUp, Search,
  Trash2, Download, Upload, ChevronLeft, ChevronRight, BookOpen,
  User, Heart, MessageCircle, Send, Globe,
  Music, Play, Pause, SkipBack, SkipForward, Volume2, Share2, LogOut
} from 'lucide-react';

// --- BANCO DE DADOS INDEXEDDB ASSÍNCRONO ---

const DB_NAME = 'EstudioNarrativoDB';
const DB_VERSION = 3;
let dbInstance = null;

const getDB = () => {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB não suportado neste ambiente.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (e) => {
      reject(new Error(`Erro ao abrir IndexedDB: ${e.target.error}`));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      dbInstance.onversionchange = () => {
        dbInstance.close();
        dbInstance = null;
      };
      dbInstance.onclose = () => {
        dbInstance = null;
      };
      resolve(dbInstance);
    };

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
      if (!db.objectStoreNames.contains('books')) db.createObjectStore('books', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('documents')) db.createObjectStore('documents', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('posts')) db.createObjectStore('posts', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('pdfs')) db.createObjectStore('pdfs', { keyPath: 'id' });
    };
  });
};

const dbGet = async (storeName, key) => {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = key ? store.get(key) : store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
};

const dbSet = async (storeName, val, key) => {
  try {
    const db = await getDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.onabort = () => resolve(false);
      tx.onerror = () => resolve(false);
      const store = tx.objectStore(storeName);
      if (key) store.put(val, key);
      else store.put(val);
      tx.oncomplete = () => resolve(true);
    });
  } catch (e) {
    console.error('Erro na gravação do IndexedDB:', e);
    return false;
  }
};

const dbDelete = async (storeName, key) => {
  try {
    const db = await getDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    });
  } catch {
    return false;
  }
};

// --- HELPERS ---

const calculateWords = (text = '') => {
  if (!text || typeof text !== 'string') return 0;
  const cleanText = text.trim();
  return cleanText ? (cleanText.match(/\S+/g) || []).length : 0;
};

const triggerSecureDownload = (content, filename, type) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// O React já escapa HTML ao renderizar, então aqui só removemos
// caracteres de controle (escapar &, < etc. faria o texto aparecer como "&amp;").
const sanitizeInput = (str = '') => {
  return String(str)
    .replace(/[\0\x08\x0B\x0C\x0E-\x1F]/g, '')
    .trim();
};

const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// --- DADOS INICIAIS ---

const LIVROS_INICIAIS = [
  {
    id: 'b1',
    title: 'A Sombra do Tempo',
    author: 'Alexandre Sousa',
    genre: 'Ficção Científica',
    coverColor: 'from-purple-600 to-indigo-800',
    synopsis: 'Uma jornada através das fendas temporais da Via Láctea, onde o passado e o futuro colidem em uma estação espacial abandonada.',
    content: `Capítulo 1: O Despertar\n\nO silêncio na estação espacial era quase ensurdecedor. Lucas olhou através da janela de quartzo e observou as estrelas distantes se contorcendo na dobra espacial.\n\n"Tudo pronto para o salto?", perguntou a inteligência artificial da nave, sua voz ecoando suavemente pelo painel de controle.\n\nA poeira estelar cobria a fiação do módulo principal. Nada naquelas coordenadas batia com os mapas galácticos antigos. Precisamos calibrar o reator secundário antes de avançar, alertou Lucas, ajustando as chaves do console.\n\nCapítulo 2: O Sinal\n\nUm bipe estridente cortou o ar estático do convés de comando. O painel holográfico piscou em carmesim.\n\n"Detectando emissão de táquions a 400 milhas náuticas", anunciou a IA. "Assinatura idêntica à nave de reconhecimento perdida há quarenta anos."`
  }
];

const PDFS_INICIAIS = [
  {
    id: 'doc_1',
    title: 'Manual de Escrita Criativa',
    fileName: 'manual_escrita.txt',
    size: '1.2 KB',
    uploadedAt: '2026-03-20',
    content: `A Estrutura Narrativa e a Arte de Contar Histórias\n\nA estrutura de três atos é um modelo utilizado na escrita dramática que divide uma história em três partes fundamentais: Exposição, Confronto e Resolução.\n\nNo Primeiro Ato, o universo e os personagens são apresentados. O incidente incitante rompe o equilíbrio do protagonista, forçando-o a tomar uma decisão transformadora.\n\nNo Segundo Ato, os obstáculos se multiplicam. O protagonista enfrenta provações e derrotas temporárias, culminando no ponto de maior tensão ou crise da jornada.\n\nNo Terceiro Ato, ocorre o clímax: o confronto final onde os dilemas centrais da história são resolvidos. Em seguida, a narrativa se encerra com a consolidação de um novo equilíbrio.`
  }
];

// --- PERFIL & COMUNIDADE ---

const AVATAR_GRADIENTS = [
  'from-indigo-500 to-purple-600',
  'from-rose-500 to-orange-500',
  'from-emerald-500 to-teal-600',
  'from-sky-500 to-blue-700',
  'from-amber-500 to-red-500',
  'from-fuchsia-500 to-pink-600'
];

const PERFIL_INICIAL = {
  name: 'Autor',
  handle: 'autor',
  bio: '',
  favoriteGenre: '',
  avatarColor: AVATAR_GRADIENTS[0]
};

// Posts de exemplo (fictícios) para a comunidade não começar vazia
const POSTS_INICIAIS = [
  {
    id: 'p_seed_1',
    isMine: false,
    authorName: 'Marina Lopes',
    authorHandle: 'marinalopes',
    authorColor: AVATAR_GRADIENTS[1],
    text: 'Alguém mais travou no segundo ato? Estou testando o método Snowflake para destravar meu romance de fantasia. Dicas são bem-vindas!',
    createdAt: '2026-10-08T14:00:00.000Z',
    likes: 4,
    likedByMe: false,
    comments: [
      { id: 'c_seed_1', isMine: false, authorName: 'Caio Andrade', text: 'Funcionou muito para mim. Comece pela frase única e vá expandindo.', createdAt: '2026-10-08T16:30:00.000Z' }
    ],
    sharedBook: null
  },
  {
    id: 'p_seed_2',
    isMine: false,
    authorName: 'Caio Andrade',
    authorHandle: 'caioandrade',
    authorColor: AVATAR_GRADIENTS[2],
    text: 'Terminei o primeiro capítulo do meu thriller. Feedback honesto é sempre bem-vindo.',
    createdAt: '2026-10-09T09:15:00.000Z',
    likes: 2,
    likedByMe: false,
    comments: [],
    sharedBook: {
      title: 'Quarto Fechado',
      genre: 'Thriller',
      synopsis: 'Um detetive aposentado investiga um crime impossível em uma mansão trancada por dentro.',
      excerpt: 'Capítulo 1\n\nA chave estava do lado de dentro da porta. Ninguém entrara, ninguém saíra, e ainda assim havia um corpo no centro da biblioteca.\n\n"Isso não é possível", murmurou o inspetor, passando a mão pelo batente.'
    }
  }
];

const Avatar = ({ name, color, src, size = 'w-10 h-10', text = 'text-base' }) => (
  <div className={`${size} ${text} shrink-0 rounded-full bg-gradient-to-br ${color || AVATAR_GRADIENTS[0]} flex items-center justify-center text-white font-bold shadow-md`}>
    {src
      ? <img src={src} alt="" referrerPolicy="no-referrer" className="w-full h-full rounded-full object-cover" />
      : ((name || '?').trim().charAt(0).toUpperCase() || '?')}
  </div>
);

const formatPostDate = (iso) => {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
};

const APRENDIZAGEM_CONTEUDO = [
  {
    id: 'estruturas',
    title: 'Construção & Estruturas',
    icon: Compass,
    description: 'Modelos de arquitetura narrativa, controle de ritmo e métodos de expansão de enredo.',
    lessons: [
      {
        subtitle: 'Estrutura de 3 Atos',
        tag: 'Arquitetura',
        details: 'Divide a narrativa em Exposição (Incidente Incitante), Confronto (Pontos de Virada, Midpoint e Crise) e Resolução (Clímax e Novo Equilíbrio). Garante clareza e ritmo estruturado.'
      },
      {
        subtitle: 'Jornada do Herói (Monomito)',
        tag: 'Mito / Fantasia',
        details: 'Os 12 estágios consagrados por Joseph Campbell e Christopher Vogler: do Mundo Comum ao Retorno com o Elixir, passando pelo Chamado, Provações e a Ordalização.'
      },
      {
        subtitle: 'Método Snowflake (Floco de Neve)',
        tag: 'Planejamento',
        details: 'Desenvolvido por Randy Ingermanson. Comece construindo uma única frase explicativa e expanda sistematicamente para um parágrafo, fichas de personagens e, por fim, a escaleta detalhada.'
      },
      {
        subtitle: 'Ritmo & Tensão (Pacing)',
        tag: 'Técnica',
        details: 'Alternância estratégica entre Cenas de Ação (objetivo, conflito, desastre) e Sequências de Reflexão (reação, dilema, decisão) para manter o leitor engajado sem causar exaustão.'
      }
    ]
  },
  {
    id: 'personagens',
    title: 'Desenvolvimento de Personagens',
    icon: Users,
    description: 'Psicologia dos personagens, motivações profundas, arquétipos e tipos funcionais.',
    lessons: [
      {
        subtitle: 'A Ficha de Personagem Profunda',
        tag: 'Psicologia',
        details: 'Equilibre o Desejo Consciente (Want) com a Necessidade Inconsciente (Need). Defina a Ferida Primária (Ghost/Wound), a Mentira (The Lie) em que ele acredita e determine o Arco (Positivo, Negativo ou Estático).'
      },
      {
        subtitle: 'Tipos & Papéis Funcionais',
        tag: 'Elenco',
        details: 'Como escalar e equilibrar: Protagonista (motor da ação), Antagonista (força de oposição), Mentor, Coadjuvantes, Alívio Cômico, Camaleão e a Sombra.'
      },
      {
        subtitle: 'Arquétipos Junguianos na Literatura',
        tag: 'Teoria',
        details: 'Padrões universais do inconsciente coletivo: O Herói, O Sábio, O Rebelde, O Governante, O Criador, O Cuidador, O Inocente e O Amante.'
      }
    ]
  },
  {
    id: 'definicoes',
    title: 'Tipos, POV & Worldbuilding',
    icon: Lightbulb,
    description: 'Perspectivas narrativas, regras de construção de mundo e técnicas de prosa.',
    lessons: [
      {
        subtitle: 'Foco Narrativo / Ponto de Vista (POV)',
        tag: 'Perspectiva',
        details: '1ª Pessoa (íntima e visceral, com foco em narradores não confiáveis), 3ª Pessoa Limitada (imersão focada em um único personagem por cena) e 3ª Pessoa Onisciente (visão panorâmica e editorial).'
      },
      {
        subtitle: 'Construção de Mundo (Worldbuilding)',
        tag: 'Ambientação',
        details: 'Aplicações práticas das Leis de Sanderson para Sistemas de Magia (Duros vs. Macios), consistência geopolítica, aspectos socioculturais e atmosfera.'
      },
      {
        subtitle: "Show, Don't Tell (Mostre, Não Conte)",
        tag: 'Escrita',
        details: 'Demonstre emoções e intenções através de sensações viscerais, linguagem corporal e ações concretas em vez de resumos expositivos explícitos.'
      }
    ]
  },
  {
    id: 'tendencias',
    title: 'Gêneros & Mercado Editorial',
    icon: TrendingUp,
    description: 'Análise de gêneros em alta, nichos de leitores e publicação moderna.',
    lessons: [
      {
        subtitle: 'Fantasia & Romantasy',
        tag: 'Tendência Mercado',
        details: 'O fenômeno do Romantasy (subgêneros de fantasia com forte foco em romance e tensão interpessoal), High Fantasy e Urban Fantasy no mercado contemporâneo.'
      },
      {
        subtitle: 'Thriller & Ficção Policial',
        tag: 'Gênero',
        details: 'Técnicas de mistérios de quarto fechado (locked-room), procedurais investigativos, thrillers psicológicos e a construção de Plot Twists memoráveis.'
      },
      {
        subtitle: 'Ficção Científica (Sci-Fi)',
        tag: 'Gênero',
        details: 'Especificidades entre Cyberpunk, Space Opera, Solarpunk e Sci-Fi Hard (baseado em rigor científico).'
      },
      {
        subtitle: 'Mercado Digital & Autopublicação',
        tag: 'Carreira',
        details: 'Estratégias para Amazon Kindle Direct Publishing (KDP), otimização de metadados, capas atrativas e construção de comunidade de leitores.'
      }
    ]
  }
];

// --- LEITURA CONFORTÁVEL, PDF, MÚSICA E CONTA GOOGLE ---

// Crie um "OAuth Client ID" (tipo Aplicativo da Web) no Google Cloud Console e cole aqui.
// Adicione a origem do app (ex.: http://localhost:5173) em "Origens JavaScript autorizadas".
const GOOGLE_CLIENT_ID = 'COLE_SEU_CLIENT_ID.apps.googleusercontent.com';

// Worker via CDN, na mesma versão instalada (evita problemas de bundling no react-scripts).
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
const MAX_PDF_BYTES = 25 * 1024 * 1024;

// Junta as linhas quebradas do PDF em parágrafos (heurística: linhas curtas encerram parágrafo).
const reflowPdfText = (raw) => {
  const lines = raw.split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (lines.length === 0) return '';
  const lens = lines.map(l => l.length).sort((a, b) => a - b);
  const median = lens[Math.floor(lens.length / 2)];
  const paragraphs = [];
  let current = lines[0];
  let lastLen = lines[0].length;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (/[a-zà-ú]-$/i.test(current) && /^[a-zà-ú]/.test(line)) current = current.slice(0, -1) + line;
    else if (lastLen < median * 0.6 && !/[,;]$/.test(current)) { paragraphs.push(current); current = line; }
    else current += ' ' + line;
    lastLen = line.length;
  }
  paragraphs.push(current);
  return paragraphs.join('\n');
};

const extractPdf = async (buffer) => {
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  let raw = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const { items } = await page.getTextContent();
    raw += items.map(it => (it.str ?? '') + (it.hasEOL ? '\n' : '')).join('').replace(/\n?$/, '\n');
  }
  const numPages = pdf.numPages;
  await pdf.destroy();
  return { numPages, text: reflowPdfText(raw) };
};

const decodeJwt = (token) => {
  const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(payload), c => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
};

// --- Leitor com modo de leitura confortável ---
const READER_THEMES = {
  light: { bg: '#fafaf9', fg: '#1c1917', border: '#e7e5e4', label: 'Claro' },
  sepia: { bg: '#f4ecd8', fg: '#433422', border: '#e0d3b0', label: 'Sépia' },
  dark: { bg: '#0f172a', fg: '#cbd5e1', border: '#1e293b', label: 'Escuro' }
};

const ComfortReader = ({ title, pages, onClose, defaultTheme }) => {
  const [idx, setIdx] = useState(0);
  const [prefs, setPrefs] = useState({ theme: defaultTheme, size: 19, serif: true, spacing: 1.8, width: 65 });
  const scrollRef = useRef(null);
  const t = READER_THEMES[prefs.theme] || READER_THEMES.sepia;
  const total = pages.length || 1;

  useEffect(() => {
    let alive = true;
    dbGet('settings', 'readerPrefs').then(saved => { if (alive && saved) setPrefs(p => ({ ...p, ...saved })); });
    return () => { alive = false; };
  }, []);

  const update = (patch) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    dbSet('settings', next, 'readerPrefs');
  };
  const go = useCallback((d) => setIdx(i => Math.min(total - 1, Math.max(0, i + d))), [total]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); }, [idx]);

  const btn = (active) => `px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${active ? 'bg-indigo-600 border-indigo-600 text-white' : 'hover:bg-black/10'}`;
  const opts = (list, key) => list.map(([label, val]) => (
    <button key={label} type="button" onClick={() => update({ [key]: val })} className={btn(prefs[key] === val)} style={{ borderColor: t.border }} aria-pressed={prefs[key] === val}>{label}</button>
  ));
  const nav = 'flex items-center gap-1 px-3 py-1.5 rounded-lg border disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black/10';

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex flex-col" style={{ background: t.bg, color: t.fg }}>
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b" style={{ borderColor: t.border }}>
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="w-5 h-5 text-indigo-500 shrink-0" />
          <h3 className="font-bold text-sm truncate">{title}</h3>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/10" aria-label="Fechar leitor">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 border-b text-xs" style={{ borderColor: t.border }}>
        <div className="flex items-center gap-1">
          {Object.entries(READER_THEMES).map(([key, v]) => (
            <button key={key} type="button" onClick={() => update({ theme: key })} className={btn(prefs.theme === key)} style={{ borderColor: v.border }} aria-pressed={prefs.theme === key}>{v.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => update({ size: Math.max(14, prefs.size - 1) })} className={btn(false)} style={{ borderColor: t.border }} aria-label="Diminuir letra">A−</button>
          <span className="w-8 text-center tabular-nums">{prefs.size}</span>
          <button type="button" onClick={() => update({ size: Math.min(32, prefs.size + 1) })} className={btn(false)} style={{ borderColor: t.border }} aria-label="Aumentar letra">A+</button>
        </div>
        <div className="flex items-center gap-1">{opts([['Serifa', true], ['Sem serifa', false]], 'serif')}</div>
        <div className="flex items-center gap-1">{opts([['Estreita', 50], ['Média', 65], ['Larga', 80]], 'width')}</div>
        <div className="flex items-center gap-1">{opts([['Compacto', 1.5], ['Normal', 1.8], ['Amplo', 2.1]], 'spacing')}</div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-8">
        <article
          className="mx-auto whitespace-pre-wrap break-words"
          style={{
            maxWidth: `${prefs.width}ch`,
            fontSize: `${prefs.size}px`,
            lineHeight: prefs.spacing,
            fontFamily: prefs.serif ? 'Georgia, "Times New Roman", serif' : 'system-ui, -apple-system, "Segoe UI", sans-serif'
          }}
        >
          {pages[idx]}
        </article>
      </div>

      <div className="border-t" style={{ borderColor: t.border }}>
        <div className="h-1" style={{ background: t.border }}>
          <div className="h-full bg-indigo-500 transition-all" style={{ width: `${((idx + 1) / total) * 100}%` }} />
        </div>
        <div className="flex items-center justify-between px-4 py-3 text-xs">
          <button type="button" disabled={idx === 0} onClick={() => go(-1)} className={nav} style={{ borderColor: t.border }}>
            <ChevronLeft className="w-4 h-4" /> Anterior
          </button>
          <span>Página {idx + 1} de {total}</span>
          <button type="button" disabled={idx >= total - 1} onClick={() => go(1)} className={nav} style={{ borderColor: t.border }}>
            Próxima <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Player de música (playlists do YouTube via IFrame API) ---
const MUSIC_PRESETS = [
  { id: 'lofi-louvor', name: 'Lo-Fi Cristão • Louvor' },
  { id: 'lofi-oracao', name: 'Lo-Fi Cristão • Oração e foco' },
  { id: 'lofi-hinos', name: 'Lo-Fi Cristão • Hinos' }
];

const getPlaylistId = (url = '') => (String(url).match(/[?&]list=([A-Za-z0-9_-]{10,})/) || [])[1] || '';

let ytApiPromise = null;
const loadYouTubeApi = () => {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!ytApiPromise) {
    ytApiPromise = new Promise((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT); };
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.onerror = () => { ytApiPromise = null; reject(new Error('Falha ao carregar a API do YouTube')); };
      document.head.appendChild(tag);
    });
  }
  return ytApiPromise;
};

const MusicPlayer = ({ isDark, showNotification }) => {
  const [links, setLinks] = useState({});
  const [presetId, setPresetId] = useState(MUSIC_PRESETS[0].id);
  const [linkDraft, setLinkDraft] = useState('');
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [trackTitle, setTrackTitle] = useState('');
  const [volume, setVolume] = useState(60);
  const holderRef = useRef(null);
  const playerRef = useRef(null);
  const volumeRef = useRef(60);

  const listId = getPlaylistId(links[presetId]);

  useEffect(() => {
    dbGet('settings', 'musicLinks').then(saved => { if (saved) setLinks(saved); });
  }, []);

  useEffect(() => {
    setReady(false);
    setPlaying(false);
    setTrackTitle('');
    if (!listId || !holderRef.current) return;
    let cancelled = false;
    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !holderRef.current) return;
        holderRef.current.innerHTML = '';
        const mount = document.createElement('div');
        holderRef.current.appendChild(mount);
        playerRef.current = new YT.Player(mount, {
          width: '100%',
          height: '200',
          playerVars: { listType: 'playlist', list: listId, playsinline: 1, rel: 0 },
          events: {
            onReady: (e) => { e.target.setVolume(volumeRef.current); setReady(true); },
            onStateChange: (e) => {
              setPlaying(e.data === 1);
              const title = e.target.getVideoData?.().title;
              if (title) setTrackTitle(title);
            }
          }
        });
      })
      .catch(() => showNotification('Não foi possível carregar o player do YouTube.'));
    return () => {
      cancelled = true;
      try { playerRef.current?.destroy(); } catch { /* ignore */ }
      playerRef.current = null;
    };
  }, [listId, showNotification]);

  const call = (fn, ...args) => { try { playerRef.current?.[fn]?.(...args); } catch { /* ignore */ } };
  const onVolume = (v) => { setVolume(v); volumeRef.current = v; call('setVolume', v); };

  const persist = (next) => { setLinks(next); dbSet('settings', next, 'musicLinks'); };
  const saveLink = () => {
    const url = linkDraft.trim();
    if (!getPlaylistId(url)) {
      showNotification('Cole o link de uma playlist do YouTube (precisa conter "list=").');
      return;
    }
    persist({ ...links, [presetId]: url });
    setLinkDraft('');
  };
  const clearLink = () => {
    const next = { ...links };
    delete next[presetId];
    persist(next);
  };

  const round = `p-2 rounded-full disabled:opacity-40 transition-colors ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`;

  return (
    <aside className={`rounded-2xl border p-5 space-y-4 lg:sticky lg:top-24 ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
      <h2 className="font-bold flex items-center gap-2">
        <Music className="w-5 h-5 text-indigo-500" /> Música para ler
      </h2>

      <div className="flex flex-col gap-2">
        {MUSIC_PRESETS.map(p => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPresetId(p.id)}
            aria-pressed={presetId === p.id}
            className={`text-left px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
              presetId === p.id
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-300 hover:bg-slate-100'
            }`}
          >
            {p.name}{links[p.id] ? '' : ' (sem link)'}
          </button>
        ))}
      </div>

      <div ref={holderRef} className={`rounded-xl overflow-hidden ${listId ? '' : 'hidden'}`} />

      {listId ? (
        <>
          <p className="text-xs text-slate-500 truncate" title={trackTitle}>{trackTitle || 'Carregando playlist...'}</p>
          <div className="flex items-center justify-center gap-2">
            <button type="button" disabled={!ready} onClick={() => call('previousVideo')} className={round} aria-label="Faixa anterior">
              <SkipBack className="w-5 h-5" />
            </button>
            <button
              type="button"
              disabled={!ready}
              onClick={() => call(playing ? 'pauseVideo' : 'playVideo')}
              className="p-3 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition-colors"
              aria-label={playing ? 'Pausar' : 'Tocar'}
            >
              {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <button type="button" disabled={!ready} onClick={() => call('nextVideo')} className={round} aria-label="Próxima faixa">
              <SkipForward className="w-5 h-5" />
            </button>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            <Volume2 className="w-4 h-4" />
            <input type="range" min="0" max="100" value={volume} onChange={(e) => onVolume(Number(e.target.value))} className="flex-1 accent-indigo-500" aria-label="Volume" />
          </label>
          <button type="button" onClick={clearLink} className="text-xs text-rose-500 hover:underline">Trocar o link desta playlist</button>
        </>
      ) : (
        <div className="space-y-2">
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Cole o link de uma playlist de lo-fi cristão do YouTube para ouvir aqui.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={linkDraft}
              onChange={(e) => setLinkDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveLink(); }}
              placeholder="https://youtube.com/playlist?list=..."
              className={`flex-1 min-w-0 px-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
              }`}
            />
            <button type="button" onClick={saveLink} className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium">Salvar</button>
          </div>
        </div>
      )}
    </aside>
  );
};

// --- Vínculo com conta Google (Google Identity Services) ---
const GIS_SRC = 'https://accounts.google.com/gsi/client';

const GoogleLinkCard = ({ google, isDark, onLink, onUnlink }) => {
  const btnRef = useRef(null);
  const cbRef = useRef(onLink);
  cbRef.current = onLink;
  const configured = !GOOGLE_CLIENT_ID.startsWith('COLE_');

  useEffect(() => {
    if (google || !configured) return;
    let cancelled = false;
    const init = () => {
      if (cancelled || !window.google?.accounts?.id || !btnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (resp) => { try { cbRef.current(decodeJwt(resp.credential)); } catch { /* ignore */ } }
      });
      window.google.accounts.id.renderButton(btnRef.current, {
        theme: isDark ? 'filled_black' : 'outline', size: 'large', text: 'continue_with', shape: 'pill', locale: 'pt-BR'
      });
    };
    if (window.google?.accounts?.id) {
      init();
      return () => { cancelled = true; };
    }
    let tag = document.querySelector(`script[src="${GIS_SRC}"]`);
    if (!tag) {
      tag = document.createElement('script');
      tag.src = GIS_SRC;
      tag.async = true;
      document.head.appendChild(tag);
    }
    tag.addEventListener('load', init);
    return () => { cancelled = true; tag.removeEventListener('load', init); };
  }, [google, configured, isDark]);

  return (
    <div className={`w-full mt-6 pt-6 border-t text-left ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
      <p className="text-xs font-semibold text-slate-500 mb-3">Conta Google</p>
      {google ? (
        <div className="flex items-center gap-3">
          {google.picture && <img src={google.picture} alt="" referrerPolicy="no-referrer" className="w-9 h-9 rounded-full" />}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{google.name}</p>
            <p className="text-xs text-slate-500 truncate">{google.email}</p>
          </div>
          <button type="button" onClick={onUnlink} className="p-2 rounded-lg hover:bg-rose-500/10 text-rose-500 transition-colors" title="Desvincular conta Google">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      ) : configured ? (
        <div ref={btnRef} />
      ) : (
        <p className="text-xs text-amber-500">Defina GOOGLE_CLIENT_ID no topo do App.jsx para ativar o vínculo.</p>
      )}
    </div>
  );
};

// --- Aba "Leitura": PDFs + comunidade + música ---
const ReadingTab = ({ isDark, pdfs, busy, publishedIds, communityReads, onUpload, onRead, onDelete, onTogglePublish, onSendFile, onOpenOriginal, showNotification }) => {
  const inputRef = useRef(null);
  const muted = isDark ? 'text-slate-400' : 'text-slate-600';
  const card = isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200';
  const ghost = `px-3 py-1.5 rounded-lg border text-xs transition-colors whitespace-nowrap flex items-center gap-1.5 ${isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-300 hover:bg-slate-100'}`;

  return (
    <div className="space-y-6">
      <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Leitura</h1>
          <p className={`text-sm mt-1 ${muted}`}>Adicione PDFs, leia em modo confortável e compartilhe com outros autores.</p>
        </div>
        <input
          type="file"
          ref={inputRef}
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; onUpload(f); }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium shadow-lg shadow-indigo-600/30 transition-all"
        >
          <FileUp className="w-4 h-4" /> {busy ? 'Processando...' : 'Adicionar PDF'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-8">

          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-500" /> Meus PDFs ({pdfs.length})
            </h2>
            {pdfs.length === 0 && (
              <p className={`text-sm ${muted}`}>Nenhum PDF ainda. Clique em "Adicionar PDF" para começar.</p>
            )}
            <div className="space-y-3">
              {pdfs.map(pdf => {
                const published = !!pdf.sharedPostId && publishedIds.has(pdf.sharedPostId);
                return (
                  <div key={pdf.id} className={`p-4 rounded-xl border ${card}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2.5 bg-indigo-600/10 text-indigo-400 rounded-lg"><FileText className="w-5 h-5" /></div>
                      <div className="min-w-0">
                        <h4 className="font-semibold text-sm truncate">{pdf.title}</h4>
                        <p className="text-xs text-slate-500 truncate">{pdf.numPages} págs • {pdf.size}{published ? ' • publicado na comunidade' : ''}</p>
                      </div>
                    </div>
                    {pdf.scanned && (
                      <p className="text-xs text-amber-500 mt-2">Sem texto selecionável (provável PDF escaneado): o modo confortável não está disponível, mas dá para abrir o original.</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <button type="button" disabled={pdf.scanned} onClick={() => onRead({ title: pdf.title, content: pdf.text })} className={`${ghost} text-indigo-400 disabled:opacity-40`}>
                        <BookOpen className="w-3.5 h-3.5" /> Ler
                      </button>
                      <button type="button" onClick={() => onOpenOriginal(pdf)} className={ghost}>Abrir original</button>
                      <button type="button" onClick={() => onTogglePublish(pdf)} className={ghost}>
                        <Share2 className="w-3.5 h-3.5" /> {published ? 'Remover da comunidade' : 'Publicar na comunidade'}
                      </button>
                      <button type="button" onClick={() => onSendFile(pdf)} className={ghost}>Enviar arquivo</button>
                      <button type="button" onClick={() => onDelete(pdf)} className="p-2 rounded-lg hover:bg-rose-500/10 text-rose-500 transition-colors ml-auto" title="Remover PDF">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-indigo-500" /> Da comunidade ({communityReads.length})
            </h2>
            {communityReads.length === 0 && (
              <p className={`text-sm ${muted}`}>Quando outros autores publicarem livros ou PDFs, eles aparecem aqui.</p>
            )}
            <div className="space-y-3">
              {communityReads.map(item => (
                <div key={item.id} className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${card}`}>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-sm truncate">{item.title}</h4>
                    <p className="text-xs text-slate-500 truncate">{item.kind === 'pdf' ? 'PDF' : 'Livro'} • {item.meta} • por {item.author} (@{item.handle})</p>
                  </div>
                  <button type="button" onClick={() => onRead({ title: item.title, content: item.content })} className={`${ghost} text-indigo-400`}>
                    <BookOpen className="w-3.5 h-3.5" /> Ler
                  </button>
                </div>
              ))}
            </div>
          </section>

        </div>

        <MusicPlayer isDark={isDark} showNotification={showNotification} />
      </div>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL ---

export default function EstudioApp() {
  const [theme, setTheme] = useState('dark');
  const [activeTab, setActiveTab] = useState('library');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const [books, setBooks] = useState([]);
  const [myPdfs, setMyPdfs] = useState([]);
  const [pdfs, setPdfs] = useState([]);
  const [pdfBusy, setPdfBusy] = useState(false);

  const [selectedBookId, setSelectedBookId] = useState('');
  const [saveStatus, setSaveStatus] = useState('salvo');

  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const [selectedModule, setSelectedModule] = useState(APRENDIZAGEM_CONTEUDO[0].id);
  const [searchTerm, setSearchTerm] = useState('');

  const [flipbookActive, setFlipbookActive] = useState(false);
  const [flipbookBook, setFlipbookBook] = useState(null);
  const [, setCurrentPageIndex] = useState(0);
  const [fontSize, setFontSize] = useState(16);

  // Perfil & Comunidade
  const [profile, setProfile] = useState(PERFIL_INICIAL);
  const [profileDraft, setProfileDraft] = useState(PERFIL_INICIAL);
  const [posts, setPosts] = useState([]);
  const [newPostText, setNewPostText] = useState('');
  const [shareBookId, setShareBookId] = useState('');
  const [commentDrafts, setCommentDrafts] = useState({});
  const [feedFilter, setFeedFilter] = useState('all');

  const [toast, setToast] = useState(null);
  const jsonFileInputRef = useRef(null);
  const docFileInputRef = useRef(null);
  const toastTimerRef = useRef(null);
  const currentBookRef = useRef(null);

  // Carregamento inicial do IndexedDB
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const savedTheme = await dbGet('settings', 'theme');
        if (savedTheme && isMounted) setTheme(savedTheme);

        const savedBooks = await dbGet('books');
        if (savedBooks && savedBooks.length > 0) {
          if (isMounted) {
            setBooks(savedBooks);
            setSelectedBookId(savedBooks[0].id);
          }
        } else {
          if (isMounted) {
            setBooks(LIVROS_INICIAIS);
            setSelectedBookId(LIVROS_INICIAIS[0].id);
          }
          for (const b of LIVROS_INICIAIS) {
            await dbSet('books', b);
          }
        }

        const savedPdfs = await dbGet('documents');
        if (savedPdfs && savedPdfs.length > 0) {
          if (isMounted) setMyPdfs(savedPdfs);
        } else {
          if (isMounted) setMyPdfs(PDFS_INICIAIS);
          for (const d of PDFS_INICIAIS) {
            await dbSet('documents', d);
          }
        }

        const savedProfile = await dbGet('settings', 'profile');
        if (savedProfile && isMounted) {
          setProfile(savedProfile);
          setProfileDraft(savedProfile);
        }

        const savedPdfFiles = await dbGet('pdfs');
        if (savedPdfFiles && isMounted) setPdfs(savedPdfFiles);

        const savedPosts = await dbGet('posts');
        if (savedPosts && savedPosts.length > 0) {
          if (isMounted) setPosts(savedPosts);
        } else {
          if (isMounted) setPosts(POSTS_INICIAIS);
          for (const p of POSTS_INICIAIS) {
            await dbSet('posts', p);
          }
        }
      } catch (err) {
        console.error('Erro ao carregar dados do IndexedDB:', err);
        // Fallback: o app continua funcionando em memória
        if (isMounted) {
          setBooks(LIVROS_INICIAIS);
          setSelectedBookId(LIVROS_INICIAIS[0].id);
          setMyPdfs(PDFS_INICIAIS);
          setPosts(POSTS_INICIAIS);
        }
      } finally {
        if (isMounted) setIsLoaded(true);
      }
    }
    loadData();
    return () => {
      isMounted = false;
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const currentBook = useMemo(() => {
    return books.find(b => b.id === selectedBookId) || books[0] || { id: '', title: '', content: '', author: '', genre: '', synopsis: '' };
  }, [books, selectedBookId]);

  useEffect(() => {
    currentBookRef.current = currentBook;
  }, [currentBook]);

  const currentBookWords = useMemo(() => {
    return calculateWords(currentBook?.content || '');
  }, [currentBook?.content]);

  const showNotification = useCallback((msg) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // Autosave com debounce
  useEffect(() => {
    if (!isLoaded || !selectedBookId) return;

    const targetBook = books.find(b => b.id === selectedBookId);
    if (!targetBook) return;

    setSaveStatus('salvando');
    const handler = setTimeout(async () => {
      const success = await dbSet('books', targetBook);
      setSaveStatus(success ? 'salvo' : 'erro');
    }, 1000);

    return () => clearTimeout(handler);
  }, [books, selectedBookId, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    dbSet('settings', theme, 'theme');
  }, [theme, isLoaded]);

  // Atalho Ctrl+S / Cmd+S
  useEffect(() => {
    const handleGlobalKeyDown = async (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        const activeBook = currentBookRef.current;
        if (activeBook && activeBook.id) {
          const ok = await dbSet('books', activeBook);
          setSaveStatus(ok ? 'salvo' : 'erro');
          showNotification(ok ? 'Projeto salvo com sucesso!' : 'Erro ao salvar o projeto.');
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [showNotification]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleTitleChange = (newTitle) => {
    setBooks(prev => prev.map(b => (b.id === selectedBookId ? { ...b, title: newTitle } : b)));
  };

  const handleContentChange = (newContent) => {
    setBooks(prev => prev.map(b => (b.id === selectedBookId ? { ...b, content: newContent } : b)));
  };

  const handleCreateNewBook = () => {
    const newBook = {
      id: `b_${Date.now()}`,
      title: 'Novo Manuscrito',
      author: 'Autor',
      genre: 'Geral',
      coverColor: 'from-blue-600 to-indigo-800',
      synopsis: 'Sem sinopse.',
      content: ''
    };
    setBooks(prev => [newBook, ...prev]);
    setSelectedBookId(newBook.id);
    setActiveTab('editor');
    showNotification('Novo manuscrito criado!');
  };

  const confirmDeleteBook = (id) => {
    if (books.length <= 1) {
      showNotification('Você deve manter ao menos um projeto ativo.');
      return;
    }
    setDeleteConfirmId(id);
  };

  const executeDeleteBook = async () => {
    if (!deleteConfirmId) return;
    const id = deleteConfirmId;
    try {
      const filtered = books.filter(b => b.id !== id);
      setBooks(filtered);
      await dbDelete('books', id);
      if (selectedBookId === id && filtered.length > 0) {
        setSelectedBookId(filtered[0].id);
      }
      showNotification('Projeto removido com sucesso.');
    } catch (error) {
      console.error('Erro ao excluir manuscrito:', error);
      showNotification('Erro ao excluir o manuscrito.');
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleDeleteDoc = async (id) => {
    setMyPdfs(prev => prev.filter(d => d.id !== id));
    await dbDelete('documents', id);
    showNotification('Documento removido.');
  };

  const handleExportJSON = (book) => {
    const jsonString = JSON.stringify(book, null, 2);
    const fileName = `${(book.title || 'projeto').toLowerCase().replace(/[^a-z0-9]/g, '_')}.json`;
    triggerSecureDownload(jsonString, fileName, 'application/json');
    showNotification('Projeto exportado em JSON!');
  };

  const handleExportTXT = (book) => {
    const textContent = `${book.title}\n\n${book.content}`;
    const fileName = `${(book.title || 'manuscrito').toLowerCase().replace(/[^a-z0-9]/g, '_')}.txt`;
    triggerSecureDownload(textContent, fileName, 'text/plain;charset=utf-8');
    showNotification('Manuscrito baixado em TXT!');
  };

  const handleImportJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showNotification('Erro: Arquivo excede o limite de 10MB.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (typeof imported !== 'object' || imported === null || !imported.title || imported.content === undefined) {
          throw new Error('Formato inválido');
        }
        const newBook = {
          id: `b_imp_${Date.now()}`,
          title: sanitizeInput(imported.title || 'Projeto Importado').slice(0, 100),
          author: sanitizeInput(imported.author || 'Desconhecido').slice(0, 80),
          genre: sanitizeInput(imported.genre || 'Geral').slice(0, 50),
          coverColor: typeof imported.coverColor === 'string' ? imported.coverColor : 'from-indigo-600 to-purple-800',
          synopsis: sanitizeInput(imported.synopsis || '').slice(0, 500),
          content: String(imported.content || '')
        };
        setBooks(prev => [newBook, ...prev]);
        setSelectedBookId(newBook.id);
        showNotification(`Projeto "${newBook.title}" importado!`);
      } catch {
        showNotification('Erro: Arquivo JSON de projeto inválido ou corrompido.');
      }
    };
    reader.onerror = () => showNotification('Erro ao ler o arquivo.');
    reader.readAsText(file);
    e.target.value = '';
  };

  // Upload de documentos de apoio (.txt / .md)
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showNotification('Erro: Documento excede o limite de 5MB.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const newDoc = {
        id: `doc_${Date.now()}`,
        title: sanitizeInput(file.name.replace(/\.[^.]+$/, '')).slice(0, 100) || 'Documento',
        fileName: sanitizeInput(file.name).slice(0, 120),
        size: formatFileSize(file.size),
        uploadedAt: new Date().toISOString().slice(0, 10),
        content: String(event.target.result || '')
      };
      setMyPdfs(prev => [newDoc, ...prev]);
      await dbSet('documents', newDoc);
      showNotification(`Documento "${newDoc.title}" anexado!`);
    };
    reader.onerror = () => showNotification('Erro ao ler o documento.');
    reader.readAsText(file);
    e.target.value = '';
  };

  // --- PERFIL ---
  const handleSaveProfile = async () => {
    const clean = {
      name: sanitizeInput(profileDraft.name).slice(0, 60) || 'Autor',
      handle: sanitizeInput(profileDraft.handle).toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24) || 'autor',
      bio: sanitizeInput(profileDraft.bio).slice(0, 300),
      favoriteGenre: sanitizeInput(profileDraft.favoriteGenre).slice(0, 50),
      avatarColor: profileDraft.avatarColor || AVATAR_GRADIENTS[0],
      google: profile.google || null
    };
    setProfile(clean);
    setProfileDraft(clean);
    const ok = await dbSet('settings', clean, 'profile');
    showNotification(ok ? 'Perfil atualizado!' : 'Erro ao salvar o perfil.');
  };

  const profileStats = useMemo(() => {
    const myPosts = posts.filter(p => p.isMine);
    return {
      manuscripts: books.length,
      words: books.reduce((sum, b) => sum + calculateWords(b.content), 0),
      posts: myPosts.length,
      likes: myPosts.reduce((sum, p) => sum + (p.likes || 0), 0)
    };
  }, [books, posts]);

  // --- COMUNIDADE ---
  const sortedPosts = useMemo(() => {
    const list = feedFilter === 'mine' ? posts.filter(p => p.isMine) : posts;
    return [...list].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }, [posts, feedFilter]);

  const updatePost = async (id, updater) => {
    const target = posts.find(p => p.id === id);
    if (!target) return;
    const updated = updater(target);
    setPosts(prev => prev.map(p => (p.id === id ? updated : p)));
    await dbSet('posts', updated);
  };

  const handleCreatePost = async () => {
    const text = sanitizeInput(newPostText).slice(0, 1000);
    const book = books.find(b => b.id === shareBookId);
    if (!text && !book) {
      showNotification('Escreva algo ou escolha um manuscrito para compartilhar.');
      return;
    }
    const post = {
      id: `p_${Date.now()}`,
      isMine: true,
      authorName: '',
      authorHandle: '',
      authorColor: '',
      text,
      createdAt: new Date().toISOString(),
      likes: 0,
      likedByMe: false,
      comments: [],
      sharedBook: book
        ? {
            title: book.title,
            genre: book.genre,
            synopsis: book.synopsis,
            excerpt: (book.content || '').slice(0, 2000)
          }
        : null
    };
    setPosts(prev => [post, ...prev]);
    await dbSet('posts', post);
    setNewPostText('');
    setShareBookId('');
    setFeedFilter('all');
    showNotification('Publicado na comunidade!');
  };

  const handleToggleLike = (id) => {
    updatePost(id, p => ({
      ...p,
      likedByMe: !p.likedByMe,
      likes: Math.max(0, (p.likes || 0) + (p.likedByMe ? -1 : 1))
    }));
  };

  const handleAddComment = (id) => {
    const text = sanitizeInput(commentDrafts[id] || '').slice(0, 500);
    if (!text) return;
    updatePost(id, p => ({
      ...p,
      comments: [
        ...(p.comments || []),
        { id: `c_${Date.now()}`, isMine: true, authorName: '', text, createdAt: new Date().toISOString() }
      ]
    }));
    setCommentDrafts(prev => ({ ...prev, [id]: '' }));
  };

  const handleDeletePost = async (id) => {
    setPosts(prev => prev.filter(p => p.id !== id));
    await dbDelete('posts', id);
    showNotification('Publicação removida.');
  };

  // --- PDFs ---
  const handleUploadPdf = async (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
      showNotification('Selecione um arquivo PDF.');
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      showNotification('Erro: PDF excede o limite de 25MB.');
      return;
    }
    setPdfBusy(true);
    try {
      const { numPages, text } = await extractPdf(await file.arrayBuffer());
      const scanned = text.replace(/\s/g, '').length < numPages * 40;
      const record = {
        id: `pdf_${Date.now()}`,
        title: sanitizeInput(file.name.replace(/\.[^.]+$/, '')).slice(0, 100) || 'PDF',
        fileName: sanitizeInput(file.name).slice(0, 120),
        size: formatFileSize(file.size),
        numPages,
        uploadedAt: new Date().toISOString().slice(0, 10),
        text,
        scanned,
        blob: file,
        sharedPostId: null
      };
      const ok = await dbSet('pdfs', record);
      setPdfs(prev => [record, ...prev]);
      showNotification(
        !ok ? 'PDF aberto, mas não foi possível salvá-lo no navegador.'
          : scanned ? 'PDF adicionado, mas sem texto selecionável (provável escaneado).'
          : `PDF "${record.title}" adicionado!`
      );
    } catch (err) {
      console.error('Erro ao processar PDF:', err);
      showNotification('Não foi possível ler este PDF (protegido por senha ou corrompido?).');
    } finally {
      setPdfBusy(false);
    }
  };

  const handleDeletePdf = async (pdf) => {
    if (pdf.sharedPostId) await handleDeletePost(pdf.sharedPostId);
    setPdfs(prev => prev.filter(p => p.id !== pdf.id));
    await dbDelete('pdfs', pdf.id);
    showNotification('PDF removido.');
  };

  const handleTogglePublishPdf = async (pdf) => {
    const isPublished = !!pdf.sharedPostId && posts.some(p => p.id === pdf.sharedPostId);
    if (isPublished) {
      await handleDeletePost(pdf.sharedPostId);
      const updated = { ...pdf, sharedPostId: null };
      setPdfs(prev => prev.map(p => (p.id === pdf.id ? updated : p)));
      await dbSet('pdfs', updated);
      return;
    }
    if (pdf.scanned) {
      showNotification('Este PDF não tem texto para compartilhar no leitor.');
      return;
    }
    const post = {
      id: `p_${Date.now()}`,
      isMine: true,
      authorName: '',
      authorHandle: '',
      authorColor: '',
      text: '',
      createdAt: new Date().toISOString(),
      likes: 0,
      likedByMe: false,
      comments: [],
      sharedBook: null,
      sharedPdf: { title: pdf.title, numPages: pdf.numPages, text: pdf.text }
    };
    setPosts(prev => [post, ...prev]);
    await dbSet('posts', post);
    const updated = { ...pdf, sharedPostId: post.id };
    setPdfs(prev => prev.map(p => (p.id === pdf.id ? updated : p)));
    await dbSet('pdfs', updated);
    showNotification('PDF publicado na comunidade!');
  };

  const handleSendPdfFile = async (pdf) => {
    const name = pdf.fileName || 'documento.pdf';
    const file = new File([pdf.blob], name, { type: 'application/pdf' });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: pdf.title });
      } else {
        triggerSecureDownload(pdf.blob, name, 'application/pdf');
        showNotification('Compartilhamento nativo indisponível aqui; o PDF foi baixado.');
      }
    } catch (err) {
      if (err?.name !== 'AbortError') showNotification('Não foi possível compartilhar o arquivo.');
    }
  };

  const handleOpenPdfOriginal = (pdf) => {
    const url = URL.createObjectURL(pdf.blob);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const publishedIds = useMemo(() => new Set(posts.map(p => p.id)), [posts]);

  const communityReads = useMemo(() => posts
    .filter(p => !p.isMine && (p.sharedBook || p.sharedPdf))
    .map(p => ({
      id: p.id,
      kind: p.sharedPdf ? 'pdf' : 'book',
      title: (p.sharedPdf || p.sharedBook).title,
      author: p.authorName,
      handle: p.authorHandle,
      meta: p.sharedPdf ? `${p.sharedPdf.numPages} páginas` : (p.sharedBook.genre || 'Geral'),
      content: p.sharedPdf ? p.sharedPdf.text : p.sharedBook.excerpt
    })), [posts]);

  // --- CONTA GOOGLE ---
  const handleGoogleLink = async (g) => {
    const google = { sub: g.sub, email: g.email, name: g.name, picture: g.picture, linkedAt: new Date().toISOString() };
    const useGoogleName = (!profile.name || profile.name === 'Autor') && g.name;
    const nameFromGoogle = useGoogleName ? { name: sanitizeInput(g.name).slice(0, 60) } : {};
    const next = { ...profile, google, ...nameFromGoogle };
    setProfile(next);
    setProfileDraft(prev => ({ ...prev, google, ...nameFromGoogle }));
    const ok = await dbSet('settings', next, 'profile');
    showNotification(ok ? `Conta Google vinculada: ${g.email}` : 'Erro ao salvar o vínculo.');
  };

  const handleGoogleUnlink = async () => {
    window.google?.accounts?.id?.disableAutoSelect?.();
    const next = { ...profile, google: null };
    setProfile(next);
    setProfileDraft(prev => ({ ...prev, google: null }));
    await dbSet('settings', next, 'profile');
    showNotification('Conta Google desvinculada.');
  };

  // Paginação do leitor (Flipbook)
  const pages = useMemo(() => {
    if (!flipbookBook) return ['Sem conteúdo para exibição.'];
    const fullText = flipbookBook.content || 'Conteúdo em branco.';
    const paragraphs = fullText.split('\n');
    const resultPages = [];
    let currentPage = '';
    const WORDS_PER_PAGE = 220;

    for (const p of paragraphs) {
      const pageWordCount = calculateWords(currentPage);
      const paragraphWordCount = calculateWords(p);

      if (pageWordCount + paragraphWordCount > WORDS_PER_PAGE && currentPage.length > 0) {
        resultPages.push(currentPage.trim());
        currentPage = p + '\n\n';
      } else {
        currentPage += p + '\n\n';
      }
    }

    if (currentPage.trim().length > 0) {
      resultPages.push(currentPage.trim());
    }

    return resultPages.length > 0 ? resultPages : ['Sem conteúdo para exibição.'];
  }, [flipbookBook]);

  const openFlipbook = (book) => {
    setFlipbookBook(book);
    setCurrentPageIndex(0);
    setFlipbookActive(true);
  };

  const closeFlipbook = () => {
    setFlipbookActive(false);
    setFlipbookBook(null);
  };

  const filteredLessons = useMemo(() => {
    const activeMod = APRENDIZAGEM_CONTEUDO.find(m => m.id === selectedModule) || APRENDIZAGEM_CONTEUDO[0];
    if (!searchTerm.trim()) return activeMod.lessons;

    const term = searchTerm.toLowerCase();
    return activeMod.lessons.filter(l =>
      l.subtitle.toLowerCase().includes(term) ||
      l.details.toLowerCase().includes(term) ||
      l.tag.toLowerCase().includes(term)
    );
  }, [selectedModule, searchTerm]);

  const isDark = theme === 'dark';

  const navItems = [
    { id: 'library', label: 'Biblioteca', Icon: BookOpen },
    { id: 'editor', label: 'Editor Pro', Icon: Edit3 },
    { id: 'reading', label: 'Leitura', Icon: FileText },
    { id: 'community', label: 'Comunidade', Icon: Globe },
    { id: 'learning', label: 'Aprendizado', Icon: GraduationCap },
    { id: 'profile', label: 'Perfil', Icon: User }
  ];

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>

      {/* HEADER */}
      <header className={`sticky top-0 z-30 border-b backdrop-blur-md ${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-slate-200'}`}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">

          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={`p-2 rounded-lg md:hidden ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
              aria-label="Alternar menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/30">
                <Feather className="w-5 h-5" />
              </div>
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">
                Estúdio Narrativo
              </span>
            </div>
          </div>

          {/* NAVEGAÇÃO DESKTOP */}
          <nav className={`hidden md:flex items-center gap-1 p-1 rounded-xl border ${isDark ? 'bg-slate-800/20 border-slate-700/30' : 'bg-slate-100 border-slate-200'}`}>
            {navItems.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === id
                    ? 'bg-indigo-600 text-white shadow-md'
                    : isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </nav>

          {/* TEMA */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-xl border transition-all ${
                isDark
                  ? 'bg-slate-900 border-slate-800 text-amber-400 hover:bg-slate-800'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
              title="Alternar Tema"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* MENU MOBILE */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className={`relative w-64 max-w-xs flex-1 flex flex-col py-6 px-4 shadow-xl ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-800'}`}>
            <div className="flex items-center justify-between mb-8">
              <span className="font-bold text-lg text-indigo-500">Navegação</span>
              <button onClick={() => setSidebarOpen(false)} className="p-1 rounded-lg hover:bg-slate-800/20" aria-label="Fechar menu">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {navItems.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => { setActiveTab(id); setSidebarOpen(false); }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-medium ${activeTab === id ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800/10'}`}
                >
                  <Icon className="w-5 h-5" /> {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6">

        {/* --- LEITURA (PDFs + MÚSICA) --- */}
        <div className={activeTab === 'reading' ? '' : 'hidden'}>
          <ReadingTab
            isDark={isDark}
            pdfs={pdfs}
            busy={pdfBusy}
            publishedIds={publishedIds}
            communityReads={communityReads}
            onUpload={handleUploadPdf}
            onRead={openFlipbook}
            onDelete={handleDeletePdf}
            onTogglePublish={handleTogglePublishPdf}
            onSendFile={handleSendPdfFile}
            onOpenOriginal={handleOpenPdfOriginal}
            showNotification={showNotification}
          />
        </div>

        {/* --- BIBLIOTECA --- */}
        {activeTab === 'library' && (
          <div className="space-y-8">

            <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Sua Estante Digital</h1>
                <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Gerencie seus manuscritos e documentos de estudo localmente.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="file"
                  ref={jsonFileInputRef}
                  onChange={handleImportJSON}
                  accept=".json"
                  className="hidden"
                />
                <button
                  onClick={() => jsonFileInputRef.current?.click()}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    isDark ? 'border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <Upload className="w-4 h-4 text-indigo-400" />
                  Importar Projeto JSON
                </button>

                <button
                  onClick={handleCreateNewBook}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium shadow-lg shadow-indigo-600/30 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Novo Manuscrito
                </button>
              </div>
            </div>

            {/* MANUSCRITOS */}
            <div>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Feather className="w-5 h-5 text-indigo-500" />
                Manuscritos Ativos ({books.length})
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {books.map((book) => (
                  <div
                    key={book.id}
                    className={`group relative rounded-2xl border p-5 flex flex-col justify-between transition-all duration-200 hover:shadow-xl ${
                      isDark ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className={`h-32 rounded-xl bg-gradient-to-br ${book.coverColor || 'from-indigo-600 to-purple-800'} p-4 flex flex-col justify-between text-white shadow-inner mb-4`}>
                        <span className="text-xs font-semibold uppercase tracking-wider bg-black/30 px-2 py-1 rounded-md w-fit backdrop-blur-sm">
                          {book.genre || 'Geral'}
                        </span>
                        <div>
                          <h3 className="font-bold text-lg leading-snug line-clamp-1">{book.title}</h3>
                          <p className="text-xs text-white/80">{book.author}</p>
                        </div>
                      </div>

                      <p className={`text-xs line-clamp-3 mb-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        {book.synopsis || 'Sem sinopse informada.'}
                      </p>
                    </div>

                    <div className={`flex items-center justify-between pt-3 border-t text-xs ${isDark ? 'border-slate-800/50' : 'border-slate-200'}`}>
                      <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>
                        {calculateWords(book.content)} palavras
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openFlipbook(book)}
                          className="p-2 rounded-lg hover:bg-indigo-600/10 text-indigo-400 transition-colors"
                          title="Ler no Flipbook"
                        >
                          <BookOpen className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleExportJSON(book)}
                          className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                          title="Exportar JSON"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedBookId(book.id);
                            setActiveTab('editor');
                          }}
                          className="p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
                          title="Editar Manuscrito"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => confirmDeleteBook(book.id)}
                          className="p-2 rounded-lg hover:bg-rose-500/10 text-rose-500 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* DOCUMENTOS DE APOIO */}
            <div className={`pt-6 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-500" />
                  Documentos de Apoio ({myPdfs.length})
                </h2>

                <input
                  type="file"
                  ref={docFileInputRef}
                  onChange={handleFileUpload}
                  accept=".txt,.md"
                  className="hidden"
                />
                <button
                  onClick={() => docFileInputRef.current?.click()}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
                    isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                  }`}
                >
                  <FileUp className="w-4 h-4 text-indigo-400" />
                  Anexar Documento (.txt / .md)
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myPdfs.map((doc) => (
                  <div
                    key={doc.id}
                    className={`p-4 rounded-xl border flex items-center justify-between ${
                      isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="p-2.5 bg-indigo-600/10 text-indigo-400 rounded-lg">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="truncate">
                        <h4 className="font-semibold text-sm truncate">{doc.title}</h4>
                        <p className="text-xs text-slate-500 truncate">{doc.fileName} • {doc.size}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => openFlipbook({ title: doc.title, content: doc.content })}
                        className={`px-3 py-1.5 rounded-lg border text-xs text-indigo-400 transition-colors whitespace-nowrap ${
                          isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        Visualizar
                      </button>
                      <button
                        onClick={() => handleDeleteDoc(doc.id)}
                        className="p-2 rounded-lg hover:bg-rose-500/10 text-rose-500 transition-colors"
                        title="Remover documento"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* --- EDITOR PRO --- */}
        {activeTab === 'editor' && (
          <div className="h-[calc(100vh-8rem)] flex flex-col md:flex-row gap-4">

            {/* LISTA LATERAL */}
            <div className={`w-full md:w-64 flex flex-col rounded-2xl border p-4 max-h-60 md:max-h-none ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h3 className="font-bold text-sm uppercase tracking-wider text-slate-500 mb-3">Seus Manuscritos</h3>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {books.map(b => (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBookId(b.id)}
                    className={`w-full text-left p-3 rounded-xl transition-all ${
                      b.id === selectedBookId
                        ? 'bg-indigo-600 text-white font-medium shadow-md'
                        : isDark ? 'hover:bg-slate-800/60 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <p className="text-sm font-semibold truncate">{b.title || 'Sem título'}</p>
                    <p className="text-xs opacity-75 truncate">{calculateWords(b.content)} palavras</p>
                  </button>
                ))}
              </div>

              <button
                onClick={handleCreateNewBook}
                className={`mt-3 w-full py-2.5 rounded-xl border border-dashed hover:border-indigo-500 text-indigo-400 flex items-center justify-center gap-2 text-xs font-semibold transition-all ${isDark ? 'border-slate-700' : 'border-slate-300'}`}
              >
                <Plus className="w-4 h-4" /> Criar Projeto
              </button>
            </div>

            {/* ÁREA DE TEXTO */}
            <div className={`flex-1 flex flex-col min-h-0 rounded-2xl border ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'}`}>

              <div className={`p-4 border-b flex flex-wrap items-center justify-between gap-4 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                <input
                  type="text"
                  value={currentBook.title || ''}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Título do Manuscrito..."
                  className="bg-transparent text-xl font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded-lg px-2 py-1 flex-1 min-w-[200px]"
                />

                <div className="flex items-center gap-3 text-xs">
                  <span className={`px-2.5 py-1 rounded-full ${
                    saveStatus === 'salvo' ? 'bg-emerald-500/10 text-emerald-400' :
                    saveStatus === 'salvando' ? 'bg-amber-500/10 text-amber-400' : 'bg-rose-500/10 text-rose-400'
                  }`}>
                    {saveStatus === 'salvo' ? '✓ Salvo' : saveStatus === 'salvando' ? 'Salvando...' : 'Erro ao salvar'}
                  </span>

                  <button
                    onClick={() => handleExportTXT(currentBook)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors ${
                      isDark ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" /> Baixar .TXT
                  </button>
                </div>
              </div>

              <div className="flex-1 p-4 flex flex-col min-h-0">
                <textarea
                  value={currentBook.content || ''}
                  onChange={(e) => handleContentChange(e.target.value)}
                  placeholder="Escreva sua história aqui... Use Ctrl+S para salvar manualmente a qualquer momento."
                  className={`w-full flex-1 p-4 bg-transparent resize-none focus:outline-none font-serif leading-relaxed ${
                    isDark ? 'text-slate-200 placeholder-slate-600' : 'text-slate-800 placeholder-slate-400'
                  }`}
                  style={{ fontSize: `${fontSize}px` }}
                />
              </div>

              <div className={`px-4 py-3 border-t flex items-center justify-between text-xs text-slate-500 ${isDark ? 'border-slate-800/60' : 'border-slate-200'}`}>
                <div className="flex items-center gap-4">
                  <span>{currentBookWords} palavras</span>
                  <span>{(currentBook.content || '').length} caracteres</span>
                </div>

                <div className="flex items-center gap-2">
                  <span>Fonte:</span>
                  <button
                    onClick={() => setFontSize(f => Math.max(12, f - 2))}
                    className={`px-2 py-0.5 rounded font-bold ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
                    aria-label="Diminuir fonte"
                  >
                    -
                  </button>
                  <span>{fontSize}px</span>
                  <button
                    onClick={() => setFontSize(f => Math.min(28, f + 2))}
                    className={`px-2 py-0.5 rounded font-bold ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
                    aria-label="Aumentar fonte"
                  >
                    +
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* --- CENTRAL DE APRENDIZADO --- */}
        {activeTab === 'learning' && (
          <div className="space-y-6">

            <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Central de Aprendizado</h1>
                <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Guias estruturados, teoria literária e técnicas avançadas de narrativa.
                </p>
              </div>

              <div className="relative w-full md:w-72">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar técnicas ou conceitos..."
                  className={`w-full pl-9 pr-4 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                  }`}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {APRENDIZAGEM_CONTEUDO.map((mod) => {
                const IconComponent = mod.icon;
                return (
                  <button
                    key={mod.id}
                    onClick={() => setSelectedModule(mod.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                      selectedModule === mod.id
                        ? 'bg-indigo-600 text-white shadow-md'
                        : isDark ? 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200' : 'bg-white border border-slate-200 text-slate-600'
                    }`}
                  >
                    <IconComponent className="w-4 h-4" />
                    {mod.title}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredLessons.map((lesson) => (
                <div
                  key={lesson.subtitle}
                  className={`p-6 rounded-2xl border transition-all ${
                    isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-indigo-600/10 text-indigo-400 border border-indigo-500/20">
                      {lesson.tag}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold mb-2">{lesson.subtitle}</h3>
                  <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    {lesson.details}
                  </p>
                </div>
              ))}

              {filteredLessons.length === 0 && (
                <p className="text-sm text-slate-500 col-span-full">Nenhum conteúdo encontrado para a busca.</p>
              )}
            </div>

          </div>
        )}

        {/* --- COMUNIDADE --- */}
        {activeTab === 'community' && (
          <div className="space-y-6 max-w-3xl mx-auto">

            <div className={`border-b pb-6 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Comunidade</h1>
              <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Compartilhe trechos, troque ideias e dê feedback a outros autores.
              </p>
              <p className={`text-xs mt-2 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                As publicações ficam salvas apenas neste navegador. Os posts de Marina e Caio são exemplos.
              </p>
            </div>

            {/* NOVO POST */}
            <div className={`rounded-2xl border p-4 ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="flex gap-3">
                <Avatar name={profile.name} color={profile.avatarColor} />
                <textarea
                  value={newPostText}
                  onChange={(e) => setNewPostText(e.target.value)}
                  maxLength={1000}
                  rows={3}
                  placeholder="Compartilhe uma ideia, dúvida ou conquista..."
                  className={`flex-1 bg-transparent resize-none focus:outline-none text-sm ${isDark ? 'placeholder-slate-600' : 'placeholder-slate-400'}`}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-3 border-t border-slate-800/40">
                <select
                  value={shareBookId}
                  onChange={(e) => setShareBookId(e.target.value)}
                  className={`text-xs rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-full ${
                    isDark ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-slate-300 text-slate-700'
                  }`}
                >
                  <option value="">Sem manuscrito anexado</option>
                  {books.map(b => (
                    <option key={b.id} value={b.id}>Anexar trecho: {b.title || 'Sem título'}</option>
                  ))}
                </select>

                <button
                  onClick={handleCreatePost}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium shadow-lg shadow-indigo-600/30 transition-all"
                >
                  <Send className="w-4 h-4" /> Publicar
                </button>
              </div>
            </div>

            {/* FILTRO */}
            <div className="flex gap-2">
              {[{ id: 'all', label: 'Todos' }, { id: 'mine', label: 'Meus posts' }].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFeedFilter(f.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    feedFilter === f.id
                      ? 'bg-indigo-600 text-white shadow-md'
                      : isDark ? 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200' : 'bg-white border border-slate-200 text-slate-600'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* FEED */}
            <div className="space-y-4">
              {sortedPosts.length === 0 && (
                <p className="text-sm text-slate-500">Nenhuma publicação por aqui ainda.</p>
              )}

              {sortedPosts.map((post) => {
                const authorName = post.isMine ? profile.name : post.authorName;
                const authorHandle = post.isMine ? profile.handle : post.authorHandle;
                const authorColor = post.isMine ? profile.avatarColor : post.authorColor;

                return (
                  <article
                    key={post.id}
                    className={`rounded-2xl border p-5 ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar name={authorName} color={authorColor} />
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{authorName}</p>
                          <p className="text-xs text-slate-500 truncate">@{authorHandle} • {formatPostDate(post.createdAt)}</p>
                        </div>
                      </div>

                      {post.isMine && (
                        <button
                          onClick={() => handleDeletePost(post.id)}
                          className="p-2 rounded-lg hover:bg-rose-500/10 text-rose-500 transition-colors"
                          title="Excluir publicação"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {post.text && (
                      <p className="text-sm leading-relaxed mt-4 whitespace-pre-wrap break-words">{post.text}</p>
                    )}

                    {post.sharedBook && (
                      <div className={`mt-4 rounded-xl border p-4 ${isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-bold text-sm truncate">{post.sharedBook.title}</p>
                            <p className="text-xs text-indigo-400">{post.sharedBook.genre || 'Geral'}</p>
                          </div>
                          <button
                            onClick={() => openFlipbook({ title: post.sharedBook.title, content: post.sharedBook.excerpt })}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs text-indigo-400 whitespace-nowrap transition-colors ${
                              isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            <BookOpen className="w-3.5 h-3.5" /> Ler trecho
                          </button>
                        </div>
                        {post.sharedBook.synopsis && (
                          <p className={`text-xs mt-2 line-clamp-3 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                            {post.sharedBook.synopsis}
                          </p>
                        )}
                      </div>
                    )}

                    {post.sharedPdf && (
                      <div className={`mt-4 rounded-xl border p-4 flex items-center justify-between gap-3 ${isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="min-w-0">
                          <p className="font-bold text-sm truncate">{post.sharedPdf.title}</p>
                          <p className="text-xs text-indigo-400">PDF • {post.sharedPdf.numPages} páginas</p>
                        </div>
                        <button
                          onClick={() => openFlipbook({ title: post.sharedPdf.title, content: post.sharedPdf.text })}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs text-indigo-400 whitespace-nowrap transition-colors ${
                            isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          <BookOpen className="w-3.5 h-3.5" /> Ler PDF
                        </button>
                      </div>
                    )}

                    <div className={`flex items-center gap-4 mt-4 pt-3 border-t text-xs ${isDark ? 'border-slate-800/50' : 'border-slate-200'}`}>
                      <button
                        onClick={() => handleToggleLike(post.id)}
                        className={`flex items-center gap-1.5 transition-colors ${post.likedByMe ? 'text-rose-500' : 'text-slate-500 hover:text-rose-400'}`}
                        aria-pressed={post.likedByMe}
                      >
                        <Heart className={`w-4 h-4 ${post.likedByMe ? 'fill-current' : ''}`} />
                        {post.likes || 0}
                      </button>
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <MessageCircle className="w-4 h-4" />
                        {(post.comments || []).length}
                      </span>
                    </div>

                    {/* COMENTÁRIOS */}
                    {(post.comments || []).length > 0 && (
                      <div className="mt-3 space-y-2">
                        {post.comments.map(c => (
                          <div key={c.id} className={`rounded-xl px-3 py-2 text-xs ${isDark ? 'bg-slate-950/50' : 'bg-slate-50'}`}>
                            <span className="font-semibold">{c.isMine ? profile.name : c.authorName}</span>
                            <span className="text-slate-500"> • {formatPostDate(c.createdAt)}</span>
                            <p className={`mt-1 whitespace-pre-wrap break-words ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{c.text}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2 mt-3">
                      <input
                        type="text"
                        value={commentDrafts[post.id] || ''}
                        onChange={(e) => setCommentDrafts(prev => ({ ...prev, [post.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment(post.id); }}
                        maxLength={500}
                        placeholder="Escreva um comentário..."
                        className={`flex-1 px-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                          isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                        }`}
                      />
                      <button
                        onClick={() => handleAddComment(post.id)}
                        className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                        aria-label="Enviar comentário"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {/* --- PERFIL --- */}
        {activeTab === 'profile' && (
          <div className="space-y-6">

            <div className={`border-b pb-6 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Seu Perfil</h1>
              <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Como os outros autores veem você na comunidade.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* CARTÃO DO PERFIL */}
              <div className={`rounded-2xl border p-6 flex flex-col items-center text-center ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
                <Avatar name={profile.name} color={profile.avatarColor} src={profile.google?.picture} size="w-24 h-24" text="text-4xl" />
                <h2 className="text-xl font-bold mt-4">{profile.name}</h2>
                <p className="text-sm text-slate-500">@{profile.handle}</p>
                {profile.favoriteGenre && (
                  <span className="mt-3 text-xs font-semibold px-2.5 py-1 rounded-md bg-indigo-600/10 text-indigo-400 border border-indigo-500/20">
                    {profile.favoriteGenre}
                  </span>
                )}
                <p className={`text-sm mt-4 whitespace-pre-wrap break-words ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {profile.bio || 'Nenhuma bio ainda.'}
                </p>

                <GoogleLinkCard google={profile.google} isDark={isDark} onLink={handleGoogleLink} onUnlink={handleGoogleUnlink} />

                <div className={`grid grid-cols-2 gap-3 w-full mt-6 pt-6 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                  {[
                    { label: 'Manuscritos', value: profileStats.manuscripts },
                    { label: 'Palavras', value: profileStats.words.toLocaleString('pt-BR') },
                    { label: 'Publicações', value: profileStats.posts },
                    { label: 'Curtidas', value: profileStats.likes }
                  ].map(s => (
                    <div key={s.label}>
                      <p className="text-lg font-bold">{s.value}</p>
                      <p className="text-xs text-slate-500">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* FORMULÁRIO */}
              <div className={`lg:col-span-2 rounded-2xl border p-6 space-y-4 ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
                <h3 className="font-bold text-lg">Editar perfil</h3>

                {[
                  { key: 'name', label: 'Nome de exibição', max: 60, placeholder: 'Seu nome' },
                  { key: 'handle', label: 'Usuário (apenas letras, números e _)', max: 24, placeholder: 'seu_usuario' },
                  { key: 'favoriteGenre', label: 'Gênero favorito', max: 50, placeholder: 'Ex.: Fantasia, Thriller...' }
                ].map(f => (
                  <label key={f.key} className="block">
                    <span className="text-xs font-semibold text-slate-500">{f.label}</span>
                    <input
                      type="text"
                      value={profileDraft[f.key] || ''}
                      onChange={(e) => setProfileDraft(prev => ({ ...prev, [f.key]: e.target.value }))}
                      maxLength={f.max}
                      placeholder={f.placeholder}
                      className={`mt-1 w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                        isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                      }`}
                    />
                  </label>
                ))}

                <label className="block">
                  <span className="text-xs font-semibold text-slate-500">Bio ({(profileDraft.bio || '').length}/300)</span>
                  <textarea
                    value={profileDraft.bio || ''}
                    onChange={(e) => setProfileDraft(prev => ({ ...prev, bio: e.target.value }))}
                    maxLength={300}
                    rows={4}
                    placeholder="Conte um pouco sobre você e o que escreve..."
                    className={`mt-1 w-full px-3 py-2 rounded-xl border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  />
                </label>

                <div>
                  <span className="text-xs font-semibold text-slate-500">Cor do avatar</span>
                  <div className="flex flex-wrap gap-3 mt-2">
                    {AVATAR_GRADIENTS.map(g => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setProfileDraft(prev => ({ ...prev, avatarColor: g }))}
                        className={`w-9 h-9 rounded-full bg-gradient-to-br ${g} transition-all ${
                          profileDraft.avatarColor === g ? 'ring-2 ring-offset-2 ring-indigo-500 ring-offset-transparent scale-110' : ''
                        }`}
                        aria-label="Escolher cor do avatar"
                        aria-pressed={profileDraft.avatarColor === g}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setProfileDraft(profile)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium border ${
                      isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    Descartar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    className="px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white shadow-md"
                  >
                    Salvar perfil
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* --- LEITOR (MODO DE LEITURA CONFORTÁVEL) --- */}
      {flipbookActive && flipbookBook && (
        <ComfortReader
          key={flipbookBook.title}
          title={flipbookBook.title}
          pages={pages}
          onClose={closeFlipbook}
          defaultTheme={isDark ? 'dark' : 'sepia'}
        />
      )}

      {/* --- MODAL: CONFIRMAÇÃO DE EXCLUSÃO --- */}
      {deleteConfirmId !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-confirm-title"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setDeleteConfirmId(null)}
        >
          <div
            className={`max-w-md w-full border rounded-2xl p-6 shadow-xl ${
              isDark ? 'border-slate-800 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-900'
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="delete-confirm-title" className="font-bold text-lg mb-2">
              Confirmar Exclusão
            </h3>

            <p className={`text-sm mb-6 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Tem certeza de que deseja excluir este manuscrito? Esta ação não pode ser desfeita.
            </p>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border ${
                  isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-300 hover:bg-slate-100'
                }`}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={executeDeleteBook}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-red-600 hover:bg-red-500 text-white shadow-md"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- TOAST --- */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-3 rounded-xl bg-indigo-600 text-white text-sm font-medium shadow-xl"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
