// Mock Data compartido para todas las pantallas
// Mantiene coherencia entre componentes

const ORGANIZATION = {
  id: 'org-001',
  name: 'Acme Coaching Corp',
  logo: '🏢',
  sector: 'Tecnología',
  country: 'España',
  timezone: 'Europe/Madrid',
  plan: 'Pro',
  status: 'active',
  createdAt: '2024-01-15',
  color: '#8C7B80',
  contactEmail: 'admin@acmecorp.com'
};

const COACHES = [
  {
    id: 'coach-001',
    name: 'María García',
    email: 'maria@acmecorp.com',
    avatar: '👩‍💼',
    specialty: 'Tech Leadership',
    status: 'active',
    joinedAt: '2024-01-15',
    clientsAssigned: 8,
    capacity: 10,
    programsActive: 3,
    nps: 4.8,
    retentionRate: 95,
    completionRate: 92,
    lastActive: '2024-07-30T14:30:00',
    totalProgramsCompleted: 24,
    sessionCount: 156,
    metrics: {
      clientSatisfaction: 4.8,
      retentionRate: 95,
      completionRate: 92,
      avgDuration: 28
    }
  },
  {
    id: 'coach-002',
    name: 'Carlos López',
    email: 'carlos@acmecorp.com',
    avatar: '👨‍💼',
    specialty: 'Sales & Negotiation',
    status: 'active',
    joinedAt: '2024-02-20',
    clientsAssigned: 6,
    capacity: 10,
    programsActive: 2,
    nps: 4.6,
    retentionRate: 88,
    completionRate: 85,
    lastActive: '2024-07-30T09:15:00',
    totalProgramsCompleted: 18,
    sessionCount: 124,
    metrics: {
      clientSatisfaction: 4.6,
      retentionRate: 88,
      completionRate: 85,
      avgDuration: 30
    }
  },
  {
    id: 'coach-003',
    name: 'Ana Martínez',
    email: 'ana@acmecorp.com',
    avatar: '👩‍🏫',
    specialty: 'Career Development',
    status: 'active',
    joinedAt: '2024-03-10',
    clientsAssigned: 7,
    capacity: 10,
    programsActive: 3,
    nps: 4.9,
    retentionRate: 97,
    completionRate: 94,
    lastActive: '2024-07-30T16:45:00',
    totalProgramsCompleted: 28,
    sessionCount: 189,
    metrics: {
      clientSatisfaction: 4.9,
      retentionRate: 97,
      completionRate: 94,
      avgDuration: 26
    }
  },
  {
    id: 'coach-004',
    name: 'Roberto Díaz',
    email: 'roberto@acmecorp.com',
    avatar: '👨‍💻',
    specialty: 'Executive Coaching',
    status: 'active',
    joinedAt: '2024-04-05',
    clientsAssigned: 5,
    capacity: 8,
    programsActive: 2,
    nps: 4.7,
    retentionRate: 92,
    completionRate: 88,
    lastActive: '2024-07-29T11:20:00',
    totalProgramsCompleted: 15,
    sessionCount: 98,
    metrics: {
      clientSatisfaction: 4.7,
      retentionRate: 92,
      completionRate: 88,
      avgDuration: 32
    }
  },
  {
    id: 'coach-005',
    name: 'Sofia Ruiz',
    email: 'sofia@acmecorp.com',
    avatar: '👩‍🎓',
    specialty: 'Personal Branding',
    status: 'active',
    joinedAt: '2024-05-12',
    clientsAssigned: 4,
    capacity: 10,
    programsActive: 1,
    nps: 4.5,
    retentionRate: 85,
    completionRate: 80,
    lastActive: '2024-07-30T13:00:00',
    totalProgramsCompleted: 10,
    sessionCount: 64,
    metrics: {
      clientSatisfaction: 4.5,
      retentionRate: 85,
      completionRate: 80,
      avgDuration: 29
    }
  }
];

const CLIENTS = [
  {
    id: 'client-001',
    name: 'Juan Pérez',
    email: 'juan.perez@external.com',
    avatar: '👨‍💰',
    coachId: 'coach-001',
    coachName: 'María García',
    program: 'Semana 3',
    programWeek: 3,
    status: 'active',
    startDate: '2024-07-01',
    endDate: '2024-07-29',
    progress: 75,
    riskLevel: 'low',
    sector: 'Finanzas',
    role: 'Product Manager'
  },
  {
    id: 'client-002',
    name: 'Isabel Sánchez',
    email: 'isabel.sanchez@external.com',
    avatar: '👩‍💻',
    coachId: 'coach-001',
    coachName: 'María García',
    program: 'Semana 2',
    programWeek: 2,
    status: 'active',
    startDate: '2024-07-08',
    endDate: '2024-08-05',
    progress: 50,
    riskLevel: 'low',
    sector: 'Tecnología',
    role: 'Engineering Lead'
  },
  {
    id: 'client-003',
    name: 'Miguel Torres',
    email: 'miguel.torres@external.com',
    avatar: '👨‍🚀',
    coachId: 'coach-002',
    coachName: 'Carlos López',
    program: 'Semana 1',
    programWeek: 1,
    status: 'active',
    startDate: '2024-07-22',
    endDate: '2024-08-19',
    progress: 25,
    riskLevel: 'medium',
    sector: 'Startups',
    role: 'Founder'
  },
  {
    id: 'client-004',
    name: 'Patricia Moreno',
    email: 'patricia.moreno@external.com',
    avatar: '👩‍🔬',
    coachId: 'coach-003',
    coachName: 'Ana Martínez',
    program: 'Completado',
    programWeek: 4,
    status: 'completed',
    startDate: '2024-06-03',
    endDate: '2024-07-01',
    progress: 100,
    riskLevel: 'low',
    sector: 'Consultoría',
    role: 'Strategy Director'
  },
  {
    id: 'client-005',
    name: 'David Ruiz',
    email: 'david.ruiz@external.com',
    avatar: '👨‍⚖️',
    coachId: 'coach-001',
    coachName: 'María García',
    program: 'Semana 4',
    programWeek: 4,
    status: 'active',
    startDate: '2024-06-24',
    endDate: '2024-07-22',
    progress: 95,
    riskLevel: 'low',
    sector: 'Legal',
    role: 'Partner'
  },
  {
    id: 'client-006',
    name: 'Elena Gómez',
    email: 'elena.gomez@external.com',
    avatar: '👩‍💼',
    coachId: 'coach-002',
    coachName: 'Carlos López',
    program: 'Semana 2',
    programWeek: 2,
    status: 'active',
    startDate: '2024-07-15',
    endDate: '2024-08-12',
    progress: 50,
    riskLevel: 'high',
    sector: 'RRHH',
    role: 'HR Manager'
  },
  {
    id: 'client-007',
    name: 'Francisco Jiménez',
    email: 'francisco.jimenez@external.com',
    avatar: '👨‍🎨',
    coachId: 'coach-004',
    coachName: 'Roberto Díaz',
    program: 'Semana 1',
    programWeek: 1,
    status: 'active',
    startDate: '2024-07-29',
    endDate: '2024-08-26',
    progress: 10,
    riskLevel: 'medium',
    sector: 'Creative',
    role: 'Creative Director'
  },
  {
    id: 'client-008',
    name: 'Marta Fernández',
    email: 'marta.fernandez@external.com',
    avatar: '👩‍🏭',
    coachId: 'coach-003',
    coachName: 'Ana Martínez',
    program: 'Semana 3',
    programWeek: 3,
    status: 'active',
    startDate: '2024-07-08',
    endDate: '2024-08-05',
    progress: 75,
    riskLevel: 'low',
    sector: 'Manufactura',
    role: 'Operations Manager'
  },
  {
    id: 'client-009',
    name: 'Luis Navarro',
    email: 'luis.navarro@external.com',
    avatar: '👨‍🏢',
    coachId: 'coach-005',
    coachName: 'Sofia Ruiz',
    program: 'Semana 2',
    programWeek: 2,
    status: 'active',
    startDate: '2024-07-15',
    endDate: '2024-08-12',
    progress: 50,
    riskLevel: 'low',
    sector: 'Retail',
    role: 'Marketing Manager'
  },
  {
    id: 'client-010',
    name: 'Carmen López',
    email: 'carmen.lopez@external.com',
    avatar: '👩‍⚕️',
    coachId: 'coach-004',
    coachName: 'Roberto Díaz',
    program: 'Semana 4',
    programWeek: 4,
    status: 'active',
    startDate: '2024-06-30',
    endDate: '2024-07-28',
    progress: 90,
    riskLevel: 'low',
    sector: 'Salud',
    role: 'Medical Director'
  }
];

const PROGRAMS = [
  {
    id: 'prog-001',
    name: 'Pathway 4 Semanas',
    week: 1,
    activeClients: 2,
    totalClients: 8,
    completedClients: 0,
    status: 'active',
    coaches: ['coach-001', 'coach-002', 'coach-005'],
    completionRate: 25,
    avgDuration: 28,
    startDate: '2024-07-22',
    growthRate: 12
  },
  {
    id: 'prog-002',
    name: 'Pathway 4 Semanas',
    week: 2,
    activeClients: 3,
    totalClients: 7,
    completedClients: 1,
    status: 'active',
    coaches: ['coach-001', 'coach-003'],
    completionRate: 50,
    avgDuration: 26,
    startDate: '2024-07-15',
    growthRate: 8
  },
  {
    id: 'prog-003',
    name: 'Pathway 4 Semanas',
    week: 3,
    activeClients: 2,
    totalClients: 5,
    completedClients: 2,
    status: 'active',
    coaches: ['coach-002', 'coach-004'],
    completionRate: 75,
    avgDuration: 27,
    startDate: '2024-07-08',
    growthRate: 6
  },
  {
    id: 'prog-004',
    name: 'Pathway 4 Semanas',
    week: 4,
    activeClients: 2,
    totalClients: 3,
    completedClients: 2,
    status: 'active',
    coaches: ['coach-001', 'coach-003'],
    completionRate: 95,
    avgDuration: 28,
    startDate: '2024-06-30',
    growthRate: 4
  }
];

const ANALYTICS_DATA = {
  kpis: {
    totalClients: 10,
    activeCoaches: 5,
    completionRate: 76,
    averageDuration: 27.75,
    totalRevenue: 24000,
    clientSatisfaction: 4.7
  },
  monthlyGrowth: [
    { month: 'Enero', clients: 3, revenue: 2000 },
    { month: 'Febrero', clients: 5, revenue: 3500 },
    { month: 'Marzo', clients: 8, revenue: 5600 },
    { month: 'Abril', clients: 10, revenue: 7000 },
    { month: 'Mayo', clients: 14, revenue: 9800 },
    { month: 'Junio', clients: 18, revenue: 12600 },
    { month: 'Julio', clients: 20, revenue: 14000 }
  ],
  retention: [
    { week: 'Semana 1', retention: 100 },
    { week: 'Semana 2', retention: 95 },
    { week: 'Semana 3', retention: 88 },
    { week: 'Semana 4', retention: 82 }
  ],
  coachUtilization: [
    { coach: 'María García', utilization: 80 },
    { coach: 'Carlos López', utilization: 60 },
    { coach: 'Ana Martínez', utilization: 70 },
    { coach: 'Roberto Díaz', utilization: 50 },
    { coach: 'Sofia Ruiz', utilization: 40 }
  ],
  forecast: [
    { month: 'Agosto', projected: 28, confidence: 95 },
    { month: 'Septiembre', projected: 35, confidence: 85 },
    { month: 'Octubre', projected: 42, confidence: 75 }
  ]
};

const BILLING_DATA = {
  plan: 'Pro',
  price: 2999,
  currency: 'EUR',
  billingCycle: 'monthly',
  nextBillingDate: '2024-08-15',
  status: 'active',
  coaches: 5,
  maxCoaches: 10,
  invoices: [
    {
      id: 'inv-001',
      date: '2024-07-15',
      amount: 2999,
      status: 'paid',
      period: 'Julio 2024'
    },
    {
      id: 'inv-002',
      date: '2024-06-15',
      amount: 2999,
      status: 'paid',
      period: 'Junio 2024'
    },
    {
      id: 'inv-003',
      date: '2024-05-15',
      amount: 2999,
      status: 'paid',
      period: 'Mayo 2024'
    }
  ]
};

// Exportar para uso en todas las páginas
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ORGANIZATION,
    COACHES,
    CLIENTS,
    PROGRAMS,
    ANALYTICS_DATA,
    BILLING_DATA
  };
}
