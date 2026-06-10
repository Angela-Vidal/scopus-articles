import { Home, Network } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArticleListModal } from "../components/ArticleListModal";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { supabase } from "../lib/supabase";

interface KeywordCount {
  name: string;
  count: number;
}

export function KeywordMapPage() {
  useDocumentTitle("Scopus Analytics | Mapa de Palavras-Chave");

  const [keywords, setKeywords] = useState<KeywordCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    articleIds: number[];
  }>({
    isOpen: false,
    title: "",
    articleIds: [],
  });

  // Local mapping just for the clicked word to find its articles.
  // We can fetch articles dynamically on click or preload them.
  // It's probably easier to preload keyword -> article ID mapping for the top N keywords,
  // or just run a query when the keyword is clicked!
  const [keywordMappings, setKeywordMappings] = useState<{
    [kw: string]: number[];
  }>({});

  useEffect(() => {
    loadKeywordMap();
  }, []);

  async function loadKeywordMap() {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase.from("artigo_palavra_chave")
        .select(`
          id_artigo,
          palavras_chaves (
            palavra_chave
          )
        `);

      if (error) throw error;

      const occurrences: { [kw: string]: number } = {};
      const mappings: { [kw: string]: number[] } = {};

      if (data) {
        data.forEach((item: any) => {
          const kwName = item.palavras_chaves?.palavra_chave?.trim();
          if (
            kwName &&
            kwName.toLowerCase() !== "null" &&
            kwName.toLowerCase() !== "sem dados" &&
            kwName !== ""
          ) {
            occurrences[kwName] = (occurrences[kwName] || 0) + 1;
            if (!mappings[kwName]) mappings[kwName] = [];
            mappings[kwName].push(item.id_artigo);
          }
        });
      }

      const processed = Object.keys(occurrences)
        .map((name) => ({ name, count: occurrences[name] }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 150); // Get top 150 for the map to avoid too much noise

      // Embaralhar as palavras para a nuvem
      for (let i = processed.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [processed[i], processed[j]] = [processed[j], processed[i]];
      }

      setKeywords(processed);
      setKeywordMappings(mappings);
    } catch (err: any) {
      setError(err.message || "Erro ao processar as palavras-chave.");
    } finally {
      setLoading(false);
    }
  }

  const handleWordClick = (keyword: string) => {
    if (keywordMappings[keyword]) {
      setModalConfig({
        isOpen: true,
        title: `Artigos com a Palavra-chave: ${keyword}`,
        articleIds: keywordMappings[keyword],
      });
    }
  };

  const getFontSize = (count: number, maxCount: number, minCount: number) => {
    if (maxCount === minCount) return "1rem";
    // Let's use a scale from 1rem to 4rem based on count.
    const minSize = 1;
    const maxSize = 3.5;
    const scale = (count - minCount) / (maxCount - minCount);
    // Use an ease-out square root scale to balance the size differences
    const size = minSize + Math.sqrt(scale) * (maxSize - minSize);
    return `${size}rem`;
  };

  const getColor = (count: number, maxCount: number) => {
    const scale = count / maxCount;
    if (scale > 0.8) return "text-indigo-600";
    if (scale > 0.5) return "text-sky-600";
    if (scale > 0.3) return "text-emerald-600";
    if (scale > 0.15) return "text-amber-600";
    if (scale > 0.05) return "text-rose-500";
    return "text-zinc-500";
  };

  const maxCount =
    keywords.length > 0 ? Math.max(...keywords.map((k) => k.count)) : 1;
  const minCount =
    keywords.length > 0 ? Math.min(...keywords.map((k) => k.count)) : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-zinc-500 mb-2">
            <Link
              to="/dashboard"
              className="hover:text-indigo-600 transition-colors flex items-center gap-1"
            >
              <Home className="w-4 h-4" />
              <span>Dashboard</span>
            </Link>
            <span>/</span>
            <Link
              to="/palavras-chave"
              className="hover:text-indigo-600 transition-colors"
            >
              <span>Palavras-chave</span>
            </Link>
            <span>/</span>
            <span className="text-zinc-900 font-medium tracking-tight">
              Mapa Visual
            </span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-zinc-900 flex items-center gap-3">
            <Network className="w-8 h-8 text-indigo-600" />
            Mapa de Palavras-Chave
          </h1>
          <p className="text-zinc-500 mt-2 text-sm">
            Visualização de nuvem de palavras baseada na frequência de termos na
            coleção acadêmica. Clique nos termos para visualizar os artigos
            correspondentes.
          </p>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-3xl p-8 shadow-sm relative min-h-[500px] flex items-center justify-center">
        {loading ? (
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="text-zinc-500 font-medium">Processando conexões...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100 max-w-md text-center">
            {error}
          </div>
        ) : keywords.length === 0 ? (
          <div className="text-center text-zinc-500 text-lg">
            Nenhuma palavra-chave encontrada para gerar o mapa.
          </div>
        ) : (
          <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-4 max-w-5xl">
            {keywords.map((kw, idx) => {
              // Shuffle a slight structural rotation occasionally for flavor, though inline words are typically horizontal
              return (
                <div
                  key={idx}
                  onClick={() => handleWordClick(kw.name)}
                  className={`cursor-pointer transition-all hover:scale-110 active:scale-95 text-center font-bold font-sans ${getColor(kw.count, maxCount)}`}
                  style={{
                    fontSize: getFontSize(kw.count, maxCount, minCount),
                    lineHeight: "1.1",
                  }}
                  title={`${kw.name}: ${kw.count} ocorrências`}
                >
                  {kw.name}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ArticleListModal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
        title={modalConfig.title}
        articleIds={modalConfig.articleIds}
      />
    </div>
  );
}
