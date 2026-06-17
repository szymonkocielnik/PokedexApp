import { Component } from '@angular/core';
import { Index } from './index';

interface Pokemon {
  name: string;
  height: number;
  weight: number;
}

@Component({
  selector: 'app-root',
  imports: [
    Index
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})

export class App {
  url: string = 'https://pokeapi.co/api/v2/pokemon/';

  protected znajdz(value: string) {
    getData((this.url + value));
  }
}

async function getData(endpoint: string): Promise<void> {
  const response = await fetch(endpoint);
  const data: Pokemon = await response.json();
  console.log(data.name + ': ' + data.height + ': ' + data.weight);
}

async function showAllPokemon() {

}
