export interface QuizQuestion {
  q: string;
  options: string[];
  correct: number; // índice da opção correta
  explain: string;
  reward: number; // moedas por acerto
}

export const QUIZ: QuizQuestion[] = [
  {
    q: 'Qual atitude é correta ao encontrar uma área isolada?',
    options: [
      'Passar rápido para economizar tempo',
      'Respeitar o isolamento e procurar rota segura',
      'Remover a fita de isolamento',
      'Ignorar se não houver ninguém olhando',
    ],
    correct: 1,
    explain: 'Isolamento protege você de um risco que nem sempre é visível. Sempre procure a rota segura.',
    reward: 120,
  },
  {
    q: 'Para que serve o EPI (Equipamento de Proteção Individual)?',
    options: [
      'Substituir todas as outras medidas de segurança',
      'Deixar o uniforme mais bonito',
      'Ser a última barreira de proteção contra o risco',
      'Evitar advertências do supervisor',
    ],
    correct: 2,
    explain: 'O EPI é a última barreira: ele protege quando as demais medidas não eliminaram o risco.',
    reward: 120,
  },
  {
    q: 'Você presenciou um quase acidente. O que fazer?',
    options: [
      'Comunicar imediatamente para evitar um acidente real',
      'Esquecer, afinal ninguém se machucou',
      'Contar apenas para os colegas',
      'Registrar somente se acontecer de novo',
    ],
    correct: 0,
    explain: 'Quase acidente é aviso grátis: comunicar permite corrigir a causa antes de alguém se ferir.',
    reward: 120,
  },
  {
    q: 'O que significa "bloqueio e etiquetagem" na manutenção?',
    options: [
      'Trancar a oficina no fim do turno',
      'Isolar fontes de energia e sinalizar que há pessoas trabalhando',
      'Etiquetar as ferramentas novas',
      'Bloquear o acesso do turno seguinte',
    ],
    correct: 1,
    explain: 'Bloqueio e etiquetagem garantem que o equipamento não seja energizado enquanto alguém trabalha nele.',
    reward: 140,
  },
  {
    q: 'Por que manter distância de equipamentos móveis grandes?',
    options: [
      'Porque eles são barulhentos',
      'Para não sujar o uniforme de poeira',
      'Porque todo equipamento móvel tem pontos cegos',
      'Para não atrapalhar a produção',
    ],
    correct: 2,
    explain: 'O operador pode não ver você. Só se aproxime com contato visual confirmado e autorização.',
    reward: 120,
  },
  {
    q: 'Ao enfrentar um trecho com poeira intensa, o correto é:',
    options: [
      'Acelerar para sair logo da poeira',
      'Usar máscara adequada e redobrar a atenção',
      'Fechar os olhos e seguir em frente',
      'Remover o capacete para enxergar melhor',
    ],
    correct: 1,
    explain: 'Poeira reduz visibilidade e afeta a respiração. Máscara adequada e atenção redobrada.',
    reward: 120,
  },
  {
    q: 'Piso molhado na área industrial. Qual a conduta correta?',
    options: [
      'Correr na ponta dos pés',
      'Passar de qualquer jeito, é só água',
      'Reduzir o ritmo, usar calçado antiderrapante e sinalizar',
      'Pular por cima sem olhar',
    ],
    correct: 2,
    explain: 'Área molhada é risco de queda. Reduza o ritmo, use calçado adequado e sinalize para os colegas.',
    reward: 120,
  },
  {
    q: 'Antes de iniciar qualquer atividade, o ideal é:',
    options: [
      'Começar logo para adiantar o serviço',
      'Parar, pensar e agir: observar os riscos primeiro',
      'Esperar alguém mandar',
      'Improvisar as ferramentas que faltam',
    ],
    correct: 1,
    explain: '"Pare, pense e aja" evita a pressa, que é uma das maiores causas de acidentes.',
    reward: 120,
  },
  {
    q: 'Você encontra um vazamento sinalizado no caminho. O que fazer?',
    options: [
      'Atravessar rápido prendendo a respiração',
      'Respeitar a sinalização, desviar e comunicar a área responsável',
      'Tirar foto e postar no grupo',
      'Tampar o vazamento com um pano',
    ],
    correct: 1,
    explain: 'Nunca atravesse área de vazamento. Desvie pela rota segura e acione quem é treinado para atuar.',
    reward: 130,
  },
  {
    q: 'Qual o papel das bacias de contenção na área ambiental?',
    options: [
      'Decorar a entrada da mina',
      'Guardar água para lavar equipamentos',
      'Conter produtos e evitar contaminação do solo e da água',
      'Servir de reservatório para incêndio',
    ],
    correct: 2,
    explain: 'Bacias de contenção evitam que vazamentos alcancem o solo e os cursos d’água. Proteção ambiental é segurança.',
    reward: 130,
  },
];
