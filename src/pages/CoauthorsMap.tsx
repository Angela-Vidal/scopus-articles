import { Home, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { Link } from "react-router-dom";
import { ArticleListModal } from "../components/ArticleListModal";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { supabase } from "../lib/supabase";

interface Node {
  id: string;
  name: string;
  val: number; // For node sizing based on degree
}

interface Link {
  source: string;
  target: string;
}

export function CoauthorsMapPage() {
  useDocumentTitle("Scopus Analytics | Mapa de Coautoria");

  const [graphData, setGraphData] = useState<{ nodes: Node[]; links: Link[] }>({
    nodes: [],
    links: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    articleIds: number[];
  }>({
    isOpen: false,
    title: "",
    articleIds: [],
  });
  const [authorArticlesMap, setAuthorArticlesMap] = useState<{
    [authorId: string]: number[];
  }>({});

  useEffect(() => {
    loadNetwork();
  }, []);

  useEffect(() => {
    // Update dimensions on window resize
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight || 600,
        });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  async function loadNetwork() {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase.from("artigo_autor").select(`
          id_artigo,
          id_autor,
          autores (
            nome
          )
        `);

      if (error) throw error;

      // Process articles mapping
      const articlesMap: {
        [articleId: string]: { id: string; name: string }[];
      } = {};
      const authorsMap: {
        [authorId: string]: {
          id: string;
          name: string;
          degree: number;
          articlesCount: number;
        };
      } = {};
      const authorArticles: { [authorId: string]: number[] } = {};

      if (data) {
        data.forEach((item: any) => {
          const articleId = String(item.id_artigo);
          const authorId = String(item.id_autor);
          const authorName = item.autores?.nome || `Autor ${authorId}`;

          if (!articlesMap[articleId]) {
            articlesMap[articleId] = [];
          }

          articlesMap[articleId].push({ id: authorId, name: authorName });

          if (!authorsMap[authorId]) {
            authorsMap[authorId] = {
              id: authorId,
              name: authorName,
              degree: 0,
              articlesCount: 0,
            };
          }
          authorsMap[authorId].articlesCount += 1;

          if (!authorArticles[authorId]) {
            authorArticles[authorId] = [];
          }
          authorArticles[authorId].push(item.id_artigo);
        });
      }

      setAuthorArticlesMap(authorArticles);

      // Get top 100 authors by articlesCount
      const topAuthorsList = Object.values(authorsMap)
        .sort((a, b) => b.articlesCount - a.articlesCount)
        .slice(0, 100);

      const topAuthorIds = new Set(topAuthorsList.map((a) => a.id));

      const linksDetails: { [key: string]: boolean } = {};
      const finalLinks: Link[] = [];

      // Build links (edges) based on shared article logic
      Object.keys(articlesMap).forEach((articleId) => {
        const coauthors = articlesMap[articleId];
        if (coauthors.length > 1) {
          for (let i = 0; i < coauthors.length; i++) {
            for (let j = i + 1; j < coauthors.length; j++) {
              const a1 = coauthors[i].id;
              const a2 = coauthors[j].id;

              if (topAuthorIds.has(a1) && topAuthorIds.has(a2)) {
                // Sort ids so link is undirected and unique
                const source = a1 < a2 ? a1 : a2;
                const target = a1 < a2 ? a2 : a1;
                const linkId = `${source}-${target}`;

                if (!linksDetails[linkId]) {
                  linksDetails[linkId] = true;
                  finalLinks.push({ source, target });
                  // Increase degree for node sizing
                  if (authorsMap[source]) authorsMap[source].degree += 1;
                  if (authorsMap[target]) authorsMap[target].degree += 1;
                }
              }
            }
          }
        }
      });

      const finalNodes = topAuthorsList
        .filter((author) => author.degree > 0)
        .map((author) => ({
          id: author.id,
          name: author.name,
          val: Math.max(1, Math.min(10, author.degree)), // Scale the sizing
        }));

      setGraphData({ nodes: finalNodes, links: finalLinks });
    } catch (err: any) {
      setError(err.message || "Erro ao processar as conexões de autores.");
    } finally {
      setLoading(false);
    }
  }

  // ForceGraph configuration and handling
  const nodeCanvasObject = (
    node: any,
    ctx: CanvasRenderingContext2D,
    globalScale: number,
  ) => {
    const label = node.name;
    const fontSize = 12 / globalScale;
    ctx.font = `${fontSize}px Sans-Serif`;
    ctx.fillStyle = "#4f46e5"; // indigo-600

    // Draw Node Circle
    ctx.beginPath();
    const radius = Math.sqrt(node.val || 1) * 2;
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = "#818cf8"; // indigo-400
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.stroke();

    // Draw Label slightly below the node
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#3f3f46"; // zinc-700
    ctx.fillText(label, node.x, node.y + radius + fontSize);
  };

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
              to="/autores"
              className="hover:text-indigo-600 transition-colors"
            >
              <span>Autores</span>
            </Link>
            <span>/</span>
            <span className="text-zinc-900 font-medium tracking-tight">
              Rede de Coautoria
            </span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-zinc-900 flex items-center gap-3">
            <Users className="w-8 h-8 text-indigo-600" />
            Mapa de Coautoria
          </h1>
          <p className="text-zinc-500 mt-2 text-sm max-w-3xl">
            Grafo interativo mostrando as conexões de coautoria. Autores com
            mais colaborações têm nós maiores. Você pode dar zoom, arrastar a
            tela ou os próprios nós.{" "}
            <strong>Clique em um autor para visualizar seus artigos.</strong>
          </p>
        </div>
      </div>

      <div
        ref={containerRef}
        className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm relative min-h-[600px] w-full flex items-center justify-center"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="text-zinc-500 font-medium">
              Extraindo conexões da rede...
            </p>
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100 max-w-md text-center">
            {error}
          </div>
        ) : graphData.nodes.length === 0 ? (
          <div className="text-center text-zinc-500 text-lg">
            Nenhuma conexão de coautoria encontrada.
          </div>
        ) : (
          <ForceGraph2D
            width={dimensions.width}
            height={dimensions.height}
            graphData={graphData}
            nodeLabel="name"
            nodeRelSize={4}
            nodeCanvasObject={nodeCanvasObject}
            nodePointerAreaPaint={(
              node: any,
              color: string,
              ctx: CanvasRenderingContext2D,
              globalScale: number,
            ) => {
              ctx.fillStyle = color;
              const radius = Math.sqrt(node.val || 1) * 2;
              const fontSize = 12 / globalScale;
              ctx.font = `${fontSize}px Sans-Serif`;
              const textWidth = ctx.measureText(node.name).width;

              // Define a hitbox que cobre o texto e a bolinha
              ctx.fillRect(
                node.x - textWidth / 2,
                node.y,
                textWidth,
                radius + fontSize * 2,
              );
              ctx.beginPath();
              ctx.arc(node.x, node.y, radius + 4, 0, 2 * Math.PI, false);
              ctx.fill();
            }}
            linkColor={() => "#e4e4e7"} // zinc-200
            linkWidth={1.5}
            cooldownTicks={100}
            onEngineStop={() => console.log("Graph stabilized")}
            d3AlphaDecay={0.05}
            onNodeClick={(node: any) => {
              if (node && node.id && authorArticlesMap[node.id]) {
                setModalConfig({
                  isOpen: true,
                  title: `Artigos do Autor: ${node.name}`,
                  articleIds: authorArticlesMap[node.id],
                });
              }
            }}
          />
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
