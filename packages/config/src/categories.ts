export interface SeedSubcategory {
  slug: string;
  name: string;
  nameEn: string;
  services: { slug: string; name: string; nameEn: string; defaultDurationMinutes?: number }[];
}

export interface SeedCategory {
  slug: string;
  name: string;
  nameEn: string;
  icon: string;
  subcategories: SeedSubcategory[];
}

/**
 * The MVP launch catalog. This seeds the `categories` / `subcategories` / `services`
 * tables — the app itself never hard-codes category logic beyond reading this shape,
 * so admins can extend the catalog later without a rebuild.
 */
export const LAUNCH_CATEGORIES: SeedCategory[] = [
  {
    slug: "barberia",
    name: "Barbería",
    nameEn: "Barber / Hair",
    icon: "scissors",
    subcategories: [
      {
        slug: "corte-cabello",
        name: "Corte de cabello",
        nameEn: "Haircut",
        services: [
          { slug: "corte-hombre", name: "Corte de cabello para hombre", nameEn: "Men's haircut", defaultDurationMinutes: 30 },
          { slug: "corte-domicilio", name: "Corte a domicilio", nameEn: "Haircut at home", defaultDurationMinutes: 45 },
          { slug: "arreglo-barba", name: "Arreglo de barba", nameEn: "Beard trim", defaultDurationMinutes: 20 },
        ],
      },
      {
        slug: "peinado",
        name: "Peinado",
        nameEn: "Hairstyling",
        services: [{ slug: "peinado-estilo", name: "Peinado y estilizado", nameEn: "Hairstyling", defaultDurationMinutes: 40 }],
      },
    ],
  },
  {
    slug: "belleza",
    name: "Belleza",
    nameEn: "Beauty / Makeup",
    icon: "sparkles",
    subcategories: [
      {
        slug: "maquillaje",
        name: "Maquillaje",
        nameEn: "Makeup",
        services: [
          { slug: "maquillaje-evento", name: "Maquillaje para evento", nameEn: "Event makeup", defaultDurationMinutes: 60 },
          { slug: "maquillaje-social", name: "Maquillaje social", nameEn: "Makeup artist", defaultDurationMinutes: 50 },
        ],
      },
      {
        slug: "unas",
        name: "Uñas",
        nameEn: "Nails",
        services: [{ slug: "manicure", name: "Manicure", nameEn: "Nails", defaultDurationMinutes: 45 }],
      },
      {
        slug: "pestanas",
        name: "Pestañas",
        nameEn: "Lashes",
        services: [{ slug: "extension-pestanas", name: "Extensión de pestañas", nameEn: "Lashes", defaultDurationMinutes: 90 }],
      },
    ],
  },
  {
    slug: "limpieza",
    name: "Limpieza",
    nameEn: "Cleaning",
    icon: "sparkle",
    subcategories: [
      {
        slug: "limpieza-hogar",
        name: "Limpieza del hogar",
        nameEn: "House cleaning",
        services: [
          { slug: "limpieza-apartamento", name: "Limpieza de apartamento", nameEn: "Apartment cleaning", defaultDurationMinutes: 120 },
          { slug: "limpieza-profunda", name: "Limpieza profunda", nameEn: "Deep cleaning", defaultDurationMinutes: 180 },
        ],
      },
      {
        slug: "limpieza-oficina",
        name: "Limpieza de oficina",
        nameEn: "Office cleaning",
        services: [{ slug: "limpieza-oficina-general", name: "Limpieza de oficina", nameEn: "Office cleaning", defaultDurationMinutes: 120 }],
      },
    ],
  },
  {
    slug: "hogar",
    name: "Hogar",
    nameEn: "Handyman / Home Services",
    icon: "hammer",
    subcategories: [
      {
        slug: "ensamblaje",
        name: "Ensamblaje de muebles",
        nameEn: "Furniture assembly",
        services: [{ slug: "armar-mueble", name: "Armar mueble", nameEn: "Furniture assembly", defaultDurationMinutes: 60 }],
      },
      {
        slug: "instalaciones",
        name: "Instalaciones",
        nameEn: "Installations",
        services: [
          { slug: "montar-tv", name: "Montar TV", nameEn: "Mount TV", defaultDurationMinutes: 45 },
          { slug: "reparaciones-basicas", name: "Reparaciones básicas", nameEn: "Basic repairs", defaultDurationMinutes: 60 },
        ],
      },
      {
        slug: "pintura",
        name: "Pintura",
        nameEn: "Painting",
        services: [{ slug: "pintura-apartamento", name: "Pintura de apartamento", nameEn: "Apartment painting", defaultDurationMinutes: 240 }],
      },
      {
        slug: "mudanza",
        name: "Ayuda con mudanza",
        nameEn: "Moving help",
        services: [{ slug: "ayuda-mudanza", name: "Ayuda con mudanza", nameEn: "Moving help", defaultDurationMinutes: 180 }],
      },
    ],
  },
  {
    slug: "entrenador",
    name: "Entrenadores",
    nameEn: "Personal Trainers / Coaches",
    icon: "barbell",
    subcategories: [
      {
        slug: "fitness",
        name: "Gym",
        nameEn: "Gym",
        services: [{ slug: "sesion-fitness", name: "Sesión de gimnasio", nameEn: "Gym training session", defaultDurationMinutes: 60 }],
      },
      {
        slug: "futbol",
        name: "Fútbol",
        nameEn: "Soccer",
        services: [
          { slug: "sesion-futbol", name: "Sesión de entrenamiento de fútbol", nameEn: "Soccer training session", defaultDurationMinutes: 60 },
        ],
      },
      {
        slug: "boxeo",
        name: "Boxeo",
        nameEn: "Boxing",
        services: [{ slug: "sesion-boxeo", name: "Sesión de boxeo", nameEn: "Boxing training session", defaultDurationMinutes: 60 }],
      },
    ],
  },
  {
    slug: "tutorias",
    name: "Tutorías",
    nameEn: "Tutoring / Personal Services",
    icon: "book-open",
    subcategories: [
      {
        slug: "academica",
        name: "Tutoría académica",
        nameEn: "Academic tutoring",
        services: [
          { slug: "tutoria-ingles", name: "Tutoría de inglés", nameEn: "English tutoring", defaultDurationMinutes: 60 },
          { slug: "tutoria-matematicas", name: "Tutoría de matemáticas", nameEn: "Math tutoring", defaultDurationMinutes: 60 },
        ],
      },
      {
        slug: "entrenamiento",
        name: "Entrenamiento personal",
        nameEn: "Personal training",
        services: [{ slug: "entrenamiento-personal", name: "Entrenamiento personal", nameEn: "Personal training", defaultDurationMinutes: 60 }],
      },
      {
        slug: "tecnologia",
        name: "Asistencia tecnológica",
        nameEn: "Tech assistance",
        services: [{ slug: "soporte-tecnico", name: "Soporte técnico básico", nameEn: "Basic tech assistance", defaultDurationMinutes: 45 }],
      },
    ],
  },
];
