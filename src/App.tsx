/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { 
  BookOpen, 
  Users, 
  Hash, 
  Link as LinkIcon, 
  Plus, 
  ArrowRight,
  Database,
  Search,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Article {
  id: number;
  titulo: string;
  ano: number;
  source_titulo: string;
  doi: string;
  link: string;
  resumo: string;
}

interface Author {
  id: string;
  nome: string;
  nome_completo: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'articles' | 'authors' | 'keywords' | 'references' | 'sql'>('articles');
  const [articles, setArticles] = useState<Article[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [keywords, setKeywords] = useState<{ id: number; palavra_chave: string }[]>([]);
  const [references, setReferences] = useState<{ id: number; conteudo_referencia: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [artRes, autRes, keyRes, refRes] = await Promise.all([
        supabase.from('artigos').select('*'),
        supabase.from('autores').select('*'),
        supabase.from('palavras_chaves').select('*'),
        supabase.from('referencias').select('*')
      ]);

      if (artRes.error) throw artRes.error;
      if (autRes.error) throw autRes.error;
      if (keyRes.error) throw keyRes.error;
      if (refRes.error) throw refRes.error;

      setArticles(artRes.data || []);
      setAuthors(autRes.data || []);
      setKeywords(keyRes.data || []);
      setReferences(refRes.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isConfigured = 
    import.meta.env.VITE_SUPABASE_URL && 
    import.meta.env.VITE_SUPABASE_URL !== 'SUA_URL_DO_SUPABASE';

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 leading-normal">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg text-white">
              <BookOpen size={20} />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 hidden sm:block">
              Base Acadêmica
            </h1>
          </div>
          
          <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto max-w-[70%] sm:max-w-none">
            {[
              { id: 'articles', label: 'Artigos' },
              { id: 'authors', label: 'Autores' },
              { id: 'keywords', label: 'Palavras-chaves' },
              { id: 'references', label: 'Referências' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all shrink-0 ${
                  activeTab === tab.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
            <div className="w-px h-4 bg-slate-300 mx-1 hidden sm:block" />
            <button
              onClick={() => setActiveTab('sql')}
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all shrink-0 ${
                activeTab === 'sql' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              SQL
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!isConfigured && activeTab !== 'sql' && (
          <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl mb-8">
            <div className="flex flex-col md:flex-row gap-4 items-start">
              <div className="bg-amber-100 p-3 rounded-full text-amber-600 shrink-0">
                <Database size={24} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-amber-900">Configuração do Supabase</h2>
                <p className="text-amber-800 mt-1 max-w-2xl text-sm">
                  O projeto está pronto para o GitHub Pages. Adicione as chaves em <strong>Settings {' > '} Secrets</strong> no GitHub com os nomes 
                  <code className="bg-amber-200 px-1 py-0.5 rounded mx-1 text-xs">VITE_SUPABASE_URL</code> e 
                  <code className="bg-amber-200 px-1 py-0.5 rounded mx-1 text-xs">VITE_SUPABASE_ANON_KEY</code>.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button 
                    onClick={() => setActiveTab('sql')}
                    className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors flex items-center gap-2 shadow-sm"
                  >
                    Ver Script SQL <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-xl mb-8 text-red-700 text-sm flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Erro na conexão: {error}
          </div>
        )}

        <AnimatePresence mode="wait">
          {activeTab === 'articles' && (
            <motion.div
              key="articles"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                  <h2 className="text-3xl font-extrabold text-slate-900">Artigos</h2>
                  <p className="text-slate-500 mt-1 text-sm">Gerencie a biblioteca de artigos científicos.</p>
                </div>
                <button className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-200 active:scale-95">
                  <Plus size={18} /> Novo Artigo
                </button>
              </div>

              {loading ? (
                <div className="text-center py-20 text-slate-400">Carregando dados do Supabase...</div>
              ) : articles.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {articles.map(article => (
                    <article key={article.id} className="group bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all duration-300">
                      <div className="flex justify-between items-start mb-4">
                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] bg-indigo-50 px-2 py-1 rounded-md">
                          {article.ano}
                        </span>
                        <div className="text-slate-300 group-hover:text-indigo-400 transition-colors">
                          <FileText size={20} />
                        </div>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 mb-3 line-clamp-2 leading-tight group-hover:text-indigo-600 transition-colors">
                        {article.titulo}
                      </h3>
                      <p className="text-slate-500 text-sm mb-4 line-clamp-3 leading-relaxed">
                        {article.resumo || 'Sem resumo disponível.'}
                      </p>
                      <div className="flex items-center justify-between mt-auto pt-5 border-t border-slate-50">
                        <div className="flex items-center gap-2 text-[11px] font-medium text-slate-400">
                          <Search size={14} className="text-slate-300" />
                          <span className="uppercase tracking-wider">{article.source_titulo}</span>
                        </div>
                        {article.link && (
                          <a 
                            href={article.link} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="bg-slate-50 p-2 rounded-full text-slate-400 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                          >
                            <LinkIcon size={14} />
                          </a>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState icon={<BookOpen size={40} />} title="Sem artigos" description="Sua biblioteca está vazia. Comece adicionando novos artigos." />
              )}
            </motion.div>
          )}

          {activeTab === 'authors' && (
            <motion.div
              key="authors"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-3xl font-extrabold text-slate-900">Autores</h2>
                  <p className="text-slate-500 mt-1 text-sm">Pesquisadores vinculados aos projetos.</p>
                </div>
                <button className="bg-white border border-slate-200 text-slate-600 px-5 py-2.5 rounded-xl font-semibold hover:bg-slate-50 transition-all flex items-center gap-2 active:scale-95 shadow-sm">
                  <Users size={18} /> Adicionar
                </button>
              </div>

              <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">ID/Bio</th>
                        <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Citação</th>
                        <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Nome Completo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {authors.length > 0 ? (
                        authors.map(author => (
                          <tr key={author.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-8 py-5">
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400">
                                {author.id.substring(0,2).toUpperCase()}
                              </div>
                            </td>
                            <td className="px-8 py-5 text-sm font-bold text-slate-900">
                              {author.nome}
                            </td>
                            <td className="px-8 py-5 text-sm text-slate-500">
                              {author.nome_completo}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="px-8 py-16 text-center text-slate-400 italic">Nenhum autor encontrado.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'keywords' && (
            <motion.div
              key="keywords"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="mb-8">
                <h2 className="text-3xl font-extrabold text-slate-900">Palavras-chaves</h2>
                <p className="text-slate-500 mt-1 text-sm">Termos técnicos para indexação.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                {keywords.length > 0 ? (
                  keywords.map(kw => (
                    <div key={kw.id} className="bg-white border border-slate-200 px-6 py-3 rounded-2xl flex items-center gap-3 shadow-sm hover:border-indigo-300 transition-all cursor-default">
                      <Hash size={16} className="text-indigo-400" />
                      <span className="font-semibold text-slate-700">{kw.palavra_chave}</span>
                    </div>
                  ))
                ) : (
                  <EmptyState icon={<Hash size={40} />} title="Sem palavras-chaves" description="O index de metadados está vazio." />
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'references' && (
            <motion.div
              key="references"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
            >
              <div className="mb-8">
                <h2 className="text-3xl font-extrabold text-slate-900">Referências</h2>
                <p className="text-slate-500 mt-1 text-sm">Obras citadas na coleção atual.</p>
              </div>
              <div className="space-y-4">
                {references.length > 0 ? (
                  references.map(ref => (
                    <div key={ref.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex gap-4 items-start group">
                      <div className="bg-slate-50 p-2 rounded-lg text-slate-300 group-hover:text-indigo-500 transition-colors">
                        <LinkIcon size={18} />
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed italic">{ref.conteudo_referencia}</p>
                    </div>
                  ))
                ) : (
                  <EmptyState icon={<LinkIcon size={40} />} title="Sem referências" description="Nenhuma citação externa registrada até o momento." />
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'sql' && <SQLSection />}
        </AnimatePresence>
      </main>
    </div>
  );
}

function EmptyState({ icon, title, description }: { icon: any, title: string, description: string }) {
  return (
    <div className="text-center py-20 bg-white border border-slate-200 rounded-[2rem] shadow-sm">
      <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-slate-900">{title}</h3>
      <p className="text-slate-400 mt-2 max-w-sm mx-auto text-sm">{description}</p>
    </div>
  );
}

function SQLSection() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-2xl border border-slate-800">
        <div className="px-8 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400/20" />
              <div className="w-3 h-3 rounded-full bg-amber-400/20" />
              <div className="w-3 h-3 rounded-full bg-emerald-400/20" />
            </div>
            <span className="text-xs font-mono text-slate-500 ml-4">schema_supabase.sql</span>
          </div>
          <button 
            onClick={() => navigator.clipboard.writeText(sqlContent)}
            className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl transition-all font-semibold"
          >
            Copiar Script
          </button>
        </div>
        <div className="p-8 overflow-x-auto max-h-[400px]">
          <pre className="text-indigo-300 font-mono text-sm leading-relaxed whitespace-pre">
            {sqlContent}
          </pre>
        </div>
      </div>
    </div>
  );
}

const sqlContent = `-- SQL PARA SUPABASE
CREATE TABLE autores (id TEXT PRIMARY KEY, nome TEXT NOT NULL, nome_completo TEXT);
CREATE TABLE artigos (id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, titulo TEXT NOT NULL, ano INTEGER, source_titulo TEXT, qt_citacao INTEGER DEFAULT 0, doi TEXT, link TEXT, resumo TEXT);
CREATE TABLE palavras_chaves (id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, palavra_chave TEXT NOT NULL UNIQUE);
CREATE TABLE referencias (id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, conteudo_referencia TEXT);
CREATE TABLE artigo_autor (id_artigo BIGINT REFERENCES artigos(id) ON DELETE CASCADE, id_autor TEXT REFERENCES autores(id) ON DELETE CASCADE, PRIMARY KEY (id_artigo, id_autor));
CREATE TABLE artigo_palavra_chave (id_artigo BIGINT REFERENCES artigos(id) ON DELETE CASCADE, id_palavra_chave BIGINT REFERENCES palavras_chaves(id) ON DELETE CASCADE, PRIMARY KEY (id_artigo, id_palavra_chave));
CREATE TABLE artigo_referencia (id_artigo BIGINT REFERENCES artigos(id) ON DELETE CASCADE, id_referencia BIGINT REFERENCES referencias(id) ON DELETE CASCADE, PRIMARY KEY (id_artigo, id_referencia));`;
