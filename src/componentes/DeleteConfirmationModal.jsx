// src/DeleteConfirmationModal.jsx
import React from 'react';

export const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, theme }) => {
  if (!isOpen) return null;

  const isDark = theme === 'dark';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className={`max-w-md w-full border rounded-2xl p-6 ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <h3 className="font-bold text-lg mb-2">Confirmar exclusão</h3>
        <p className={`text-sm mb-6 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          Tem certeza de que deseja excluir este manuscrito?
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-red-600 hover:bg-red-700 text-white"
          >
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
};
