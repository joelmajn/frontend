import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, RotateCcw } from "lucide-react";

interface Category {
  value: string;
  label: string;
  isDefault?: boolean;
  isRecurring?: boolean;
}

interface CategoryManagerProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onCategoriesChange: (categories: Category[]) => void;
}

// Categorias padrão do sistema
const DEFAULT_CATEGORIES: Category[] = [
  { value: "alimentacao", label: "Alimentação", isDefault: true },
  { value: "eletronicos", label: "Eletrônicos", isDefault: true },
  { value: "combustivel", label: "Combustível", isDefault: true },
  { value: "vestuario", label: "Vestuário", isDefault: true },
  { value: "saude", label: "Saúde", isDefault: true },
  { value: "assinatura", label: "Assinatura", isDefault: true, isRecurring: true },
  { value: "outros", label: "Outros", isDefault: true },
];

// Chave para localStorage
const STORAGE_KEY = "custom_categories";

export default function CategoryManager({ 
  isOpen, 
  onClose, 
  categories, 
  onCategoriesChange 
}: CategoryManagerProps) {
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [allCategories, setAllCategories] = useState<Category[]>([]);

  // Carregar categorias do localStorage ao abrir
  useEffect(() => {
    if (isOpen) {
      loadCategoriesFromStorage();
    }
  }, [isOpen]);

  // Salvar categorias no localStorage sempre que mudar
  useEffect(() => {
    if (allCategories.length > 0) {
      saveCategoriestoStorage();
      onCategoriesChange(allCategories);
    }
  }, [allCategories, onCategoriesChange]);

  const loadCategoriesFromStorage = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      
      if (stored) {
        const customCategories = JSON.parse(stored);
        // Mesclar categorias padrão com customizadas, removendo duplicatas
        const merged = mergeCategories(DEFAULT_CATEGORIES, customCategories);
        setAllCategories(merged);
      } else {
        // Primeira vez - usar apenas categorias padrão
        setAllCategories([...DEFAULT_CATEGORIES]);
      }
    } catch (error) {
      console.error("Erro ao carregar categorias:", error);
      setAllCategories([...DEFAULT_CATEGORIES]);
    }
  };

  const saveCategoriestoStorage = () => {
    try {
      // Salvar apenas categorias customizadas e modificações das padrão
      const toSave = allCategories.filter(cat => 
        !cat.isDefault || 
        !DEFAULT_CATEGORIES.find(def => 
          def.value === cat.value && 
          def.label === cat.label &&
          def.isRecurring === cat.isRecurring
        )
      );
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (error) {
      console.error("Erro ao salvar categorias:", error);
    }
  };

  const mergeCategories = (defaultCats: Category[], customCats: Category[]): Category[] => {
    const merged = [...defaultCats];
    
    customCats.forEach(customCat => {
      const existingIndex = merged.findIndex(cat => cat.value === customCat.value);
      
      if (existingIndex >= 0) {
        // Atualizar categoria existente
        merged[existingIndex] = { ...merged[existingIndex], ...customCat };
      } else {
        // Adicionar nova categoria
        merged.push(customCat);
      }
    });
    
    return merged;
  };

  const handleAddCategory = () => {
    if (newCategoryName.trim()) {
      const categoryValue = newCategoryName.toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
      
      const newCategory: Category = {
        value: categoryValue,
        label: newCategoryName.trim(),
        isDefault: false,
        isRecurring: isRecurring
      };
      
      // Verificar se categoria já existe
      if (!allCategories.find(c => c.value === categoryValue)) {
        setAllCategories(prev => [...prev, newCategory]);
        setNewCategoryName("");
        setIsRecurring(false);
      }
    }
  };

  const handleDeleteCategory = (categoryValue: string) => {
    setAllCategories(prev => prev.filter(c => c.value !== categoryValue));
  };

  const handleToggleRecurring = (categoryValue: string) => {
    setAllCategories(prev => 
      prev.map(cat => 
        cat.value === categoryValue 
          ? { ...cat, isRecurring: !cat.isRecurring }
          : cat
      )
    );
  };

  const resetToDefaults = () => {
    if (confirm("Tem certeza que deseja restaurar as categorias padrão? Isso irá remover todas as categorias customizadas.")) {
      setAllCategories([...DEFAULT_CATEGORIES]);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar Categorias</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Informação sobre assinaturas */}
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="text-sm font-medium text-blue-900 mb-1">
              💡 Categoria "Assinatura"
            </h4>
            <p className="text-xs text-blue-700">
              Compras marcadas como "Assinatura" são consideradas recorrentes e aparecem automaticamente todos os meses.
            </p>
          </div>

          {/* Adicionar nova categoria */}
          <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700">Adicionar Nova Categoria:</h4>
            
            <div className="flex gap-2">
              <Input
                placeholder="Nome da categoria"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAddCategory();
                  }
                }}
                className="flex-1"
              />
              <Button
                onClick={handleAddCategory}
                size="sm"
                className="bg-primary hover:bg-blue-700"
                disabled={!newCategoryName.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="recurring"
                checked={isRecurring}
                onCheckedChange={setIsRecurring}
              />
              <label htmlFor="recurring" className="text-sm text-gray-600">
                Categoria recorrente (aparece todos os meses)
              </label>
            </div>
          </div>

          {/* Lista de categorias */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-700">Categorias Disponíveis:</h4>
              <Button
                variant="outline"
                size="sm"
                onClick={resetToDefaults}
                className="text-orange-600 hover:text-orange-700"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Restaurar Padrão
              </Button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {allCategories.map((category) => (
                <div key={category.value} className="flex items-center justify-between p-2 bg-white rounded border">
                  <div className="flex items-center gap-2 flex-1">
                    <Badge 
                      className={`
                        ${category.isRecurring 
                          ? 'bg-purple-100 text-purple-700 border-purple-200' 
                          : 'bg-gray-100 text-gray-700 border-gray-200'
                        }
                      `}
                    >
                      {category.label}
                      {category.isRecurring && " 🔄"}
                    </Badge>
                    
                    {category.isDefault && (
                      <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                        Padrão
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Toggle recorrente */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-7 w-7 p-0 ${
                        category.isRecurring 
                          ? 'text-purple-600 hover:text-purple-700' 
                          : 'text-gray-400 hover:text-purple-600'
                      }`}
                      onClick={() => handleToggleRecurring(category.value)}
                      title={category.isRecurring ? "Remover recorrência" : "Tornar recorrente"}
                    >
                      🔄
                    </Button>

                    {/* Deletar categoria */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                      onClick={() => handleDeleteCategory(category.value)}
                      title="Excluir categoria"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Estatísticas */}
          <div className="text-xs text-gray-500 p-2 bg-gray-50 rounded">
            <p>Total: {allCategories.length} categorias</p>
            <p>Recorrentes: {allCategories.filter(c => c.isRecurring).length}</p>
            <p>Customizadas: {allCategories.filter(c => !c.isDefault).length}</p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
            >
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}