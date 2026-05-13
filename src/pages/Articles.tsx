import {
  Calendar,
  Edit2,
  ExternalLink,
  MessageSquare,
  Plus,
  Quote,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { AddArticleModal } from "../components/AddArticleModal";
import { DataTable } from "../components/DataTable";
import { DetailModal } from "../components/DetailModal";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { supabase } from "../lib/supabase";
import { Artigo, ArtigoComDetalhes } from "../types";

export function ArticlesPage() {
  useDocumentTitle("Artigos");
  const [articles, setArticles] = useState<Artigo[]>([]);
  const [selectedArticle, setSelectedArticle] =
    useState<ArtigoComDetalhes | null>(null);
  const [articleToEdit, setArticleToEdit] = useState<Artigo | null>(null);
  const [articleToDelete, setArticleToDelete] = useState<number | null>(null);
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
    fetchArticles();
  }, [currentPage, searchTerm, sortCol, sortDesc]);

  async function fetchArticles() {
    setIsLoading(true);
    try {
      let query = supabase.from("artigos").select(
        `
          *,
          artigo_autor(
            autores(nome)
          )
        `,
        { count: "exact" },
      );

      if (searchTerm) {
        const safeTerm = searchTerm.replace(/,/g, "");
        query = query.or(
          `titulo.ilike.%${safeTerm}%,source_titulo.ilike.%${safeTerm}%`,
        );
      }

      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      // Handle null/empty sortCol
      const orderCol = sortCol || "id";

      query = query.order(orderCol, { ascending: !sortDesc }).range(from, to);

      const { data, count, error } = await query;

      if (error) throw error;

      if (count !== null) setTotalCount(count);

      // Transform data to easily access authors list
      const transformedData = (data || []).map((article) => ({
        ...article,
        autores_nomes: (article.artigo_autor as any[])
          ?.map((aa) => aa.autores?.nome)
          .filter(Boolean)
          .join(", "),
      }));

      setArticles(transformedData);
    } catch (error) {
      console.error("Erro ao buscar artigos:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function confirmDelete() {
    if (articleToDelete === null) return;

    setIsLoading(true);
    try {
      // 1. Obter IDs associados antes de deletar
      const { data: autoresAssociados } = await supabase
        .from("artigo_autor")
        .select("id_autor")
        .eq("id_artigo", articleToDelete);
      const { data: palavrasAssociadas } = await supabase
        .from("artigo_palavra_chave")
        .select("id_palavra_chave")
        .eq("id_artigo", articleToDelete);
      const { data: refsAssociadas } = await supabase
        .from("artigo_referencia")
        .select("id_referencia")
        .eq("id_artigo", articleToDelete);

      // 2. Deletar associações primeiro para não dar erro
      await supabase
        .from("artigo_autor")
        .delete()
        .eq("id_artigo", articleToDelete);
      await supabase
        .from("artigo_palavra_chave")
        .delete()
        .eq("id_artigo", articleToDelete);
      await supabase
        .from("artigo_referencia")
        .delete()
        .eq("id_artigo", articleToDelete);

      // 3. Deletar artigo
      const { error } = await supabase
        .from("artigos")
        .delete()
        .eq("id", articleToDelete);
      if (error) throw error;

      // 4. Limpar órfãos (autores, palavras, referências que não estão mais em nenhum artigo)
      if (autoresAssociados) {
        for (const { id_autor } of autoresAssociados) {
          const { data } = await supabase
            .from("artigo_autor")
            .select("id_autor")
            .eq("id_autor", id_autor);
          if (!data || data.length === 0) {
            await supabase.from("autores").delete().eq("id", id_autor);
          }
        }
      }

      if (palavrasAssociadas) {
        for (const { id_palavra_chave } of palavrasAssociadas) {
          const { data } = await supabase
            .from("artigo_palavra_chave")
            .select("id_palavra_chave")
            .eq("id_palavra_chave", id_palavra_chave);
          if (!data || data.length === 0) {
            await supabase
              .from("palavras_chaves")
              .delete()
              .eq("id", id_palavra_chave);
          }
        }
      }

      if (refsAssociadas) {
        for (const { id_referencia } of refsAssociadas) {
          const { data } = await supabase
            .from("artigo_referencia")
            .select("id_referencia")
            .eq("id_referencia", id_referencia);
          if (!data || data.length === 0) {
            await supabase.from("referencias").delete().eq("id", id_referencia);
          }
        }
      }

      fetchArticles();
    } catch (error: any) {
      console.error("Erro ao excluir artigo:", error);
      alert(
        `Erro ao excluir artigo: ${error?.message || JSON.stringify(error)}\n\n(Dica: se for um erro de política/RLS, você pode precisar ajustar as permissões no Supabase para permitir exclusões/DELETE nas tabelas).`,
      );
    } finally {
      setIsLoading(false);
      setArticleToDelete(null);
    }
  }

  const renderActions = (item: any) => (
    <div className="flex items-center justify-end gap-2 text-zinc-400">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setArticleToEdit(item);
          setIsAddModalOpen(true);
        }}
        className="p-1 hover:text-blue-600 hover:bg-blue-50 rounded"
        title="Editar"
      >
        <Edit2 className="w-4 h-4" />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setArticleToDelete(item.id);
        }}
        className="p-1 hover:text-red-600 hover:bg-red-50 rounded"
        title="Excluir"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );

  async function handleRowClick(article: any) {
    setIsLoading(true);
    try {
      // Fetch details including authors, keywords, and references
      const { data: authorsData } = await supabase
        .from("artigo_autor")
        .select("autores(*)")
        .eq("id_artigo", article.id);

      const { data: keywordsData } = await supabase
        .from("artigo_palavra_chave")
        .select("palavras_chaves(*)")
        .eq("id_artigo", article.id);

      const { data: referencesData } = await supabase
        .from("artigo_referencia")
        .select("referencias(*)")
        .eq("id_artigo", article.id);

      setSelectedArticle({
        ...article,
        autores: (authorsData?.map((item) => item.autores) as any) || [],
        palavras_chaves:
          (keywordsData?.map((item) => item.palavras_chaves) as any) || [],
        referencias:
          (referencesData?.map((item) => item.referencias) as any) || [],
      });
      setIsModalOpen(true);
    } catch (error) {
      console.error("Erro ao buscar detalhes do artigo:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const columns = [
    {
      header: "Título",
      accessor: "titulo" as const,
      sortableKey: "titulo",
      className:
        "font-medium max-w-sm overflow-hidden text-ellipsis whitespace-nowrap",
    },
    { header: "Ano", accessor: "ano" as const, sortableKey: "ano" },
    {
      header: "Citações",
      accessor: "qt_citacao" as const,
      sortableKey: "qt_citacao",
      className: "text-center",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-black text-zinc-900 tracking-tight">
            Artigos
          </h1>
          <p className="text-zinc-500">
            Explore e gerencie a base de conhecimento científico.
          </p>
        </div>
        <button
          onClick={() => {
            setArticleToEdit(null);
            setIsAddModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
        >
          <Plus className="w-5 h-5" />
          Novo Artigo
        </button>
      </div>

      <DataTable
        columns={columns}
        data={articles}
        onRowClick={handleRowClick}
        rowActions={renderActions}
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
        emptyMessage="Nenhum artigo encontrado. Verifique sua conexão com o Supabase."
      />

      <AddArticleModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setArticleToEdit(null);
        }}
        onSuccess={fetchArticles}
        articleToEdit={articleToEdit}
      />

      <DetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedArticle?.titulo || "Detalhes do Artigo"}
      >
        {selectedArticle && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-zinc-500">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm font-semibold uppercase">
                    Ano de Publicação
                  </span>
                </div>
                <p className="text-lg font-medium text-zinc-900">
                  {selectedArticle.ano || "N/A"}
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-zinc-500">
                  <MessageSquare className="w-4 h-4" />
                  <span className="text-sm font-semibold uppercase">
                    Fonte / Source
                  </span>
                </div>
                <p className="text-lg font-medium text-zinc-900">
                  {selectedArticle.source_titulo || "N/A"}
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-zinc-500">
                  <Quote className="w-4 h-4" />
                  <span className="text-sm font-semibold uppercase">
                    Citações
                  </span>
                </div>
                <p className="text-lg font-medium text-zinc-900">
                  {selectedArticle.qt_citacao}
                </p>
              </div>

              {selectedArticle.link && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-zinc-500">
                    <ExternalLink className="w-4 h-4" />
                    <span className="text-sm font-semibold uppercase">
                      Link Externo
                    </span>
                  </div>
                  <a
                    href={selectedArticle.link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-1"
                  >
                    Ver Artigo <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>

            {selectedArticle.resumo && (
              <div className="space-y-4 pt-4 border-t border-zinc-100">
                <h3 className="text-sm font-semibold text-zinc-500 uppercase">
                  Resumo / Abstract
                </h3>
                <p className="text-zinc-600 leading-relaxed text-sm md:text-base">
                  {selectedArticle.resumo}
                </p>
              </div>
            )}

            {selectedArticle.autores && selectedArticle.autores.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-zinc-100">
                <h3 className="text-sm font-semibold text-zinc-500 uppercase">
                  Autores
                </h3>
                <div className="flex flex-wrap gap-2 pt-1">
                  {selectedArticle.autores.map((autor) => (
                    <span
                      key={autor.id}
                      className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-xs font-medium transition-colors hover:bg-emerald-100"
                    >
                      {autor.nome}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedArticle.palavras_chaves &&
              selectedArticle.palavras_chaves.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-zinc-100">
                  <h3 className="text-sm font-semibold text-zinc-500 uppercase">
                    Palavras-chave
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedArticle.palavras_chaves.map((pc) => (
                      <span
                        key={pc.id}
                        className="px-3 py-1 bg-emerald-600 text-white rounded-full text-xs font-semibold"
                      >
                        {pc.palavra_chave}
                      </span>
                    ))}
                  </div>
                </div>
              )}

            {selectedArticle.referencias &&
              selectedArticle.referencias.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-zinc-100">
                  <h3 className="text-sm font-semibold text-zinc-500 uppercase">
                    Referências
                  </h3>
                  <ul className="space-y-3">
                    {selectedArticle.referencias.map((ref) => (
                      <li
                        key={ref.id}
                        className="text-xs text-zinc-500 italic border-l-2 border-zinc-200 pl-4"
                      >
                        {ref.conteudo_referencia}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
          </div>
        )}
      </DetailModal>

      {/* Confirmação de Exclusão */}
      {articleToDelete !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-900/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-zinc-900">Excluir Artigo?</h3>
            <p className="text-sm text-zinc-500 leading-relaxed">
              Tem certeza que deseja excluir este artigo e todas as suas
              associações? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setArticleToDelete(null)}
                className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium rounded-lg transition-colors"
                disabled={isLoading}
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                disabled={isLoading}
              >
                {isLoading ? "Excluindo..." : "Excluir Artigo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
