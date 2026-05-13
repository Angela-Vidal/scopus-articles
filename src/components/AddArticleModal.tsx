import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Artigo } from '../types';
import { X, Save, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AddArticleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  articleToEdit?: Artigo | null;
}

export function AddArticleModal({ isOpen, onClose, onSuccess, articleToEdit }: AddArticleModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    titulo: '',
    ano: new Date().getFullYear(),
    source_titulo: '',
    qt_citacao: 0,
    doi: '',
    link: '',
    resumo: ''
  });

  const [newAuthors, setNewAuthors] = useState<string[]>([]);
  const [newKeywords, setNewKeywords] = useState<string[]>([]);
  const [newReferences, setNewReferences] = useState<string[]>([]);

  React.useEffect(() => {
    if (articleToEdit && isOpen) {
      setFormData({
        titulo: articleToEdit.titulo || '',
        ano: articleToEdit.ano || new Date().getFullYear(),
        source_titulo: articleToEdit.source_titulo || '',
        qt_citacao: articleToEdit.qt_citacao || 0,
        doi: articleToEdit.doi || '',
        link: articleToEdit.link || '',
        resumo: articleToEdit.resumo || ''
      });
      // We can't easily fetch and populate the exact previous names since we store their full references differently,
      // but let's at least populate if they exist. For a robust edit, we'd fetch them here.
      fetchArticleRelations(articleToEdit.id);
    } else if (isOpen) {
      resetForm();
    }
  }, [articleToEdit, isOpen]);

  async function fetchArticleRelations(id: number) {
    try {
      const { data: authors } = await supabase.from('artigo_autor').select('autores(nome_completo)').eq('id_artigo', id);
      const { data: keywords } = await supabase.from('artigo_palavra_chave').select('palavras_chaves(palavra_chave)').eq('id_artigo', id);
      const { data: references } = await supabase.from('artigo_referencia').select('referencias(conteudo_referencia)').eq('id_artigo', id);
      
      if (authors) setNewAuthors(authors.map(a => (a.autores as any).nome_completo).filter(Boolean));
      if (keywords) setNewKeywords(keywords.map(k => (k.palavras_chaves as any).palavra_chave).filter(Boolean));
      if (references) setNewReferences(references.map(r => (r.referencias as any).conteudo_referencia).filter(Boolean));
    } catch (err) {}
  }

  const [authorInput, setAuthorInput] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [referenceInput, setReferenceInput] = useState('');

  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.titulo) return;
    setIsLoading(true);
    setError(null);

    try {
      let articleId;

      if (articleToEdit) {
        // UPDATE
        const { error: artError } = await supabase
          .from('artigos')
          .update(formData)
          .eq('id', articleToEdit.id);

        if (artError) throw artError;
        articleId = articleToEdit.id;

        // Limpar associações atuais para recriar
        await supabase.from('artigo_autor').delete().eq('id_artigo', articleId);
        await supabase.from('artigo_palavra_chave').delete().eq('id_artigo', articleId);
        await supabase.from('artigo_referencia').delete().eq('id_artigo', articleId);
      } else {
        // INSERT
        const { error: artError, data: artData } = await supabase
          .from('artigos')
          .insert([formData])
          .select()
          .single();

        if (artError) {
          if (artError.message.includes('RLS')) {
            throw new Error('Erro de permissão (RLS). Certifique-se de habilitar políticas de INSERT no seu painel Supabase.');
          }
          throw artError;
        }
        articleId = artData.id;
      }

      // 2. Processar Autores
      for (const name of newAuthors) {
        const authorId = name.toLowerCase().trim().replace(/\s+/g, '-');
        
        let citationName = name;
        const parts = name.trim().split(/\s+/);
        if (parts.length > 1) {
          const last = parts.pop()?.toUpperCase();
          const rest = parts.join(' ');
          citationName = `${last}, ${rest}`;
        } else {
          citationName = name.toUpperCase();
        }

        const { data: existingAuthor } = await supabase.from('autores').select('id').eq('id', authorId).single();
        
        if (!existingAuthor) {
          const { error: insErr } = await supabase.from('autores').insert([{ id: authorId, nome: citationName, nome_completo: name }]);
          if (insErr && insErr.code !== '23505') throw insErr;
        }

        const { error: linkErr } = await supabase.from('artigo_autor').insert([{ id_artigo: articleId, id_autor: authorId }]);
        if (linkErr) throw linkErr;
      }

      // 3. Processar Palavras-chave
      for (const kw of newKeywords) {
        const { data: kwData, error: kwErr } = await supabase
          .from('palavras_chaves')
          .upsert([{ palavra_chave: kw }], { onConflict: 'palavra_chave' })
          .select()
          .single();
        
        if (kwErr) throw kwErr;
        if (kwData) {
          const { error: linkErr } = await supabase.from('artigo_palavra_chave').insert([{ id_artigo: articleId, id_palavra_chave: kwData.id }]);
          if (linkErr) throw linkErr;
        }
      }

      // 4. Processar Referências
      for (const refContent of newReferences) {
        const { data: refData, error: refErr } = await supabase
          .from('referencias')
          .insert([{ conteudo_referencia: refContent }])
          .select()
          .single();
        
        if (refErr) throw refErr;
        if (refData) {
          const { error: linkErr } = await supabase.from('artigo_referencia').insert([{ id_artigo: articleId, id_referencia: refData.id }]);
          if (linkErr) throw linkErr;
        }
      }
      
      onSuccess();
      onClose();
      resetForm();
    } catch (err: any) {
      setError(err.message || 'Erro inesperado ao salvar o artigo.');
    } finally {
      setIsLoading(false);
    }
  }

  function resetForm() {
    setFormData({
      titulo: '',
      ano: new Date().getFullYear(),
      source_titulo: '',
      qt_citacao: 0,
      doi: '',
      link: '',
      resumo: ''
    });
    setNewAuthors([]);
    setNewKeywords([]);
    setNewReferences([]);
    setAuthorInput('');
    setKeywordInput('');
    setReferenceInput('');
  }

  const addItem = (input: string, setInput: (v: string) => void, setList: (v: any) => void) => {
    if (!input.trim()) return;
    setList((prev: string[]) => [...prev, input.trim()]);
    setInput('');
  };

  const removeItem = (setList: (v: any) => void, index: number) => {
    setList((prev: any[]) => prev.filter((_, i) => i !== index));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'ano' || name === 'qt_citacao' ? parseInt(value) || 0 : value
    }));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[80]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-x-4 top-[5%] bottom-[5%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-xl bg-white rounded-2xl shadow-2xl z-[90] flex flex-col overflow-hidden border border-zinc-200"
          >
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-zinc-900">{articleToEdit ? 'Editar Artigo' : 'Novo Artigo'}</h2>
              <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-zinc-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs font-semibold rounded-lg">
                  {error}
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase">Título *</label>
                <input
                  required
                  name="titulo"
                  value={formData.titulo}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                  placeholder="Título do artigo científico"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase">Ano</label>
                  <input
                    type="number"
                    name="ano"
                    value={formData.ano}
                    onChange={handleChange}
                    className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase">Citações</label>
                  <input
                    type="number"
                    name="qt_citacao"
                    value={formData.qt_citacao}
                    onChange={handleChange}
                    className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase">Fonte / Source</label>
                <input
                  name="source_titulo"
                  value={formData.source_titulo}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                  placeholder="Ex: Journal of Science"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase">Link</label>
                <input
                  name="link"
                  value={formData.link}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                  placeholder="https://..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase">DOI</label>
                <input
                  name="doi"
                  value={formData.doi}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                  placeholder="10.1000/..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase">Resumo</label>
                <textarea
                  name="resumo"
                  rows={3}
                  value={formData.resumo}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all resize-none"
                  placeholder="Breve resumo do artigo..."
                />
              </div>

              <div className="pt-4 border-t border-zinc-100 space-y-6">
                {/* Autores */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase">Adicionar Autores</label>
                  <div className="flex gap-2">
                    <input
                      value={authorInput}
                      onChange={(e) => setAuthorInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addItem(authorInput, setAuthorInput, setNewAuthors))}
                      className="flex-1 px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm"
                      placeholder="Nome do autor..."
                    />
                    <button
                      type="button"
                      onClick={() => addItem(authorInput, setAuthorInput, setNewAuthors)}
                      className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-bold"
                    >
                      +
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {newAuthors.map((author, idx) => (
                      <span key={idx} className="flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-xs font-medium">
                        {author}
                        <button type="button" onClick={() => removeItem(setNewAuthors, idx)}>
                          <X className="w-3 h-3 hover:text-emerald-900" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Palavras-chave */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase">Palavras-chave</label>
                  <div className="flex gap-2">
                    <input
                      value={keywordInput}
                      onChange={(e) => setKeywordInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addItem(keywordInput, setKeywordInput, setNewKeywords))}
                      className="flex-1 px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm"
                      placeholder="Ex: Inteligência Artificial"
                    />
                    <button
                      type="button"
                      onClick={() => addItem(keywordInput, setKeywordInput, setNewKeywords)}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold"
                    >
                      +
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {newKeywords.map((kw, idx) => (
                      <span key={idx} className="flex items-center gap-1 px-3 py-1 bg-zinc-100 text-zinc-600 border border-zinc-200 rounded-full text-xs font-medium">
                        {kw}
                        <button type="button" onClick={() => removeItem(setNewKeywords, idx)}>
                          <X className="w-3 h-3 hover:text-zinc-900" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Referências */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase">Referências Bibliográficas</label>
                  <div className="space-y-2">
                    <textarea
                      value={referenceInput}
                      onChange={(e) => setReferenceInput(e.target.value)}
                      rows={2}
                      className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm resize-none"
                      placeholder="Citação da referência..."
                    />
                    <button
                      type="button"
                      onClick={() => addItem(referenceInput, setReferenceInput, setNewReferences)}
                      className="w-full px-4 py-2 bg-white border border-zinc-200 text-zinc-600 rounded-lg text-xs font-bold hover:bg-zinc-50"
                    >
                      + Adicionar Referência à Lista
                    </button>
                  </div>
                  <div className="space-y-2 pt-2">
                    {newReferences.map((ref, idx) => (
                      <div key={idx} className="group flex items-start gap-2 p-2 bg-zinc-50 border border-zinc-100 rounded-lg text-xs italic text-zinc-600">
                        <span className="flex-1 line-clamp-2">{ref}</span>
                        <button type="button" onClick={() => removeItem(setNewReferences, idx)} className="text-zinc-400 hover:text-red-500">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </form>

            <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 text-sm font-bold text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={isLoading || !formData.titulo}
                className="flex-[2] px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-300 text-white text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {articleToEdit ? 'Atualizar Artigo' : 'Salvar Artigo'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
