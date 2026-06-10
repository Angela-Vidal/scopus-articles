import { toPng } from "html-to-image";
import {
  Award,
  BarChart3,
  BookMarked,
  BookOpen,
  Calendar,
  ChevronRight,
  Database,
  Download,
  Languages,
  Layers,
  Loader2,
  Lock,
  Maximize2,
  MessageSquare,
  Tag,
  TrendingUp,
  Unlock,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  XAxis,
} from "recharts";
import { ArticleListModal } from "../components/ArticleListModal";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { supabase } from "../lib/supabase";

// Custom classification function inside the Page context but external to the render loop for optimal caching
const getConceptualGroup = (title: string, keywordsStr: string): string => {
  const text = `${title} ${keywordsStr}`.toLowerCase();

  if (
    text.includes("aprendizado") ||
    text.includes("education") ||
    text.includes("ensino") ||
    text.includes("learning") ||
    text.includes("escola") ||
    text.includes("e-learning") ||
    text.includes("aluno") ||
    text.includes("didático") ||
    text.includes("classroom") ||
    text.includes("university") ||
    text.includes("students")
  ) {
    return "Tecnologias Educacionais";
  }

  if (
    text.includes("bibliometria") ||
    text.includes("scopus") ||
    text.includes("web of science") ||
    text.includes("citation") ||
    text.includes("indicadores") ||
    text.includes("métrica") ||
    text.includes("bibliometric") ||
    text.includes("scientometric") ||
    text.includes("pós-graduação") ||
    text.includes("academia")
  ) {
    return "Métricas & Bibliometria";
  }

  if (
    text.includes("inteligência artificial") ||
    text.includes("artificial intelligence") ||
    text.includes("machine learning") ||
    text.includes("dados") ||
    text.includes("data") ||
    text.includes("algoritmo") ||
    text.includes("software") ||
    text.includes("deep learning") ||
    text.includes("digitalization") ||
    text.includes("analytics")
  ) {
    return "Inteligência Artificial & Dados";
  }

  if (
    text.includes("saúde") ||
    text.includes("médico") ||
    text.includes("clinica") ||
    text.includes("health") ||
    text.includes("covid") ||
    text.includes("hospital") ||
    text.includes("paciente") ||
    text.includes("enfermagem") ||
    text.includes("care") ||
    text.includes("biomedical")
  ) {
    return "Ciências da Saúde";
  }

  if (
    text.includes("gestão") ||
    text.includes("inovação") ||
    text.includes("management") ||
    text.includes("innovation") ||
    text.includes("business") ||
    text.includes("empresa") ||
    text.includes("mercado") ||
    text.includes("estratégia") ||
    text.includes("sustainability")
  ) {
    return "Gestão & Inovação";
  }

  return "Ciências Multidisciplinares";
};

interface MetricState {
  totalArticles: number;
  uniqueAuthors: number;
  totalCitations: number;
  averageCitations: number;
  hIndex: number;
  openAccessPercentage: number;
}

export function DashboardPage() {
  useDocumentTitle("Dashboard");
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<MetricState>({
    totalArticles: 0,
    uniqueAuthors: 0,
    totalCitations: 0,
    averageCitations: 0,
    hIndex: 0,
    openAccessPercentage: 0,
  });

  // Additional stats for charts and insights
  const [yearlyStats, setYearlyStats] = useState<
    { year: number; count: number; citations: number }[]
  >([]);
  const [topJournals, setTopJournals] = useState<
    { name: string; count: number }[]
  >([]);
  const [topAuthors, setTopAuthors] = useState<
    { name: string; count: number }[]
  >([]);
  const [topKeywords, setTopKeywords] = useState<
    { name: string; count: number }[]
  >([]);
  const [conceptualGroups, setConceptualGroups] = useState<
    { name: string; count: number }[]
  >([]);
  const [openAccessStats, setOpenAccessStats] = useState<
    { name: string; count: number }[]
  >([]);
  const [languagesStats, setLanguagesStats] = useState<
    { name: string; count: number }[]
  >([]);

  // Navigation mapping for Modal
  const [chartDataMappings, setChartDataMappings] = useState<{
    [chart: string]: { [label: string]: number[] };
  }>({
    publications: {},
    citations: {},
    journals: {},
    authors: {},
    keywords: {},
    conceptual_groups: {},
    open_access: {},
    languages: {},
  });

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    articleIds: number[];
  }>({
    isOpen: false,
    title: "",
    articleIds: [],
  });

  const handleChartClick = (
    chartType: string,
    label: string | number,
    specificTitle?: string,
  ) => {
    const mapping = chartDataMappings[chartType];
    if (mapping && mapping[String(label)]) {
      setModalConfig({
        isOpen: true,
        title: specificTitle || `Artigos: ${label}`,
        articleIds: mapping[String(label)],
      });
    }
  };

  // State to track fullscreen chart selection
  const [fullscreenChart, setFullscreenChart] = useState<
    | "publications"
    | "citations"
    | "journals"
    | "authors"
    | "keywords"
    | "conceptual_groups"
    | "open_access"
    | "languages"
    | null
  >(null);

  // HTML Element references for capturing diagrams directly on page
  const pubChartRef = useRef<HTMLDivElement>(null);
  const citChartRef = useRef<HTMLDivElement>(null);
  const journalChartRef = useRef<HTMLDivElement>(null);
  const authorChartRef = useRef<HTMLDivElement>(null);
  const keywordChartRef = useRef<HTMLDivElement>(null);
  const groupChartRef = useRef<HTMLDivElement>(null);
  const oaChartRef = useRef<HTMLDivElement>(null);
  const langChartRef = useRef<HTMLDivElement>(null);

  // Hidden clean template references for exporting perfect full illustrations
  const pubExportRef = useRef<HTMLDivElement>(null);
  const citExportRef = useRef<HTMLDivElement>(null);
  const journalExportRef = useRef<HTMLDivElement>(null);
  const authorExportRef = useRef<HTMLDivElement>(null);
  const keywordExportRef = useRef<HTMLDivElement>(null);
  const groupExportRef = useRef<HTMLDivElement>(null);
  const oaExportRef = useRef<HTMLDivElement>(null);
  const langExportRef = useRef<HTMLDivElement>(null);

  // Toast message state for mock PNG downlod action
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage((m) => (m === message ? null : m));
    }, 3000);
  };

  const handleDownloadPNG = async (chartType: string) => {
    let ref;
    let filenamePart = "";

    if (chartType === "publications") {
      ref = pubExportRef;
      filenamePart = "publicacoes-por-ano";
    } else if (chartType === "citations") {
      ref = citExportRef;
      filenamePart = "citacoes-por-ano";
    } else if (chartType === "journals") {
      ref = journalExportRef;
      filenamePart = "top-periodicos";
    } else if (chartType === "authors") {
      ref = authorExportRef;
      filenamePart = "top-autores";
    } else if (chartType === "keywords") {
      ref = keywordExportRef;
      filenamePart = "top-palavras-chave";
    } else if (chartType === "conceptual_groups") {
      ref = groupExportRef;
      filenamePart = "grupo-conceitual";
    } else if (chartType === "open_access") {
      ref = oaExportRef;
      filenamePart = "acesso-aberto";
    } else if (chartType === "languages") {
      ref = langExportRef;
      filenamePart = "idioma-publicacao";
    }

    if (!ref || !ref.current) return;

    try {
      const dataUrl = await toPng(ref.current, {
        backgroundColor: "#ffffff",
        cacheBust: true,
        pixelRatio: 2,
      });

      const link = document.createElement("a");
      link.download = `grafico-${filenamePart}-${new Date().getFullYear()}.png`;
      link.href = dataUrl;
      link.click();

      triggerToast("Gráfico completo salvo em alta resolução!");
    } catch (error) {
      console.error("Erro ao exportar gráfico:", error);
      triggerToast("Erro de renderização ao gerar PNG.");
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    setLoading(true);
    try {
      // 1. Fetch total unique authors directly (exact count)
      const { count: authorsCount, error: authorsError } = await supabase
        .from("autores")
        .select("*", { count: "exact", head: true });

      if (authorsError) throw authorsError;

      // 2. Fetch all articles sequentially to compute cumulative statistics accurately
      let allArticles: any[] = [];
      let hasMore = true;
      let page = 0;
      const pageSize = 1000;

      while (hasMore && page < 25) {
        const { data, error } = await supabase
          .from("artigos")
          .select(
            "id, qt_citacao, open_access, ano, source_titulo, titulo, language_of_original_document",
          )
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;

        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          allArticles = [...allArticles, ...data];
          if (data.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        }
      }

      // 3. Fetch all article-keyword associations to compute TOP keywords and Conceptual Group distribution
      let allArtigoKeywords: any[] = [];
      let kwHasMore = true;
      let kwPage = 0;
      while (kwHasMore && kwPage < 25) {
        const { data, error } = await supabase
          .from("artigo_palavra_chave")
          .select("id_artigo, id_palavra_chave, palavras_chaves(palavra_chave)")
          .range(kwPage * 1000, (kwPage + 1) * 1000 - 1);
        if (error) throw error;
        if (!data || data.length === 0) {
          kwHasMore = false;
        } else {
          allArtigoKeywords = [...allArtigoKeywords, ...data];
          if (data.length < 1000) kwHasMore = false;
          else kwPage++;
        }
      }

      // Map of id_artigo -> list of keywords and count occurrences of each keyword
      const articleKeywordsMap: { [key: number]: string[] } = {};
      const keywordOccurrences: { [key: string]: number } = {};

      allArtigoKeywords.forEach((item) => {
        const kwName = item.palavras_chaves?.palavra_chave?.trim();
        if (
          kwName &&
          kwName.toLowerCase() !== "null" &&
          kwName.toLowerCase() !== "sem dados" &&
          kwName !== ""
        ) {
          keywordOccurrences[kwName] = (keywordOccurrences[kwName] || 0) + 1;
          if (item.id_artigo) {
            if (!articleKeywordsMap[item.id_artigo]) {
              articleKeywordsMap[item.id_artigo] = [];
            }
            if (!articleKeywordsMap[item.id_artigo].includes(kwName)) {
              articleKeywordsMap[item.id_artigo].push(kwName);
            }
          }
        }
      });

      // 4. Fetch all article-author associations to compute TOP 20 authors
      let allArtigoAutores: any[] = [];
      let authorHasMore = true;
      let authorPage = 0;
      while (authorHasMore && authorPage < 25) {
        const { data, error } = await supabase
          .from("artigo_autor")
          .select("id_artigo, id_autor, autores(nome)")
          .range(authorPage * 1000, (authorPage + 1) * 1000 - 1);
        if (error) throw error;
        if (!data || data.length === 0) {
          authorHasMore = false;
        } else {
          allArtigoAutores = [...allArtigoAutores, ...data];
          if (data.length < 1000) authorHasMore = false;
          else authorPage++;
        }
      }

      const authorOccurrences: { [key: string]: number } = {};
      allArtigoAutores.forEach((item) => {
        const authorName = item.autores?.nome?.trim();
        if (
          authorName &&
          authorName.toLowerCase() !== "null" &&
          authorName.toLowerCase() !== "sem dados" &&
          authorName !== ""
        ) {
          authorOccurrences[authorName] =
            (authorOccurrences[authorName] || 0) + 1;
        }
      });

      // Compute statistics safe-guarding fields
      const totalArticlesCount = allArticles.length;
      let totalCitationsCount = 0;
      let openAccessCount = 0;
      const citationList: number[] = [];

      // Dictionaries for charts
      const yearMap: { [key: number]: { count: number; citations: number } } =
        {};
      const journalMap: { [key: string]: number } = {};
      const openAccessOccurrences: { [key: string]: number } = {};
      const languageOccurrences: { [key: string]: number } = {};
      const conceptualGroupOccurrences: { [key: string]: number } = {};

      const localMappings: { [chart: string]: { [label: string]: number[] } } =
        {
          publications: {},
          citations: {},
          journals: {},
          authors: {},
          keywords: {},
          conceptual_groups: {},
          open_access: {},
          languages: {},
        };

      allArticles.forEach((art) => {
        // Citations
        const cit = Number(art.qt_citacao) || 0;
        totalCitationsCount += cit;
        citationList.push(cit);

        // Open Access detection
        const oa = art.open_access;
        const isOA =
          oa &&
          oa.trim() !== "" &&
          oa.trim().toLowerCase() !== "null" &&
          oa.trim().toLowerCase() !== "sem dados";
        if (isOA) {
          openAccessCount++;
        }

        // Years matching
        const yr = Number(art.ano);
        if (yr) {
          if (!yearMap[yr]) {
            yearMap[yr] = { count: 0, citations: 0 };
          }
          yearMap[yr].count += 1;
          yearMap[yr].citations += cit;

          if (!localMappings.publications[yr])
            localMappings.publications[yr] = [];
          localMappings.publications[yr].push(art.id);

          if (cit > 0) {
            if (!localMappings.citations[yr]) localMappings.citations[yr] = [];
            localMappings.citations[yr].push(art.id);
          }
        }

        // Journals
        const journal = art.source_titulo?.trim();
        if (
          journal &&
          journal.toLowerCase() !== "null" &&
          journal.toLowerCase() !== "sem dados" &&
          journal !== ""
        ) {
          journalMap[journal] = (journalMap[journal] || 0) + 1;
          if (!localMappings.journals[journal])
            localMappings.journals[journal] = [];
          localMappings.journals[journal].push(art.id);
        }

        // Open Access Categories for detailed OA chart
        if (
          oa &&
          oa.trim() !== "" &&
          oa.trim().toLowerCase() !== "null" &&
          oa.trim().toLowerCase() !== "sem dados"
        ) {
          const oaParts = oa
            .split(";")
            .map((p) => p.trim())
            .filter((p) => !!p);
          if (oaParts.length > 0) {
            oaParts.forEach((part) => {
              let label = part;
              if (label.toLowerCase() === "all open access")
                label = "Acesso Aberto (Total)";
              else if (label.toLowerCase() === "gold")
                label = "Dourada (Gold OA)";
              else if (label.toLowerCase() === "green")
                label = "Verde (Green OA)";
              else if (label.toLowerCase() === "hybrid")
                label = "Híbrida (Hybrid OA)";
              else if (label.toLowerCase() === "bronze")
                label = "Bronze (Bronze OA)";
              else
                label =
                  label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();

              openAccessOccurrences[label] =
                (openAccessOccurrences[label] || 0) + 1;
              if (!localMappings.open_access[label])
                localMappings.open_access[label] = [];
              localMappings.open_access[label].push(art.id);
            });
          } else {
            openAccessOccurrences["Acesso Fechado (Restrito)"] =
              (openAccessOccurrences["Acesso Fechado (Restrito)"] || 0) + 1;
            if (!localMappings.open_access["Acesso Fechado (Restrito)"])
              localMappings.open_access["Acesso Fechado (Restrito)"] = [];
            localMappings.open_access["Acesso Fechado (Restrito)"].push(art.id);
          }
        } else {
          openAccessOccurrences["Acesso Fechado (Restrito)"] =
            (openAccessOccurrences["Acesso Fechado (Restrito)"] || 0) + 1;
          if (!localMappings.open_access["Acesso Fechado (Restrito)"])
            localMappings.open_access["Acesso Fechado (Restrito)"] = [];
          localMappings.open_access["Acesso Fechado (Restrito)"].push(art.id);
        }

        // Languages
        const lang = art.language_of_original_document;
        if (
          lang &&
          lang.trim() !== "" &&
          lang.trim().toLowerCase() !== "null" &&
          lang.trim().toLowerCase() !== "sem dados"
        ) {
          let label = lang.trim();
          if (
            label.toLowerCase() === "english" ||
            label.toLowerCase() === "inglês" ||
            label.toLowerCase() === "ingles"
          )
            label = "Inglês";
          else if (
            label.toLowerCase() === "portuguese" ||
            label.toLowerCase() === "português" ||
            label.toLowerCase() === "portugues"
          )
            label = "Português";
          else if (
            label.toLowerCase() === "spanish" ||
            label.toLowerCase() === "espanhol"
          )
            label = "Espanhol";
          else if (
            label.toLowerCase() === "french" ||
            label.toLowerCase() === "francês" ||
            label.toLowerCase() === "frances"
          )
            label = "Francês";

          label = label.charAt(0).toUpperCase() + label.slice(1);
          languageOccurrences[label] = (languageOccurrences[label] || 0) + 1;
          if (!localMappings.languages[label])
            localMappings.languages[label] = [];
          localMappings.languages[label].push(art.id);
        } else {
          languageOccurrences["Não Informado"] =
            (languageOccurrences["Não Informado"] || 0) + 1;
          if (!localMappings.languages["Não Informado"])
            localMappings.languages["Não Informado"] = [];
          localMappings.languages["Não Informado"].push(art.id);
        }

        // Conceptual grouping using the rule-based classify helper
        const kwsList = articleKeywordsMap[art.id] || [];
        const group = getConceptualGroup(art.titulo || "", kwsList.join(" "));
        conceptualGroupOccurrences[group] =
          (conceptualGroupOccurrences[group] || 0) + 1;
        if (!localMappings.conceptual_groups[group])
          localMappings.conceptual_groups[group] = [];
        localMappings.conceptual_groups[group].push(art.id);
      });

      // Add Authors to mapping
      allArtigoAutores.forEach((item) => {
        const authorName = item.autores?.nome?.trim();
        if (
          authorName &&
          authorName.toLowerCase() !== "null" &&
          authorName.toLowerCase() !== "sem dados" &&
          authorName !== ""
        ) {
          if (!localMappings.authors[authorName])
            localMappings.authors[authorName] = [];
          localMappings.authors[authorName].push(item.id_artigo);
        }
      });

      // Add Keywords to mapping
      allArtigoKeywords.forEach((item) => {
        const kwName = item.palavras_chaves?.palavra_chave?.trim();
        if (
          kwName &&
          kwName.toLowerCase() !== "null" &&
          kwName.toLowerCase() !== "sem dados" &&
          kwName !== ""
        ) {
          if (!localMappings.keywords[kwName])
            localMappings.keywords[kwName] = [];
          localMappings.keywords[kwName].push(item.id_artigo);
        }
      });

      // Calculate H-Index
      const sortedCitations = [...citationList].sort((a, b) => b - a);
      let calculatedHIndex = 0;
      for (let i = 0; i < sortedCitations.length; i++) {
        if (sortedCitations[i] >= i + 1) {
          calculatedHIndex = i + 1;
        } else {
          break;
        }
      }

      // Calculate average
      const avgCitations =
        totalArticlesCount > 0 ? totalCitationsCount / totalArticlesCount : 0;

      // Calculate Open Access Percentage
      const oaPercentage =
        totalArticlesCount > 0
          ? (openAccessCount / totalArticlesCount) * 100
          : 0;

      // Process year stats for graphs (sort ascending)
      const sortedYears = Object.keys(yearMap)
        .map((y) => Number(y))
        .sort((a, b) => a - b)
        .map((y) => ({
          year: y,
          count: yearMap[y].count,
          citations: yearMap[y].citations,
        }));

      // Process top 15 journals
      const processedJournals = Object.keys(journalMap)
        .map((name) => ({ name, count: journalMap[name] }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15);

      // Process top 20 authors
      const processedAuthors = Object.keys(authorOccurrences)
        .map((name) => ({ name, count: authorOccurrences[name] }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);

      // Process top 15 keywords
      const processedKeywords = Object.keys(keywordOccurrences)
        .map((name) => ({ name, count: keywordOccurrences[name] }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15);

      // Process conceptual groups
      const processedGroups = Object.keys(conceptualGroupOccurrences)
        .map((name) => ({ name, count: conceptualGroupOccurrences[name] }))
        .sort((a, b) => b.count - a.count);

      // Process open access stats
      const processedOA = Object.keys(openAccessOccurrences)
        .map((name) => ({ name, count: openAccessOccurrences[name] }))
        .sort((a, b) => b.count - a.count);

      // Process language labels
      const processedLanguages = Object.keys(languageOccurrences)
        .map((name) => ({ name, count: languageOccurrences[name] }))
        .sort((a, b) => b.count - a.count);

      setMetrics({
        totalArticles: totalArticlesCount,
        uniqueAuthors: authorsCount || 0,
        totalCitations: totalCitationsCount,
        averageCitations: Number(avgCitations.toFixed(2)),
        hIndex: calculatedHIndex,
        openAccessPercentage: Number(oaPercentage.toFixed(1)),
      });

      setYearlyStats(sortedYears);
      setTopJournals(processedJournals);
      setTopAuthors(processedAuthors);
      setTopKeywords(processedKeywords);
      setConceptualGroups(processedGroups);
      setOpenAccessStats(processedOA);
      setLanguagesStats(processedLanguages);
      setChartDataMappings(localMappings);
    } catch (e) {
      console.error("Error loading dashboard stats:", e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-[400px] gap-4"
        id="dashboard_loading"
      >
        <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
        <p className="text-zinc-500 font-medium">
          Carregando métricas e análises acadêmicas...
        </p>
      </div>
    );
  }

  const getChartDetails = (chartType: string) => {
    switch (chartType) {
      case "publications":
        return {
          icon: <Calendar className="w-5 h-5 text-emerald-600" />,
          title: "Histórico Completo de Publicações",
          subtitle:
            "Número exato de artigos distribuídos ano a ano em toda a coleção.",
        };
      case "citations":
        return {
          icon: <BarChart3 className="w-5 h-5 text-sky-500" />,
          title: "Distribuição de Citações Acumuladas",
          subtitle:
            "Citações agregadas e maturidade acadêmica obtida por ano de publicação.",
        };
      case "journals":
        return {
          icon: <BookMarked className="w-5 h-5 text-indigo-600" />,
          title: "TOP 15 Periódicos Científicos",
          subtitle:
            "Ranking completo de periódicos com maior número de manuscritos publicados na base.",
        };
      case "authors":
        return {
          icon: <Users className="w-5 h-5 text-rose-600" />,
          title: "TOP 20 Autores Científicos",
          subtitle:
            "Ranking completo de pesquisadores por número absoluto de patentes e artigos publicados.",
        };
      case "keywords":
        return {
          icon: <Tag className="w-5 h-5 text-orange-600" />,
          title: "Mapeamento de TOP 15 Palavras-Chave",
          subtitle:
            "Frequência de indexação absoluta das terminologias científicas na base.",
        };
      case "conceptual_groups":
        return {
          icon: <Layers className="w-5 h-5 text-violet-600" />,
          title: "Mapeamento Epistêmico & Grupos Conceituais",
          subtitle:
            "Categorização sistemática por cluster epistemológico baseada nas palavras-chave.",
        };
      case "open_access":
        return {
          icon: <Unlock className="w-5 h-5 text-teal-600" />,
          title: "Distribuição por Tipo de Acesso (Open Access)",
          subtitle:
            "Detalhamento do percentual de acessibilidade livre e modalidades de circulação.",
        };
      case "languages":
        return {
          icon: <Languages className="w-5 h-5 text-amber-600" />,
          title: "Distribuição Linguística da Produção",
          subtitle:
            "Participação proporcional de cada idioma original nos trabalhos da coleção.",
        };
      default:
        return {
          icon: <BarChart3 className="w-5 h-5 text-zinc-500" />,
          title: "Visualização Detalhada",
          subtitle: "Mapeamento estatístico aprofundado.",
        };
    }
  };

  const renderExpandedChartContent = (
    chartType: string,
    isExport: boolean = false,
  ) => {
    return (
      <>
        {(chartType === "publications" || chartType === "citations") && (
          <>
            <div className="bg-zinc-50/50 border border-zinc-100 rounded-2xl px-6 py-8">
              <div className="w-full pb-4 pt-8 h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={yearlyStats}
                    margin={{ top: 20, right: 0, left: 0, bottom: 0 }}
                  >
                    <XAxis
                      dataKey="year"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12, fill: "#52525b" }}
                    />
                    <RechartsTooltip
                      cursor={{ fill: "rgba(0,0,0,0.05)" }}
                      contentStyle={{
                        borderRadius: "8px",
                        border: "none",
                        boxShadow:
                          "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
                      }}
                      formatter={(value: number) => [
                        `${value} ${chartType === "publications" ? (value === 1 ? "artigo" : "artigos") : value === 1 ? "citação" : "citações"}`,
                        chartType === "publications"
                          ? "Publicações"
                          : "Citações",
                      ]}
                    />
                    <Bar
                      dataKey={
                        chartType === "publications" ? "count" : "citations"
                      }
                      fill={
                        chartType === "publications" ? "#10b981" : "#0ea5e9"
                      }
                      radius={[4, 4, 0, 0]}
                      onClick={(data: any) => {
                        if (data && data.year) {
                          handleChartClick(chartType, data.year);
                        }
                      }}
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      <LabelList
                        dataKey={
                          chartType === "publications" ? "count" : "citations"
                        }
                        position="top"
                        style={{
                          fill: "#27272a",
                          fontSize: 11,
                          fontWeight: "bold",
                        }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className={`space-y-3 ${isExport ? "hidden" : ""}`}>
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-zinc-500" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Tabela de Dados Consolidados
                </h4>
              </div>
              <div className="border border-zinc-200 rounded-xl overflow-hidden shadow-sm bg-white">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-50/85 text-xs font-semibold text-zinc-500 border-b border-zinc-200 uppercase tracking-widest">
                      <th className="px-6 py-3.5">Ano de Publicação</th>
                      <th className="px-6 py-3.5 text-right">
                        Artigos Publicados
                      </th>
                      <th className="px-6 py-3.5 text-right">
                        Citações Acumuladas
                      </th>
                      <th className="px-6 py-3.5 text-right">
                        Média Citações / Artigo
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-zinc-100">
                    {[...yearlyStats].reverse().map((item, index) => {
                      const average =
                        item.count > 0
                          ? (item.citations / item.count).toFixed(2)
                          : "0.00";
                      return (
                        <tr
                          key={index}
                          className="hover:bg-zinc-50/50 transition-colors"
                        >
                          <td className="px-6 py-3 font-bold text-zinc-800">
                            {item.year}
                          </td>
                          <td className="px-6 py-3 text-right">
                            <span className="inline-block bg-emerald-50 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded">
                              {item.count}{" "}
                              {item.count === 1 ? "artigo" : "artigos"}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-right font-mono text-zinc-600 font-medium">
                            {item.citations}
                          </td>
                          <td className="px-6 py-3 text-right text-zinc-500 font-mono">
                            {average}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {chartType === "journals" && (
          <>
            <div className="bg-zinc-50/50 border border-zinc-100 rounded-2xl p-6 space-y-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                Distribuição Gráfica
              </h4>
              <div className="space-y-4">
                {topJournals.map((item, idx) => {
                  const maxVal = Math.max(
                    ...topJournals.map((j) => j.count),
                    1,
                  );
                  const pct = (item.count / maxVal) * 100;
                  return (
                    <div
                      key={idx}
                      className="space-y-1 cursor-pointer group"
                      onClick={() =>
                        handleChartClick(
                          "journals",
                          item.name,
                          `Artigos no Periódico: ${item.name}`,
                        )
                      }
                    >
                      <div className="flex items-center justify-between text-xs font-semibold text-zinc-700 group-hover:text-indigo-600 transition-colors">
                        <span>
                          #{idx + 1}. {item.name}
                        </span>
                        <span className="font-mono bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-[10px]">
                          {item.count} artigos
                        </span>
                      </div>
                      <div className="w-full h-3 bg-zinc-100 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${pct}%` }}
                          className="h-full bg-indigo-600 rounded-full"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={`space-y-3 ${isExport ? "hidden" : ""}`}>
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-zinc-500" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Detalhamento Completo (Top 15 Periódicos)
                </h4>
              </div>
              <div className="border border-zinc-200 rounded-xl overflow-hidden shadow-sm bg-white">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-50/85 text-xs font-semibold text-zinc-500 border-b border-zinc-200 uppercase tracking-widest">
                      <th className="px-6 py-3.5 w-20">Posição</th>
                      <th className="px-6 py-3.5">Periódico Científico</th>
                      <th className="px-6 py-3.5 text-right">
                        Artigos Publicados
                      </th>
                      <th className="px-6 py-3.5 text-right">
                        Proporção Proporcional (%)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-zinc-100">
                    {topJournals.map((item, index) => {
                      const pct =
                        metrics.totalArticles > 0
                          ? (
                              (item.count / metrics.totalArticles) *
                              100
                            ).toFixed(2)
                          : "0.00";
                      return (
                        <tr
                          key={index}
                          className="hover:bg-zinc-50/50 transition-colors"
                        >
                          <td className="px-6 py-3 font-bold text-indigo-600">
                            #{index + 1}
                          </td>
                          <td className="px-6 py-3 font-semibold text-zinc-800">
                            {item.name}
                          </td>
                          <td className="px-6 py-3 text-right">
                            <span className="inline-block bg-indigo-50 text-indigo-800 text-xs font-bold px-2.5 py-1 rounded-lg">
                              {item.count} artigos
                            </span>
                          </td>
                          <td className="px-6 py-3 text-right text-zinc-500 font-mono font-medium">
                            {pct}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {chartType === "authors" && (
          <>
            <div className="bg-zinc-50/50 border border-zinc-100 rounded-2xl p-6 space-y-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                Distribuição Gráfica
              </h4>
              <div className="space-y-4">
                {topAuthors.map((item, idx) => {
                  const maxVal = Math.max(...topAuthors.map((a) => a.count), 1);
                  const pct = (item.count / maxVal) * 100;
                  return (
                    <div
                      key={idx}
                      className="space-y-1 cursor-pointer group"
                      onClick={() =>
                        handleChartClick(
                          "authors",
                          item.name,
                          `Artigos de: ${item.name}`,
                        )
                      }
                    >
                      <div className="flex items-center justify-between text-xs font-semibold text-zinc-700 group-hover:text-rose-600 transition-colors">
                        <span className="truncate pr-4">
                          #{idx + 1}. {item.name}
                        </span>
                        <span className="font-mono bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap">
                          {item.count} artigos
                        </span>
                      </div>
                      <div className="w-full h-3 bg-zinc-100 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${pct}%` }}
                          className="h-full bg-rose-500 rounded-full"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={`space-y-3 ${isExport ? "hidden" : ""}`}>
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-zinc-500" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Detalhamento Completo (Top 20 Autores)
                </h4>
              </div>
              <div className="border border-zinc-200 rounded-xl overflow-hidden shadow-sm bg-white">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-50/85 text-xs font-semibold text-zinc-500 border-b border-zinc-200 uppercase tracking-widest">
                      <th className="px-6 py-3.5 w-20">Posição</th>
                      <th className="px-6 py-3.5">Nome do Pesquisador</th>
                      <th className="px-6 py-3.5 text-right font-bold text-zinc-500">
                        Artigos Registrados
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-zinc-100">
                    {topAuthors.map((item, index) => {
                      return (
                        <tr
                          key={index}
                          className="hover:bg-zinc-50/50 transition-colors"
                        >
                          <td className="px-6 py-3 font-bold text-rose-600">
                            #{index + 1}
                          </td>
                          <td className="px-6 py-3 font-semibold text-zinc-800">
                            {item.name}
                          </td>
                          <td className="px-6 py-3 text-right">
                            <span className="inline-block bg-rose-50 text-rose-800 text-xs font-bold px-2.5 py-1 rounded-lg">
                              {item.count} artigos
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {chartType === "keywords" && (
          <>
            <div className="bg-zinc-50/50 border border-zinc-100 rounded-2xl p-6 space-y-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                Distribuição Gráfica
              </h4>
              <div className="space-y-4">
                {topKeywords.map((item, idx) => {
                  const maxVal = Math.max(
                    ...topKeywords.map((k) => k.count),
                    1,
                  );
                  const pct = (item.count / maxVal) * 100;
                  return (
                    <div
                      key={idx}
                      className="space-y-1 cursor-pointer group"
                      onClick={() =>
                        handleChartClick(
                          "keywords",
                          item.name,
                          `Artigos com a Palavra-chave: ${item.name}`,
                        )
                      }
                    >
                      <div className="flex items-center justify-between text-xs font-semibold text-zinc-700 group-hover:text-orange-600 transition-colors">
                        <span className="truncate pr-4">
                          #{idx + 1}. {item.name}
                        </span>
                        <span className="font-mono bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap">
                          {item.count} ocorrências
                        </span>
                      </div>
                      <div className="w-full h-3 bg-zinc-100 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${pct}%` }}
                          className="h-full bg-orange-500 rounded-full"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={`space-y-3 ${isExport ? "hidden" : ""}`}>
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-zinc-500" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Detalhamento Completo (Top 15 Termos)
                </h4>
              </div>
              <div className="border border-zinc-200 rounded-xl overflow-hidden shadow-sm bg-white">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-50/85 text-xs font-semibold text-zinc-500 border-b border-zinc-200 uppercase tracking-widest">
                      <th className="px-6 py-3.5 w-20">Posição</th>
                      <th className="px-6 py-3.5">
                        Palavra-Chave / Termo Indexado
                      </th>
                      <th className="px-6 py-3.5 text-right font-bold text-zinc-500">
                        Ocorrências Totais
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-zinc-100">
                    {topKeywords.map((item, index) => {
                      return (
                        <tr
                          key={index}
                          className="hover:bg-zinc-50/50 transition-colors"
                        >
                          <td className="px-6 py-3 font-bold text-orange-600">
                            #{index + 1}
                          </td>
                          <td className="px-6 py-3 font-semibold text-zinc-800">
                            {item.name}
                          </td>
                          <td className="px-6 py-3 text-right">
                            <span className="inline-block bg-orange-50 text-orange-850 text-xs font-bold px-2.5 py-1 rounded-lg">
                              {item.count} ocorrências
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {chartType === "conceptual_groups" && (
          <>
            <div className="bg-zinc-50/50 border border-zinc-100 rounded-2xl p-6 space-y-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                Distribuição Gráfica
              </h4>
              <div className="space-y-4">
                {conceptualGroups.map((item, idx) => {
                  const maxVal = Math.max(
                    ...conceptualGroups.map((g) => g.count),
                    1,
                  );
                  const pct = (item.count / maxVal) * 100;
                  return (
                    <div
                      key={idx}
                      className="space-y-1 cursor-pointer group"
                      onClick={() =>
                        handleChartClick(
                          "conceptual_groups",
                          item.name,
                          `Artigos no Grupo: ${item.name}`,
                        )
                      }
                    >
                      <div className="flex items-center justify-between text-xs font-semibold text-zinc-700 group-hover:text-violet-600 transition-colors">
                        <span className="truncate pr-4">{item.name}</span>
                        <span className="font-mono bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap">
                          {item.count} artigos (
                          {((item.count / metrics.totalArticles) * 100).toFixed(
                            1,
                          )}
                          %)
                        </span>
                      </div>
                      <div className="w-full h-3 bg-zinc-100 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${pct}%` }}
                          className="h-full bg-violet-600 rounded-full"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={`space-y-3 ${isExport ? "hidden" : ""}`}>
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-zinc-500" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Detalhamento Completo (Áreas Científicas)
                </h4>
              </div>
              <div className="border border-zinc-200 rounded-xl overflow-hidden shadow-sm bg-white">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-50/85 text-xs font-semibold text-zinc-500 border-b border-zinc-200 uppercase tracking-widest">
                      <th className="px-6 py-3.5">
                        Grupo Conceitual (Taxonomia Relacional)
                      </th>
                      <th className="px-6 py-3.5 text-right font-bold text-zinc-500">
                        Qtd. Artigos
                      </th>
                      <th className="px-6 py-3.5 text-right">
                        Proporção Relativa (%)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-zinc-100">
                    {conceptualGroups.map((item, index) => {
                      const pct =
                        metrics.totalArticles > 0
                          ? (
                              (item.count / metrics.totalArticles) *
                              100
                            ).toFixed(2)
                          : "0.00";
                      return (
                        <tr
                          key={index}
                          className="hover:bg-zinc-50/50 transition-colors"
                        >
                          <td className="px-6 py-3 font-semibold text-zinc-800">
                            {item.name}
                          </td>
                          <td className="px-6 py-3 text-right">
                            <span className="inline-block bg-violet-50 text-violet-850 text-xs font-bold px-2.5 py-1 rounded-lg">
                              {item.count} artigos
                            </span>
                          </td>
                          <td className="px-6 py-3 text-right text-zinc-500 font-mono font-medium">
                            {pct}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {chartType === "open_access" && (
          <>
            <div className="bg-zinc-50/50 border border-zinc-100 rounded-2xl p-6 space-y-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                Distribuição Gráfica
              </h4>
              <div className="h-80 w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={openAccessStats}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={110}
                      paddingAngle={2}
                      dataKey="count"
                      label={({ value }) => value}
                      onClick={(data: any) => {
                        if (data && data.name) {
                          handleChartClick(
                            "open_access",
                            data.name,
                            `Artigos no Acesso: ${data.name}`,
                          );
                        }
                      }}
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      {openAccessStats.map((entry, index) => {
                        const COLORS = [
                          "#0ea5e9",
                          "#10b981",
                          "#f59e0b",
                          "#e11d48",
                          "#8b5cf6",
                          "#f97316",
                          "#64748b",
                        ];
                        return (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        );
                      })}
                    </Pie>
                    <Legend
                      layout="vertical"
                      verticalAlign="middle"
                      align="right"
                      iconType="circle"
                      wrapperStyle={{ fontSize: "12px", color: "#52525b" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className={`space-y-3 ${isExport ? "hidden" : ""}`}>
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-zinc-500" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Detalhamento Completo (Acesso de Circulação)
                </h4>
              </div>
              <div className="border border-zinc-200 rounded-xl overflow-hidden shadow-sm bg-white">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-50/85 text-xs font-semibold text-zinc-500 border-b border-zinc-200 uppercase tracking-widest">
                      <th className="px-6 py-3.5">
                        Modalidade / Tipo Open Access (OA)
                      </th>
                      <th className="px-6 py-3.5 text-right font-bold text-zinc-500">
                        Qtd. Artigos
                      </th>
                      <th className="px-6 py-3.5 text-right">
                        Porcentagem Representativa (%)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-zinc-100">
                    {openAccessStats.map((item, index) => {
                      const pct =
                        metrics.totalArticles > 0
                          ? (
                              (item.count / metrics.totalArticles) *
                              100
                            ).toFixed(2)
                          : "0.00";
                      return (
                        <tr
                          key={index}
                          className="hover:bg-zinc-50/50 transition-colors"
                        >
                          <td className="px-6 py-3 font-semibold text-zinc-800">
                            {item.name}
                          </td>
                          <td className="px-6 py-3 text-right">
                            <span className="inline-block bg-teal-50 text-teal-850 text-xs font-bold px-2.5 py-1 rounded-lg">
                              {item.count} trabalhos
                            </span>
                          </td>
                          <td className="px-6 py-3 text-right text-zinc-500 font-mono font-medium">
                            {pct}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {chartType === "languages" && (
          <>
            <div className="bg-zinc-50/50 border border-zinc-100 rounded-2xl p-6 space-y-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                Distribuição Gráfica
              </h4>
              <div className="space-y-4">
                {languagesStats.map((item, idx) => {
                  const maxVal = Math.max(
                    ...languagesStats.map((l) => l.count),
                    1,
                  );
                  const pct = (item.count / maxVal) * 100;
                  return (
                    <div
                      key={idx}
                      className="space-y-1 cursor-pointer group"
                      onClick={() =>
                        handleChartClick(
                          "languages",
                          item.name,
                          `Artigos no Idioma: ${item.name}`,
                        )
                      }
                    >
                      <div className="flex items-center justify-between text-xs font-semibold text-zinc-700 group-hover:text-amber-600 transition-colors">
                        <span className="truncate pr-4">{item.name}</span>
                        <span className="font-mono bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap">
                          {item.count} artigos (
                          {((item.count / metrics.totalArticles) * 100).toFixed(
                            1,
                          )}
                          %)
                        </span>
                      </div>
                      <div className="w-full h-3 bg-zinc-100 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${pct}%` }}
                          className="h-full bg-amber-500 rounded-full"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={`space-y-3 ${isExport ? "hidden" : ""}`}>
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-zinc-500" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Detalhamento Completo (Idiomas de Publicação)
                </h4>
              </div>
              <div className="border border-zinc-200 rounded-xl overflow-hidden shadow-sm bg-white">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-50/85 text-xs font-semibold text-zinc-500 border-b border-zinc-200 uppercase tracking-widest">
                      <th className="px-6 py-3.5">
                        Idioma Original do Manuscrito
                      </th>
                      <th className="px-6 py-3.5 text-right font-bold text-zinc-500">
                        Volume de Produções (Contagem)
                      </th>
                      <th className="px-6 py-3.5 text-right">
                        Proporção no Acervo (%)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-zinc-100">
                    {languagesStats.map((item, index) => {
                      const pct =
                        metrics.totalArticles > 0
                          ? (
                              (item.count / metrics.totalArticles) *
                              100
                            ).toFixed(2)
                          : "0.00";
                      return (
                        <tr
                          key={index}
                          className="hover:bg-zinc-50/50 transition-colors"
                        >
                          <td className="px-6 py-3 font-semibold text-zinc-800">
                            {item.name}
                          </td>
                          <td className="px-6 py-3 text-right">
                            <span className="inline-block bg-amber-50 text-amber-850 text-xs font-bold px-2.5 py-1 rounded-lg">
                              {item.count} artigos
                            </span>
                          </td>
                          <td className="px-6 py-3 text-right text-zinc-500 font-mono font-medium">
                            {pct}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </>
    );
  };

  return (
    <div
      className="space-y-8 animate-in fade-in duration-300 relative"
      id="dashboard_main_container"
    >
      {/* Dynamic Toast Feedback Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-zinc-950 border border-zinc-800 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 animate-in slide-in-from-bottom duration-300">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-xs font-bold leading-none">{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-emerald-600 font-semibold text-sm">
          <TrendingUp className="w-4 h-4" />
          <span>Visão Operacional e Científica</span>
        </div>
        <h1 className="text-3xl font-black text-zinc-900 tracking-tight">
          Dashboard Executivo
        </h1>
        <p className="text-zinc-500 max-w-xl">
          Visão analítica unificada sobre o desempenho científico, citações
          acumuladas e mapeamento de impacto.
        </p>
      </div>

      {/* METRICAS BARRA SUPERIOR (Required) */}
      <div
        className="w-full bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden"
        id="dashboard_top_metrics_bar"
      >
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-x divide-y lg:divide-y-0 divide-zinc-100">
          {/* Card 1: Número de Artigos */}
          <div
            className="p-6 flex flex-col justify-between hover:bg-zinc-50/50 transition-colors"
            id="metric_num_artigos"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                Artigos
              </span>
              <BookOpen className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-4">
              <span className="text-3xl font-black text-zinc-900 leading-none">
                {metrics.totalArticles}
              </span>
              <p className="text-[10px] text-zinc-500 mt-1">
                Registrados na base
              </p>
            </div>
          </div>

          {/* Card 2: Autores Únicos */}
          <div
            className="p-6 flex flex-col justify-between hover:bg-zinc-50/50 transition-colors"
            id="metric_autores_unicos"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                Autores
              </span>
              <Users className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-4">
              <span className="text-3xl font-black text-zinc-900 leading-none">
                {metrics.uniqueAuthors}
              </span>
              <p className="text-[10px] text-zinc-500 mt-1">
                Autores catalogados
              </p>
            </div>
          </div>

          {/* Card 3: Total Citações */}
          <div
            className="p-6 flex flex-col justify-between hover:bg-zinc-50/50 transition-colors"
            id="metric_total_citacoes"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                Citações
              </span>
              <MessageSquare className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-4">
              <span className="text-3xl font-black text-zinc-900 leading-none">
                {metrics.totalCitations}
              </span>
              <p className="text-[10px] text-zinc-500 mt-1">
                Citações acumuladas
              </p>
            </div>
          </div>

          {/* Card 4: Média de Citações */}
          <div
            className="p-6 flex flex-col justify-between hover:bg-zinc-50/50 transition-colors"
            id="metric_media_citacoes"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                Média Cit.
              </span>
              <BarChart3 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-4">
              <span className="text-3xl font-black text-zinc-900 leading-none">
                {metrics.averageCitations}
              </span>
              <p className="text-[10px] text-zinc-500 mt-1">
                Por artigo científico
              </p>
            </div>
          </div>

          {/* Card 5: H-INDEX */}
          <div
            className="p-6 flex flex-col justify-between hover:bg-zinc-50/50 transition-colors"
            id="metric_h_index"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                H-Index
              </span>
              <Award className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-4">
              <span className="text-3xl font-black text-zinc-900 leading-none">
                {metrics.hIndex}
              </span>
              <p className="text-[10px] text-zinc-500 mt-1">
                Métrica de impacto h
              </p>
            </div>
          </div>

          {/* Card 6: Porcentagem Open Access */}
          <div
            className="p-6 flex flex-col justify-between hover:bg-zinc-50/50 transition-colors"
            id="metric_open_access"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                Acesso Ab.
              </span>
              <Lock className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-4">
              <span className="text-3xl font-black text-zinc-900 leading-none">
                {metrics.openAccessPercentage}%
              </span>
              <p className="text-[10px] text-zinc-500 mt-1">
                Documentos abertos
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Graficos Section */}
      <div
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        id="dashboard_charts_grid"
      >
        {/* Grafico 1: Publicações por ano */}
        <div
          ref={pubChartRef}
          className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-6"
          id="visual_publications_by_year"
        >
          <div className="flex items-start justify-between border-b border-zinc-100 pb-4 mb-6">
            <div>
              <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-600" />
                <span>Publicações por Ano</span>
              </h3>
              <p className="text-xs text-zinc-500">
                Volume total de artigos científicos publicados anualmente (Série
                Histórica).
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => handleDownloadPNG("publications")}
                className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 rounded-xl transition-all border border-zinc-100 bg-white cursor-pointer"
                title="Salvar gráfico em PNG"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={() => setFullscreenChart("publications")}
                className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 rounded-xl transition-all border border-zinc-100 bg-white cursor-pointer"
                title="Expandir gráfico para tela cheia"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {yearlyStats.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-zinc-400 italic text-sm">
              Nenhuma publicação registrada para análise cronológica.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="relative h-64 w-full flex items-end gap-2 pt-6 select-none bg-gradient-to-t from-zinc-50/50 to-transparent rounded-xl px-4 border border-zinc-100/50">
                {yearlyStats.slice(-10).map((item, idx) => {
                  const maxCount = Math.max(
                    ...yearlyStats.map((s) => s.count),
                    1,
                  );
                  const countPct = (item.count / maxCount) * 80;

                  return (
                    <div
                      key={idx}
                      className="flex-1 flex flex-col justify-end items-center h-full group relative cursor-pointer"
                      onClick={() =>
                        handleChartClick(
                          "publications",
                          item.year,
                          `Artigos em ${item.year}`,
                        )
                      }
                    >
                      <div className="absolute bottom-full mb-2 bg-zinc-900 text-white text-[10px] p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-lg whitespace-nowrap text-center">
                        <p className="font-bold text-center border-b border-zinc-800 pb-0.5 mb-1 text-emerald-400">
                          {item.year}
                        </p>
                        <p>
                          📢 Artigos:{" "}
                          <span className="font-bold text-white">
                            {item.count}
                          </span>
                        </p>
                      </div>

                      <div
                        style={{ height: `${countPct}%` }}
                        className="w-full max-w-[28px] bg-emerald-600 hover:bg-emerald-500 rounded-t-lg transition-all duration-300 relative flex items-start justify-center cursor-pointer shadow-sm hover:shadow"
                      >
                        <span className="absolute -top-6 text-[9px] font-bold text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity">
                          {item.count}
                        </span>
                      </div>

                      <span className="text-[10px] font-bold text-zinc-500 mt-2 tracking-tight">
                        {item.year}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="text-[10px] text-zinc-400 text-center italic">
                Passe o mouse sobre as barras para ver a quantidade exata de
                artigos por ano.
              </div>
            </div>
          )}
        </div>

        {/* Grafico 2: Citações por ano de publicação */}
        <div
          ref={citChartRef}
          className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-6"
          id="visual_citations_by_year"
        >
          <div className="flex items-start justify-between border-b border-zinc-100 pb-4 mb-6">
            <div>
              <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-sky-600" />
                <span>Citações por Ano de Publicação</span>
              </h3>
              <p className="text-xs text-zinc-500">
                Volume acumulado de citações geradas por artigos (Série
                Histórica).
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => handleDownloadPNG("citations")}
                className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 rounded-xl transition-all border border-zinc-100 bg-white cursor-pointer"
                title="Salvar gráfico em PNG"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={() => setFullscreenChart("citations")}
                className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 rounded-xl transition-all border border-zinc-100 bg-white cursor-pointer"
                title="Expandir gráfico para tela cheia"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {yearlyStats.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-zinc-400 italic text-sm">
              Nenhuma citação registrada para análise cronológica.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="relative h-64 w-full flex items-end gap-2 pt-6 select-none bg-gradient-to-t from-zinc-50/50 to-transparent rounded-xl px-4 border border-zinc-100/50">
                {yearlyStats.slice(-10).map((item, idx) => {
                  const maxCitations = Math.max(
                    ...yearlyStats.map((s) => s.citations),
                    1,
                  );
                  const citationPct = (item.citations / maxCitations) * 80;

                  return (
                    <div
                      key={idx}
                      className="flex-1 flex flex-col justify-end items-center h-full group relative cursor-pointer"
                      onClick={() =>
                        handleChartClick(
                          "citations",
                          item.year,
                          `Citações em Artigos de ${item.year}`,
                        )
                      }
                    >
                      <div className="absolute bottom-full mb-2 bg-zinc-900 text-white text-[10px] p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-lg whitespace-nowrap text-center">
                        <p className="font-bold text-center border-b border-zinc-800 pb-0.5 mb-1 text-sky-400">
                          {item.year}
                        </p>
                        <p>
                          💬 Citações:{" "}
                          <span className="font-bold text-white">
                            {item.citations}
                          </span>
                        </p>
                      </div>

                      <div
                        style={{ height: `${citationPct}%` }}
                        className="w-full max-w-[28px] bg-sky-500 hover:bg-sky-400 rounded-t-lg transition-all duration-300 relative flex items-start justify-center cursor-pointer shadow-sm hover:shadow"
                      >
                        <span className="absolute -top-6 text-[9px] font-bold text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity">
                          {item.citations}
                        </span>
                      </div>

                      <span className="text-[10px] font-bold text-zinc-500 mt-2 tracking-tight">
                        {item.year}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="text-[10px] text-zinc-400 text-center italic">
                Passe o mouse sobre as barras para ver a quantidade de citações
                dos trabalhos de cada ano.
              </div>
            </div>
          )}
        </div>

        {/* Grafico 3: TOP 15 Periódicos */}
        <div
          ref={journalChartRef}
          className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-6"
          id="visual_top_journals"
        >
          <div className="flex items-start justify-between border-b border-zinc-100 pb-4 mb-6">
            <div>
              <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                <BookMarked className="w-5 h-5 text-indigo-600" />
                <span>TOP 15 Periódicos</span>
              </h3>
              <p className="text-xs text-zinc-500">
                Periódicos científicos com maior representatividade.
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => handleDownloadPNG("journals")}
                className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 rounded-xl transition-all border border-zinc-100 bg-white cursor-pointer"
                title="Salvar gráfico em PNG"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={() => setFullscreenChart("journals")}
                className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 rounded-xl transition-all border border-zinc-100 bg-white cursor-pointer"
                title="Expandir gráfico para tela cheia"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {topJournals.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-zinc-400 italic text-sm">
              Sem dados de periódicos disponíveis nesta base.
            </div>
          ) : (
            <div className="space-y-4 max-h-[290px] overflow-y-auto pr-1">
              {topJournals.slice(0, 5).map((item, idx) => {
                const maxVal = Math.max(...topJournals.map((j) => j.count), 1);
                const pct = (item.count / maxVal) * 100;
                return (
                  <div
                    key={idx}
                    className="space-y-1 cursor-pointer group"
                    onClick={() =>
                      handleChartClick(
                        "journals",
                        item.name,
                        `Artigos no Periódico: ${item.name}`,
                      )
                    }
                  >
                    <div className="flex items-center justify-between text-xs font-semibold text-zinc-700 group-hover:text-indigo-700 transition-colors">
                      <span className="truncate max-w-[80%]">
                        #{idx + 1}. {item.name}
                      </span>
                      <span className="font-mono bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-[10px]">
                        {item.count} artigos
                      </span>
                    </div>
                    <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${pct}%` }}
                        className="h-full bg-indigo-600 rounded-full"
                      />
                    </div>
                  </div>
                );
              })}
              {topJournals.length > 5 && (
                <button
                  onClick={() => setFullscreenChart("journals")}
                  className="w-full py-2.5 bg-zinc-50 hover:bg-zinc-100 text-zinc-600 text-xs font-bold rounded-xl transition-all border border-zinc-100/80 cursor-pointer flex items-center justify-center gap-1 mt-2 shadow-sm"
                >
                  Ver todos os 15 periódicos{" "}
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Grafico 4: TOP 20 Autores */}
        <div
          ref={authorChartRef}
          className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-6"
          id="visual_top_authors"
        >
          <div className="flex items-start justify-between border-b border-zinc-100 pb-4 mb-6">
            <div>
              <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-rose-600" />
                <span>TOP 20 Autores</span>
              </h3>
              <p className="text-xs text-zinc-500">
                Mapeamento de produtividade científica individual de
                pesquisadores.
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => handleDownloadPNG("authors")}
                className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 rounded-xl transition-all border border-zinc-100 bg-white cursor-pointer"
                title="Salvar gráfico em PNG"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={() => setFullscreenChart("authors")}
                className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 rounded-xl transition-all border border-zinc-100 bg-white cursor-pointer"
                title="Expandir gráfico para tela cheia"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {topAuthors.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-zinc-400 italic text-sm">
              Nenhuma contribuição de autor identificada nesta coleção.
            </div>
          ) : (
            <div className="space-y-4 max-h-[290px] overflow-y-auto pr-1">
              {topAuthors.slice(0, 5).map((item, idx) => {
                const maxVal = Math.max(...topAuthors.map((a) => a.count), 1);
                const pct = (item.count / maxVal) * 100;
                return (
                  <div
                    key={idx}
                    className="space-y-1 cursor-pointer group"
                    onClick={() =>
                      handleChartClick(
                        "authors",
                        item.name,
                        `Artigos de: ${item.name}`,
                      )
                    }
                  >
                    <div className="flex items-center justify-between text-xs font-semibold text-zinc-700 group-hover:text-rose-700 transition-colors">
                      <span className="truncate max-w-[80%]">
                        #{idx + 1}. {item.name}
                      </span>
                      <span className="font-mono bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded text-[10px]">
                        {item.count} artigos
                      </span>
                    </div>
                    <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${pct}%` }}
                        className="h-full bg-rose-500 rounded-full"
                      />
                    </div>
                  </div>
                );
              })}
              {topAuthors.length > 5 && (
                <button
                  onClick={() => setFullscreenChart("authors")}
                  className="w-full py-2.5 bg-zinc-50 hover:bg-zinc-100 text-zinc-600 text-xs font-bold rounded-xl transition-all border border-zinc-100/80 cursor-pointer flex items-center justify-center gap-1 mt-2 shadow-sm"
                >
                  Ver todos os 20 autores{" "}
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Grafico 5: TOP 15 Palavras-chave */}
        <div
          ref={keywordChartRef}
          className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-6"
          id="visual_top_keywords"
        >
          <div className="flex items-start justify-between border-b border-zinc-100 pb-4 mb-6">
            <div>
              <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                <Tag className="w-5 h-5 text-orange-600" />
                <span>TOP 15 Palavras-Chave</span>
              </h3>
              <p className="text-xs text-zinc-500">
                Mapeamento temático através da recorrência absoluta de termos
                indexados.
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => handleDownloadPNG("keywords")}
                className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 rounded-xl transition-all border border-zinc-100 bg-white cursor-pointer"
                title="Salvar gráfico em PNG"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={() => setFullscreenChart("keywords")}
                className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 rounded-xl transition-all border border-zinc-100 bg-white cursor-pointer"
                title="Expandir gráfico para tela cheia"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {topKeywords.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-zinc-400 italic text-sm">
              Nenhuma palavra-chave encontrada na coleção.
            </div>
          ) : (
            <div className="space-y-4 max-h-[290px] overflow-y-auto pr-1">
              {topKeywords.slice(0, 5).map((item, idx) => {
                const maxVal = Math.max(...topKeywords.map((k) => k.count), 1);
                const pct = (item.count / maxVal) * 100;
                return (
                  <div
                    key={idx}
                    className="space-y-1 cursor-pointer group"
                    onClick={() =>
                      handleChartClick(
                        "keywords",
                        item.name,
                        `Artigos com a Palavra-chave: ${item.name}`,
                      )
                    }
                  >
                    <div className="flex items-center justify-between text-xs font-semibold text-zinc-700 group-hover:text-orange-700 transition-colors">
                      <span className="truncate max-w-[80%]">
                        #{idx + 1}. {item.name}
                      </span>
                      <span className="font-mono bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded text-[10px]">
                        {item.count} ocorrências
                      </span>
                    </div>
                    <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${pct}%` }}
                        className="h-full bg-orange-500 rounded-full"
                      />
                    </div>
                  </div>
                );
              })}
              {topKeywords.length > 5 && (
                <button
                  onClick={() => setFullscreenChart("keywords")}
                  className="w-full py-2.5 bg-zinc-50 hover:bg-zinc-100 text-zinc-600 text-xs font-bold rounded-xl transition-all border border-zinc-100/80 cursor-pointer flex items-center justify-center gap-1 mt-2 shadow-sm"
                >
                  Ver todas as 15 palavras-chave{" "}
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Grafico 6: Grupo Conceitual */}
        <div
          ref={groupChartRef}
          className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-6"
          id="visual_conceptual_groups"
        >
          <div className="flex items-start justify-between border-b border-zinc-100 pb-4 mb-6">
            <div>
              <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-violet-600" />
                <span>Grupo Conceitual</span>
              </h3>
              <p className="text-xs text-zinc-500">
                Mapeamento epistêmico por classificação taxonômica sistemática.
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => handleDownloadPNG("conceptual_groups")}
                className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 rounded-xl transition-all border border-zinc-100 bg-white cursor-pointer"
                title="Salvar gráfico em PNG"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={() => setFullscreenChart("conceptual_groups")}
                className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 rounded-xl transition-all border border-zinc-100 bg-white cursor-pointer"
                title="Expandir gráfico para tela cheia"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {conceptualGroups.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-zinc-400 italic text-sm">
              Sem clusters conceituais processados.
            </div>
          ) : (
            <div className="space-y-4 max-h-[290px] overflow-y-auto pr-1">
              {conceptualGroups.map((item, idx) => {
                const maxVal = Math.max(
                  ...conceptualGroups.map((g) => g.count),
                  1,
                );
                const pct = (item.count / maxVal) * 100;
                return (
                  <div
                    key={idx}
                    className="space-y-1 cursor-pointer group"
                    onClick={() =>
                      handleChartClick(
                        "conceptual_groups",
                        item.name,
                        `Artigos no Grupo: ${item.name}`,
                      )
                    }
                  >
                    <div className="flex items-center justify-between text-xs font-semibold text-zinc-700 group-hover:text-violet-700 transition-colors">
                      <span className="truncate max-w-[80%]">{item.name}</span>
                      <span className="font-mono bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded text-[10px]">
                        {item.count} artigos (
                        {((item.count / metrics.totalArticles) * 100).toFixed(
                          0,
                        )}
                        %)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${pct}%` }}
                        className="h-full bg-violet-600"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Grafico 7: Acesso Aberto */}
        <div
          ref={oaChartRef}
          className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-6"
          id="visual_open_access"
        >
          <div className="flex items-start justify-between border-b border-zinc-100 pb-4 mb-6">
            <div>
              <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                <Unlock className="w-5 h-5 text-teal-600" />
                <span>Acesso Aberto (Open Access)</span>
              </h3>
              <p className="text-xs text-zinc-500">
                Mapeamento de acessibilidade e circulação científica livre dos
                documentos.
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => handleDownloadPNG("open_access")}
                className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 rounded-xl transition-all border border-zinc-100 bg-white cursor-pointer"
                title="Salvar gráfico em PNG"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={() => setFullscreenChart("open_access")}
                className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 rounded-xl transition-all border border-zinc-100 bg-white cursor-pointer"
                title="Expandir gráfico para tela cheia"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {openAccessStats.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-zinc-400 italic text-sm">
              Sem dados de acessibilidade processados.
            </div>
          ) : (
            <div className="h-64 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={openAccessStats}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="count"
                    onClick={(data: any) => {
                      if (data && data.name) {
                        handleChartClick(
                          "open_access",
                          data.name,
                          `Artigos no Acesso: ${data.name}`,
                        );
                      }
                    }}
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    {openAccessStats.map((entry, index) => {
                      const COLORS = [
                        "#0ea5e9",
                        "#10b981",
                        "#f59e0b",
                        "#e11d48",
                        "#8b5cf6",
                        "#f97316",
                        "#64748b",
                      ];
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      );
                    })}
                  </Pie>
                  <RechartsTooltip
                    formatter={(value: number) => [
                      `${value} artigos`,
                      "Quantidade",
                    ]}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "none",
                      boxShadow:
                        "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
                    }}
                  />
                  <Legend
                    layout="vertical"
                    verticalAlign="middle"
                    align="right"
                    iconType="circle"
                    wrapperStyle={{ fontSize: "11px", color: "#52525b" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Grafico 8: Idioma de publicação */}
        <div
          ref={langChartRef}
          className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-6"
          id="visual_publication_languages"
        >
          <div className="flex items-start justify-between border-b border-zinc-100 pb-4 mb-6">
            <div>
              <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                <Languages className="w-5 h-5 text-amber-600" />
                <span>Idioma de Publicação</span>
              </h3>
              <p className="text-xs text-zinc-500">
                Mapeamento demográfico e distribuição por idioma original do
                manuscrito.
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => handleDownloadPNG("languages")}
                className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 rounded-xl transition-all border border-zinc-100 bg-white cursor-pointer"
                title="Salvar gráfico em PNG"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={() => setFullscreenChart("languages")}
                className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 rounded-xl transition-all border border-zinc-100 bg-white cursor-pointer"
                title="Expandir gráfico para tela cheia"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {languagesStats.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-zinc-400 italic text-sm">
              Sem dados demográficos linguísticos disponíveis.
            </div>
          ) : (
            <div className="space-y-4 max-h-[290px] overflow-y-auto pr-1">
              {languagesStats.map((item, idx) => {
                const maxVal = Math.max(
                  ...languagesStats.map((l) => l.count),
                  1,
                );
                const pct = (item.count / maxVal) * 100;
                return (
                  <div
                    key={idx}
                    className="space-y-1 cursor-pointer group"
                    onClick={() =>
                      handleChartClick(
                        "languages",
                        item.name,
                        `Artigos no Idioma: ${item.name}`,
                      )
                    }
                  >
                    <div className="flex items-center justify-between text-xs font-semibold text-zinc-700 group-hover:text-amber-700 transition-colors">
                      <span className="truncate max-w-[80%]">{item.name}</span>
                      <span className="font-mono bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded text-[10px]">
                        {item.count} artigos (
                        {((item.count / metrics.totalArticles) * 100).toFixed(
                          1,
                        )}
                        %)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${pct}%` }}
                        className="h-full bg-amber-500"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* FULLSCREEN ZOOM MODAL OVERLAY */}
      {fullscreenChart !== null && (
        <div
          className="fixed inset-0 bg-zinc-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4 md:p-6 overflow-y-auto animate-in fade-in duration-200"
          id="fullscreen_chart_modal_overlay"
          onClick={() => setFullscreenChart(null)}
        >
          <div
            className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-250"
            id="fullscreen_chart_modal_content"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            {(() => {
              const details = getChartDetails(fullscreenChart || "");
              return (
                <div className="px-6 py-5 border-b border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-white border border-zinc-200 shadow-sm">
                      {details.icon}
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-zinc-900 tracking-tight">
                        {details.title}
                      </h3>
                      <p className="text-xs text-zinc-500">
                        {details.subtitle}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleDownloadPNG(fullscreenChart || "")}
                      className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 rounded-xl transition-all border border-zinc-100 bg-white cursor-pointer"
                      title="Salvar gráfico em PNG"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setFullscreenChart(null)}
                      className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-xl transition-all border border-zinc-200 bg-white cursor-pointer"
                      title="Fechar e voltar ao Dashboard"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-8">
              {renderExpandedChartContent(fullscreenChart || "")}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50/50 flex items-center justify-end">
              <button
                onClick={() => setFullscreenChart(null)}
                className="px-4 py-2 bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold rounded-xl transition-all font-sans cursor-pointer"
              >
                Voltar ao Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HIDDEN TEMPLATES FOR EXPORTING CLEAN HIGH-QUALITY PNG CHARTS (ALL DATA, NO SCROLLBARS, NO EXTRA TABLES) */}
      <div
        className="absolute top-[-9999px] left-[-9999px] pointer-events-none opacity-0"
        id="export_hidden_templates"
      >
        {[
          { type: "publications", ref: pubExportRef },
          { type: "citations", ref: citExportRef },
          { type: "journals", ref: journalExportRef },
          { type: "authors", ref: authorExportRef },
          { type: "keywords", ref: keywordExportRef },
          { type: "conceptual_groups", ref: groupExportRef },
          { type: "open_access", ref: oaExportRef },
          { type: "languages", ref: langExportRef },
        ].map((config) => {
          const details = getChartDetails(config.type);
          return (
            <div
              key={config.type}
              ref={config.ref}
              className="w-[1100px] bg-white p-12 flex flex-col gap-10 text-zinc-900 border border-zinc-200 rounded-3xl"
            >
              <div className="flex items-center gap-4">
                <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 shadow-sm">
                  {details?.icon}
                </div>
                <div>
                  <h2 className="text-2xl font-black text-zinc-800 tracking-tight">
                    {details?.title}
                  </h2>
                  <p className="text-sm text-zinc-500 mt-1">
                    {details?.subtitle}
                  </p>
                </div>
              </div>
              <div className="flex flex-col">
                {renderExpandedChartContent(config.type, true)}
              </div>
            </div>
          );
        })}
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
