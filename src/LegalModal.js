import React from 'react';
import { X, ShieldCheck, FileText } from 'lucide-react';

export default function LegalModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl bg-slate-900 border border-slate-800 text-slate-200 p-6 shadow-2xl">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
          <ShieldCheck className="w-7 h-7 text-purple-400" />
          <h2 className="text-xl font-bold text-white">Termos de Uso &amp; Privacidade</h2>
        </div>

        <div className="space-y-6 text-sm leading-relaxed text-slate-300">
          <section>
            <h3 className="text-base font-semibold text-purple-300 flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4" /> Termos de Uso
            </h3>
            <p className="mb-2"><strong>1. Propriedade Intelectual:</strong> Todo conteúdo, história ou obra literária criada ou editada na plataforma é de propriedade 100% exclusiva do usuário. Não reivindicamos qualquer direito sobre suas criações.</p>
            <p className="mb-2"><strong>2. Armazenamento Local &amp; Responsabilidade:</strong> A plataforma utiliza o armazenamento local do seu próprio navegador (IndexedDB). É de responsabilidade do usuário exportar backups periódicos (JSON/Texto) de seus manuscritos.</p>
            <p><strong>3. Isenção de Garantias:</strong> A ferramenta é fornecida "como está", sem garantia de armazenamento ininterrupto em caso de formatação ou limpeza de cache do navegador.</p>
          </section>

          <section className="border-t border-slate-800 pt-4">
            <h3 className="text-base font-semibold text-purple-300 flex items-center gap-2 mb-2">
              <ShieldCheck className="w-4 h-4" /> Política de Privacidade (LGPD)
            </h3>
            <p className="mb-2"><strong>1. Privacidade Absoluta:</strong> Não coletamos, enviamos ou armazenamos seus textos ou manuscritos em servidores externos. Tudo permanece apenas no seu próprio dispositivo.</p>
            <p><strong>2. Conformidade:</strong> A aplicação opera sob o princípio de <em>Privacy by Default</em>, respeitando integralmente a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).</p>
          </section>
        </div>

        <div className="mt-8 pt-4 border-t border-slate-800 flex justify-end">
          <button 
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium transition"
          >
            Entendi e Concordo
          </button>
        </div>
      </div>
    </div>
  );
}
