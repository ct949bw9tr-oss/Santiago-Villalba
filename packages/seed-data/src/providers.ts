export interface ProviderSeed {
  firstName: string;
  lastName: string;
  city: string;
  category: string; // category slug
  subcategory: string; // subcategory slug
  service: string; // service slug
  headline: string;
  bio: string;
  years: number;
  rating: number;
  ratingCount: number;
  completedJobs: number;
  responseMinutes: number;
  pricingModel: "fixed" | "starting_at" | "hourly" | "custom_quote";
  price: number | null;
  verified: boolean;
}

export const SEED_PROVIDERS: ProviderSeed[] = [
  { firstName: "Andrés", lastName: "Ramírez", city: "Bogotá", category: "barberia", subcategory: "corte-cabello", service: "corte-hombre", headline: "Barbero", bio: "Barbero profesional con más de 8 años de experiencia en cortes clásicos y modernos.", years: 8, rating: 4.9, ratingCount: 126, completedJobs: 342, responseMinutes: 5, pricingModel: "fixed", price: 35000, verified: true },
  { firstName: "Valentina", lastName: "Morales", city: "Medellín", category: "belleza", subcategory: "maquillaje", service: "maquillaje-evento", headline: "Maquilladora profesional", bio: "Especialista en maquillaje de novias y eventos, formada en Bogotá y Miami.", years: 6, rating: 4.8, ratingCount: 89, completedJobs: 210, responseMinutes: 10, pricingModel: "starting_at", price: 85000, verified: true },
  { firstName: "Carlos", lastName: "Jiménez", city: "Barranquilla", category: "hogar", subcategory: "ensamblaje", service: "armar-mueble", headline: "Handyman", bio: "Armo, instalo y reparo de todo en tu hogar. Puntual y garantizado.", years: 10, rating: 4.9, ratingCount: 203, completedJobs: 480, responseMinutes: 8, pricingModel: "fixed", price: 45000, verified: true },
  { firstName: "Laura", lastName: "Pérez", city: "Bogotá", category: "limpieza", subcategory: "limpieza-hogar", service: "limpieza-apartamento", headline: "Profesional de limpieza", bio: "Limpieza detallada de apartamentos y casas, productos ecológicos disponibles.", years: 5, rating: 4.7, ratingCount: 71, completedJobs: 190, responseMinutes: 15, pricingModel: "hourly", price: 30000, verified: true },
  { firstName: "Daniel", lastName: "Suárez", city: "Cali", category: "tutorias", subcategory: "academica", service: "tutoria-ingles", headline: "Profesor de inglés", bio: "Certificación TESOL, clases personalizadas para todos los niveles.", years: 7, rating: 5.0, ratingCount: 54, completedJobs: 140, responseMinutes: 20, pricingModel: "hourly", price: 40000, verified: true },
  { firstName: "Camila", lastName: "Torres", city: "Bogotá", category: "barberia", subcategory: "corte-cabello", service: "corte-domicilio", headline: "Estilista a domicilio", bio: "Cortes y peinados a domicilio, disponibilidad los fines de semana.", years: 4, rating: 4.6, ratingCount: 38, completedJobs: 95, responseMinutes: 12, pricingModel: "fixed", price: 40000, verified: true },
  { firstName: "Felipe", lastName: "Gómez", city: "Medellín", category: "barberia", subcategory: "corte-cabello", service: "arreglo-barba", headline: "Barbero especialista en barba", bio: "Diseño y arreglo de barba con navaja tradicional.", years: 6, rating: 4.8, ratingCount: 64, completedJobs: 175, responseMinutes: 7, pricingModel: "fixed", price: 20000, verified: true },
  { firstName: "Isabella", lastName: "Rodríguez", city: "Cali", category: "belleza", subcategory: "maquillaje", service: "maquillaje-social", headline: "Maquilladora", bio: "Maquillaje social y editorial, look natural o glam.", years: 3, rating: 4.7, ratingCount: 41, completedJobs: 88, responseMinutes: 18, pricingModel: "starting_at", price: 70000, verified: false },
  { firstName: "Mariana", lastName: "Castro", city: "Bogotá", category: "belleza", subcategory: "unas", service: "manicure", headline: "Especialista en uñas", bio: "Manicure y nail art, materiales de alta calidad.", years: 5, rating: 4.9, ratingCount: 112, completedJobs: 260, responseMinutes: 10, pricingModel: "fixed", price: 30000, verified: true },
  { firstName: "Juliana", lastName: "Ortiz", city: "Medellín", category: "belleza", subcategory: "pestanas", service: "extension-pestanas", headline: "Especialista en pestañas", bio: "Extensiones de pestañas pelo a pelo y volumen ruso.", years: 4, rating: 4.8, ratingCount: 57, completedJobs: 130, responseMinutes: 14, pricingModel: "fixed", price: 90000, verified: true },
  { firstName: "Santiago", lastName: "Herrera", city: "Bogotá", category: "limpieza", subcategory: "limpieza-hogar", service: "limpieza-profunda", headline: "Limpieza profunda", bio: "Equipo de limpieza profunda para mudanzas y post-construcción.", years: 6, rating: 4.7, ratingCount: 49, completedJobs: 120, responseMinutes: 20, pricingModel: "fixed", price: 120000, verified: true },
  { firstName: "Natalia", lastName: "Vargas", city: "Cali", category: "limpieza", subcategory: "limpieza-oficina", service: "limpieza-oficina-general", headline: "Limpieza de oficinas", bio: "Servicio de limpieza para oficinas y locales comerciales.", years: 5, rating: 4.6, ratingCount: 33, completedJobs: 80, responseMinutes: 25, pricingModel: "hourly", price: 28000, verified: false },
  { firstName: "Alejandro", lastName: "Ruiz", city: "Barranquilla", category: "hogar", subcategory: "instalaciones", service: "montar-tv", headline: "Técnico de instalaciones", bio: "Montaje de TV, soportes y cableado oculto.", years: 9, rating: 4.9, ratingCount: 98, completedJobs: 230, responseMinutes: 9, pricingModel: "fixed", price: 40000, verified: true },
  { firstName: "Sebastián", lastName: "Molina", city: "Bogotá", category: "hogar", subcategory: "instalaciones", service: "reparaciones-basicas", headline: "Técnico multiservicios", bio: "Reparaciones eléctricas, plomería básica e instalaciones varias.", years: 11, rating: 4.8, ratingCount: 154, completedJobs: 400, responseMinutes: 11, pricingModel: "hourly", price: 35000, verified: true },
  { firstName: "Diego", lastName: "Castaño", city: "Medellín", category: "hogar", subcategory: "pintura", service: "pintura-apartamento", headline: "Maestro pintor", bio: "Pintura interior y exterior, presupuesto personalizado según el espacio.", years: 12, rating: 4.9, ratingCount: 76, completedJobs: 160, responseMinutes: 30, pricingModel: "custom_quote", price: null, verified: true },
  { firstName: "Andrea", lastName: "Salazar", city: "Cartagena", category: "hogar", subcategory: "mudanza", service: "ayuda-mudanza", headline: "Ayuda con mudanzas", bio: "Equipo confiable para mudanzas locales, cuidamos tus cosas como propias.", years: 4, rating: 4.7, ratingCount: 29, completedJobs: 65, responseMinutes: 15, pricingModel: "hourly", price: 25000, verified: false },
  { firstName: "Mateo", lastName: "Gil", city: "Bogotá", category: "tutorias", subcategory: "academica", service: "tutoria-matematicas", headline: "Tutor de matemáticas", bio: "Ingeniero, tutorías de matemáticas para colegio y universidad.", years: 5, rating: 4.9, ratingCount: 67, completedJobs: 150, responseMinutes: 10, pricingModel: "hourly", price: 38000, verified: true },
  { firstName: "Valeria", lastName: "León", city: "Medellín", category: "tutorias", subcategory: "entrenamiento", service: "entrenamiento-personal", headline: "Entrenadora personal", bio: "Entrenamiento funcional personalizado a domicilio o en parque.", years: 6, rating: 4.8, ratingCount: 82, completedJobs: 190, responseMinutes: 12, pricingModel: "fixed", price: 50000, verified: true },
  { firstName: "Julián", lastName: "Rojas", city: "Cali", category: "tutorias", subcategory: "tecnologia", service: "soporte-tecnico", headline: "Soporte técnico", bio: "Ayuda con computadores, celulares y configuración de redes en casa.", years: 3, rating: 4.6, ratingCount: 22, completedJobs: 55, responseMinutes: 20, pricingModel: "fixed", price: 35000, verified: false },
  { firstName: "Paula", lastName: "Mendoza", city: "Cartagena", category: "barberia", subcategory: "peinado", service: "peinado-estilo", headline: "Estilista", bio: "Peinados para toda ocasión, especialista en trenzas y recogidos.", years: 5, rating: 4.8, ratingCount: 46, completedJobs: 105, responseMinutes: 13, pricingModel: "starting_at", price: 60000, verified: true },
];

export function providerKey(p: ProviderSeed): string {
  return `${p.firstName} ${p.lastName}`;
}
