/** Sponsor originali (GDD §2). Budget annuo indicativo in crediti. */
export interface SponsorContent {
  name: string;
  industry: string;
  country: string;
  budget: [number, number];
}

export const SPONSORS: SponsorContent[] = [
  { name: 'Voltaris Energy', industry: 'energia', country: 'ITA', budget: [2_000_000, 6_000_000] },
  { name: 'Nexora Telecom', industry: 'telecomunicazioni', country: 'ESP', budget: [3_000_000, 9_000_000] },
  { name: 'Fulmine Drinks', industry: 'bevande', country: 'ITA', budget: [1_000_000, 4_000_000] },
  { name: 'Kestrel Watches', industry: 'orologi', country: 'GBR', budget: [800_000, 3_000_000] },
  { name: 'Aurum Bank', industry: 'finanza', country: 'SUI', budget: [4_000_000, 12_000_000] },
  { name: 'Helix Helmets', industry: 'abbigliamento tecnico', country: 'FRA', budget: [300_000, 1_500_000] },
  { name: 'Pantera Apparel', industry: 'abbigliamento', country: 'ITA', budget: [500_000, 2_000_000] },
  { name: 'Orvane Motors', industry: 'motori', country: 'GBR', budget: [1_500_000, 5_000_000] },
  { name: 'Petrava Fuels', industry: 'carburanti', country: 'NED', budget: [2_000_000, 7_000_000] },
  { name: 'Velgrip Tyres', industry: 'pneumatici', country: 'GER', budget: [1_000_000, 4_000_000] },
  { name: 'Cortex Dynamics', industry: 'elettronica', country: 'USA', budget: [1_000_000, 3_500_000] },
  { name: 'Sakura Trading', industry: 'commercio', country: 'JPN', budget: [800_000, 3_000_000] },
  { name: 'Nordvik Energi', industry: 'energia', country: 'NOR', budget: [1_200_000, 4_000_000] },
  { name: 'Mistral Air', industry: 'trasporti', country: 'FRA', budget: [1_000_000, 3_000_000] },
  { name: 'Siam Speed Co.', industry: 'logistica', country: 'THA', budget: [400_000, 1_500_000] },
  { name: 'Tidewater Logistics', industry: 'logistica', country: 'AUS', budget: [600_000, 2_000_000] },
  { name: 'Quantica Software', industry: 'tecnologia', country: 'USA', budget: [2_000_000, 8_000_000] },
  { name: 'Ferrox Brakes', industry: 'componentistica', country: 'ITA', budget: [500_000, 1_800_000] },
  { name: 'Granada Café', industry: 'alimentare', country: 'ESP', budget: [300_000, 1_200_000] },
  { name: 'Lumen Optics', industry: 'ottica', country: 'GER', budget: [400_000, 1_600_000] },
];
