import {
  AlertTriangle,
  BookOpen,
  Calendar,
  Database,
  Edit2,
  ExternalLink,
  FileText,
  Globe,
  Loader2,
  Lock,
  MessageSquare,
  Plus,
  Quote,
  Sparkles,
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

  // Estados para Transformação de Dados
  const [isTransforming, setIsTransforming] = useState(false);
  const [transformError, setTransformError] = useState<string | null>(null);
  const [transformSuccess, setTransformSuccess] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [nullAbstractCount, setNullAbstractCount] = useState<number | null>(
    null,
  );

  async function checkNullAbstracts() {
    setIsTransforming(true);
    setTransformError(null);
    setTransformSuccess(null);
    try {
      const { data, error } = await supabase
        .from("artigos")
        .select("id, resumo");

      if (error) throw error;

      const toDelete = (data || []).filter((item) => {
        return (
          !item.resumo ||
          item.resumo.trim() === "" ||
          item.resumo.trim().toLowerCase() === "null"
        );
      });

      setNullAbstractCount(toDelete.length);
      setConfirmOpen(true);
    } catch (err: any) {
      console.error("Erro ao verificar abstracts:", err);
      setTransformError(err.message || "Erro ao consultar banco de dados.");
    } finally {
      setIsTransforming(false);
    }
  }

  async function executeDeleteNullAbstracts() {
    setIsTransforming(true);
    setTransformError(null);
    setConfirmOpen(false);
    try {
      const { data, error } = await supabase
        .from("artigos")
        .select("id, resumo");

      if (error) throw error;

      const toDelete = (data || []).filter((item) => {
        return (
          !item.resumo ||
          item.resumo.trim() === "" ||
          item.resumo.trim().toLowerCase() === "null"
        );
      });

      const ids = toDelete.map((item) => item.id);

      if (ids.length === 0) {
        setTransformSuccess(
          "Nenhum artigo com abstract nulo ou vazio foi encontrado.",
        );
        return;
      }

      // Deleta primeiro das tabelas associativas em chunks para evitar limites
      const chunkSize = 100;
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        await supabase.from("artigo_autor").delete().in("id_artigo", chunk);
        await supabase
          .from("artigo_palavra_chave")
          .delete()
          .in("id_artigo", chunk);
        await supabase
          .from("artigo_referencia")
          .delete()
          .in("id_artigo", chunk);
        await supabase.from("artigos").delete().in("id", chunk);
      }

      setTransformSuccess(
        `${ids.length} artigos sem abstract foram excluídos com sucesso do banco de dados.`,
      );
      setCurrentPage(1);
      fetchArticles();
    } catch (err: any) {
      console.error("Erro ao processar exclusão:", err);
      setTransformError(err.message || "Erro ao processar exclusão.");
    } finally {
      setIsTransforming(false);
    }
  }

  async function executeTransformIssnIsbn() {
    setIsTransforming(true);
    setTransformError(null);
    setTransformSuccess(null);
    try {
      const { data, error } = await supabase
        .from("artigos")
        .select("id, issn, isbn, issn_isbn");

      if (error) {
        if (
          error.message?.includes("issn_isbn") ||
          error.message?.includes("does not exist")
        ) {
          throw new Error(
            'A coluna "issn_isbn" não existe na tabela "artigos". Por favor, execute o comando SQL abaixo no seu painel do Supabase para criá-la:\n\nALTER TABLE public.artigos ADD COLUMN IF NOT EXISTS issn_isbn text;',
          );
        }
        throw error;
      }

      const toUpdate = (data || [])
        .map((item) => {
          const expectedVal =
            item.issn && item.issn.trim() !== ""
              ? item.issn.trim()
              : item.isbn && item.isbn.trim() !== ""
                ? item.isbn.trim()
                : null;
          return {
            id: item.id,
            expected: expectedVal,
            current: item.issn_isbn,
          };
        })
        .filter((item) => item.expected !== item.current);

      if (toUpdate.length === 0) {
        setTransformSuccess(
          "Todos os artigos já possuem o campo ISSN_ISBN atualizado conforme a regra (priorizando o ISSN).",
        );
        return;
      }

      const chunkSize = 50;
      let totalUpdated = 0;
      for (let i = 0; i < toUpdate.length; i += chunkSize) {
        const chunk = toUpdate.slice(i, i + chunkSize);
        const promises = chunk.map((item) =>
          supabase
            .from("artigos")
            .update({ issn_isbn: item.expected })
            .eq("id", item.id),
        );
        await Promise.all(promises);
        totalUpdated += chunk.length;
      }

      setTransformSuccess(
        `Sucesso! ${totalUpdated} artigos foram transformados e atualizados com o valor correto na coluna ISSN_ISBN no banco de dados.`,
      );
      fetchArticles();
    } catch (err: any) {
      console.error("Erro ao transformar ISSN/ISBN:", err);
      setTransformError(
        err.message || "Erro durante a transformação dos dados.",
      );
    } finally {
      setIsTransforming(false);
    }
  }

  async function executeTratarTipoAcesso() {
    setIsTransforming(true);
    setTransformError(null);
    setTransformSuccess(null);
    try {
      const { data, error } = await supabase
        .from("artigos")
        .select("id, open_access");

      if (error) throw error;

      const toUpdate = (data || [])
        .map((item) => {
          const isNullOrEmpty =
            !item.open_access ||
            item.open_access.trim() === "" ||
            item.open_access.trim().toLowerCase() === "null";
          return {
            id: item.id,
            expected: isNullOrEmpty ? "sem dados" : item.open_access,
            current: item.open_access,
          };
        })
        .filter((item) => item.expected !== item.current);

      if (toUpdate.length === 0) {
        setTransformSuccess(
          "Todos os artigos já possuem dados válidos ou já foram tratados no campo de Acesso Aberto (Open Access).",
        );
        return;
      }

      const chunkSize = 50;
      let totalUpdated = 0;
      for (let i = 0; i < toUpdate.length; i += chunkSize) {
        const chunk = toUpdate.slice(i, i + chunkSize);
        const promises = chunk.map((item) =>
          supabase
            .from("artigos")
            .update({ open_access: item.expected })
            .eq("id", item.id),
        );
        await Promise.all(promises);
        totalUpdated += chunk.length;
      }

      setTransformSuccess(
        `Sucesso! ${totalUpdated} artigos tiveram o campo de Acesso Aberto (Open Access) nulo/vazio tratado para "sem dados".`,
      );
      fetchArticles();
    } catch (err: any) {
      console.error("Erro ao tratar tipo de acesso:", err);
      setTransformError(
        err.message || "Erro durante o tratamento do tipo de acesso.",
      );
    } finally {
      setIsTransforming(false);
    }
  }

  async function executeTratarDoi() {
    setIsTransforming(true);
    setTransformError(null);
    setTransformSuccess(null);
    try {
      const { data, error } = await supabase.from("artigos").select("id, doi");

      if (error) throw error;

      const toUpdate = (data || [])
        .map((item) => {
          const isNullOrEmpty =
            !item.doi ||
            item.doi.trim() === "" ||
            item.doi.trim().toLowerCase() === "null";
          return {
            id: item.id,
            expected: isNullOrEmpty ? "sem dados" : item.doi,
            current: item.doi,
          };
        })
        .filter((item) => item.expected !== item.current);

      if (toUpdate.length === 0) {
        setTransformSuccess(
          "Todos os artigos já possuem dados válidos ou já foram tratados no campo DOI.",
        );
        return;
      }

      const chunkSize = 50;
      let totalUpdated = 0;
      for (let i = 0; i < toUpdate.length; i += chunkSize) {
        const chunk = toUpdate.slice(i, i + chunkSize);
        const promises = chunk.map((item) =>
          supabase
            .from("artigos")
            .update({ doi: item.expected })
            .eq("id", item.id),
        );
        await Promise.all(promises);
        totalUpdated += chunk.length;
      }

      setTransformSuccess(
        `Sucesso! ${totalUpdated} artigos tiveram o campo DOI nulo/vazio tratado para "sem dados".`,
      );
      fetchArticles();
    } catch (err: any) {
      console.error("Erro ao tratar DOI:", err);
      setTransformError(err.message || "Erro durante o tratamento do DOI.");
    } finally {
      setIsTransforming(false);
    }
  }

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
    {
      header: "Fonte",
      accessor: "source_titulo" as const,
      sortableKey: "source_titulo",
      className:
        "max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap text-zinc-500",
    },
    {
      header: "DOI",
      accessor: "doi" as const,
      sortableKey: "doi",
      className:
        "font-mono text-xs max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap text-zinc-400",
    },
    {
      header: "ISSN",
      accessor: "issn" as const,
      sortableKey: "issn",
      className:
        "font-mono text-xs text-zinc-400 max-w-[100px] overflow-hidden text-ellipsis whitespace-nowrap",
    },
    {
      header: "ISBN",
      accessor: "isbn" as const,
      sortableKey: "isbn",
      className:
        "font-mono text-xs text-zinc-400 max-w-[100px] overflow-hidden text-ellipsis whitespace-nowrap",
    },
    {
      header: "ISSN_ISBN",
      accessor: (item: Artigo) =>
        item.issn_isbn ||
        item.issn ||
        item.isbn || <span className="text-zinc-300">-</span>,
      sortableKey: "issn_isbn",
      className:
        "font-mono text-xs font-semibold text-zinc-600 max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap",
    },
    {
      header: "Idioma",
      accessor: "language_of_original_document" as const,
      sortableKey: "language_of_original_document",
      className:
        "text-xs text-zinc-500 max-w-[100px] overflow-hidden text-ellipsis whitespace-nowrap",
    },
    {
      header: "Tipo de Doc.",
      accessor: "document_type" as const,
      sortableKey: "document_type",
      className:
        "text-xs text-zinc-500 max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap",
    },
    {
      header: "Acesso Aberto",
      accessor: "open_access" as const,
      sortableKey: "open_access",
      className:
        "text-xs text-zinc-500 max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap",
    },
    {
      header: "Link",
      accessor: (item: Artigo) =>
        item.link ? (
          <a
            href={item.link}
            target="_blank"
            rel="noreferrer"
            className="text-emerald-600 hover:text-emerald-800 transition-colors p-1 hover:bg-emerald-50 rounded inline-flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
            title={item.link}
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        ) : (
          <span className="text-zinc-300">-</span>
        ),
      sortableKey: "link",
      className: "text-center",
    },
    {
      header: "Resumo",
      accessor: (item: Artigo) =>
        item.resumo ? (
          <span
            title={item.resumo}
            className="text-zinc-400 text-xs text-ellipsis overflow-hidden block max-w-xs whitespace-nowrap"
          >
            {item.resumo}
          </span>
        ) : (
          <span className="text-zinc-300">-</span>
        ),
      sortableKey: "resumo",
      className: "max-w-xs",
    },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      <div className="flex-1 min-w-0 space-y-6 w-full">
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
      </div>

      {/* Barra Lateral: Transformação de Dados */}
      <aside className="w-full lg:w-80 shrink-0 space-y-6 bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm self-start">
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2 border-b border-zinc-100 pb-3">
            <Database className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>Transformação de dados</span>
          </h2>
          <p className="text-xs text-zinc-500 leading-relaxed">
            Execute rotinas personalizadas e limpezas operacionais nos dados de
            sua biblioteca acadêmica.
          </p>

          {transformError && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700 font-medium">
              {transformError}
            </div>
          )}

          {transformSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-700 font-medium whitespace-pre-line animate-in fade-in duration-200">
              {transformSuccess}
            </div>
          )}

          {!confirmOpen ? (
            <div className="space-y-3">
              <button
                onClick={checkNullAbstracts}
                disabled={isTransforming}
                className="w-full h-11 flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-xl transition-all text-xs disabled:opacity-50 active:scale-95 shadow-sm"
                title="Excluir artigos com Abstract nulo ou em branco"
              >
                {isTransforming ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verificando...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span>Excluir Abstract Null</span>
                  </>
                )}
              </button>

              <button
                onClick={executeTransformIssnIsbn}
                disabled={isTransforming}
                className="w-full h-11 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all text-xs disabled:opacity-50 active:scale-95 shadow-sm"
                title="Sincronizar campo issn_isbn com ISSN ou ISBN"
              >
                {isTransforming ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processando...</span>
                  </>
                ) : (
                  <>
                    <BookOpen className="w-4 h-4 text-emerald-200" />
                    <span>Transformar ISSN/ISBN</span>
                  </>
                )}
              </button>

              <button
                onClick={executeTratarTipoAcesso}
                disabled={isTransforming}
                className="w-full h-11 flex items-center justify-center gap-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold rounded-xl transition-all text-xs disabled:opacity-50 active:scale-95 border border-zinc-300 shadow-sm"
                title="Substituir Tipo de Acesso (Open Access) nulo/em preto por 'sem dados'"
              >
                {isTransforming ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Tratando...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 text-zinc-600" />
                    <span>Tratar tipo de acesso</span>
                  </>
                )}
              </button>

              <button
                onClick={executeTratarDoi}
                disabled={isTransforming}
                className="w-full h-11 flex items-center justify-center gap-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold rounded-xl transition-all text-xs disabled:opacity-50 active:scale-95 border border-zinc-300 shadow-sm"
                title="Substituir DOI nulo/em preto por 'sem dados'"
              >
                {isTransforming ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Tratando...</span>
                  </>
                ) : (
                  <>
                    <Globe className="w-4 h-4 text-zinc-600" />
                    <span>Tratar DOI</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex gap-2 text-amber-800">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider">
                    Confirmar Exclusão
                  </h4>
                  <p className="text-xs mt-1 leading-relaxed">
                    Existem{" "}
                    <strong className="font-extrabold text-amber-900">
                      {nullAbstractCount}
                    </strong>{" "}
                    artigos sem abstract. Deseja excluí-los e limpar suas
                    associações permanentemente?
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmOpen(false)}
                  disabled={isTransforming}
                  className="px-3 py-1.5 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 font-bold rounded-lg text-xs transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={executeDeleteNullAbstracts}
                  disabled={isTransforming}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-xs transition-colors"
                >
                  Confirmar ({nullAbstractCount})
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

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

              {selectedArticle.issn && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-zinc-500">
                    <BookOpen className="w-4 h-4" />
                    <span className="text-sm font-semibold uppercase">
                      ISSN
                    </span>
                  </div>
                  <p className="text-lg font-medium text-zinc-900">
                    {selectedArticle.issn}
                  </p>
                </div>
              )}

              {selectedArticle.isbn && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-zinc-500">
                    <BookOpen className="w-4 h-4" />
                    <span className="text-sm font-semibold uppercase">
                      ISBN
                    </span>
                  </div>
                  <p className="text-lg font-medium text-zinc-900">
                    {selectedArticle.isbn}
                  </p>
                </div>
              )}

              {(selectedArticle.issn_isbn ||
                selectedArticle.issn ||
                selectedArticle.isbn) && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-emerald-600">
                    <BookOpen className="w-4 h-4" />
                    <span className="text-sm font-semibold uppercase">
                      ISSN_ISBN
                    </span>
                  </div>
                  <p className="text-lg font-extrabold text-emerald-700 font-mono">
                    {selectedArticle.issn_isbn ||
                      selectedArticle.issn ||
                      selectedArticle.isbn}
                  </p>
                </div>
              )}

              {selectedArticle.language_of_original_document && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-zinc-500">
                    <Globe className="w-4 h-4" />
                    <span className="text-sm font-semibold uppercase">
                      Idioma Original
                    </span>
                  </div>
                  <p className="text-lg font-medium text-zinc-900">
                    {selectedArticle.language_of_original_document}
                  </p>
                </div>
              )}

              {selectedArticle.document_type && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-zinc-500">
                    <FileText className="w-4 h-4" />
                    <span className="text-sm font-semibold uppercase">
                      Tipo de Documento
                    </span>
                  </div>
                  <p className="text-lg font-medium text-zinc-900">
                    {selectedArticle.document_type}
                  </p>
                </div>
              )}

              {selectedArticle.open_access && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-zinc-500">
                    <Lock className="w-4 h-4" />
                    <span className="text-sm font-semibold uppercase">
                      Acesso Aberto (Open Access)
                    </span>
                  </div>
                  <p className="text-lg font-medium text-zinc-900">
                    {selectedArticle.open_access}
                  </p>
                </div>
              )}

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
