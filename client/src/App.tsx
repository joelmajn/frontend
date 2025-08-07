import React, { useState, useEffect } from 'react';
import { Route, Switch } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { AuthManager } from "@/lib/auth";
import AuthScreen from "@/components/AuthScreen";
import Dashboard from "@/pages/dashboard";
import Cards from "@/pages/cards";
import Purchases from "@/pages/purchases";
import InvoiceHistory from "@/pages/invoice-history";
import Subscriptions from "@/pages/subscriptions";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Verificar se usuário está autenticado
    const checkAuth = () => {
      const authenticated = AuthManager.isAuthenticated();
      setIsAuthenticated(authenticated);
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const handleAuthenticated = () => {
    setIsAuthenticated(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen onAuthenticated={handleAuthenticated} />;
  }

  return (
    <>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/cards" component={Cards} />
        <Route path="/purchases" component={Purchases} />
        <Route path="/invoice-history" component={InvoiceHistory} />
        <Route path="/subscriptions" component={Subscriptions} />
        <Route>
          <Dashboard />
        </Route>
      </Switch>
      <Toaster />
    </>
  );
}