import React from 'react';

export function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="w-full bg-white border-t border-zinc-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-zinc-500">
          <p>
            &copy; {currentYear} BiblioHub. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-1 flex-wrap justify-center">
            <span>Desenvolvido por</span>
            <a 
              href="https://www.linkedin.com/in/angela-vidal-vp/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="font-medium text-emerald-600 hover:text-emerald-700 hover:underline transition-colors ml-1"
            >
              Angela Vidal
            </a>
            <span>&amp;</span>
            <a 
              href="https://www.linkedin.com/in/albiery-goncalves/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="font-medium text-emerald-600 hover:text-emerald-700 hover:underline transition-colors"
            >
              Albiery Gonçalves
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
