import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Autor, Artigo } from '../types';
import { DataTable } from '../components/DataTable';
import { DetailModal } from '../components/DetailModal';
import { AddArticleModal } from '../components/AddArticleModal';
import { Plus } from 'lucide-react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export function AuthorsPage() {
  useDocumentTitle('Autores');
  const [authors, setAuthors] = useState<Autor[]>([]);
  const [selectedAuthor, setSelectedAuthor] = useState<Autor | null>(null);
  const [authorArticles, setAuthorArticles] = useState<Artigo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // Pagination & Search state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortCol, setSortCol] = useState<string>('nome');
  const [sortDesc, setSortDesc] = useState<boolean>(false);
  const pageSize = 25;

  useEffect(() => {
    fetchAuthors();
  }, [currentPage, searchTerm, sortCol, sortDesc]);

  async function fetchAuthors() {
    setIsLoading(true);
    try {
      let query = supabase
        .from('autores')
        .select('*', { count: 'exact' });
        
      if (searchTerm) {
        const safeTerm = searchTerm.replace(/,/g, '');
        query = query.or(`nome.ilike.%${safeTerm}%,nome_completo.ilike.%${safeTerm}%`);
      }

      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      const orderCol = sortCol || 'nome';
      query = query
        .order(orderCol, { ascending: !sortDesc })
        .range(from, to);

      const { data, count, error } = await query;

      if (error) throw error;
      
      if (count !== null) setTotalCount(count);
      setAuthors(data || []);
    } catch (error) {
      console.error('Erro ao buscar autores:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRowClick(author: Autor) {
    setIsLoading(true);
    setSelectedAuthor(author);
    try {
      // Fetch articles for this author
      const { data, error } = await supabase
        .from('artigo_autor')
        .select('artigos(*)')
        .eq('id_autor', author.id);

      if (error) throw error;
      setAuthorArticles(data?.map(item => item.artigos) as any || []);
      setIsModalOpen(true);
    } catch (error) {
      console.error('Erro ao buscar artigos do autor:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const columns = [
    { header: 'Nome', accessor: 'nome' as const, sortableKey: 'nome', className: 'font-medium' },
    { header: 'Nome Completo', accessor: 'nome_completo' as const, sortableKey: 'nome_completo' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-black text-zinc-900 tracking-tight">Autores</h1>
          <p className="text-zinc-500">Mapeamento de pesquisadores e contribuintes.</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
        >
          <Plus className="w-5 h-5" />
          Novo Artigo
        </button>
      </div>

      <DataTable
        columns={columns}
        data={authors}
        onRowClick={handleRowClick}
        isLoading={isLoading}
        serverSide={true}
        totalCount={totalCount}
        currentPage={currentPage}
        itemsPerPage={pageSize}
        onPageChange={(page) => setCurrentPage(page)}
        onSearch={(term) => {
          setSearchTerm(term);
          setCurrentPage(1);
        }}
        onSortChange={(col, desc) => {
          setSortCol(col || 'id');
          setSortDesc(desc);
          setCurrentPage(1);
        }}
        emptyMessage="Nenhum autor encontrado."
        searchPlaceholder="Buscar por nome ou nome completo..."
      />

      <AddArticleModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchAuthors}
      />

      <DetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedAuthor?.nome || 'Detalhes do Autor'}
      >
        {selectedAuthor && (
          <div className="space-y-8">
            <div>
               <h3 className="text-sm font-semibold text-zinc-500 uppercase mb-2">Informações Cadastrais</h3>
               <div className="bg-emerald-50 p-4 rounded-lg space-y-2 border border-emerald-100">
                <p className="text-sm text-zinc-600">
                  <span className="font-bold text-emerald-800">Nome de Citação:</span> {selectedAuthor.nome}
                </p>
                <p className="text-sm text-zinc-600">
                  <span className="font-bold text-emerald-800">Nome Completo:</span> {selectedAuthor.nome_completo || 'Não informado'}
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-zinc-500 uppercase mb-4">Artigos Relacionados</h3>
              {authorArticles.length > 0 ? (
                <div className="space-y-3">
                  {authorArticles.map((artigo) => (
                    <div 
                      key={artigo.id} 
                      className="p-3 border border-emerald-100 rounded-lg hover:border-emerald-300 transition-colors bg-white shadow-sm"
                    >
                      <p className="text-sm font-medium text-zinc-900">{artigo.titulo}</p>
                      <p className="text-xs text-emerald-600 mt-1 font-medium">{artigo.ano} • {artigo.source_titulo}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-400 italic">Nenhum artigo vinculado a este autor.</p>
              )}
            </div>
          </div>
        )}
      </DetailModal>
    </div>
  );
}
