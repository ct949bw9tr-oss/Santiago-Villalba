export interface CustomerSeed {
  firstName: string;
  lastName: string;
  city: string;
}

export const SEED_CUSTOMERS: CustomerSeed[] = [
  { firstName: "Santiago", lastName: "Villalba", city: "Bogotá" },
  { firstName: "Juan Pablo", lastName: "Duarte", city: "Bogotá" },
  { firstName: "María José", lastName: "Cárdenas", city: "Medellín" },
  { firstName: "Camilo", lastName: "Andrade", city: "Cali" },
  { firstName: "Lucía", lastName: "Fernández", city: "Barranquilla" },
  { firstName: "Sofía", lastName: "Restrepo", city: "Cartagena" },
  { firstName: "Nicolás", lastName: "Peña", city: "Bogotá" },
  { firstName: "Gabriela", lastName: "Nieto", city: "Medellín" },
];

export function customerKey(c: CustomerSeed): string {
  return `${c.firstName} ${c.lastName}`;
}
