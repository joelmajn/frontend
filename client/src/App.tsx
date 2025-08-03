import { Route, Switch } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import Dashboard from "@/pages/dashboard";
import Cards from "@/pages/cards";
import Purchases from "@/pages/purchases";
import InvoiceHistory from "@/pages/invoice-history";

export default function App() {
  return (
    <>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/cards" component={Cards} />
        <Route path="/purchases" component={Purchases} />
        <Route path="/invoice-history" component={InvoiceHistory} />
        <Route>
          <Dashboard />
        </Route>
      </Switch>
      <Toaster />
    </>
  );
}