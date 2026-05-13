-- Execute este script no SQL Editor do seu projeto Supabase 
-- para permitir que o App leia e escreva dados sem restrições.

-- 1. Habilitar RLS
ALTER TABLE autores ENABLE ROW LEVEL SECURITY;
ALTER TABLE artigos ENABLE ROW LEVEL SECURITY;
ALTER TABLE palavras_chaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE referencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE artigo_autor ENABLE ROW LEVEL SECURITY;
ALTER TABLE artigo_palavra_chave ENABLE ROW LEVEL SECURITY;
ALTER TABLE artigo_referencia ENABLE ROW LEVEL SECURITY;

-- 2. Criar políticas de acesso público (Leitura e Escrita)
CREATE POLICY "Public Access autores" ON autores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access artigos" ON artigos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access palavras_chaves" ON palavras_chaves FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access referencias" ON referencias FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access artigo_autor" ON artigo_autor FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access artigo_palavra_chave" ON artigo_palavra_chave FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access artigo_referencia" ON artigo_referencia FOR ALL USING (true) WITH CHECK (true);
