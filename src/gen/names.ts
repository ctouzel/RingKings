import type { Nationality } from '../model/types';

/**
 * Banques de noms et de villes par origine.
 * "QC" est une origine à part (Québécois francophones) qui donne la nationalité CA.
 * Tous les noms sont fictifs : combinaisons aléatoires de prénoms et noms courants.
 */
export type Origin = Nationality | 'QC';

export interface NamePool {
  first: string[];
  last: string[];
  cities: string[];
  /** Langue des surnoms proposés. */
  nickLang: 'en' | 'es' | 'fr';
}

export const NAME_POOLS: Record<Origin, NamePool> = {
  QC: {
    first: ['Jean-François', 'Mathieu', 'Olivier', 'Simon', 'Maxime', 'Alexandre', 'Samuel', 'Gabriel', 'Félix', 'Étienne', 'Marc-André', 'Jérémie', 'Vincent', 'Louis-Philippe', 'Antoine', 'Dominic', 'Raphaël', 'Patrice', 'Kevin', 'Sébastien'],
    last: ['Tremblay', 'Gagnon', 'Roy', 'Côté', 'Bouchard', 'Gauthier', 'Morin', 'Lavoie', 'Fortin', 'Gagné', 'Ouellet', 'Pelletier', 'Bélanger', 'Lévesque', 'Bergeron', 'Leblanc', 'Paquette', 'Girard', 'Simard', 'Boucher', 'Caron', 'Beaulieu', 'Cloutier', 'Dubé', 'Poirier', 'Lachance', 'Thibodeau'],
    cities: ['Montréal (QC)', 'Québec (QC)', 'Laval (QC)', 'Gatineau (QC)', 'Longueuil (QC)', 'Sherbrooke (QC)', 'Saguenay (QC)', 'Lévis (QC)', 'Trois-Rivières (QC)', 'Terrebonne (QC)', 'Rimouski (QC)', 'Drummondville (QC)', 'Saint-Hyacinthe (QC)', 'Rouyn-Noranda (QC)'],
    nickLang: 'fr',
  },
  CA: {
    first: ['Tyler', 'Connor', 'Liam', 'Brandon', 'Jordan', 'Ryan', 'Cole', 'Dylan', 'Logan', 'Evan', 'Jamal', 'Arjun', 'Marcus', 'Owen', 'Hunter'],
    last: ['MacDonald', 'Campbell', 'Stewart', 'Wilson', 'Thompson', 'Fraser', 'Murray', 'Anderson', 'Mitchell', 'Ross', 'Sandhu', 'Grant', 'Henderson', 'Clarke', 'Dawson'],
    cities: ['Toronto (ON)', 'Hamilton (ON)', 'Winnipeg (MB)', 'Edmonton (AB)', 'Calgary (AB)', 'Vancouver (BC)', 'Halifax (NS)', 'Moncton (NB)', 'Ottawa (ON)', 'Saskatoon (SK)', 'Windsor (ON)'],
    nickLang: 'en',
  },
  US: {
    first: ['Marcus', 'DeShawn', 'Tyrone', 'Jake', 'Anthony', 'Brandon', 'Terrell', 'Kevin', 'Andre', 'Jaylen', 'Devon', 'Michael', 'Chris', 'Darius', 'Isaiah', 'Travis', 'Malik', 'Nick', 'Cody', 'Reggie', 'Shawn', 'Jermaine'],
    last: ['Johnson', 'Williams', 'Brown', 'Jackson', 'Davis', 'Harris', 'Robinson', 'Walker', 'Carter', 'Mitchell', 'Coleman', 'Washington', 'Brooks', 'Price', 'Hayes', 'Russell', 'Bennett', 'Sullivan', 'Grant', 'Freeman', 'Holloway', 'Pierce', 'Riley', 'Spencer'],
    cities: ['Philadelphie', 'Détroit', 'Brooklyn', 'Las Vegas', 'Los Angeles', 'Chicago', 'Houston', 'Baltimore', 'Cleveland', 'Atlanta', 'Newark', 'Oakland', 'Memphis', 'St. Louis', 'Denver', 'Miami'],
    nickLang: 'en',
  },
  MX: {
    first: ['José', 'Juan Carlos', 'Luis', 'Miguel Ángel', 'Jesús', 'Alejandro', 'Saúl', 'Julio César', 'Óscar', 'Francisco', 'Ricardo', 'Eduardo', 'Rafael', 'Erik', 'Fernando', 'Gilberto', 'Isaac', 'Diego', 'Héctor', 'Rubén', 'Andrés', 'Emanuel'],
    last: ['García', 'Hernández', 'Martínez', 'López', 'González', 'Rodríguez', 'Pérez', 'Sánchez', 'Ramírez', 'Torres', 'Flores', 'Rivera', 'Gómez', 'Díaz', 'Reyes', 'Cruz', 'Morales', 'Ortiz', 'Gutiérrez', 'Chávez', 'Mendoza', 'Castillo', 'Vargas', 'Salazar', 'Navarro'],
    cities: ['Guadalajara', 'Tijuana', 'Mexicali', 'Monterrey', 'Ciudad de México', 'Culiacán', 'Los Mochis', 'Hermosillo', 'Mazatlán', 'Puebla', 'León', 'Ciudad Obregón', 'Mérida', 'Toluca'],
    nickLang: 'es',
  },
  GB: {
    first: ['Callum', 'Jamie', 'Liam', 'Connor', 'Josh', 'Ryan', 'Ben', 'Dan', 'Kieran', 'Lewis', 'Tommy', 'Harry', 'Joe', 'Craig', 'Jordan', 'Reece', 'Aaron', 'Kyle'],
    last: ['Smith', 'Jones', 'Taylor', 'Davies', 'Evans', 'Thomas', 'Walsh', 'Hughes', 'Clarke', 'Wood', 'Fletcher', 'Hall', 'Wright', 'Lewis', 'Murphy', 'Barker', 'Cartwright', 'Holt', 'Kelly', 'Price', 'Doyle'],
    cities: ['Londres', 'Manchester', 'Liverpool', 'Sheffield', 'Birmingham', 'Glasgow', 'Cardiff', 'Belfast', 'Leeds', 'Newcastle', 'Nottingham', 'Bristol'],
    nickLang: 'en',
  },
  CU: { first: ['Yoenis', 'Yordenis', 'Lázaro', 'Osleys', 'Yasmany', 'Reinier', 'Yunier', 'Andy'], last: ['Pérez', 'Hechavarría', 'Iglesias', 'Álvarez', 'Ramírez', 'Ortiz', 'Fonseca', 'Batista', 'Quesada'], cities: ['La Havane', 'Santiago de Cuba', 'Camagüey', 'Holguín', 'Pinar del Río'], nickLang: 'es' },
  PR: { first: ['Edwin', 'Josué', 'Xander', 'Félix', 'Ángel', 'Jonathan', 'Christian'], last: ['Rivera', 'Colón', 'Vázquez', 'Santiago', 'Rosario', 'Figueroa', 'Ortiz', 'Pagán'], cities: ['San Juan', 'Caguas', 'Bayamón', 'Ponce', 'Carolina'], nickLang: 'es' },
  DO: { first: ['Junior', 'Wilfredo', 'Rafael', 'Alberto', 'Juan', 'Elvis', 'Carlos'], last: ['Peña', 'Batista', 'Marte', 'Cabrera', 'De los Santos', 'Polanco', 'Mejía'], cities: ['Saint-Domingue', 'Santiago', 'San Pedro de Macorís', 'La Romana'], nickLang: 'es' },
  CO: { first: ['Andrés', 'Camilo', 'Jhon', 'Yeison', 'Sebastián', 'Duván'], last: ['Mosquera', 'Palacios', 'Valencia', 'Cuesta', 'Quintero', 'Arboleda'], cities: ['Carthagène', 'Barranquilla', 'Cali', 'Medellín'], nickLang: 'es' },
  BR: { first: ['João', 'Thiago', 'Rafael', 'Lucas', 'Everton', 'Wanderson'], last: ['Silva', 'Santos', 'Oliveira', 'Souza', 'Conceição', 'Ferreira', 'Barbosa'], cities: ['Salvador', 'São Paulo', 'Rio de Janeiro', 'Recife'], nickLang: 'es' },
  AR: { first: ['Marcos', 'Lucas', 'Matías', 'Nicolás', 'Facundo', 'Brian'], last: ['Fernández', 'Acosta', 'Romero', 'Sosa', 'Benítez', 'Medina', 'Aguirre'], cities: ['Buenos Aires', 'Córdoba', 'Rosario', 'Santa Fe', 'Mar del Plata'], nickLang: 'es' },
  IE: { first: ['Seán', 'Conor', 'Patrick', 'Eamonn', 'Michael', 'Cian'], last: ["O'Brien", 'Byrne', 'Kavanagh', 'Gallagher', 'Doherty', 'McCarthy', 'Brennan'], cities: ['Dublin', 'Cork', 'Limerick', 'Galway', 'Mullingar'], nickLang: 'en' },
  FR: { first: ['Karim', 'Yannick', 'Mehdi', 'Romain', 'Christian', 'Souleymane', 'Lucas'], last: ['Benali', 'Dupont', 'Moreau', 'Lefebvre', 'Traoré', 'Mercier', 'Bonnet', 'Diallo'], cities: ['Paris', 'Marseille', 'Lyon', 'Lille', 'Toulouse', 'Bordeaux'], nickLang: 'fr' },
  DE: { first: ['Felix', 'Jonas', 'Tobias', 'Dennis', 'Arthur', 'Leon'], last: ['Müller', 'Schmidt', 'Wagner', 'Becker', 'Hoffmann', 'Krüger', 'Neumann'], cities: ['Berlin', 'Hambourg', 'Munich', 'Cologne', 'Magdebourg'], nickLang: 'en' },
  IT: { first: ['Giovanni', 'Luca', 'Alessandro', 'Matteo', 'Fabio', 'Emiliano'], last: ['Rossi', 'Esposito', 'Russo', 'Bianchi', 'Romano', 'Ferrara', 'De Luca'], cities: ['Rome', 'Naples', 'Milan', 'Turin', 'Bari'], nickLang: 'en' },
  ES: { first: ['Javier', 'Sergio', 'Pablo', 'Kiko', 'Adrián', 'Jon'], last: ['Fernández', 'Ruiz', 'Navarro', 'Moreno', 'Jiménez', 'Echeverría'], cities: ['Madrid', 'Barcelone', 'Séville', 'Valence', 'Bilbao'], nickLang: 'es' },
  PL: { first: ['Krzysztof', 'Tomasz', 'Mateusz', 'Kamil', 'Piotr', 'Michał'], last: ['Kowalski', 'Nowak', 'Wiśniewski', 'Wójcik', 'Zieliński', 'Kamiński', 'Lewandowski'], cities: ['Varsovie', 'Cracovie', 'Gdańsk', 'Wrocław', 'Łódź'], nickLang: 'en' },
  UA: { first: ['Oleksandr', 'Vasyl', 'Denys', 'Serhiy', 'Viktor', 'Artem'], last: ['Kovalenko', 'Bondarenko', 'Shevchenko', 'Tkachenko', 'Melnyk', 'Kravchuk', 'Lysenko'], cities: ['Kyiv', 'Kharkiv', 'Lviv', 'Odesa', 'Dnipro'], nickLang: 'en' },
  RU: { first: ['Dmitry', 'Sergey', 'Artur', 'Alexei', 'Ruslan', 'Fedor'], last: ['Ivanov', 'Smirnov', 'Volkov', 'Petrov', 'Sokolov', 'Kuznetsov', 'Morozov'], cities: ['Moscou', 'Saint-Pétersbourg', 'Iekaterinbourg', 'Kazan', 'Tcheliabinsk'], nickLang: 'en' },
  KZ: { first: ['Daniyar', 'Zhanibek', 'Kanat', 'Yerlan', 'Aslanbek', 'Nurlan'], last: ['Sadykov', 'Abdrakhmanov', 'Iskakov', 'Nurlanov', 'Seitkali', 'Omarov'], cities: ['Almaty', 'Astana', 'Karaganda', 'Chymkent'], nickLang: 'en' },
  UZ: { first: ['Bakhodir', 'Shakhram', 'Murodjon', 'Israil', 'Otabek', 'Jasur'], last: ['Kholmatov', 'Mirzaev', 'Rakhimov', 'Tursunov', 'Yusupov', 'Karimov'], cities: ['Tachkent', 'Samarcande', 'Boukhara', 'Andijan'], nickLang: 'en' },
  NG: { first: ['Yusuf', 'Chidi', 'Emeka', 'Tunde', 'Oluwaseun', 'Ikenna'], last: ['Adeyemi', 'Okafor', 'Balogun', 'Eze', 'Adebayo', 'Nwosu', 'Okonkwo'], cities: ['Lagos', 'Ibadan', 'Abuja', 'Port Harcourt', 'Kano'], nickLang: 'en' },
  GH: { first: ['Kwame', 'Kofi', 'Isaac', 'Emmanuel', 'Joshua', 'Richard'], last: ['Mensah', 'Asante', 'Owusu', 'Boateng', 'Addo', 'Ofori', 'Quaye'], cities: ['Accra', 'Kumasi', 'Bukom', 'Tema'], nickLang: 'en' },
  ZA: { first: ['Thabo', 'Sibusiso', 'Kevin', 'Zolani', 'Lwazi', 'Ruan'], last: ['Ndlovu', 'Dlamini', 'Mokoena', 'van der Merwe', 'Nkosi', 'Botha'], cities: ['Johannesburg', 'Le Cap', 'Durban', 'East London', 'Mdantsane'], nickLang: 'en' },
  JP: { first: ['Kenshiro', 'Ryota', 'Takuma', 'Daigo', 'Haruto', 'Sho', 'Yuki'], last: ['Tanaka', 'Suzuki', 'Takahashi', 'Watanabe', 'Yamamoto', 'Kobayashi', 'Sato'], cities: ['Tokyo', 'Osaka', 'Yokohama', 'Nagoya', 'Kobe'], nickLang: 'en' },
  PH: { first: ['Jerwin', 'Reymart', 'Marlon', 'Jhack', 'Rodel', 'Arnel'], last: ['Santos', 'Reyes', 'Bautista', 'Villanueva', 'Mendoza', 'Dela Cruz', 'Aquino'], cities: ['General Santos', 'Cebu', 'Manille', 'Davao', 'Bohol'], nickLang: 'en' },
  TH: { first: ['Somchai', 'Anan', 'Kittisak', 'Prasit', 'Wichai'], last: ['Saelim', 'Chaiyaporn', 'Srisuk', 'Thongdee', 'Boonmee'], cities: ['Bangkok', 'Si Sa Ket', 'Nakhon Ratchasima', 'Chiang Mai'], nickLang: 'en' },
  KR: { first: ['Min-jun', 'Ji-hoon', 'Hyun-woo', 'Dong-hyun', 'Sung-min'], last: ['Kim', 'Park', 'Lee', 'Choi', 'Jung', 'Kang'], cities: ['Séoul', 'Busan', 'Incheon', 'Daegu'], nickLang: 'en' },
  AU: { first: ['Jai', 'Liam', 'Tim', 'Josh', 'Brock', 'Mitch'], last: ['Callaghan', 'Hogan', 'Kennedy', 'Walsh', 'Mitchell', 'Harding'], cities: ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Gold Coast'], nickLang: 'en' },
};

/** Surnoms par langue. */
export const NICKNAMES: Record<NamePool['nickLang'], string[]> = {
  en: ['The Hammer', 'Iron', 'Lightning', 'The Truth', 'Dead Serious', 'The Machine', 'Smooth', 'The Viper', 'Big Time', 'The Butcher', 'Showtime', 'Thunder', 'The Ghost', 'Rock Solid', 'Hurricane', 'The Natural', 'Mayhem', 'Silk', 'The Bulldog', 'Blue Steel', 'Kid Nitro', 'The Professor', 'Sandman', 'Buzzsaw'],
  es: ['El Toro', 'El Huracán', 'El Implacable', 'Dinamita', 'El Gallo', 'El Matador', 'El Tigre', 'Pitbull', 'El Halcón', 'El Rey', 'Jaguar', 'Relámpago', 'El Chacal', 'Bombón', 'El Martillo', 'Cobra', 'El Bravo'],
  fr: ['Le Bulldozer', 'Le Marteau', 'Le Lion', "L'Éclair", 'Le Bûcheron', 'Le Prof', 'Le Tigre', 'Le Bombardier', 'Le Chirurgien', 'Le Taureau', 'Le Renard', 'La Machine', 'Le Phénix', 'Le Rouleau', 'Le Boucher'],
};

/** Origine -> nationalité officielle. */
export function nationalityOf(origin: Origin): Nationality {
  return origin === 'QC' ? 'CA' : origin;
}
