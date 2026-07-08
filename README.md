# ⛑️ Mina Segura Run

**Corra, desvie, colete EPIs e mantenha a operação segura.**

Infinite runner 3D em 3 faixas com câmera atrás do personagem, tema de **mineração, segurança do trabalho, operação industrial e meio ambiente**. Visual 3D estilizado semi-cartoon, educativo sem ser chato, pronto para navegador desktop, mobile e instalação como PWA.

> 100% de assets originais e procedurais: modelos por primitivas, texturas geradas em canvas, áudio sintetizado via WebAudio. Zero dependência de material com direitos autorais.

---

## Tecnologias

| Camada | Tecnologia | Por quê |
| --- | --- | --- |
| Linguagem | **TypeScript** (strict) | Segurança de tipos em todo o jogo |
| UI/Menus | **React 18** | Componentização das telas e HUD |
| 3D | **Three.js** | Engine 3D web leve e madura |
| Build | **Vite 5** | Dev server rápido e build otimizado |
| Estado | Mini-store própria (`useSyncExternalStore`) | Sem dependências extras |
| Áudio | **WebAudio API** (procedural) | Música/efeitos sem assets |
| Persistência | **localStorage** com validação | Save robusto offline |
| PWA | Manifest + Service Worker manual | Instalável e jogável offline |

Dependências de produção: apenas `react`, `react-dom` e `three`.

---

## Como instalar e rodar

```bash
npm install       # instala dependências
npm run dev       # dev server em http://localhost:5173
npm run build     # build de produção em /dist
npm run preview   # serve o build em http://localhost:4173
npm run typecheck # verificação de tipos
npm run icons     # regenera os ícones PNG da PWA (sem dependências)
```

Requisitos: Node.js 18+.

## Como testar no mobile

1. Rode `npm run dev` (o Vite já expõe na rede local com `host: true`);
2. No celular, acesse `http://SEU_IP_LOCAL:5173` (mesma rede Wi-Fi);
3. Para testar a PWA (service worker exige build): `npm run build && npm run preview` e acesse `http://SEU_IP:4173`;
4. No Chrome/Android ou Safari/iOS use **"Adicionar à tela inicial"** para instalar.

Também dá para testar o layout mobile no desktop com o device toolbar do DevTools (F12 → Ctrl+Shift+M).

## Deploy

O jogo é um site 100% estático (pasta `dist/`). Fallback de rota não é necessário (single page sem rotas), mas o service worker já faz network-first com fallback offline para o `index.html`.

**Vercel**
```bash
npm i -g vercel
vercel          # framework: Vite | build: npm run build | output: dist
```

**Netlify**
```bash
npm i -g netlify-cli
netlify deploy --prod --dir=dist
```
Ou arraste a pasta `dist/` em https://app.netlify.com/drop.

**Qualquer servidor estático**: copie o conteúdo de `dist/` para a raiz pública. O projeto usa `base: './'`, então funciona inclusive em subdiretórios.

**Apps nativos (opcional)**: por ser um build estático com touch controls e PWA, o projeto pode ser embrulhado com [Capacitor](https://capacitorjs.com) (`npx cap add android`) apontando `webDir: 'dist'`.

---

## Controles

| Ação | Mobile | Desktop |
| --- | --- | --- |
| Trocar de faixa | Deslizar ← / → | Setas ← → ou A/D |
| Pular | Deslizar ↑ | Seta ↑, W ou Espaço |
| Rolar | Deslizar ↓ | Seta ↓ ou S |
| Ativar power-up equipado | Toque duplo (ou botão do HUD) | Shift ou E |
| Pausar | Botão ⏸ no HUD | ESC ou P |

---

## Estrutura do projeto

```
/src
  /components      # telas React (menu, HUD, loja, pausa, game over, quiz…)
  /data            # conteúdo do jogo (skins, mapas, missões, quiz, padrões de obstáculos…)
  /game            # sistemas do jogo
    GameEngine.ts        # loop, câmera, qualidade, orquestração
    PlayerController.ts  # física, animação procedural, hitbox
    CharacterFactory.ts  # personagem 3D por primitivas (8 skins)
    ProceduralMap.ts     # geração infinita por módulos validados
    ObstacleManager.ts   # fábricas de meshes + pools de reuso
    CollisionSystem.ts   # AABB com tolerâncias justas
    PowerUpSystem.ts     # 8 power-ups temáticos
    MissionSystem.ts     # missões de segurança com progressão
    ScoreSystem.ts       # pontos, minérios e Índice de Segurança
    EventSystem.ts       # eventos aleatórios (poeira, chuva, apagão…)
    EnvironmentSystem.ts # biomas: céu, luzes, props por mapa
    ParticleSystem.ts    # partículas pooled (coleta, chuva, trilhas)
    AudioSystem.ts       # música/efeitos 100% sintetizados
    InputSystem.ts       # teclado + swipe com sensibilidade
    SaveSystem.ts        # save local validado + helpers de progresso
    TextureFactory.ts    # texturas canvas + paleta (modo daltônico)
  /state           # stores reativas (UI, HUD) e tipos
  /styles          # CSS industrial responsivo
/public
  manifest.webmanifest, sw.js, favicon.svg, icons/
/scripts
  generate-icons.mjs  # gera PNGs da PWA sem dependências
```

---

## Como estender o jogo

### Adicionar um novo mapa
1. Em `src/data/maps.ts`, adicione um item em `MAPS` com `id`, tema (cores de céu/solo/pista, `trackStyle`), requisitos de desbloqueio e `hazardBias`;
2. Adicione o novo id ao tipo `MapId` em `src/state/types.ts`;
3. (Opcional) Em `EnvironmentSystem.spawnRow`, crie o case do bioma com os props laterais; fábricas novas entram em `makeProp`.

### Adicionar um novo obstáculo
1. Em `src/data/obstacles.ts`, registre o tipo em `ObstacleTypeId`, `OBSTACLE_DEFS` (colisor + `kind`: `low` pular / `over` rolar / `full` bloqueio) e um caractere em `CHAR_OBSTACLE`;
2. Crie a fábrica do mesh em `ObstacleManager.ts` (case no `Pools.make`);
3. Use o caractere nos padrões `PATTERNS` — a validação automática (`validatePattern`) garante que nenhum padrão fique impossível;
4. Se tiver dica de game over própria, adicione a causa em `CrashCause` e `DEATH_TIPS`.

### Adicionar uma nova skin
1. Em `src/data/characters.ts`, adicione em `SKINS` (cores, raridade, preço, bônus, acessório);
2. Adicione o id ao tipo `SkinId` em `src/state/types.ts`;
3. (Opcional) Crie o acessório 3D no switch de `CharacterFactory.ts`;
4. (Opcional) Aplique o bônus em `GameEngine.startRun`.

### Alterar a dificuldade
Em `ProceduralMap.ts` e `GameEngine.ts`:
- Velocidade: `11 + distance * 0.011` com teto `speedCap` por mapa (`data/maps.ts`);
- Tier de dificuldade: `floor(distance / 250)` (0 a 8) seleciona padrões por `minTier/maxTier`;
- Frequência de riscos especiais: pesos em `pickSpecial` + `hazardBias` por mapa;
- Espaçamento: `bufferRows` em `spawnPatternChunk`.

---

## Funcionalidades implementadas

**Gameplay**
- Runner 3D em 3 faixas com pulo, rolagem, troca de faixa com buffer de input e hitbox justa (menor que o visual, com folga em transição de faixa);
- Geração procedural por módulos com validação automática de rota (nunca gera caminho impossível) e reciclagem de objetos (pools, zero alocação por frame);
- 11 obstáculos fixos + caminhão cruzando, vagão nos trilhos, portão fechando, braço mecânico e queda de rochas — todos com aviso antecipado (placa, luz piscando, alarme);
- Riscos especiais: poeira (visibilidade), área molhada (controle), vazamento sinalizado (Índice), correia com empuxo lateral;
- 8 power-ups temáticos (Escudo EPI, Rádio de Alerta, Botas, Máscara, Modo Inspeção, Caminho Seguro, DDS automático x2, Drone com ímã);
- Eventos aleatórios: poeira elevada, chuva, apagão (lanterna no capacete), mudança de turno e simulado de detonação com rota segura sinalizada;
- Dificuldade progressiva por distância com teto por mapa e ajuste automático de qualidade por FPS.

**Diferencial educativo**
- **Índice de Segurança** (sobe jogando seguro, desce em comportamento de risco) que multiplica o XP;
- Kit completo de 8 EPIs = bônus; 4 EPIs seguidos ativam o DDS (pontos x2);
- Cartas educativas rápidas, dicas de segurança no carregamento e no game over (contextual à causa da colisão);
- Quiz opcional de segurança a cada 3 corridas com recompensa.

**Meta-jogo**
- 6 mapas/biomas com pista, céu, iluminação, props e riscos próprios; desbloqueio por nível ou minérios;
- 8 skins com raridade e bônus leves; trilhas cosméticas;
- 12 missões com séries progressivas + 12 conquistas;
- Nível/XP, recordes, ranking local (top 8), recompensa diária com sequência;
- Loja com moeda interna (Minérios de Ouro), cargas e melhorias de power-ups, estrutura preparada para monetização futura (pacotes simulados, anúncio recompensado simulado — sem pagamentos reais).

**Plataforma**
- PWA instalável com service worker (funciona offline após a 1ª visita);
- Responsivo desktop/mobile, controles por swipe com sensibilidade ajustável, vibração;
- Acessibilidade: modo daltônico, redução de efeitos, desligar tremor de câmera, legendas nos alertas, botões grandes;
- Performance: pools de objetos, texturas canvas compartilhadas, partículas com buffers fixos, pausa de render com aba oculta, resolução adaptativa, 3 níveis de qualidade + automático;
- Save local validado com valores padrão e reset de progresso.

---

## Testes realizados

- `tsc --noEmit` sem erros (strict);
- `npm run build` de produção OK (~220 KB gzip no total);
- Jogo abre no navegador sem erros de console;
- Fluxo completo testado no navegador: carregamento → menu → como jogar → corrida (countdown, troca de faixa, pulo, rolagem via eventos de teclado verificados em runtime) → colisão → game over com dica contextual, recordes, conquistas e XP;
- Pausa/continua/reinicia; sair para o menu;
- Loja (compra de cargas, melhorias, trilhas, pacotes simulados), personagens (compra/equipar), mapas (seleção/desbloqueio/prévia), missões, ranking, configurações (volumes, qualidade, daltônico, reset com confirmação);
- Save/carregamento entre reloads; contagem de corridas, recordes e conquistas consistentes;
- Render pausa quando a aba fica oculta (verificado);
- Perfil de render em qualidade alta: ~130–300 draw calls, < 10k triângulos.

## Melhorias futuras sugeridas

- Ranking online (a estrutura de `RankEntry` já é serializável — basta um endpoint);
- Passe de segurança sazonal e eventos temporados (estrutura de eventos já existe);
- Mais idiomas (strings centralizadas em `src/data`);
- Modelos GLTF artesanais opcionais no lugar das primitivas (o `CharacterFactory` isola essa troca);
- Encapsulamento Capacitor com haptics nativos e leaderboard de loja de apps;
- Replays/ghosts locais e desafios diários com seed fixa (`ProceduralMap` já aceita seed);
- Modo treino guiado usando o sistema de missões.
