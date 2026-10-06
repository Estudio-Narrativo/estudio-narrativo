import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Edit3, FileText, Plus, Moon, Sun, 
  Sparkles, X, Feather, Menu, Bookmark, FileUp,
  GraduationCap, Compass, Users, Lightbulb, TrendingUp, Search,
  Type, Save, Trash2, Download, Share2, Upload, ChevronLeft, ChevronRight, Check, AlertTriangle, BookOpen
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

const LIVROS_INICIAIS = [
  {
    id: 'b1',
    title: 'A Sombra do Tempo',
    author: 'Alexandre Sousa',
    genre: 'Ficção Científica',
    coverColor: 'from-purple-600 to-indigo-800',
    synopsis: 'Uma jornada através das fendas temporais da Via Láctea.',
    content: 'Capítulo 1: O Despertar\n\nO silêncio na estação espacial era ensurdecedor.'
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

  const currentBook = useMemo(() => {
    return books.find(b => b.id === selectedBookId) || books[0] || { id: '', title: '', content: '' };
  }, [books, selectedBookId]);

  return (
    <div className={`min-h-screen flex flex-col ${theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <header className="px-6 py-4 flex items-center justify-between border-b border-slate-800 bg-slate-900">
        <div className="flex items-center gap-2">
          <Feather className="w-6 h-6 text-purple-500" />
          <h1 className="text-xl font-bold text-white">Estúdio Narrativo</h1>
        </div>
        <nav className="flex items-center gap-2">
          <button 
            onClick={() => setActiveTab('library')} 
            className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'library' ? 'bg-purple-600 text-white' : 'text-slate-400'}`}
          >
            Biblioteca
          </button>
          <button 
            onClick={() => setActiveTab('editor')} 
            className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'editor' ? 'bg-purple-600 text-white' : 'text-slate-400'}`}
          >
            Editor
          </button>
        </nav>
      </header>

      <main className="flex-1 p-6">
        {activeTab === 'library' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Meus Manuscritos</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {books.map(b => (
                <div key={b.id} className="p-4 rounded-xl border border-slate-800 bg-slate-900">
                  <h3 className="font-bold text-white">{b.title}</h3>
                  <button 
                    onClick={() => { setSelectedBookId(b.id); setActiveTab('editor'); }} 
                    className="mt-2 px-3 py-1 bg-purple-600 text-white rounded-lg text-xs"
                  >
                    Editar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'editor' && (
          <div className="flex flex-col h-full space-y-4">
            <input 
              type="text" 
              value={currentBook.title || ''} 
              onChange={(e) => setBooks(prev => prev.map(b => b.id === selectedBookId ? { ...b, title: e.target.value } : b))}
              className="text-lg font-bold bg-transparent border-b border-slate-800 p-2 text-white" 
            />
            <textarea 
              value={currentBook.content || ''} 
              onChange={(e) => setBooks(prev => prev.map(b => b.id === selectedBookId ? { ...b, content: e.target.value } : b))}
              className="w-full h-96 bg-slate-900 border border-slate-800 rounded-xl p-4 text-white focus:outline-none"
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
  
