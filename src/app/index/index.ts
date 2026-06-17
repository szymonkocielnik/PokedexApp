import { ChangeDetectorRef, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface PokemonStat {
  name: string;
  value: number;
}

interface Pokemon {
  id: string;
  name: string;
  image: string;
  height?: number;
  weight?: number;
  baseExperience?: number;
  types?: string[];
  abilities?: string[];
  stats?: PokemonStat[];
}

@Component({
  selector: 'app-index',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './index.html',
  styleUrl: './index.css',
})
export class Index {
  allPokemon: Pokemon[] = [];
  filteredPokemon: Pokemon[] = [];

  private visibleCount = 24;
  private readonly step = 24;
  private currentQuery = '';

  isTypeView = false;
  pokemonTypes: string[] = [];
  typeGroups: Record<string, Pokemon[]> = {};
  openTypes = new Set<string>();
  loadingTypes = false;
  loadingTypeNames = new Set<string>();

  selectedPokemon: Pokemon | null = null;
  loadingSelectedPokemon = false;

  private pokemonNameSet = new Set<string>();
  private prefetched = false;
  private pokemonDetailsCache: Record<string, Pokemon> = {};

  constructor(private cdr: ChangeDetectorRef) {}

  async ngOnInit(): Promise<void> {
    await this.loadAllPokemon();
    this.applyFilterAndVisibility();
    this.cdr.detectChanges();
  }

  async loadAllPokemon(): Promise<void> {
    const res = await fetch('https://pokeapi.co/api/v2/pokemon?limit=1302&offset=0');
    const data = await res.json();

    this.allPokemon = data.results.map((p: any) => {
      const id = p.url.split('/').slice(-2, -1)[0];

      return {
        id,
        name: p.name,
        image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`,
      };
    });

    this.pokemonNameSet = new Set(this.allPokemon.map((p) => p.name));
  }

  onSearch(value: string): void {
    this.currentQuery = value.toLowerCase().trim();
    this.applyFilterAndVisibility();
  }

  showMore(): void {
    this.visibleCount += this.step;
    this.applyFilterAndVisibility();
  }

  get canShowMore(): boolean {
    return (
      !this.currentQuery && !this.isTypeView && this.filteredPokemon.length < this.allPokemon.length
    );
  }

  onTypeViewToggle(enabled: boolean): void {
    this.isTypeView = enabled;
    this.cdr.detectChanges();

    if (enabled && this.pokemonTypes.length === 0) {
      void this.loadTypes();
    }

    if (enabled && !this.prefetched) {
      this.prefetched = true;
      void this.prefetchTypesInBackground();
    }
  }

  isTypeOpen(typeName: string): boolean {
    return this.openTypes.has(typeName);
  }

  async toggleType(typeName: string): Promise<void> {
    if (this.openTypes.has(typeName)) {
      this.openTypes.delete(typeName);
      this.cdr.detectChanges();
      return;
    }

    this.openTypes.add(typeName);
    this.cdr.detectChanges();

    if (!this.typeGroups[typeName]) {
      await this.loadPokemonsForType(typeName);
    }
  }

  async openStats(pokemon: Pokemon): Promise<void> {
    this.selectedPokemon = pokemon;
    this.loadingSelectedPokemon = true;
    this.cdr.detectChanges();

    if (this.pokemonDetailsCache[pokemon.name]) {
      this.selectedPokemon = this.pokemonDetailsCache[pokemon.name];
      this.loadingSelectedPokemon = false;
      this.cdr.detectChanges();
      return;
    }

    try {
      const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemon.name}`);
      const data = await res.json();

      const pokemonWithDetails: Pokemon = {
        ...pokemon,
        height: data.height,
        weight: data.weight,
        baseExperience: data.base_experience,
        types: data.types.map((typeData: any) => typeData.type.name),
        abilities: data.abilities.map((abilityData: any) => abilityData.ability.name),
        stats: data.stats.map((statData: any) => {
          return {
            name: statData.stat.name,
            value: statData.base_stat,
          };
        }),
      };

      this.pokemonDetailsCache[pokemon.name] = pokemonWithDetails;
      this.selectedPokemon = pokemonWithDetails;
    } finally {
      this.loadingSelectedPokemon = false;
      this.cdr.detectChanges();
    }
  }

  closeStats(): void {
    this.selectedPokemon = null;
  }

  trackByType(_: number, typeName: string): string {
    return typeName;
  }

  trackByPokemon(_: number, p: Pokemon): string {
    return p.name;
  }

  private async loadTypes(): Promise<void> {
    this.loadingTypes = true;
    this.cdr.detectChanges();

    try {
      const res = await fetch('https://pokeapi.co/api/v2/type');
      const data = await res.json();

      this.pokemonTypes = data.results
        .map((t: any) => t.name)
        .filter((name: string) => name !== 'unknown' && name !== 'shadow')
        .sort((a: string, b: string) => a.localeCompare(b));
    } finally {
      this.loadingTypes = false;
      this.cdr.detectChanges();
    }
  }

  private async prefetchTypesInBackground(): Promise<void> {
    if (this.pokemonTypes.length === 0) {
      await this.loadTypes();
    }

    const queue = [...this.pokemonTypes];
    const workersCount = 4;

    const worker = async () => {
      while (queue.length > 0) {
        const typeName = queue.shift();

        if (!typeName || this.typeGroups[typeName]) {
          continue;
        }

        await this.loadPokemonsForType(typeName, false);
      }
    };

    await Promise.all(Array.from({ length: workersCount }, () => worker()));
  }

  private async loadPokemonsForType(typeName: string, showLoading = true): Promise<void> {
    if (showLoading) {
      this.loadingTypeNames.add(typeName);
      this.cdr.detectChanges();
    }

    try {
      const res = await fetch(`https://pokeapi.co/api/v2/type/${typeName}`);
      const data = await res.json();

      const uniqueByName = new Map<string, Pokemon>();

      for (const entry of data.pokemon) {
        const p = entry.pokemon;

        if (!this.pokemonNameSet.has(p.name)) {
          continue;
        }

        const id = p.url.split('/').slice(-2, -1)[0];

        uniqueByName.set(p.name, {
          id,
          name: p.name,
          image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`,
        });
      }

      this.typeGroups[typeName] = Array.from(uniqueByName.values()).sort((a, b) =>
        a.name.localeCompare(b.name),
      );
    } finally {
      if (showLoading) {
        this.loadingTypeNames.delete(typeName);
      }

      this.cdr.detectChanges();
    }
  }

  private applyFilterAndVisibility(): void {
    if (!this.currentQuery) {
      this.filteredPokemon = this.allPokemon.slice(0, this.visibleCount);
      return;
    }

    this.filteredPokemon = this.allPokemon.filter((p) => p.name.startsWith(this.currentQuery));
  }
}
