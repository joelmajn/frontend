import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, CreditCard, ShoppingCart, History, Home } from "lucide-react";

export default function NavigationMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="text-white hover:bg-white hover:bg-opacity-20">
          <MoreVertical className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem asChild>
          <Link href="/" className="flex items-center gap-2 w-full">
            <Home className="h-4 w-4" />
            Dashboard
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/cards" className="flex items-center gap-2 w-full">
            <CreditCard className="h-4 w-4" />
            Cartões Registrados
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/purchases" className="flex items-center gap-2 w-full">
            <ShoppingCart className="h-4 w-4" />
            Compras Registradas
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/invoice-history" className="flex items-center gap-2 w-full">
            <History className="h-4 w-4" />
            Histórico de Faturas
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}