import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { Upload, X, FileUp, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

// nome artigo: Title
// ano: Year
// citações: Cited by
// fonte/source: Source
// link: Link
// DOI: DOI
// resumo: Abstract
// nomes autores: Author full names (separado por ;)
// palavras chave: Author Keywords (separado por ;)
// referências: References (separado por ;)

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CsvImportModal({ isOpen, onClose }: CsvImportModalProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleImport = () => {
    if (!file) return;
    setError(null);
    setSuccess(false);
    setIsImporting(true);
    setProgress(0);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          if (results.errors.length > 0 && results.errors[0].type !== 'Delimiter') {
            console.error('CSV Parsing Errors:', results.errors);
          }

          const data = results.data as any[];
          if (data.length === 0) {
            throw new Error('O arquivo CSV está vazio.');
          }

          const header = results.meta.fields?.map(h => h.trim().replace(/^[\uFEFF\u200B]/g, '')) || [];
          
          const strictRequiredColumns = ['Title'];
          
          const missingStrictColumns = strictRequiredColumns.filter(col => !header.includes(col));
          if (missingStrictColumns.length > 0) {
            throw new Error(`Coluna "Title" (Título) obrigatória não encontrada. Colunas no arquivo:\n${header.join(', ')}\n\nPor favor, verifique se o arquivo tem estas colunas ou exporte novamente do Scopus certifique-se de que o separador do CSV está correto.`);
          }

          // 1. Preparar dados únicos para inserção em lote (Bulk Insert)
          const uniqueAuthors = new Map<string, any>();
          const uniqueKeywords = new Set<string>();
          const uniqueReferences = new Set<string>();
          const validRows: any[] = [];

          for (let index = 0; index < data.length; index++) {
            const row = data[index];
            
            // Normalize row keys because headers might have spaces or BOMs
            const normalizedRow: any = {};
            for (const key of Object.keys(row)) {
              normalizedRow[key.trim().replace(/^[\uFEFF\u200B]/g, '')] = row[key];
            }

            const title = normalizedRow['Title']?.trim();
            if (!title) {
              continue; // Ignorar linhas sem título
            }

            const yearStr = normalizedRow['Year']?.trim();
            const citedByStr = normalizedRow['Cited by']?.trim();

            const newArticle = {
              titulo: title,
              ano: yearStr ? parseInt(yearStr, 10) : new Date().getFullYear(),
              source_titulo: normalizedRow['Source']?.trim(),
              qt_citacao: citedByStr ? parseInt(citedByStr, 10) : 0,
              doi: normalizedRow['DOI']?.trim(),
              link: normalizedRow['Link']?.trim(),
              resumo: normalizedRow['Abstract']?.trim()
            };

            const authorsRaw = normalizedRow['Author full names']?.split(';') || [];
            const authorIds: string[] = [];
            for (const nameRaw of authorsRaw) {
              const name = nameRaw.trim();
              if (!name) continue;

              const authorId = name.toLowerCase().replace(/\s+/g, '-').substring(0, 255);
              let citationName = name;
              const parts = name.split(/\s+/);
              if (parts.length > 1) {
                const last = parts.pop()?.toUpperCase();
                const rest = parts.join(' ');
                citationName = `${last}, ${rest}`;
              } else {
                citationName = name.toUpperCase();
              }

              uniqueAuthors.set(authorId, { id: authorId, nome: citationName, nome_completo: name });
              authorIds.push(authorId);
            }

            const keywordsRaw = row['Author Keywords']?.split(';') || [];
            const keywordStrings: string[] = [];
            for (const kw of keywordsRaw) {
              const kwClean = kw.trim();
              if (!kwClean) continue;
              
              uniqueKeywords.add(kwClean);
              keywordStrings.push(kwClean);
            }

            const refsRaw = row['References']?.split(';') || [];
            const refStrings: string[] = [];
            for (const ref of refsRaw) {
              const refClean = ref.trim();
              if (!refClean) continue;
              
              uniqueReferences.add(refClean);
              refStrings.push(refClean);
            }

            validRows.push({
              article: newArticle,
              authorIds,
              keywordStrings,
              refStrings
            });
          }

          if (validRows.length === 0) {
             throw new Error('Nenhuma linha do CSV contém a coluna Title preenchida de forma válida.');
          }

          setProgress(10); // Parse concluído

          // Helper para dividir os arrays grandes para respeitar os limites do insert do banco
          const chunkArray = (arr: any[], size: number) =>
            Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
              arr.slice(i * size, i * size + size)
            );

          // 2. Inserir (Upsert) todas as tabelas auxiliares globalmente de uma vez
          const authorsArray = Array.from(uniqueAuthors.values());
          for (const chunk of chunkArray(authorsArray, 500)) {
            await supabase.from('autores').upsert(chunk, { onConflict: 'id', ignoreDuplicates: true });
          }

          const kwMap = new Map<string, number>();
          const keywordsArray = Array.from(uniqueKeywords);
          for (const chunk of chunkArray(keywordsArray, 500)) {
            const { data: existing } = await supabase.from('palavras_chaves').select('id, palavra_chave').in('palavra_chave', chunk);
            const existingSet = new Set(existing?.map(e => e.palavra_chave) || []);
            existing?.forEach(e => kwMap.set(e.palavra_chave, e.id));

            const missing = chunk.filter(kw => !existingSet.has(kw)).map(kw => ({ palavra_chave: kw }));
            if (missing.length > 0) {
               const { data: inserted } = await supabase.from('palavras_chaves').insert(missing).select('id, palavra_chave');
               inserted?.forEach(e => kwMap.set(e.palavra_chave, e.id));
            }
          }

          const refMap = new Map<string, number>();
          const referencesArray = Array.from(uniqueReferences);
          for (const chunk of chunkArray(referencesArray, 500)) {
            const { data: existing } = await supabase.from('referencias').select('id, conteudo_referencia').in('conteudo_referencia', chunk);
            const existingSet = new Set(existing?.map(e => e.conteudo_referencia) || []);
            existing?.forEach(e => {
              if (e.conteudo_referencia) refMap.set(e.conteudo_referencia, e.id);
            });

            const missing = chunk.filter(ref => !existingSet.has(ref)).map(ref => ({ conteudo_referencia: ref }));
            if (missing.length > 0) {
               const { data: inserted } = await supabase.from('referencias').insert(missing).select('id, conteudo_referencia');
               inserted?.forEach(e => {
                 if (e.conteudo_referencia) refMap.set(e.conteudo_referencia, e.id);
               });
            }
          }

          setProgress(30);

          // 3. Inserir os artigos um a um (para resgatar o ID) e preparar as associações
          const allAuthorRelations: any[] = [];
          const allKeywordRelations: any[] = [];
          const allReferenceRelations: any[] = [];

          let currentArt = 0;
          for (const row of validRows) {
            const { data: artData, error: artError } = await supabase
              .from('artigos')
              .insert([row.article])
              .select('id')
              .single();

            if (artError) {
              console.error("Erro ao inserir artigo:", artError);
              currentArt++;
              continue;
            }

            const articleId = artData.id;

            // Coletar associações em memória
            // IMPORTANTE: evitar duplicados na mesma linha, para não violar a chave primária da relação
            const uniqueRowAuthors = Array.from(new Set(row.authorIds as string[]));
            const uniqueRowKwStrings = Array.from(new Set(row.keywordStrings as string[]));
            const uniqueRowRefStrings = Array.from(new Set(row.refStrings as string[]));

            for (const authorId of uniqueRowAuthors) {
              allAuthorRelations.push({ id_artigo: articleId, id_autor: authorId });
            }
            for (const kwString of uniqueRowKwStrings) {
              const kwId = kwMap.get(kwString);
              if (kwId) allKeywordRelations.push({ id_artigo: articleId, id_palavra_chave: kwId });
            }
            for (const refString of uniqueRowRefStrings) {
              const refId = refMap.get(refString);
              if (refId) allReferenceRelations.push({ id_artigo: articleId, id_referencia: refId });
            }

            currentArt++;
            // Progresso pros artigos vai de 30% a 70%
            setProgress(30 + Math.round((currentArt / validRows.length) * 40));
          }

          // 4. Inserir todas as relações em blocos/lotes também
          for (const chunk of chunkArray(allAuthorRelations, 1000)) {
            await supabase.from('artigo_autor').insert(chunk).select(); // .select() não é necessário mas pode ignorar warnings
          }
          setProgress(80);

          for (const chunk of chunkArray(allKeywordRelations, 1000)) {
            await supabase.from('artigo_palavra_chave').insert(chunk).select();
          }
          setProgress(90);

          for (const chunk of chunkArray(allReferenceRelations, 1000)) {
            await supabase.from('artigo_referencia').insert(chunk).select();
          }
          setProgress(100);

          setSuccess(true);
          setIsImporting(false);
        } catch (err: any) {
          console.error(err);
          setError(err.message || 'Erro durante a importação.');
          setIsImporting(false);
        }
      },
      error: (err) => {
        setError("Erro ao analisar o arquivo CSV.");
        setIsImporting(false);
      }
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 flex flex-col items-center">
        <div className="w-full flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
            <Upload className="w-5 h-5 text-emerald-600" />
            Importar CSV
          </h2>
          {!isImporting && (
            <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
              <X className="w-5 h-5 text-zinc-500" />
            </button>
          )}
        </div>

        {error && (
          <div className="w-full p-4 mb-4 bg-red-50 text-red-700 rounded-xl flex items-start gap-3 border border-red-100">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {success ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8" />
            </div>
            <p className="text-lg font-bold text-zinc-900">Importação Concluída!</p>
            <button
              onClick={onClose}
              className="mt-4 px-6 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg font-medium transition-all"
            >
              Fechar e Recarregar
            </button>
          </div>
        ) : (
          <>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`w-full h-48 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors ${
                isDragActive ? 'border-emerald-500 bg-emerald-50' : 'border-zinc-300 hover:border-emerald-400 bg-zinc-50 hover:bg-emerald-50/50'
              } ${isImporting ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <input
                type="file"
                accept=".csv"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                disabled={isImporting}
              />
              <FileUp className={`w-10 h-10 mb-3 ${isDragActive ? 'text-emerald-500' : 'text-zinc-400'}`} />
              <p className="text-sm font-medium text-zinc-700">
                {file ? file.name : 'Arraste e solte o CSV aqui, ou clique para selecionar'}
              </p>
              {!file && <p className="text-xs text-zinc-500 mt-1">Somente arquivos .csv suportados</p>}
            </div>

            {isImporting ? (
              <div className="w-full mt-6 space-y-2">
                <div className="flex justify-between text-sm font-medium text-zinc-700">
                  <span>Importando dados...</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-zinc-500 text-center mt-2">Isso pode levar alguns minutos.</p>
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
            
            {!isImporting && (
              <div className="w-full mt-4 p-4 bg-zinc-50 rounded-lg text-xs text-zinc-500 space-y-2 border border-zinc-200">
                <p className="font-semibold text-zinc-700">O CSV deve conter exatamente as colunas:</p>
                <p>Title, Year, Cited by, Source, Link, DOI, Abstract, Author full names, Author Keywords, References</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
