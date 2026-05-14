import React, { useState } from 'react';
import { Trash2, AlertTriangle, X, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ClearDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ClearDatabaseModal({ isOpen, onClose, onSuccess }: ClearDatabaseModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // ─────────────────────────────────────────────────────────────────────────────
  // PRÉ-REQUISITO: Execute no Supabase SQL Editor para limpeza ultra-rápida
  // ─────────────────────────────────────────────────────────────────────────────
  //
  // CREATE OR REPLACE FUNCTION clear_database_all()
  // RETURNS void LANGUAGE plpgsql AS $$
  // BEGIN
  //   DELETE FROM public.artigo_autor;
  //   DELETE FROM public.artigo_palavra_chave;
  //   DELETE FROM public.artigo_referencia;
  //   DELETE FROM public.artigos;
  //   DELETE FROM public.autores;
  //   DELETE FROM public.palavras_chaves;
  //   DELETE FROM public.referencias;
  // END;
  // $$;
  // ─────────────────────────────────────────────────────────────────────────────

  async function handleClearDatabase() {
    setIsDeleting(true);
    setError(null);

    try {
      // Tentamos usar a função RPC que é MUITO mais rápida e evita timeouts de rede
      // Se a função não existir, o erro será capturado e cairemos no modo sequencial
      const { error: rpcError } = await supabase.rpc('clear_database_all');

      if (rpcError) {
        console.warn('RPC clear_database_all não encontrada ou falhou. Tentando modo sequencial...', rpcError);
        
        // 1. Deletar as tabelas de associação (muitos-para-muitos) primeiro
        await supabase.from('artigo_autor').delete().neq('id_artigo', -1);
        await supabase.from('artigo_palavra_chave').delete().neq('id_artigo', -1);
        await supabase.from('artigo_referencia').delete().neq('id_artigo', -1);
        
        // 2. Deletar os artigos
        await supabase.from('artigos').delete().neq('id', -1);
        
        // 3. Deletar as entidades base
        await supabase.from('autores').delete().neq('id', 'not-an-id');
        await supabase.from('palavras_chaves').delete().neq('id', -1);
        await supabase.from('referencias').delete().gte('id', 0);
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Erro detalhado na limpeza:', err);
      setError(err.message || 'Erro ao limpar a base de dados. Pode ser um timeout devido ao grande volume de dados. Recomendamos usar a função SQL fornecida.');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-red-600 flex items-center gap-2">
            <Trash2 className="w-5 h-5" />
            Limpar Base de Dados
          </h2>
          {!isDeleting && (
            <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
              <X className="w-5 h-5 text-zinc-500" />
            </button>
          )}
        </div>

        <div className="bg-red-50 border border-red-100 p-4 rounded-xl mb-6">
          <div className="flex gap-3 text-red-700">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-bold text-sm">Atenção: Ação Irreversível</p>
              <p className="text-xs mt-1 leading-relaxed">
                Isso apagará permanentemente todos os artigos, autores, palavras-chave e referências cadastrados no sistema. Você terá que importar os arquivos CSV novamente.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 mb-4 bg-red-100 text-red-700 text-xs font-medium rounded-lg">
            {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1 px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium rounded-lg transition-colors order-2 sm:order-1"
          >
            Cancelar
          </button>
          <button
            onClick={handleClearDatabase}
            disabled={isDeleting}
            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 order-1 sm:order-2"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Limpando...
              </>
            ) : (
              'Confirmar Exclusão'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
