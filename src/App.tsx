import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import { PollRotationProvider } from "./contexts/pollRotation";
import { useVisitLogger } from "./hooks/useVisitLogger";
import Dashboard from "./pages/Dashboard";
import PlayPage from "./pages/PlayPage";
import ManagerPage from "./pages/ManagerPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppInner() {
  useVisitLogger();
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/tv" element={<Dashboard />} />
        <Route path="/play" element={<PlayPage />} />
        <Route path="/manager" element={<ManagerPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </HashRouter>
  );
}


const App = () => (
  <QueryClientProvider client={queryClient}>
    <Sonner />
    <PollRotationProvider>
      <AppInner />
    </PollRotationProvider>
  </QueryClientProvider>
);

export default App;
