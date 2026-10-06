import React, { useState, useEffect, useMemo } from 'react';
import { 
  Feather, Check, BookOpen, Edit3, Trash2, Plus, Moon, Sun, Download
} from 'lucide-react';

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
    request.onerror = (e) => reject(`Erro ao abrir IndexedDB: ${e.target.error}`);
    request.onsuccess = () => {
      dbInstance = request.result;
      dbInstance.onversionchange = () => { dbInstance.close(); dbInstance = null; };
      dbInstance.onclose = () => { dbInstance = null; };
      resolve(dbInstance);
    };
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('books')) db.createObjectStore('books', { keyPath: 'id' });
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
  } catch { return null; }
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
  } catch { return false; }
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
  } catch { return false; }
};

const LIVROS_INICIAIS = [
  {
    id: 'b1',
    title: 'A Sombra do Tempo',
    author: 'Autor',
    genre: 'Ficção',
    synopsis: 'Uma jornada narrativa única.',
    content: 'Capítulo 1: O Despertar\n\nEra uma noite serena e as estrelas cobriam o horizonte...'
  }
];

export default function EstudioApp() {
  const [theme, setTheme] = useState('dark');
  const [activeTab, setActiveTab] = useState('library');
  const [books, setBooks] = useState([]);
  const [selectedBookId, setSelectedBookId] = useState('');
  const [toast, setToast] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        const savedBooks = await dbGet('books');
        if (savedBooks && savedBooks.length > 0) {
          setBooks(savedBooks);
          setSelectedBookId(savedBooks[0].id);
        } else {
          setBooks(LIVROS_INICIAIS);
          setSelectedBookId(LIVROS_INICIAIS[0].id);
          for (const b of LIVROS_INICIAIS) await dbSet('books', b);
        }
      } catch (err) {
        console.error("Erro ao carregar dados:", err);
      }
    }
    loadData();
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const currentBook = useMemo(() => {
    return books.find(b => b.id === selectedBookId) || books[0] || { id: '', title: '', content: '' };
  }, [books, selectedBookId]);

  const handleCreateBook = async () => {
    const newBook = {
      id: `b_${Date.now()}`,
      title: 'Novo Manuscrito',
      author: 'Autor',
      genre: 'Geral',
      synopsis: 'Descrição do novo manuscrito...',
      content: ''
    };
    const updated = [...books, newBook];
    setBooks(updated);
    setSelectedBookId(newBook.id);
    await dbSet('books', newBook);
    setActiveTab('editor');
    showToast('Novo manuscrito criado!');
  };

  const handleUpdateTitle = async (title) => {
    const updated = books.map(b => b.id === selectedBookId ? { ...b, title } : b);
    setBooks(updated);
    const bookToSave = updated.find(b => b.id === selectedBookId);
    if (bookToSave) await dbSet('books', bookToSave);
  };

  const handleUpdateContent = async (content) => {
    const updated = books.map(b => b.id === selectedBookId ? { ...b, content } : b);
    setBooks(updated);
    const bookToSave = updated.find(b => b.id === selectedBookId);
    if (bookToSave) await dbSet('books', bookToSave);
  };

  const handleDeleteBook = async (id) => {
    if (books.length <= 1) {
      showToast('Deve manter pelo menos um manuscrito.');
      return;
    }
    const updated = books.filter(b => b.id !== id);
    setBooks(updated);
    await dbDelete('books', id);
    if (selectedBookId === id) {
      setSelectedBookId(updated[0].id);
    }
    showToast('Manuscrito removido.');
  };

  return (
    <div className={`min-h-screen flex flex-col ${theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <header className="px-6 py-4 flex items-center justify-between border-b border-slate-800 bg-slate-900">
        <div className="flex items-center gap-2">
          <Feather className="w-6 h-6 text-purple-500" />
          <h1 className="text-xl font-bold text-white">Estúdio Narrativo</h1>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} 
            className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
            title="Alternar tema"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <nav className="flex items-center gap-2">
            <button 
              onClick={() => setActiveTab('library')} 
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'library' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Biblioteca
            </button>
            <button 
              onClick={() => setActiveTab('editor')} 
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'editor' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Editor
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-5xl w-full mx-auto">
        {activeTab === 'library' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-purple-500" />
                Meus Manuscritos
              </h2>
              <button 
                onClick={handleCreateBook} 
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" /> Novo Livro
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {books.map(b => (
                <div key={b.id} className="p-5 rounded-xl border border-slate-800 bg-slate-900 flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="font-bold text-lg text-white">{b.title || 'Sem título'}</h3>
                    <p className="text-xs text-slate-400 mt-1">{b.synopsis}</p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                    <button 
                      onClick={() => { setSelectedBookId(b.id); setActiveTab('editor'); }} 
                      className="px-3 py-1.5 bg-purple-600/20 text-purple-400 hover:bg-purple-600 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Abrir no Editor
                    </button>
                    <button 
                      onClick={() => handleDeleteBook(b.id)} 
                      className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                      title="Apagar manuscrito"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'editor' && currentBook && (
          <div className="flex flex-col h-full space-y-4">
            <div className="flex items-center justify-between gap-4">
              <input 
                type="text" 
                value={currentBook.title || ''} 
                onChange={(e) => handleUpdateTitle(e.target.value)}
                placeholder="Título do Manuscrito..."
                className="text-xl font-bold bg-transparent border-b border-slate-800 p-2 text-white w-full focus:outline-none focus:border-purple-500" 
              />
            </div>
            <textarea 
              value={currentBook.content || ''} 
              onChange={(e) => handleUpdateContent(e.target.value)}
              placeholder="Escreva a sua história aqui..."
              className="w-full h-[60vh] bg-slate-900 border border-slate-800 rounded-xl p-4 text-slate-100 focus:outline-none focus:border-purple-500 resize-none font-sans leading-relaxed"
            />
          </div>
        )}
      </main>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-purple-600 text-white text-sm font-medium px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 border border-purple-400/30">
          <Check className="w-4 h-4" /> {toast}
        </div>
      )}
    </div>
  );
}
cificidades entre Cyberpunk, Space Opera, Solarpunk e Sci-Fi Hard (baseado em rigor científico).'
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

  }

   {/* MODAL DE CONFIRMAÇÃO DE DELEÇÃO */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-sm w-full space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="font-bold text-base text-white">Confirmar Exclusão</h3>
            </div>
            <p className="text-xs text-slate-400">Tem certeza de que deseja remover este projeto? Esta ação não poderá ser desfeita.</p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={() => executeDeleteBook(bookId)}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-medium rounded-lg"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST SYSTEM */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-indigo-600 text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-medium flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4 h-4" />
          {toast}
        </div>
      )}
{/* Modal de Confirmação de Exclusão */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`max-w-md w-full border rounded-2xl p-6 shadow-xl ${theme === 'dark' ? 'border-slate-800 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-900'}`}>
            <h3 className="font-bold text-lg mb-2">Confirmar Exclusão</h3>
            <p className={`text-sm mb-6 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              Tem certeza de que deseja excluir este manuscrito? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setDeleteConfirmId(null)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border ${theme === 'dark' ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-300 hover:bg-slate-100'}`}
              >
                Cancelar
              </button>
              <button 
                onClick={() => handleDeleteBook(deleteConfirmId)}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-red-600 hover:bg-red-500 text-white shadow-md"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
