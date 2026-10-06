import React, { useState, useEffect } from 'react';

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
  const [selectedBookId, setSelectedBookId] = useState('b1');
  const [toast, setToast] = useState(null);

  // Carregamento seguro via LocalStorage com Fallback
  useEffect(() => {
    try {
      const saved = localStorage.getItem('estudio_narrativo_books');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setBooks(parsed);
          setSelectedBookId(parsed[0].id);
          return;
        }
      }
    } catch (e) {
      console.error('Erro ao ler localStorage:', e);
    }
    setBooks(LIVROS_INICIAIS);
    setSelectedBookId('b1');
  }, []);

  // Salvamento automático
  const saveBooks = (newBooks) => {
    setBooks(newBooks);
    try {
      localStorage.setItem('estudio_narrativo_books', JSON.stringify(newBooks));
    } catch (e) {
      console.error('Erro ao salvar no localStorage:', e);
    }
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const currentBook = books.find(b => b.id === selectedBookId) || books[0] || { id: '', title: '', content: '' };

  const handleCreateBook = () => {
    const newBook = {
      id: `b_${Date.now()}`,
      title: 'Novo Manuscrito',
      author: 'Autor',
      genre: 'Geral',
      synopsis: 'Descrição do novo manuscrito...',
      content: ''
    };
    const updated = [...books, newBook];
    saveBooks(updated);
    setSelectedBookId(newBook.id);
    setActiveTab('editor');
    showToast('Novo manuscrito criado!');
  };

  const handleUpdateTitle = (title) => {
    const updated = books.map(b => b.id === selectedBookId ? { ...b, title } : b);
    saveBooks(updated);
  };

  const handleUpdateContent = (content) => {
    const updated = books.map(b => b.id === selectedBookId ? { ...b, content } : b);
    saveBooks(updated);
  };

  const handleDeleteBook = (id) => {
    if (books.length <= 1) {
      showToast('Mantenha pelo menos um manuscrito.');
      return;
    }
    const updated = books.filter(b => b.id !== id);
    saveBooks(updated);
    if (selectedBookId === id) {
      setSelectedBookId(updated[0].id);
    }
    showToast('Manuscrito removido.');
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans ${theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <header className="px-6 py-4 flex items-center justify-between border-b border-slate-800 bg-slate-900">
        <div className="flex items-center gap-2">
          <span className="text-purple-500 font-bold text-xl">🪶</span>
          <h1 className="text-xl font-bold text-white">Estúdio Narrativo</h1>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} 
            className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
            title="Alternar tema"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
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
                📖 Meus Manuscritos
              </h2>
              <button 
                onClick={handleCreateBook} 
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              >
                + Novo Livro
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
                      ✏️ Abrir no Editor
                    </button>
                    <button 
                      onClick={() => handleDeleteBook(b.id)} 
                      className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                      title="Apagar manuscrito"
                    >
                      🗑️
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
          ✓ {toast}
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
  
