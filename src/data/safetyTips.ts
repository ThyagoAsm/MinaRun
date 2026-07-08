import type { CrashCause, EpiId } from '../state/types';

/** Frases rotativas da tela de carregamento e do menu */
export const LOADING_PHRASES = [
  'Segurança começa antes da partida.',
  'Respeite o caminho seguro.',
  'Atenção aos equipamentos móveis.',
  'EPI completo, operação protegida.',
  'Área isolada existe por um motivo.',
  'Antes de agir, observe o risco.',
  'Comunicar quase acidente evita acidente real.',
  'Bloqueio e etiquetagem salvam vidas.',
];

export const LOADING_TIPS = [
  'Deslize para os lados para trocar de faixa.',
  'Deslize para cima para pular, para baixo para rolar.',
  'Toque duas vezes para usar o power-up equipado.',
  'Colete os 8 EPIs em uma corrida para um bônus gigante.',
  'Coletar 4 EPIs seguidos ativa o Treinamento DDS (pontos x2).',
  'Placas piscando avisam o risco antes de ele chegar.',
];

/** Cartas educativas coletáveis durante a corrida */
export const EDU_CARDS = [
  'Pare, pense e aja.',
  'Use o caminho seguro.',
  'Respeite o isolamento.',
  'Atenção aos equipamentos móveis.',
  'Comunique quase acidentes.',
  'Não improvise ferramentas.',
  'Bloqueio e etiquetagem salvam vidas.',
];

/** Dica exibida no game over conforme a causa da colisão */
export const DEATH_TIPS: Record<CrashCause, string> = {
  cone: 'Cones sinalizam desvio. Reduza, observe e contorne com segurança.',
  cavalete: 'Cavaletes marcam frentes de trabalho. Nunca passe por cima da sinalização.',
  tambor: 'Tambores podem conter produtos perigosos. Mantenha distância e reporte se estiverem fora do lugar.',
  caixa: 'Material fora do lugar é risco de tropeço. Organização também é segurança.',
  palete: 'Paletes empilhados podem deslizar. Circule apenas por rotas liberadas.',
  bloco: 'Blocos e estruturas fixas exigem rota alternativa planejada, não improviso.',
  bobina: 'Bobinas de cabo podem rolar. Nunca circule no seu raio de movimento.',
  isolamento: 'Área isolada existe por um motivo. Respeite a fita e procure a rota segura.',
  tubulacao: 'Tubulações baixas exigem atenção à altura livre. Abaixe-se e sinalize o risco.',
  portao: 'Portões em fechamento têm prioridade. Nunca tente "passar no vão".',
  caminhao: 'Equipamento móvel sempre tem ponto cego. Só cruze com contato visual e autorização.',
  vagao: 'Trilhos são faixa exclusiva de vagões. Atravesse apenas em pontos autorizados.',
  braco: 'Equipamentos em manutenção podem se mover. Respeite o bloqueio e a etiqueta.',
  rocha: 'Queda de material é risco grave. Observe os avisos e nunca pare sob carga suspensa.',
  placa: 'Placas caídas indicam anormalidade. Comunique e desvie com atenção.',
  generico: 'Antes de agir, observe o risco. Atalho inseguro pode custar caro.',
};

export const MENU_TIPS = [
  'EPI é a última barreira, não a única.',
  'Equipamento móvel sempre tem ponto cego.',
  'Atalho inseguro pode custar caro.',
  'Quem corre com atenção chega mais longe.',
  'Área molhada pede passo firme: use botas antiderrapantes.',
  'A poeira esconde o risco. Máscara e atenção redobrada.',
];

export const EPI_NAMES: Record<EpiId, string> = {
  capacete: 'Capacete',
  oculos: 'Óculos de proteção',
  luvas: 'Luvas',
  botas: 'Botas de segurança',
  auricular: 'Protetor auricular',
  mascara: 'Máscara contra poeira',
  colete: 'Colete refletivo',
  radio: 'Rádio de comunicação',
};

export const EPI_LIST: EpiId[] = [
  'capacete',
  'oculos',
  'luvas',
  'botas',
  'auricular',
  'mascara',
  'colete',
  'radio',
];
