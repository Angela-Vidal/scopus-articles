export interface Autor {
  id: string;
  nome: string;
  nome_completo?: string;
}

export interface Artigo {
  id: number;
  titulo: string;
  ano?: number;
  source_titulo?: string;
  qt_citacao: number;
  doi?: string;
  link?: string;
  resumo?: string;
  issn?: string;
  isbn?: string;
  issn_isbn?: string;
  language_of_original_document?: string;
  document_type?: string;
  open_access?: string;
}

export interface PalavraChave {
  id: number;
  palavra_chave: string;
}

export interface Referencia {
  id: number;
  conteudo_referencia?: string;
}

export interface ArtigoComDetalhes extends Artigo {
  autores?: Autor[];
  palavras_chaves?: PalavraChave[];
  referencias?: Referencia[];
}
