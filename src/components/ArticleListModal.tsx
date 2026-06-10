import { BookOpen, Calendar, ExternalLink, Quote, X } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Artigo } from "../types";

interface ArticleListModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  articleIds: number[];
}

export function ArticleListModal({
  isOpen,
  onClose,
  title,
  articleIds,
}: ArticleListModalProps) {
  const [articles, setArticles] = useState<Artigo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && articleIds.length > 0) {
      fetchArticles();
    } else if (isOpen && articleIds.length === 0) {
      setArticles([]);
      setIsLoading(false);
    }
  }, [isOpen, articleIds]);

  async function fetchArticles() {
    setIsLoading(true);
    try {
      // Chunk the IDs just in case there are thousands, to step around PostgREST limits.
      const BATCH_SIZE = 500;
      let allFetched: Artigo[] = [];

      for (let i = 0; i < articleIds.length; i += BATCH_SIZE) {
        const chunk = articleIds.slice(i, i + BATCH_SIZE);
        const { data, error } = await supabase
          .from("artigos")
          .select(
            `id, titulo, ano, source_titulo, qt_citacao, doi, link, open_access, language_of_original_document`,
          )
          .in("id", chunk);

        if (error) throw error;
        if (data) allFetched = [...allFetched, ...(data as Artigo[])];
      }

      setArticles(allFetched);
    } catch (error) {
      console.error("Error fetching grouped articles:", error);
    } finally {
      setIsLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 opacity-100 transition-opacity">
      <div
        className="bg-zinc-50 border border-zinc-200 rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col scale-100 transition-transform overflow-hidden"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-zinc-200 bg-white flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 border border-indigo-100 shadow-sm rounded-xl">
              <BookOpen className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900">{title}</h2>
              <p className="text-xs text-indigo-600 font-semibold mt-0.5">
                {isLoading
                  ? "Carregando dados..."
                  : `${articles.length} trabalhos mapeados`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
              title="Fechar (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            </div>
          ) : articles.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-zinc-500 italic">
              Nenhum artigo encontrado.
            </div>
          ) : (
            <div className="space-y-4">
              {articles.map((artigo, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-zinc-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-md transition-all"
                >
                  <div className="flex justify-between items-start gap-4">
                    <h4 className="text-sm font-bold text-zinc-900 leading-tight">
                      {artigo.titulo}
                    </h4>
                    {artigo.link || artigo.doi ? (
                      <a
                        href={
                          artigo.link ||
                          (artigo.doi ? `https://doi.org/${artigo.doi}` : "#")
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:text-indigo-800 shrink-0 p-1.5 bg-indigo-50 rounded-lg"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    ) : null}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-500">
                    {artigo.ano && (
                      <span className="flex items-center gap-1.5 text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded font-mono font-medium">
                        <Calendar className="w-3 h-3" />
                        {artigo.ano}
                      </span>
                    )}
                    {artigo.source_titulo && (
                      <span className="flex items-center gap-1.5 font-medium text-indigo-700 max-w-[200px] sm:max-w-md truncate">
                        <BookOpen className="w-3 h-3" />
                        {artigo.source_titulo}
                      </span>
                    )}
                    {artigo.qt_citacao !== undefined && (
                      <span className="flex items-center gap-1.5 text-emerald-700 font-mono">
                        <Quote className="w-3 h-3" />
                        {artigo.qt_citacao} citações
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
