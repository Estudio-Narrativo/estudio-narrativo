import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Edit3, FileText, Plus, Moon, Sun, 
  Sparkles, X, Feather, Menu, Bookmark, FileUp,
  GraduationCap, Compass, Users, Lightbulb, TrendingUp, Search,
  Type, Save, Trash2, Download, Share2, Upload, ChevronLeft, ChevronRight, Check, AlertTriangle, BookOpen
} from 'lucide-react';

// --- BANCO DE DADOS INDEXEDDB ASSÍNCRONO ---

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

// --- COMPONENTE PRINCIPAL ---

export default function EstudioApp() {
  const [theme, setTheme] = useState('dark');
  const [activeTab, setActiveTab] = useState('library');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Estados dos Dados
  const [books, setBooks] = useState([]);
  const [myPdfs, setMyPdfs] = useState([]);
  
  // Estado do Editor
  const [selectedBookId, setSelectedBookId] = useState('');
  const [saveStatus, setSaveStatus] = useState('salvo');

  // Modal de Deletar
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Estados de Aprendizagem
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

  // Persistência Assíncrona
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

  // Atalho de Teclado (Ctrl+S)
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
    setDeleteConfirmId(id);
  };

  const handleDeleteBook = async () => {
    if (!deleteConfirmId) return;
    const idToDelete = deleteConfirmId;
    setBooks(prev => prev.filter(b => b.id !== idToDelete));
    await dbDelete('books', idToDelete);
    setDeleteConfirmId(null);
    showNotification('Manuscrito removido.');
    if (selectedBookId === idToDelete) {
      const remaining = books.filter(b => b.id !== idToDelete);
      if (remaining.length > 0) setSelectedBookId(remaining[0].id);
    }
  };

  const handleExportJSON = () => {
    const dataStr = JSON.stringify(books, null, 2);
    triggerSecureDownload(dataStr, 'meus_livros_estudio.json', 'application/json');
    showNotification('Backup exportado em JSON!');
  };

  const handleImportJSON = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (Array.isArray(imported)) {
          setBooks(imported);
          for (const b of imported) {
            await dbSet('books', b);
          }
          if (imported.length > 0) setSelectedBookId(imported[0].id);
          showNotification('Livros importados com sucesso!');
        }
      } catch {
        showNotification('Erro ao ler arquivo JSON.');
      }
    };
    reader.readAsText(file);
  };

  const handleUploadDoc = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      const newDoc = {
        id: `doc_${Date.now()}`,
        title: file.name.replace(/\.[^/.]+$/, ''),
        fileName: file.name,
        size: `${(file.size / 1024).toFixed(1)} KB`,
        uploadedAt: new Date().toISOString().split('T')[0],
        content: text
      };
      setMyPdfs(prev => [newDoc, ...prev]);
      await dbSet('documents', newDoc);
      showNotification('Documento anexado!');
    };
    reader.readAsText(file);
  };

  const openFlipbook = (book) => {
    setFlipbookBook(book);
    setCurrentPageIndex(0);
    setFlipbookActive(true);
  };

  // Algoritmo de Paginação do Flipbook
  const pages = useMemo(() => {
    if (!flipbookBook || !flipbookBook.content) return ['(Manuscrito vazio)'];
    const text = flipbookBook.content;
    const paragraphs = text.split('\n');
    const pageList = [];
    let currentPage = '';

    paragraphs.forEach((p) => {
      if ((currentPage + '\n' + p).length > 600) {
        if (currentPage.trim()) pageList.push(currentPage.trim());
        currentPage = p;
      } else {
        currentPage += (currentPage ? '\n\n' : '') + p;
      }
    });

    if (currentPage.trim()) pageList.push(currentPage.trim());
    return pageList.length > 0 ? pageList : ['(Sem conteúdo)'];
  }, [flipbookBook]);

  return (
