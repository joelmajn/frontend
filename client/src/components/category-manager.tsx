import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";

interface CategoryManagerProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Array<{ value: string; label: string }>;
  onCategoriesChange: (categories: Array<{ value: string; label: string }>) => void;
}

export default function CategoryManager({ 
  isOpen, 
  onClose, 
  categories, 
  onCategoriesChange 
}: CategoryManagerProps) {
  const [newCategoryName, setNewCategoryName] = useState("");

  const handleAddCategory = () => {
    if (newCategoryName.trim()) {
      const categoryValue = newCategoryName.toLowerCase().replace(/\s+/g, '_');
      const newCategory = {
        value: categoryValue,
        label: newCategoryName.trim()
      };
      
      // Check if category already exists
      if (!categories.find(c => c.value === categoryValue)) {
        onCategoriesChange([...categories, newCategory]);
        setNewCategoryName("");
      }
    }
  };

  const handleDeleteCategory = (categoryValue: string) => {
    // Don't allow deletion of default categories
    const defaultCategories = ['alimentacao', 'eletronicos', 'combustivel', 'vestuario', 'saude', 'outros'];
    if (defaultCategories.includes(categoryValue)) {
      return;
    }
    
    onCategoriesChange(categories.filter(c => c.value !== categoryValue));
  };

  const isDefaultCategory = (categoryValue: string) => {
    const defaultCategories = ['alimentacao', 'eletronicos', 'combustivel', 'vestuario', 'saude', 'outros'];
    return defaultCategories.includes(categoryValue);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gerenciar Categorias</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add new category */}
          <div className="flex gap-2">
            <Input
              placeholder="Nova categoria"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleAddCategory();
                }
              }}
            />
            <Button
              onClick={handleAddCategory}
              size="sm"
              className="bg-primary hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Category list */}
          <div className="space-y-2 max-h-60 overflow-y-auto">
            <h4 className="text-sm font-medium text-gray-700">Categorias Disponíveis:</h4>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <div key={category.value} className="flex items-center gap-1">
                  <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-200">
                    {category.label}
                  </Badge>
                  {!isDefaultCategory(category.value) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                      onClick={() => handleDeleteCategory(category.value)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
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