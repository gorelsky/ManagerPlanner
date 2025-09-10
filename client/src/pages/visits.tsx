import BottomNavigation from "@/components/bottom-navigation";

export default function Visits() {
  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="bg-blue-header text-white px-4 py-6">
        <h1 className="text-lg font-semibold text-center">Визит Эквивалент</h1>
      </header>

      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-foreground mb-4">Раздел в разработке</h2>
          <p className="text-muted-foreground">
            Функционал визит эквивалентов будет добавлен в ближайшее время
          </p>
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
}
