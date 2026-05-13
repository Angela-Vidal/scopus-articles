import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { AddArticleModal } from "../components/AddArticleModal";
import { DataTable } from "../components/DataTable";
import { DetailModal } from "../components/DetailModal";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { supabase } from "../lib/supabase";
import { Artigo, PalavraChave } from "../types";

export function KeywordsPage() {
  useDocumentTitle("Palavras-chave");
  const [keywords, setKeywords] = useState<PalavraChave[]>([]);
  const [selectedKeyword, setSelectedKeyword] = useState<PalavraChave | null>(
    null,
  );
  const [keywordArticles, setKeywordArticles] = useState<Artigo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Pagination & Search state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortCol, setSortCol] = useState<string>("palavra_chave");
  const [sortDesc, setSortDesc] = useState<boolean>(false);
  const pageSize = 25;

  useEffect(() => {
    fetchKeywords();
  }, [currentPage, searchTerm, sortCol, sortDesc]);

  async function fetchKeywords() {
    setIsLoading(true);
    try {
      let query = supabase
        .from("palavras_chaves")
        .select("*", { count: "exact" });

      if (searchTerm) {
        query = query.ilike("palavra_chave", `%${searchTerm}%`);
      }

      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      const orderCol = sortCol || "palavra_chave";
      query = query.order(orderCol, { ascending: !sortDesc }).range(from, to);

      const { data, count, error } = await query;

      if (error) throw error;

      if (count !== null) setTotalCount(count);
      setKeywords(data || []);
    } catch (error) {
      console.error("Erro ao buscar palavras-chave:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRowClick(keyword: PalavraChave) {
    setIsLoading(true);
    setSelectedKeyword(keyword);
    try {
      // Fetch articles for this keyword
      const { data, error } = await supabase
        .from("artigo_palavra_chave")
        .select("artigos(*)")
        .eq("id_palavra_chave", keyword.id);

      if (error) throw error;
      setKeywordArticles((data?.map((item) => item.artigos) as any) || []);
      setIsModalOpen(true);
    } catch (error) {
      console.error("Erro ao buscar artigos da palavra-chave:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const columns = [
    {
      header: "Palavra-chave",
      accessor: "palavra_chave" as const,
      sortableKey: "palavra_chave",
      className: "font-semibold",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-black text-zinc-900 tracking-tight">
            Palavras Chaves
          </h1>
          <p className="text-zinc-500">
            Termos e tópicos centrais da biblioteca.
          </p>
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
        data={keywords}
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
          setSortCol(col || "id");
          setSortDesc(desc);
          setCurrentPage(1);
        }}
        emptyMessage="Nenhuma palavra-chave encontrada."
        searchPlaceholder="Buscar por palavra-chave..."
      />

      <AddArticleModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchKeywords}
      />

      <DetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedKeyword?.palavra_chave || "Detalhes da Palavra-Chave"}
      >
        {selectedKeyword && (
          <div className="space-y-8">
            <div>
              <h3 className="text-sm font-semibold text-zinc-500 uppercase mb-4">
                Artigos relacionados a este termo
              </h3>
              {keywordArticles.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {keywordArticles.map((artigo) => (
                    <div
                      key={artigo.id}
                      className="p-4 border border-emerald-100 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow"
                    >
                      <p className="text-sm font-bold text-zinc-900">
                        {artigo.titulo}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-emerald-600 font-medium">
                        <span>{artigo.ano}</span>
                        <span className="w-1 h-1 bg-emerald-300 rounded-full" />
                        <span>{artigo.source_titulo}</span>
                        <span className="w-1 h-1 bg-emerald-300 rounded-full" />
                        <span>{artigo.qt_citacao} citações</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-400 italic">
                  Nenhum artigo utiliza esta palavra-chave.
                </p>
              )}
            </div>
          </div>
        )}
      </DetailModal>
    </div>
  );
}
