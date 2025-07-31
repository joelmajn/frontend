import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import PurchaseHistory from "@/pages/purchase-history";
import CardsPage from "@/pages/cards";
import PurchasesPage from "@/pages/purchases";
import InvoiceHistoryPage from "@/pages/invoice-history";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/history" component={PurchaseHistory} />
      <Route path="/cards" component={CardsPage} />
      <Route path="/purchases" component={PurchasesPage} />
      <Route path="/invoice-history" component={InvoiceHistoryPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
