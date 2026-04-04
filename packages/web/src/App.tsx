import { Routes, Route } from "react-router-dom";
import Nav from "@/components/layout/Nav";
import Footer from "@/components/layout/Footer";
import Home from "@/pages/Home";
import Results from "@/pages/Results";
import HistoryResults from "@/pages/HistoryResults";
import History from "@/pages/History";
import Login from "@/pages/Login";
import Settings from "@/pages/Settings";
import Compare from "@/pages/Compare";
import NotFound from "@/pages/NotFound";
import { AuthProvider } from "@/hooks/use-auth";
import { ThemeProvider } from "@/hooks/use-theme";

export default function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <div className="min-h-screen bg-background text-foreground">
        <Nav />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/results/:url" element={<Results />} />
            <Route path="/history" element={<History />} />
            <Route path="/history/:scanId" element={<HistoryResults />} />
            <Route path="/compare/:id1/:id2" element={<Compare />} />
            <Route path="/login" element={<Login />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </AuthProvider>
    </ThemeProvider>
  );
}
