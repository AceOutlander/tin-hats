/**
 * The Stalingrad campaign's situation map (docs/campaigns/STALINGRAD.md, "Map region"): the western USSR from the Bug
 * to the Volga, lon 22 to 47 E, lat 46 to 57.5 N. The land is the whole sheet; the seas (the Gulf of Riga, the Black
 * Sea and the Sea of Azov) are cut out of it. Rivers: the Bug, the Dnieper with the Pripyat, the Don, the Volga and a
 * stub of the Moskva; the Pripyat marshes are shaded. The front lines by date come from the usual campaign atlases
 * (docs/campaigns/HISTORY.md) and are drawn at "recognisable at phone size" accuracy, like every shape here.
 *
 * Flat [lon, lat, lon, lat, ...] arrays in degrees. Lines and rings may run past the map edge; the canvas clips them.
 */
import type { CampaignMapDef, MapFront, MapLabel, MapRiver, MapShape } from './campaignMap';

const LAND: readonly MapShape[] = [{ name: 'sheet', pts: [19, 60, 50, 60, 50, 43, 19, 43] }];

const WATER: readonly MapShape[] = [
  {
    name: 'gulfOfRiga',
    pts: [22.3, 58.6, 22.6, 57.76, 22.75, 57.55, 23.05, 57.33, 23.25, 57.15, 23.6, 56.97, 24.1, 57.03, 24.35, 57.25, 24.38, 57.62, 24.3, 58.6],
  },
  {
    name: 'blackSea',
    pts: [
      27.5, 44, 29.6, 45.2, 29.8, 45.6, 30.2, 45.9, 30.5, 46.2, 30.75, 46.48, 31.2, 46.62, 31.55, 46.62, 32.0, 46.5, 31.6, 46.35, 32.2,
      46.15, 33.0, 46.08, 33.55, 46.15, 33.7, 46.0, 33.6, 45.6, 33.6, 44.5, 32, 44,
    ],
  },
  {
    name: 'seaOfAzov',
    pts: [
      34.8, 46.18, 35.4, 46.37, 35.9, 46.62, 36.8, 46.75, 37.55, 47.08, 38.2, 47.1, 38.9, 47.2, 39.25, 47.15, 39.0, 46.95, 38.6, 46.8,
      38.27, 46.71, 38.1, 46.4, 38.17, 46.05, 37.9, 45.6, 36.8, 45.35, 35.5, 45.3, 35.1, 45.6, 35.0, 45.95,
    ],
  },
];

const MARSH: readonly MapShape[] = [
  { name: 'pripyat', pts: [24.3, 52.35, 25.4, 52.55, 26.6, 52.7, 28.0, 52.6, 29.4, 52.3, 29.9, 51.75, 28.9, 51.35, 27.4, 51.35, 26.0, 51.45, 24.9, 51.6, 24.25, 51.95] },
];

const RIVERS: readonly MapRiver[] = [
  // The Volga leaves the sheet twice: north of Uglich (it runs on to Yaroslavl) and east of Nizhny Novgorod (to Kazan
  // and Samara); it comes back past Syzran and runs down by Saratov and Kamyshin to Stalingrad and Astrakhan.
  {
    name: 'volgaUpper',
    major: true,
    pts: [32.5, 57.25, 33.1, 57.0, 33.6, 56.8, 34.3, 56.26, 34.9, 56.45, 35.4, 56.75, 35.9, 56.86, 36.5, 56.75, 37.15, 56.73, 37.6, 56.95, 38.3, 57.5, 38.85, 58.05, 38.9, 58.6],
  },
  { name: 'volgaMiddle', major: true, pts: [41.5, 57.85, 42.15, 57.44, 43.1, 57.32, 43.5, 56.65, 44.0, 56.33, 44.5, 56.12, 46.0, 56.13, 47.6, 56.1] },
  {
    name: 'volgaLower',
    major: true,
    pts: [
      48.4, 53.2, 47.4, 52.05, 46.03, 51.53, 45.9, 51.0, 45.4, 50.1, 45.1, 49.6, 44.82, 49.05, 44.53, 48.86, 44.52, 48.71, 44.58, 48.52, 45.3,
      48.2, 46.1, 48.06, 46.7, 47.7, 47.25, 47.25, 47.8, 46.9,
    ],
  },
  {
    name: 'don',
    major: true,
    pts: [
      38.3, 53.95, 38.6, 53.4, 38.9, 52.9, 39.0, 52.4, 39.05, 51.9, 39.1, 51.55, 39.5, 51.0, 39.9, 50.6, 40.1, 50.45, 40.5, 50.1, 41.0, 49.85, 41.7,
      49.62, 42.2, 49.62, 42.74, 49.56, 43.07, 49.31, 43.4, 49.0, 43.6, 48.75, 43.0, 48.2, 42.1, 47.65, 41.1, 47.58, 40.3, 47.45, 39.7, 47.22,
      39.25, 47.12,
    ],
  },
  {
    name: 'dnieper',
    major: true,
    pts: [
      33.4, 55.95, 32.9, 55.0, 32.05, 54.78, 31.0, 54.6, 30.4, 54.5, 30.33, 53.9, 30.05, 53.1, 30.4, 52.37, 30.8, 51.95, 30.5, 51.2, 30.52,
      50.45, 31.3, 49.9, 32.0, 49.45, 33.4, 49.07, 34.3, 48.8, 35.05, 48.46, 35.15, 47.85, 34.4, 47.57, 33.4, 47.1, 32.6, 46.63, 32.0, 46.5,
    ],
  },
  { name: 'pripyat', pts: [24.0, 51.9, 25.5, 52.1, 26.1, 52.1, 27.5, 52.2, 28.8, 51.8, 29.6, 51.55, 30.5, 51.25] },
  { name: 'bug', pts: [24.4, 49.9, 24.27, 50.48, 23.9, 50.8, 23.8, 51.18, 23.55, 51.55, 23.65, 52.08, 22.66, 52.4, 21.9, 52.7, 21.0, 52.5] },
  { name: 'moskva', pts: [35.9, 55.55, 36.6, 55.6, 37.62, 55.75, 38.2, 55.4, 38.75, 55.1] },
];

const LABELS: readonly MapLabel[] = [
  { text: 'U.S.S.R.', lon: 40.6, lat: 54.2, kind: 'country' },
  { text: 'UKRAINE', lon: 33.4, lat: 50.3, kind: 'region' },
  { text: 'BYELORUSSIA', lon: 28.2, lat: 54.6, kind: 'region' },
  { text: 'ROMANIA', lon: 25.6, lat: 46.6, kind: 'region' },
  { text: 'PRIPYAT MARSHES', lon: 27.2, lat: 52.0, kind: 'region' },
  { text: 'BLACK SEA', lon: 31.6, lat: 46.25, kind: 'sea' },
  { text: 'SEA OF AZOV', lon: 36.6, lat: 46.25, kind: 'sea' },
  { text: 'VOLGA', lon: 45.95, lat: 50.6, kind: 'river', angle: -62 },
  { text: 'DON', lon: 40.75, lat: 50.2, kind: 'river', angle: 28 },
  { text: 'DNIEPER', lon: 31.45, lat: 49.35, kind: 'river', angle: 22 },
  { text: 'Brest', lon: 23.66, lat: 52.09, kind: 'city' },
  { text: 'Minsk', lon: 27.56, lat: 53.9, kind: 'city' },
  { text: 'Kiev', lon: 30.52, lat: 50.45, kind: 'city' },
  { text: 'Moscow', lon: 37.62, lat: 55.75, kind: 'city' },
  { text: 'Kalinin', lon: 35.9, lat: 56.86, kind: 'city' },
  { text: 'Klin', lon: 36.73, lat: 56.33, kind: 'city' },
  { text: 'Voronezh', lon: 39.2, lat: 51.67, kind: 'city' },
  { text: 'Rostov', lon: 39.7, lat: 47.24, kind: 'city' },
  { text: 'Stalingrad', lon: 44.52, lat: 48.71, kind: 'city' },
  { text: 'Kalach', lon: 43.53, lat: 48.69, kind: 'city' },
];

/**
 * The front by date. The 1941 frontier ran down the Bug past Brest to the San and the Carpathians, then along the
 * Prut. By 27 June the panzer groups were at Daugavpils and Minsk and fighting at Dubno; by mid-November they stood
 * before Moscow and Tula and on the Mius; by 5 December they were at their nearest to Moscow (Klin, the Yakhroma
 * bridgehead, Krasnaya Polyana). In September 1942 the line ran from the Rzhev salient down to Voronezh, along the Don
 * and into Stalingrad to the Volga bank; on 10 January 1943 the Sixth Army was a pocket west of the city and the outer
 * front had been pushed back beyond the Chir to the Donets.
 */
const FRONTS: readonly MapFront[] = [
  {
    date: '1941-06-22',
    label: '22 June 1941',
    lines: [
      [
        21.0, 58.6, 21.0, 55.4, 22.0, 54.9, 22.8, 54.35, 22.6, 53.6, 22.0, 53.0, 21.9, 52.7, 22.66, 52.4, 23.6, 52.12, 23.55, 51.55, 23.8,
        51.18, 23.9, 50.8, 24.27, 50.48, 23.4, 50.2, 22.68, 50.0, 22.77, 49.78, 22.6, 49.4, 22.9, 49.05, 24.0, 48.5, 25.2, 47.85, 26.0, 48.0,
        26.8, 48.27, 27.8, 47.2, 28.2, 46.5, 28.2, 45.0,
      ],
    ],
  },
  {
    date: '1941-06-27',
    label: '27 June 1941',
    lines: [
      [
        21.0, 58.6, 21.5, 57.1, 23.6, 56.4, 26.3, 56.05, 27.0, 55.6, 27.3, 55.0, 28.0, 54.2, 27.8, 53.0, 26.6, 52.4, 25.2, 51.9, 25.0, 51.3,
        25.5, 50.85, 25.9, 50.5, 25.4, 50.1, 24.4, 49.95, 23.5, 49.8, 22.9, 49.4, 22.9, 49.05, 24.0, 48.5, 25.2, 47.85, 26.0, 48.0, 26.8,
        48.27, 27.8, 47.2, 28.2, 46.5, 28.2, 45.0,
      ],
    ],
  },
  {
    date: '1941-11-16',
    label: '16 November 1941',
    lines: [
      [
        32.0, 58.6, 32.6, 57.4, 33.6, 56.95, 35.0, 57.1, 35.9, 57.05, 36.3, 56.85, 36.1, 56.3, 36.15, 55.95, 36.3, 55.7, 36.7, 55.42, 37.0,
        55.0, 37.05, 54.5, 37.5, 54.25, 37.9, 54.05, 38.1, 53.3, 37.8, 52.6, 37.3, 52.0, 37.1, 51.4, 37.3, 50.6, 37.6, 50.0, 37.8, 49.0, 38.3,
        48.5, 38.9, 47.9, 39.5, 47.45, 39.4, 47.15, 38.5, 46.5, 37.0, 45.0,
      ],
    ],
  },
  {
    date: '1941-12-05',
    label: '5 December 1941',
    lines: [
      [
        32.0, 58.6, 32.6, 57.4, 33.6, 56.95, 35.0, 57.1, 35.9, 57.05, 36.6, 56.75, 37.0, 56.5, 37.4, 56.3, 37.35, 55.98, 37.1, 55.85, 36.9,
        55.55, 36.8, 55.35, 37.2, 55.0, 37.1, 54.55, 37.5, 54.3, 38.0, 54.7, 38.5, 54.4, 38.9, 54.0, 38.6, 53.3, 38.6, 52.6, 37.6, 52.0, 37.4,
        51.3, 37.5, 50.4, 37.8, 49.4, 38.2, 48.6, 38.9, 47.9, 39.0, 47.3, 38.85, 47.1, 38.5, 46.5, 37.0, 45.0,
      ],
    ],
  },
  {
    date: '1942-09-13',
    label: '13 September 1942',
    lines: [
      [
        31.0, 58.6, 31.4, 57.6, 32.4, 57.2, 31.6, 56.5, 32.8, 56.0, 34.3, 56.4, 35.0, 56.0, 35.0, 55.55, 35.3, 54.75, 35.0, 54.1, 36.0, 53.45,
        36.6, 52.9, 37.6, 52.3, 38.6, 52.0, 39.2, 51.7, 39.6, 51.0, 40.2, 50.4, 40.9, 50.05, 41.7, 49.55, 42.5, 49.5, 43.1, 49.25, 43.8, 49.1,
        44.2, 48.95, 44.5, 48.86, 44.5, 48.71, 44.55, 48.6, 44.4, 48.5, 44.2, 48.2, 44.0, 47.6, 44.5, 46.6, 45.6, 45.0,
      ],
    ],
  },
  {
    date: '1943-01-10',
    label: '10 January 1943',
    lines: [
      [
        31.0, 58.6, 31.4, 57.6, 32.4, 57.2, 31.6, 56.5, 32.8, 56.0, 34.3, 56.4, 35.0, 56.0, 35.0, 55.55, 35.3, 54.75, 35.0, 54.1, 36.0, 53.45,
        36.6, 52.9, 37.6, 52.3, 38.6, 52.0, 39.2, 51.7, 39.6, 51.0, 40.1, 50.45, 40.3, 50.0, 40.0, 49.3, 40.5, 48.7, 41.0, 48.3, 41.5, 47.7,
        42.1, 47.3, 42.6, 46.6, 43.2, 45.0,
      ],
    ],
    pockets: [[43.6, 48.95, 44.15, 48.97, 44.53, 48.86, 44.55, 48.62, 44.3, 48.52, 43.85, 48.58, 43.62, 48.75]],
  },
];

export const STALINGRAD_MAP: CampaignMapDef = {
  bounds: { lonMin: 22, lonMax: 47, latMin: 46, latMax: 57.5 },
  land: LAND,
  water: WATER,
  labels: LABELS,
  rivers: RIVERS,
  marsh: MARSH,
  fronts: FRONTS,
  cartouche: { title: 'SITUATION MAP', region: 'WESTERN U.S.S.R.', dates: '1941 – 1943', lon: 25.6, lat: 47.6 },
  compass: { lon: 23.4, lat: 55.6 },
  grainSeed: 1941,
};
