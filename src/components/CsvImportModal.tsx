import { AlertCircle, CheckCircle, FileUp, Upload, X } from "lucide-react";
import Papa from "papaparse";
import React, { useRef, useState } from "react";
import { supabase } from "../lib/supabase";

// ─────────────────────────────────────────────────────────────────────────────
// PRÉ-REQUISITO: Execute no Supabase SQL Editor ANTES de usar este componente
// ─────────────────────────────────────────────────────────────────────────────
//
// 1. Adicione restrição de unicidade ao título (necessário para o ON CONFLICT) e as novas colunas:
// ALTER TABLE public.artigos ADD CONSTRAINT artigos_titulo_unique UNIQUE (titulo);
//
// ALTER TABLE public.artigos ADD COLUMN IF NOT EXISTS issn text;
// ALTER TABLE public.artigos ADD COLUMN IF NOT EXISTS isbn text;
// ALTER TABLE public.artigos ADD COLUMN IF NOT EXISTS issn_isbn text;
// ALTER TABLE public.artigos ADD COLUMN IF NOT EXISTS language_of_original_document text;
// ALTER TABLE public.artigos ADD COLUMN IF NOT EXISTS document_type text;
// ALTER TABLE public.artigos ADD COLUMN IF NOT EXISTS open_access text;
//
// 2. Crie ou atualize a função de lote:
// CREATE OR REPLACE FUNCTION insert_artigos_batch(artigos jsonb)
// RETURNS TABLE(article_id bigint, article_title text) LANGUAGE plpgsql AS $$
// DECLARE
//   art jsonb;
// BEGIN
//   FOR art IN SELECT * FROM jsonb_array_elements(artigos) LOOP
//     RETURN QUERY
//     INSERT INTO public.artigos(
//       titulo, ano, source_titulo, qt_citacao, doi, link, resumo,
//       issn, isbn, issn_isbn, language_of_original_document, document_type, open_access
//     )
//     VALUES (
//       art->>'titulo',
//       (art->>'ano')::int,
//       art->>'source_titulo',
//       COALESCE((art->>'qt_citacao')::int, 0),
//       art->>'doi',
//       art->>'link',
//       art->>'resumo',
//       art->>'issn',
//       art->>'isbn',
//       art->>'issn_isbn',
//       art->>'language_of_original_document',
//       art->>'document_type',
//       art->>'open_access'
//     )
//     ON CONFLICT (titulo) DO UPDATE SET
//       qt_citacao = EXCLUDED.qt_citacao,
//       resumo = COALESCE(EXCLUDED.resumo, public.artigos.resumo),
//       issn = COALESCE(EXCLUDED.issn, public.artigos.issn),
//       isbn = COALESCE(EXCLUDED.isbn, public.artigos.isbn),
//       issn_isbn = COALESCE(EXCLUDED.issn_isbn, public.artigos.issn_isbn),
//       language_of_original_document = COALESCE(EXCLUDED.language_of_original_document, public.artigos.language_of_original_document),
//       document_type = COALESCE(EXCLUDED.document_type, public.artigos.document_type),
//       open_access = COALESCE(EXCLUDED.open_access, public.artigos.open_access)
//     RETURNING id, titulo;
//   END LOOP;
// END;
// $$;
//
// ─────────────────────────────────────────────────────────────────────────────
// Mapeamento CSV Scopus → banco
// ─────────────────────────────────────────────────────────────────────────────
// "Title"                         → artigos.titulo
// "Year"                          → artigos.ano
// "Source title"                  → artigos.source_titulo   ← nota: "Source title", não "Source"
// "Cited by"                      → artigos.qt_citacao
// "DOI"                           → artigos.doi
// "Link"                          → artigos.link
// "Abstract"                      → artigos.resumo
// "ISSN"                          → artigos.issn
// "ISBN"                          → artigos.isbn
// "Language of Original Document" → artigos.language_of_original_document
// "Document Type"                 → artigos.document_type
// "Open Access"                   → artigos.open_access
// "Author full names"             → autores  (separado por ;)
// "Author Keywords"               → palavras_chaves (separado por ;)
// "References"                    → referencias (separado por ;)
// Todas as demais colunas do Scopus são ignoradas.
// ─────────────────────────────────────────────────────────────────────────────

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ── Utilitários puros ─────────────────────────────────────────────────────────

function chunkArray<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size),
  );
}

/** Remove BOM e espaços de chaves de cabeçalho */
function normalizeKey(key: string): string {
  return key.trim().replace(/^[\uFEFF\u200B]+/, "");
}

/** ID estável para autor (usado como PK em autores.id text) */
function makeAuthorId(fullName: string): string {
  return fullName.toLowerCase().replace(/\s+/g, "-").substring(0, 255);
}

// ── Componente ────────────────────────────────────────────────────────────────

export function CsvImportModal({ isOpen, onClose }: CsvImportModalProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // ── Drag & Drop ──────────────────────────────────────────────────────────────

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) setFile(selected);
  };

  // ── Importação ───────────────────────────────────────────────────────────────

  const handleImport = () => {
    if (!file) return;
    setError(null);
    setSuccess(false);
    setIsImporting(true);
    setProgress(0);
    setProgressLabel("Lendo arquivo...");

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => runImport(results),
      error: () => {
        setError("Erro ao analisar o arquivo CSV.");
        setIsImporting(false);
      },
    });
  };

  async function runImport(results: Papa.ParseResult<any>) {
    try {
      const rawData = results.data as Record<string, string>[];

      if (rawData.length === 0) throw new Error("O arquivo CSV está vazio.");

      // Normaliza cabeçalhos (remove BOM do primeiro campo, espaços extras)
      const header = (results.meta.fields ?? []).map(normalizeKey);

      if (!header.includes("Title")) {
        throw new Error(
          `Coluna "Title" não encontrada.\n` +
            `Primeiras colunas detectadas: ${header.slice(0, 6).join(", ")}${header.length > 6 ? "..." : ""}\n\n` +
            `Verifique se o arquivo foi exportado do Scopus com separador vírgula.`,
        );
      }

      // ── 1. Parse e deduplicação em memória ──────────────────────────────────

      setProgressLabel("Processando linhas...");

      const uniqueAuthors = new Map<
        string,
        { id: string; nome: string; nome_completo: string }
      >();
      const uniqueKeywords = new Set<string>();
      const uniqueReferences = new Set<string>();

      type ValidRow = {
        article: {
          titulo: string;
          ano: number | null;
          source_titulo: string | null;
          qt_citacao: number;
          doi: string | null;
          link: string | null;
          resumo: string | null;
          issn: string | null;
          isbn: string | null;
          issn_isbn: string | null;
          language_of_original_document: string | null;
          document_type: string | null;
          open_access: string | null;
        };
        authorIds: string[];
        keywordStrings: string[];
        refStrings: string[];
      };

      const validRows: ValidRow[] = [];

      for (const raw of rawData) {
        // Normaliza chaves da linha
        const row: Record<string, string> = {};
        for (const key of Object.keys(raw)) {
          row[normalizeKey(key)] = raw[key] ?? "";
        }

        const title = row["Title"]?.trim();
        if (!title) continue;

        // ── Campos do artigo ──────────────────────────────────────────────────
        let yearParsed = null;
        if (row["Year"]) {
          const y = parseInt(row["Year"], 10);
          if (!isNaN(y)) yearParsed = y;
        }

        let citationsParsed = 0;
        if (row["Cited by"]) {
          const c = parseInt(row["Cited by"], 10);
          if (!isNaN(c)) citationsParsed = c;
        }

        // "Source title" é o nome da coluna no Scopus
        let abstractVal = row["Abstract"]?.trim() || null;
        if (
          abstractVal &&
          abstractVal.toLowerCase() === "[no abstract available]"
        ) {
          abstractVal = null;
        }

        const issnVal = row["ISSN"]?.trim() || null;
        const isbnVal = row["ISBN"]?.trim() || null;
        const issnIsbnVal = issnVal || isbnVal || null;

        const article = {
          titulo: title,
          ano: yearParsed,
          source_titulo: row["Source title"]?.trim() || null,
          qt_citacao: citationsParsed,
          doi: row["DOI"]?.trim() || null,
          link: row["Link"]?.trim() || null,
          resumo: abstractVal,
          issn: issnVal,
          isbn: isbnVal,
          issn_isbn: issnIsbnVal,
          language_of_original_document:
            row["Language of Original Document"]?.trim() || null,
          document_type: row["Document Type"]?.trim() || null,
          open_access: row["Open Access"]?.trim() || null,
        };

        // ── Autores ───────────────────────────────────────────────────────────
        // Scopus exporta "Author full names" como:
        //   "Souza, R.R. (57218871099); Pimentel, A.D.A. (57218873912)"
        // Extraímos o ID entre parênteses para ser a PK e limpamos o nome.
        const authorIds: string[] = [];
        const authorsRaw = row["Author full names"]?.trim();
        if (authorsRaw) {
          for (const part of authorsRaw.split(";")) {
            const fullName = part.trim();
            if (!fullName) continue;

            // Tenta extrair "Nome (ID)"
            const match = fullName.match(/^(.*?)\s*\(([^)]+)\)$/);
            let authorId: string;
            let displayName: string;

            if (match) {
              displayName = match[1].trim();
              authorId = match[2].trim();
            } else {
              displayName = fullName;
              authorId = makeAuthorId(fullName);
            }

            if (!uniqueAuthors.has(authorId)) {
              uniqueAuthors.set(authorId, {
                id: authorId,
                nome: displayName,
                nome_completo: displayName,
              });
            }
            if (!authorIds.includes(authorId)) authorIds.push(authorId);
          }
        }

        // ── Palavras-chave ────────────────────────────────────────────────────
        // "Author Keywords" → "palavra1; palavra2; palavra3"
        const keywordStrings: string[] = [];
        const kwRaw = row["Author Keywords"]?.trim();
        if (kwRaw) {
          for (const part of kwRaw.split(";")) {
            const kw = part.trim();
            if (!kw) continue;
            uniqueKeywords.add(kw);
            if (!keywordStrings.includes(kw)) keywordStrings.push(kw);
          }
        }

        // ── Referências ───────────────────────────────────────────────────────
        // "References" → cada referência separada por ;
        const refStrings: string[] = [];
        const refRaw = row["References"]?.trim();
        if (refRaw) {
          for (const part of refRaw.split(";")) {
            const ref = part.trim();
            if (!ref) continue;
            uniqueReferences.add(ref);
            if (!refStrings.includes(ref)) refStrings.push(ref);
          }
        }

        validRows.push({ article, authorIds, keywordStrings, refStrings });
      }

      if (validRows.length === 0) {
        throw new Error(
          "Nenhuma linha válida encontrada. " +
            'Verifique se a coluna "Title" está preenchida nas linhas do arquivo.',
        );
      }

      setProgress(10);

      // ── 2. Upsert auxiliares em paralelo ────────────────────────────────────
      //
      // autores, palavras_chaves e referencias são tabelas independentes.
      // Promise.all os processa ao mesmo tempo.

      setProgressLabel("Salvando autores, palavras-chave e referências...");

      const [kwMap, refMap] = await Promise.all([
        upsertAuthors(Array.from(uniqueAuthors.values())),
        upsertKeywords(Array.from(uniqueKeywords)),
        upsertReferences(Array.from(uniqueReferences)),
      ]).then(([, kw, ref]) => [kw, ref] as const);

      setProgress(30);

      // ── 3. Insert artigos via RPC batch ─────────────────────────────────────
      //
      // A SQL Function insert_artigos_batch retorna { id: bigint, titulo: text }
      // para cada artigo inserido, eliminando o loop serial de 1 request/artigo.
      //
      // artigos.id é bigint GENERATED ALWAYS AS IDENTITY.
      // O JS não suporta bigint nativo em JSON, então o Supabase retorna como string.

      setProgressLabel("Inserindo artigos...");

      const articleIdByTitle = new Map<string, string>(); // titulo → id (string de bigint)

      const articleChunks = chunkArray(
        validRows.map((r) => r.article),
        200,
      );

      for (let i = 0; i < articleChunks.length; i++) {
        const { data: inserted, error: rpcError } = await supabase.rpc(
          "insert_artigos_batch",
          { artigos: articleChunks[i] },
        );

        if (rpcError) {
          console.error(
            `RPC error no chunk ${i + 1}/${articleChunks.length}:`,
            rpcError,
          );
          throw new Error(`Erro ao salvar artigos: ${rpcError.message}`);
        } else {
          for (const row of (inserted ?? []) as {
            article_id: any;
            article_title: string;
          }[]) {
            articleIdByTitle.set(row.article_title, String(row.article_id));
          }
        }

        setProgress(30 + Math.round(((i + 1) / articleChunks.length) * 30));
      }

      setProgress(60);

      // ── 4. Montar e inserir relações em batch paralelo ───────────────────────

      setProgressLabel("Criando vínculos entre registros...");

      // id_artigo é bigint no banco — Supabase aceita como string no JS
      const allAuthorRelations: { id_artigo: string; id_autor: string }[] = [];
      const allKeywordRelations: {
        id_artigo: string;
        id_palavra_chave: number;
      }[] = [];
      const allReferenceRelations: {
        id_artigo: string;
        id_referencia: number;
      }[] = [];

      for (const row of validRows) {
        const articleId = articleIdByTitle.get(row.article.titulo);
        if (!articleId) continue;

        for (const authorId of row.authorIds) {
          allAuthorRelations.push({ id_artigo: articleId, id_autor: authorId });
        }
        for (const kw of row.keywordStrings) {
          const kwId = kwMap.get(kw);
          if (kwId != null)
            allKeywordRelations.push({
              id_artigo: articleId,
              id_palavra_chave: kwId,
            });
        }
        for (const ref of row.refStrings) {
          const refId = refMap.get(ref);
          if (refId != null)
            allReferenceRelations.push({
              id_artigo: articleId,
              id_referencia: refId,
            });
        }
      }

      // Paralelo: as três tabelas de junção são independentes
      await Promise.all([
        insertInChunks(
          "artigo_autor",
          allAuthorRelations,
          1000,
          "id_artigo,id_autor",
        ),
        insertInChunks(
          "artigo_palavra_chave",
          allKeywordRelations,
          1000,
          "id_artigo,id_palavra_chave",
        ),
        insertInChunks(
          "artigo_referencia",
          allReferenceRelations,
          1000,
          "id_artigo,id_referencia",
        ),
      ]);

      setProgress(100);
      setImportedCount(articleIdByTitle.size);
      setSuccess(true);
      setIsImporting(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Erro inesperado durante a importação.");
      setIsImporting(false);
    }
  }

  // ── Helpers de persistência ───────────────────────────────────────────────────

  async function upsertAuthors(
    authors: { id: string; nome: string; nome_completo: string }[],
  ): Promise<void> {
    for (const chunk of chunkArray(authors, 500)) {
      const { error } = await supabase
        .from("autores")
        .upsert(chunk, { onConflict: "id", ignoreDuplicates: true });
      if (error) console.error("Erro ao upsert autores:", error);
    }
  }

  /**
   * palavras_chaves.id = bigint GENERATED ALWAYS AS IDENTITY
   * palavras_chaves.palavra_chave = text UNIQUE
   * → upsert com onConflict retorna o id tanto dos novos quanto dos existentes.
   */
  async function upsertKeywords(
    keywords: string[],
  ): Promise<Map<string, number>> {
    const kwMap = new Map<string, number>();

    for (const chunk of chunkArray(keywords, 500)) {
      const { data, error } = await supabase
        .from("palavras_chaves")
        .upsert(
          chunk.map((kw) => ({ palavra_chave: kw })),
          { onConflict: "palavra_chave", ignoreDuplicates: false },
        )
        .select("id, palavra_chave");

      if (error) {
        console.error("Erro ao upsert keywords:", error);
        continue;
      }
      data?.forEach((e) => kwMap.set(e.palavra_chave, Number(e.id)));
    }

    return kwMap;
  }

  /**
   * referencias.conteudo_referencia NÃO tem constraint UNIQUE no schema atual,
   * então usamos a estratégia select-then-insert para evitar duplicatas.
   *
   * Dica: se adicionar UNIQUE em conteudo_referencia, pode trocar para
   * upsert igual ao de keywords e ganhar mais performance.
   */
  async function upsertReferences(
    refs: string[],
  ): Promise<Map<string, number>> {
    const refMap = new Map<string, number>();

    for (const chunk of chunkArray(refs, 500)) {
      // Busca existentes
      const { data: existing } = await supabase
        .from("referencias")
        .select("id, conteudo_referencia")
        .in("conteudo_referencia", chunk);

      const existingSet = new Set<string>();
      existing?.forEach((e) => {
        if (e.conteudo_referencia) {
          existingSet.add(e.conteudo_referencia);
          refMap.set(e.conteudo_referencia, Number(e.id));
        }
      });

      // Insere apenas os ausentes
      const missing = chunk
        .filter((ref) => !existingSet.has(ref))
        .map((ref) => ({ conteudo_referencia: ref }));

      if (missing.length > 0) {
        const { data: inserted, error } = await supabase
          .from("referencias")
          .insert(missing)
          .select("id, conteudo_referencia");

        if (error) {
          console.error("Erro ao inserir referências:", error);
        } else {
          inserted?.forEach((e) => {
            if (e.conteudo_referencia)
              refMap.set(e.conteudo_referencia, Number(e.id));
          });
        }
      }
    }

    return refMap;
  }

  async function insertInChunks(
    table: string,
    rows: any[],
    chunkSize: number,
    onConflictStr: string,
  ): Promise<void> {
    for (const chunk of chunkArray(rows, chunkSize)) {
      const { error } = await supabase
        .from(table)
        .upsert(chunk, { onConflict: onConflictStr, ignoreDuplicates: true });
      if (error) console.error(`Erro ao inserir em ${table}:`, error);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 flex flex-col items-center">
        {/* Cabeçalho */}
        <div className="w-full flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
            <Upload className="w-5 h-5 text-emerald-600" />
            Importar CSV
          </h2>
          {!isImporting && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-zinc-500" />
            </button>
          )}
        </div>

        {/* Erro */}
        {error && (
          <div className="w-full p-4 mb-4 bg-red-50 text-red-700 rounded-xl flex items-start gap-3 border border-red-100">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm font-medium whitespace-pre-wrap">{error}</p>
          </div>
        )}

        {/* Sucesso */}
        {success ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8" />
            </div>
            <p className="text-lg font-bold text-zinc-900">
              Importação Concluída!
            </p>
            <p className="text-sm text-zinc-500">
              {importedCount} artigo(s) importado(s)
            </p>
            <button
              onClick={onClose}
              className="mt-4 px-6 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg font-medium transition-all"
            >
              Fechar e Recarregar
            </button>
          </div>
        ) : (
          <>
            {/* Drop zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`w-full h-48 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors ${
                isDragActive
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-zinc-300 hover:border-emerald-400 bg-zinc-50 hover:bg-emerald-50/50"
              } ${isImporting ? "opacity-50 pointer-events-none" : ""}`}
            >
              <input
                type="file"
                accept=".csv"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                disabled={isImporting}
              />
              <FileUp
                className={`w-10 h-10 mb-3 ${isDragActive ? "text-emerald-500" : "text-zinc-400"}`}
              />
              <p className="text-sm font-medium text-zinc-700">
                {file
                  ? file.name
                  : "Arraste e solte o CSV aqui, ou clique para selecionar"}
              </p>
              {!file && (
                <p className="text-xs text-zinc-500 mt-1">
                  Exportação do Scopus (.csv)
                </p>
              )}
            </div>

            {/* Progresso */}
            {isImporting ? (
              <div className="w-full mt-6 space-y-2">
                <div className="flex justify-between text-sm font-medium text-zinc-700">
                  <span>{progressLabel}</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-zinc-500 text-center mt-2">
                  Processando em lote — isso leva alguns segundos.
                </p>
              </div>
            ) : (
              <button
                onClick={handleImport}
                disabled={!file}
                className="w-full mt-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-300 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-sm"
              >
                Iniciar Importação
              </button>
            )}

            {/* Instruções */}
            {!isImporting && (
              <div className="w-full mt-4 p-4 bg-zinc-50 rounded-lg border border-zinc-200 space-y-2">
                <p className="text-xs font-semibold text-zinc-700">
                  Colunas utilizadas do Scopus:
                </p>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Title · Year · Source title · Cited by · DOI · Link · Abstract
                  · ISSN · ISBN · Language of Original Document · Document Type
                  · Open Access · Author full names · Author Keywords ·
                  References
                </p>
                <p className="text-xs text-zinc-400">
                  As demais colunas do Scopus são ignoradas automaticamente.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
