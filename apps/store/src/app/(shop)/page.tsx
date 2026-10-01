// Marcador temporal: el hero (3.1.2) reemplaza este bloque. Sirve para ver
// el header transparente sobre un fondo y el cambio al hacer scroll.
export default function HomePage() {
  return (
    <main>
      <section className="flex min-h-svh items-end bg-primary/40 px-4 pb-16 md:px-8 lg:px-12">
        <h1 className="text-display text-foreground">Esencia Glow</h1>
      </section>
      <section className="min-h-svh px-4 py-16 md:px-8 lg:px-12" />
    </main>
  );
}
