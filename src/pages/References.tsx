import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { AddArticleModal } from "../components/AddArticleModal";
import { DataTable } from "../components/DataTable";
import { DetailModal } from "../components/DetailModal";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { supabase } from "../lib/supabase";
import { Artigo, Referencia } from "../types";

export function ReferencesPage() {
  useDocumentTitle("Referências");
  const [references, setReferences] = useState<Referencia[]>([]);
  const [selectedReference, setSelectedReference] = useState<Referencia | null>(
    null,
  );
  const [refArticles, setRefArticles] = useState<Artigo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Pagination & Search state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortCol, setSortCol] = useState<string>("id");
  const [sortDesc, setSortDesc] = useState<boolean>(true);
  const pageSize = 25;

  useEffect(() => {
    fetchReferences();
  }, [currentPage, searchTerm, sortCol, sortDesc]);

  async function fetchReferences() {
    setIsLoading(true);
    try {
      let query = supabase.from("referencias").select("*", { count: "exact" });

      if (searchTerm) {
        query = query.ilike("conteudo_referencia", `%${searchTerm}%`);
      }

      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      const orderCol = sortCol || "id";
      query = query.order(orderCol, { ascending: !sortDesc }).range(from, to);

      const { data, count, error } = await query;

      if (error) throw error;

      if (count !== null) setTotalCount(count);
      setReferences(data || []);
    } catch (error) {
      console.error("Erro ao buscar referências:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRowClick(ref: Referencia) {
    setIsLoading(true);
    setSelectedReference(ref);
    try {
      // Fetch articles that cite this reference
      const { data, error } = await supabase
        .from("artigo_referencia")
        .select("artigos(*)")
        .eq("id_referencia", ref.id);

      if (error) throw error;
      setRefArticles((data?.map((item) => item.artigos) as any) || []);
      setIsModalOpen(true);
    } catch (error) {
      console.error("Erro ao buscar artigos citantes:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const columns = [
    {
      header: "Conteúdo da Referência",
      accessor: (item: Referencia) => (
        <span className="line-clamp-2 italic text-zinc-500 overflow-hidden text-ellipsis">
          {item.conteudo_referencia}
        </span>
      ),
      sortableKey: "conteudo_referencia",
      className: "max-w-md",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-black text-zinc-900 tracking-tight">
            Referências
          </h1>
          <p className="text-zinc-500">
            Citações e obras externas referenciadas.
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
        data={references}
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
        emptyMessage="Nenhuma referência encontrada."
        searchPlaceholder="Buscar citações..."
      />

      <AddArticleModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchReferences}
      />

      <DetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Detalhes da Referência"
      >
        {selectedReference && (
          <div className="space-y-8">
            <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100">
              <h3 className="text-sm font-semibold text-emerald-700 uppercase mb-4">
                Citação Completa
              </h3>
              <p className="text-zinc-900 italic serif leading-relaxed text-base md:text-lg">
                "{selectedReference.conteudo_referencia}"
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-zinc-500 uppercase mb-4">
                Artigos que citam esta referência
              </h3>
              {refArticles.length > 0 ? (
                <div className="space-y-3">
                  {refArticles.map((artigo) => (
                    <div
                      key={artigo.id}
                      className="p-4 border border-emerald-100 rounded-xl bg-white shadow-sm"
                    >
                      <p className="text-sm font-bold text-zinc-900">
                        {artigo.titulo}
                      </p>
                      <p className="text-xs text-emerald-600 mt-1 font-medium">
                        {artigo.ano} • {artigo.source_titulo}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-400 italic">
                  Nenhum artigo cadastrado utiliza esta referência.
                </p>
              )}
            </div>
          </div>
        )}
      </DetailModal>
    </div>
  );
}
