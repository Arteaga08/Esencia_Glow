interface SearchableOption {
  value: string;
  label: string;
}

/** Minúsculas y sin acentos: "mexico" encuentra "México". */
function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

/** Opciones que contienen el texto; las que empiezan con él, primero. Sin texto, todas. */
function filterOptions<T extends SearchableOption>(options: T[], query: string): T[] {
  const needle = normalize(query);
  if (needle === "") return options;
  const matches = options.filter((option) => normalize(option.label).includes(needle));
  return [...matches.filter((o) => normalize(o.label).startsWith(needle)), ...matches.filter((o) => !normalize(o.label).startsWith(needle))];
}

export { filterOptions, normalize };
export type { SearchableOption };
