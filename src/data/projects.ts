export const projectCategories = ['Web', 'Systems', 'Games', 'Graphics', 'Foundations'] as const;

export interface ProjectImage {
  src: string;
  alt: string;
  width: number;
  height: number;
}

interface Project {
  name: string;
  category: string;
  filter: typeof projectCategories[number];
  subtitle: string;
  description: string;
  contribution: string[];
  technologies: string[];
  sources?: { label: string; href: string }[];
  images?: ProjectImage[];
}

export const projects: Project[] = [
  {
    name: '7irafi',
    filter: 'Web',
    category: 'Web application · Team project',
    subtitle: 'A marketplace for local services',
    description: 'Connects clients with local professionals, with real-time chat and notifications.',
    contribution: [
      'Contributed across the Angular frontend and Spring Boot microservices, including service discovery, gateway routing, and JWT authentication.',
      'Used PostgreSQL databases per service and Kafka for asynchronous events. Built WebSocket chat and containerized the application with Docker Compose.',
    ],
    technologies: ['Java', 'Spring Boot', 'Angular', 'Kafka', 'PostgreSQL', 'Docker Compose'],
  },
  {
    name: 'LocalServer',
    filter: 'Systems',
    category: 'Systems programming',
    subtitle: 'An HTTP/1.1 server built in Rust',
    description: 'Serves HTTP requests through a single-threaded, event-driven architecture with non-blocking I/O.',
    contribution: [
      'Built request parsing, chunked transfer handling, GET/POST/DELETE methods, file uploads, cookies, and sessions.',
      'Added configurable routes, multiple listening ports, redirects, custom error pages, and CGI execution.',
    ],
    technologies: ['Rust', 'Sockets', 'Non-blocking I/O', 'CGI'],
  },
  {
    name: 'Custom Language Compiler',
    filter: 'Foundations',
    category: 'Language implementation',
    subtitle: 'From source code to x86-64 assembly',
    description: 'A compiler written in Rust for a custom programming language with typed expressions, control flow, and functions.',
    contribution: [
      'Implemented lexical analysis, parsing, type checking, and assembly code generation.',
      'Added variables, arithmetic and logical operations, and functions with parameters and return values.',
    ],
    technologies: ['Rust', 'x86-64 Assembly', 'Compiler Design'],
  },

  {
    name: '01Blog',
    filter: 'Web',
    category: 'Web application',
    subtitle: 'A social blogging platform',
    description: 'A social blogging platform with multimedia posts, subscriptions, personalized feeds, and moderation tools.',
    contribution: ['Implemented authentication and role-based access for users and administrators.'],
    technologies: ['Java', 'Spring Boot', 'Spring Security', 'Angular', 'PostgreSQL'],
  },
  {
    name: 'Social Network',
    filter: 'Web',
    category: 'Web application',
    subtitle: 'Social features with real-time messaging',
    description: 'Profiles, follow requests, groups, events, and private and group messaging.',
    contribution: ['Built session authentication, privacy controls, WebSocket notifications, and SQLite migrations.'],
    technologies: ['Go', 'SQLite', 'WebSockets', 'Docker'],
  },
  {
    name: 'Real-Time Forum',
    filter: 'Web',
    category: 'Web application',
    subtitle: 'Discussions and private messaging',
    description: 'A single-page discussion forum with categorized posts, comments, and reactions.',
    contribution: ['Added private messaging, online presence, and paginated chat history with debounced scrolling.'],
    technologies: ['Go', 'JavaScript', 'SQLite', 'WebSockets', 'Docker'],
  },
  {
    name: 'AirBnB Clone',
    filter: 'Web',
    category: 'Web application',
    subtitle: 'A property listing platform',
    description: 'A property listing application with browsing and filtering.',
    contribution: ['Built data models, a management console, and REST APIs with JSON and MySQL persistence, then deployed with Nginx and Gunicorn.'],
    technologies: ['Python', 'Flask', 'SQLAlchemy', 'MySQL', 'jQuery', 'Nginx', 'Gunicorn'],
  },
  {
    name: 'DopShop',
    filter: 'Web',
    category: 'Web application',
    subtitle: 'A marketplace for Moroccan products',
    description: 'An e-commerce platform for Moroccan products with search, cart, checkout, user accounts, and an admin dashboard.',
    contribution: ['Connected the React frontend to Django with Axios and TanStack Query.'],
    technologies: ['React', 'Django', 'TanStack Query', 'Axios', 'React Router'],
  },
  {
    name: 'Bomberman',
    filter: 'Games',
    category: 'Multiplayer game',
    subtitle: 'A real-time multiplayer browser game',
    description: 'A browser game for 2–4 players, built with a custom JavaScript framework and DOM rendering.',
    contribution: ['Implemented multiplayer synchronization, chat, bomb explosions, destructible blocks, and power-ups.'],
    technologies: ['JavaScript', 'Express.js', 'WebSockets'],
  },
  {
    name: 'Lem-in',
    filter: 'Foundations',
    category: 'Algorithms',
    subtitle: 'Graph pathfinding and ant simulation',
    description: 'A command-line ant simulation that routes movement through a graph.',
    contribution: ['Adapted breadth-first search to schedule routes and reduce turns while enforcing room and tunnel capacity constraints.'],
    technologies: ['Go', 'Breadth-First Search', 'Graph Algorithms'],
  },
  {
    name: 'Unix Shells',
    filter: 'Systems',
    category: 'Systems programming',
    subtitle: 'Command-line shells in C and Rust',
    description: 'Shells in C and Rust supporting pipelines, I/O redirection, environment expansion, and built-in commands.',
    contribution: ['Implemented process execution, signals, history, and file utilities in Rust.'],
    technologies: ['C', 'Rust', 'Unix'],
  },
  {
    name: 'Born2beroot',
    filter: 'Systems',
    category: 'Linux administration',
    subtitle: 'A configured and secured Linux server',
    description: 'Configured a Debian virtual machine with encrypted storage, SSH access controls, firewall rules, and AppArmor.',
    contribution: ['Automated monitoring with Bash and cron and deployed WordPress with Lighttpd and MariaDB.'],
    technologies: ['Debian', 'Bash', 'LVM', 'SSH', 'UFW', 'AppArmor', 'Cron'],
  },
  {
    name: 'miniRT',
    filter: 'Graphics',
    category: 'Computer graphics',
    subtitle: 'A 3D ray tracer built in C',
    description: 'A 3D ray tracer that renders spheres, planes, and cylinders from scene files.',
    contribution: ['Implemented intersections, ambient and diffuse lighting, hard shadows, camera configuration, and scene validation.'],
    technologies: ['C', 'MiniLibX', 'Ray Tracing', 'Vector Mathematics'],
  },
  {
    name: 'ft_irc',
    filter: 'Systems',
    category: 'Networking',
    subtitle: 'A multi-client IRC server',
    description: 'An IRC server handling simultaneous clients through non-blocking sockets and an epoll event loop.',
    contribution: ['Added authentication, private and channel messaging, and channel operator controls.'],
    technologies: ['C++98', 'TCP/IP', 'epoll', 'Non-blocking I/O'],
  },
  {
    name: 'Hack Computer',
    filter: 'Foundations',
    category: 'Computer architecture',
    subtitle: 'A computer built from logic gates',
    description: 'Built a computer from logic gates, including its ALU, memory, registers, and CPU.',
    contribution: ['Developed an assembler, VM translator, Jack compiler, and OS library for memory, I/O, graphics, and system services.'],
    technologies: ['HDL', 'Assembly', 'Computer Architecture', 'Compiler Design'],
  },
];
