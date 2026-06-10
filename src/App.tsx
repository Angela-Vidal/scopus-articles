import {
  Navigate,
  Route,
  HashRouter as Router,
  Routes,
} from "react-router-dom";
import { Layout } from "./components/Layout";
import { ArticlesPage } from "./pages/Articles";
import { AuthorsPage } from "./pages/Authors";
import { CoauthorsMapPage } from "./pages/CoauthorsMap";
import { DashboardPage } from "./pages/Dashboard";
import { KeywordMapPage } from "./pages/KeywordMap";
import { KeywordsPage } from "./pages/Keywords";
import { ReferencesPage } from "./pages/References";

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/artigos" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/artigos" element={<ArticlesPage />} />
          <Route path="/autores" element={<AuthorsPage />} />
          <Route path="/palavras-chave" element={<KeywordsPage />} />
          <Route path="/mapa-palavras-chave" element={<KeywordMapPage />} />
          <Route path="/mapa-coautoria" element={<CoauthorsMapPage />} />
          <Route path="/referencias" element={<ReferencesPage />} />
          <Route path="*" element={<Navigate to="/artigos" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
}
