import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Edit3, FileText, Plus, Moon, Sun, 
  X, Feather, Menu, FileUp,
  GraduationCap, Compass, Users, Lightbulb, TrendingUp, Search,
  Trash2, Download, Upload, ChevronLeft, ChevronRight, Check, AlertTriangle, BookOpen
} from 'lucide-react';

import { DeleteConfirmationModal } from './DeleteConfirmationModal';

// --- BANCO DE DADOS INDEXEDDB ASSÍNCRONO (GERENCIAMENTO ROBUSTO) ---

const DB_NAME = 'EstudioNarrativoDB';
const DB_VERSION = 1;
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
      reject(`Erro ao abrir IndexedDB: ${e.target.error}`);
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
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.onabort = () => reject(false);
      const store = tx.objectStore(storeName);
      const req = key ? store.put(val, key) : store.put(val);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(false);
    });
  } catch (e) {
    console.error('Erro na gravação do IndexedDB:', e);
    return false;
  }
};

const dbDelete = async (storeName, key) => {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
};

// --- HELPERS E UTILITÁRIOS SEGUROS ---

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

const sanitizeInput = (str = '') => {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/[\0\x08\x0B\x0C\x0E-\x1F]/g, '')
    .trim();
};

// --- DADOS INICIAIS DA APLICAÇÃO ---

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
        details: 'Padrões universais do inconsciente coletivo: O Herói, O Sábio, O Rebelde, O Governança, O Criador, O Cuidador, O Inocente e O Amante.'
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
        subtitle: 'Show, Don\'t Tell (Mostre, Não Conte)',
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

// --- COMPONENTE PRINCIPAL ---

export default function EstudioApp() {
  const [theme, setTheme] = useState('dark');
  const [activeTab, setActiveTab] = useState('library');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Estados dos Dados do Usuário
  const [books, setBooks] = useState([]);
  const [myPdfs, setMyPdfs] = useState([]);
  
  // Estado do Editor
  const [selectedBookId, setSelectedBookId] = useState('');
  const [saveStatus, setSaveStatus] = useState('salvo');

  // Modal de Confirmação de Deleção
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Estados da Central de Aprendizagem
  const [selectedModule, setSelectedModule] = useState(APRENDIZAGEM_CONTEUDO[0].id);
  const [searchTerm, setSearchTerm] = useState('');

  // Modais e Leitor
  const [flipbookActive, setFlipbookActive] = useState(false);
  const [flipbookBook, setFlipbookBook] = useState(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [fontSize, setFontSize] = useState(16);

  const [toast, setToast] = useState(null);
  const jsonFileInputRef = useRef(null);
  const docFileInputRef = useRef(null);
  const toastTimerRef = useRef(null);

  const currentBookRef = useRef(null);

  // Carregamento Inicial do IndexedDB
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
      } catch (err) {
        console.error("Erro ao carregar dados do IndexedDB:", err);
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

  // Persistência Assíncrona Otimizada
  useEffect(() => {
    if (!isLoaded || !selectedBookId) return;

    const targetBook = books.find(b => b.id === selectedBookId);
    if (!targetBook) return;

    const handler = setTimeout(async () => {
      setSaveStatus('salvando');
      const success = await dbSet('books', targetBook);
      setSaveStatus(success ? 'salvo' : 'erro');
    }, 1000);

    return () => clearTimeout(handler);
  }, [books, selectedBookId, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    dbSet('settings', theme, 'theme');
  }, [theme, isLoaded]);

  // Atalho de Teclado no Editor (Ctrl+S / Cmd+S)
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        const activeBook = currentBookRef.current;
        if (activeBook && activeBook.id) {
          dbSet('books', activeBook);
          setSaveStatus('salvo');
          showNotification('Projeto salvo com sucesso!');
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [showNotification]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleTitleChange = (newTitle) => {
    setBooks(prev => prev.map(b => b.id === selectedBookId ? { ...b, title: newTitle } : b));
  };

  const handleContentChange = (newContent) => {
    setBooks(prev => prev.map(b => b.id === selectedBookId ? { ...b, content: newContent } : b));
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
    const filtered = books.filter(b => b.id !== id);
    setBooks(filtered);
    await dbDelete('books', id);
    if (selectedBookId === id && filtered.length > 0) {
      setSelectedBookId(filtered[0].id);
    }
    setDeleteConfirmId(null);
    showNotification('Projeto removido com sucesso.');
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
          title: sanitizeInput(String(imported.title || 'Projeto Importado')).slice(0, 100),
          author: sanitizeInput(String(imported.author || 'Desconhecido')).slice(0, 80),
          genre: sanitizeInput(String(imported.genre || 'Geral')).slice(0, 50),
          coverColor: typeof imported.coverColor === 'string' ? imported.coverColor : 'from-indigo-600 to-purple-800',
          synopsis: sanitizeInput(String(imported.synopsis || '')).slice(0, 500),
          content: String(imported.content || '')
        };
        setBooks(prev => [newBook, ...prev]);
        setSelectedBookId(newBook.id);
        showNotification(`Projeto "${newBook.title}" importado!`);
      } catch {
        showNotification('Erro: Arquivo JSON de projeto inválido ou corrompido.');
      }
    };
    reader.readAsText(file);
    e.target.value

    // Algoritmo Otimizado de Paginação do Leitor (Flipbook)
  const pages = useMemo(() => {
    if (!flipbookBook) return ['Sem conteúdo para exibição.'];
    const fullText = flipbookBook.content || 'Conteúdo em branco.';
    const paragraphs = fullText.split('\n');
    const resultPages = [];
    let currentPage = '';
    const WORDS_PER_PAGE = 220;

    for (let p of paragraphs) {
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

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
      
      {/* HEADER / NAVBAR */}
      <header className={`sticky top-0 z-30 border-b backdrop-blur-md ${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-slate-200'}`}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={`p-2 rounded-lg md:hidden ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
              aria-label="Toggle Menu"
            >
              <Menu className="w-5 h-5"/>
            </button>
            
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/30">
                <Feather className="w-5 h-5"/>
              </div>
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">
                Estúdio Narrativo
              </span>
            </div>
          </div>

          {/* NAVEGAÇÃO DESKTOP */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-800/20 p-1 rounded-xl border border-slate-700/30">
            <button
              onClick={() => setActiveTab('library')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'library' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <BookOpen className="w-4 h-4"/>
              Biblioteca
            </button>

            <button
              onClick={() => setActiveTab('editor')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'editor' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Edit3 className="w-4 h-4"/>
              Editor Pro
            </button>

            <button
              onClick={() => setActiveTab('learning')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'learning' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <GraduationCap className="w-4 h-4"/>
              Central de Aprendizado
            </button>
          </nav>

         {/* CONTROLES / TEMA */}
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
              {isDark ? <Sun className="w-5 h-5"/> : <Moon className="w-5 h-5"/>}
            </button>
          </div>
        </div>
      </header>

      {/* MOBILE SIDEBAR MENU */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className={`relative w-64 max-w-xs flex-1 flex flex-col py-6 px-4 shadow-xl ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-800'}`}>
            <div className="flex items-center justify-between mb-8">
              <span className="font-bold text-lg text-indigo-500">Navegação</span>
              <button onClick={() => setSidebarOpen(false)} className="p-1 rounded-lg hover:bg-slate-800/20">
                <X className="w-6 h-6"/>
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => { setActiveTab('library'); setSidebarOpen(false); }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-medium ${activeTab === 'library' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800/10'}`}
              >
                <BookOpen className="w-5 h-5"/> Biblioteca
              </button>
              <button
                onClick={() => { setActiveTab('editor'); setSidebarOpen(false); }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-medium ${activeTab === 'editor' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800/10'}`}
              >
                <Edit3 className="w-5 h-5"/> Editor Pro
              </button>
              <button
                onClick={() => { setActiveTab('learning'); setSidebarOpen(false); }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-medium ${activeTab === 'learning' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800/10'}`}
              >
                <GraduationCap className="w-5 h-5"/> Central de Aprendizado
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ÁREA DE CONTEÚDO PRINCIPAL */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6">
        
        {/* --- TAB 1: BIBLIOTECA --- */}
        {activeTab === 'library' && (
          <div className="space-y-8 animate-fadeIn">
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-6">
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
                  <Upload className="w-4 h-4 text-indigo-400"/>
                  Importar Projeto JSON
                </button>

                <button
                  onClick={handleCreateNewBook}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium shadow-lg shadow-indigo-600/30 transition-all"
                >
                  <Plus className="w-4 h-4"/>
                  Novo Manuscrito
                </button>
              </div>
            </div>

            {/* SEÇÃO: MEUS MANUSCRITOS */}
            <div>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Feather className="w-5 h-5 text-indigo-500"/>
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

                    <div className="flex items-center justify-between pt-3 border-t border-slate-800/50 text-xs">
                      <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>
                        {calculateWords(book.content)} palavras
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openFlipbook(book)}
                          className="p-2 rounded-lg hover:bg-indigo-600/10 text-indigo-400 transition-colors"
                          title="Ler no Flipbook"
                        >
                          <BookOpen className="w-4 h-4"/>
                        </button>
                        <button
                          onClick={() => handleExportJSON(book)}
                          className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors"
                          title="Exportar JSON"
                        >
                          <Download className="w-4 h-4"/>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedBookId(book.id);
                            setActiveTab('editor');
                          }}
                          className="p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
                          title="Editar Manuscrito"
                        >
                          <Edit3 className="w-4 h-4"/>
                        </button>
                        <button
                          onClick={() => confirmDeleteBook(book.id)}
                          className="p-2 rounded-lg hover:bg-rose-500/10 text-rose-500 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4"/>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SEÇÃO: DOCUMENTOS & PDFs DE ESTUDO */}
            <div className="pt-6 border-t border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-500"/>
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
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-all"
                >
                  <FileUp className="w-4 h-4 text-indigo-400"/>
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
                        <FileText className="w-5 h-5"/>
                      </div>
                      <div className="truncate">
                        <h4 className="font-semibold text-sm truncate">{doc.title}</h4>
                        <p className="text-xs text-slate-500">{doc.fileName} • {doc.size}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => openFlipbook({ title: doc.title, content: doc.content })}
                      className="px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-xs text-indigo-400 transition-colors whitespace-nowrap ml-2"
                    >
                      Visualizar
                    </button>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* --- TAB 2: EDITOR PRO --- */}
        {activeTab === 'editor' && (
          <div className="h-[calc(100vh-8rem)] flex flex-col md:flex-row gap-4 animate-fadeIn">
            
            {/* PAINEL LATERAL DO EDITOR */}
            <div className={`w-full md:w-64 flex flex-col rounded-2xl border p-4 ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
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
                className="mt-3 w-full py-2.5 rounded-xl border border-dashed border-slate-700 hover:border-indigo-500 text-indigo-400 flex items-center justify-center gap-2 text-xs font-semibold transition-all"
              >
                <Plus className="w-4 h-4"/> Criar Projeto
              </button>
            </div>

            {/* ÁREA DO EDITOR DE TEXTO */}
            <div className={`flex-1 flex flex-col rounded-2xl border ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'}`}>
              
              {/* BARRA DE FERRAMENTAS DO EDITOR */}
              <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
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
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5"/> Baixar .TXT
                  </button>
                </div>
              </div>

              {/* EDITOR DE TEXTO (TEXTAREA RUSTICO & EFICIENTE) */}
              <div className="flex-1 p-4 flex flex-col">
                <textarea
                  value={currentBook.content || ''}
                  onChange={(e) => handleContentChange(e.target.value)}
                  placeholder="Escreva sua história aqui... Use o atalho Ctrl+S para salvar manualmente a qualquer momento."
                  className={`w-full flex-1 p-4 bg-transparent resize-none focus:outline-none font-serif text-lg leading-relaxed ${
                    isDark ? 'text-slate-200 placeholder-slate-600' : 'text-slate-800 placeholder-slate-400'
                  }`}
                  style={{ fontSize: `${fontSize}px` }}
                />
              </div>

              {/* BARRA DE STATUS INFERIOR */}
              <div className="px-4 py-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-4">
                  <span>{currentBookWords} palavras</span>
                  <span>{(currentBook.content || '').length} caracteres</span>
                </div>

                <div className="flex items-center gap-2">
                  <span>Tamanho da Fonte:</span>
                  <button 
                    onClick={() => setFontSize(f => Math.max(12, f - 2))} 
                    className="p-1 rounded hover:bg-slate-800 font-bold"
                  >
                    -
                  </button>
                  <span>{fontSize}px</span>
                  <button 
                    onClick={() => setFontSize(f => Math.min(28, f + 2))} 
                    className="p-1 rounded hover:bg-slate-800 font-bold"
                  >
                    +
                  </button>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* --- TAB 3: CENTRAL DE APRENDIZADO --- */}
        {activeTab === 'learning' && (
          <div className="space-y-6 animate-fadeIn">
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-6">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Central de Aprendizado</h1>
                <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Guias estruturados, teoria literária e técnicas avançadas de narrativa.
                </p>
              </div>

              <div className="relative w-full md:w-72">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500"/>
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

            {/* ABAS DOS MÓDULOS */}
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
                    <IconComponent className="w-4 h-4"/>
                    {mod.title}
                  </button>
                );
              })}
            </div>

            {/* LISTA DE AULAS/CONTEÚDOS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredLessons.map((lesson, idx) => (
                <div
                  key={idx}
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
            </div>

          </div>
        )}

      </main>

      {/* --- MODAL: LEITOR FLIPBOOK --- */}
      {flipbookActive && flipbookBook && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className={`relative w-full max-w-3xl h-[85vh] rounded-2xl border flex flex-col shadow-2xl overflow-hidden ${
            isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-amber-50/95 border-amber-200 text-amber-950'
          }`}>
            
            {/* TOPO DO LEITOR */}
            <div className="p-4 border-b border-slate-800/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-500"/>
                <h3 className="font-bold text-sm truncate max-w-md">{flipbookBook.title}</h3>
              </div>
              <button
                onClick={closeFlipbook}
                className="p-1.5 rounded-lg hover:bg-slate-800/20 transition-colors"
              >
                <X className="w-6 h-6"/>
              </button>
            </div>

            {/* PÁGINA DO LIVRO */}
            <div className="flex-1 p-8 overflow-y-auto font-serif leading-relaxed text-lg whitespace-pre-wrap">
              {pages[currentPageIndex]}
            </div>

            {/* NAVEGAÇÃO DE PÁGINAS */}
            <div className={`p-4 border-t flex items-center justify-between text-xs ${
              theme === 'dark' ? 'border-slate-800/40' : 'border-slate-200'
            }`}>
              <button
                type="button"
                disabled={currentPageIndex === 0}
                onClick={() => setCurrentPageIndex(p => Math.max(0, p - 1))}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-800/20"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Anterior</span>
              </button>

              <span>
                Página {currentPageIndex + 1} de {pages.length || 1}
              </span>

              <button
                type="button"
                disabled={currentPageIndex >= pages.length - 1}
                onClick={() => setCurrentPageIndex(p => Math.min(pages.length - 1, p + 1))}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-800/20"
              >
                <span>Próxima</span>
                <ChevronRight className="w-4 h-4" />
              </button>
        </div>
      </div>
{/* Modal de Confirmação de Exclusão */}
{deleteConfirmId && (
  <div
    role="dialog"
    aria-modal="true"
    aria-labelledby="delete-confirm-title"
    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
    onClick={() => setDeleteConfirmId(null)}
  >
    <div
      onClick={(event) => event.stopPropagation()}
      className={`max-w-md w-full border rounded-2xl p-6 shadow-xl ${
        theme === 'dark'
          ? 'border-slate-800 bg-slate-900 text-slate-100'
          : 'border-slate-200 bg-white text-slate-900'
      }`}
    >
      <h3 id="delete-confirm-title" className="font-bold text-lg mb-2">
        Confirmar Exclusão
      </h3>

      <p className={`text-sm mb-6 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
        Tem certeza de que deseja excluir este manuscrito? Esta ação não pode ser desfeita.
      </p>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => setDeleteConfirmId(null)}
          className={`px-4 py-2 rounded-xl text-sm font-medium border ${
            theme === 'dark'
              ? 'border-slate-700 hover:bg-slate-800'
              : 'border-slate-300 hover:bg-slate-100'
          }`}
        >
          Cancelar
        </button>

        <button
          type="button"
          onClick={() => {
            handleDeleteBook(deleteConfirmId);
            setDeleteConfirmId(null);
          }}
          className="px-4 py-2 rounded-xl text-sm font-medium bg-red-600 hover:bg-red-500 text-white shadow-md"
        >
          Excluir
        </button>
      </div>
    </div>
  </div>
)}