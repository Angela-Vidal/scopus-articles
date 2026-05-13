import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../lib/utils';
import { BookOpen, Users, Hash, Quote, Library, FileUp } from 'lucide-react';
import { CsvImportModal } from './CsvImportModal';

const navItems = [
  { name: 'Artigos', path: '/artigos', icon: BookOpen },
  { name: 'Autores', path: '/autores', icon: Users },
  { name: 'Palavras chaves', path: '/palavras-chave', icon: Hash },
  { name: 'Referências', path: '/referencias', icon: Quote },
];

export function Navigation() {
  const location = useLocation();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-zinc-200 z-50 px-4 md:px-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Library className="w-6 h-6 text-zinc-900" />
          <span className="font-bold text-lg tracking-tight">BiblioHub</span>
          <div className="h-6 w-px bg-zinc-300 mx-2 hidden md:block" />
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center justify-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-medium rounded-lg transition-colors ml-2"
            title="Importar CSV"
          >
            <FileUp className="w-4 h-4" />
            <span className="hidden leading-none md:inline">Importar CSV</span>
          </button>
        </div>
        
        <div className="flex items-center gap-1 md:gap-4 overflow-x-auto no-scrollbar">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center gap-2 whitespace-nowrap",
                location.pathname === item.path 
                  ? "bg-emerald-600 text-white shadow-sm font-bold" 
                  : "text-zinc-600 hover:text-zinc-900 hover:bg-emerald-50"
              )}
            >
              <item.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{item.name}</span>
            </Link>
          ))}
        </div>
      </nav>
      
      <CsvImportModal 
        isOpen={isImportModalOpen} 
        onClose={() => {
          setIsImportModalOpen(false);
          // Opcional: Aqui poderíamos disparar um evento global para as páginas recarregarem
          // Em um app simples, talvez seja ok apenas deixar o usuário recarregar ou navegar para buscar
          window.location.reload();
        }} 
      />
    </>
  );
}
