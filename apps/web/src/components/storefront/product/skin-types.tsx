/** Renglón "Tipo de piel: Seca, Normal". Sin tipos no se pinta. */
function SkinTypes({ types }: { types: string[] }) {
  if (types.length === 0) return null;
  return (
    <p className="text-body text-foreground">
      <span className="font-mono text-label uppercase text-muted-foreground-strong">Tipo de piel</span>
      <span className="ml-3">{types.join(", ")}</span>
    </p>
  );
}

export { SkinTypes };
