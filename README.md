# Scopus Articles Viewer 📚

Uma aplicação web moderna e responsiva construída com React, Vite e Supabase para importar, gerenciar e visualizar grandes volumes de artigos acadêmicos exportados da base de dados Scopus.

## 🔗 Live Demo (GitHub Pages)

O projeto está disponível e hospedado no GitHub Pages:  
👉 **[https://Angela-Vidal.github.io/scopus-articles/](https://Angela-Vidal.github.io/scopus-articles/)**

---

## ✨ Funcionalidades

- **Dashboard Interativo:** Visão geral de métricas, como total de artigos, autores e soma de citações.
- **Importação de CSV do Scopus:** Uma ferramenta inteligente de importação (Batch Insert/Upsert) para extrair e organizar artigos, autores, palavras-chave e referências diretamente de arquivos `.csv` do Scopus.
- **Visualização Detalhada:**
  - 📄 **Artigos:** Listagem paginada (Server-Side) de artigos com ordenação, pesquisa e filtros por Título.
  - 👥 **Autores:** Navegue por autores e veja seus respectivos artigos.
  - 🏷️ **Palavras-chave:** Explore artigos usando palavras-chave pesquisadas e estruturadas.
  - 📖 **Referências:** Visualize tabelas de referências extraídas dos metadados dos artigos.
- **Integração com Supabase:** Banco de dados em nuvem veloz que utiliza relacionamentos eficientes e queries otimizadas em PostgreSQL para gerenciar dados enormes.
- **UI Responsiva e Moderna:** Construída utilizando Tailwind CSS e componentes customizados para uma experiência fluida tanto no Desktop quanto no Mobile.

## 🛠️ Tecnologias Utilizadas

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Lucide React (Ícones), Recharts (Gráficos)
- **Backend/Database:** Supabase (PostgreSQL, Auth)
- **Bibliotecas Auxiliares:** PapaParse (Processamento de CSV), React Router DOM (Roteamento)
- **Deploy:** GitHub Pages + Vite

## 🚀 Como executar localmente

1. **Clone este repositório:**

   ```bash
   git clone https://github.com/Angela-Vidal/scopus-articles.git
   cd scopus-articles
   ```

2. **Instale as dependências:**

   ```bash
   npm install
   ```

3. **Configuração de Variáveis de Ambiente:**
   - Renomeie o arquivo `.env.example` para `.env` (se houver) ou crie um arquivo `.env` na raiz do projeto.
   - Adicione suas credenciais do Supabase (URL e chaves públicas). A configuração do Applet usa o arquivo `firebase-applet-config.json` e credenciais seguras para o projeto.
4. **Execute o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```
   A aplicação estará disponível em `http://localhost:3000`.

---

## 🏗️ Como fazer o Deploy para o GitHub Pages

### 1. Preparando o repositório

Garanta que no arquivo `vite.config.ts`, você tem a opção `base` configurada com o nome do seu repositório:

```typescript
export default defineConfig({
  base: "/scopus-articles/", // Nome exato do seu repositório
  // ... resto da configuração
});
```

_(Esta etapa já está feita no código atual!)_

### 2. Configurando o GitHub Actions

Para que o deploy seja automático a cada "push" na branch `main`, basta ter um arquivo `.github/workflows/deploy.yml` no seu repositório do GitHub. Aqui utilizamos uma Action oficial para o Vite.

### 3. Configurando a página no GitHub

1. Vá até o seu repositório no GitHub.
2. Clique na aba **Settings** (Configurações).
3. No menu lateral esquerdo, selecione **Pages**.
4. Em **Build and deployment**, no tópico `Source`, escolha **GitHub Actions**.

Uma vez configurado, cada `git push origin main` começará um "Action" automático que fará o build do Vite e publicará na URL final!

---

💡 _Desenvolvido para análise estruturada de literatura acadêmica._
