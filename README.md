# luan-portfolio

Portfólio de Luan Otoni. HTML, CSS e JS puros, sem build de front.

```bash
python3 tools/build.py          # gera index.html a partir de src.html
python3 -m http.server 8080     # e abra http://localhost:8080
```

## Projetos vêm do GitHub, sozinhos

A seção Projetos lê `api.github.com/users/luanotoni/repos` a cada visita (cache de 30 min no navegador; se a API falhar, usa `assets/repos.json`). Nada para editar no site quando você cria um repo. Para controlar pelo próprio GitHub, use tópicos no repositório:

- `destaque`: vira o projeto grande do topo (sem nenhum, vale o de mais estrelas e push mais recente)
- `proximo` ou `em-construcao`: vai para o bloco Próximos
- `oculto`: some do site
- forks, arquivados e o repo de perfil `luanotoni` já ficam de fora

Título em português, texto e imagens de um repo são opcionais, no objeto `EXTRA` em `js/site.js`. Sem isso, o site usa o nome e a descrição do GitHub.

`tools/build.py` também pré-renderiza a lista no HTML (para quem está sem JavaScript) e atualiza `assets/repos.json`; só precisa rodar quando `src.html` mudar.

## Peças

- O site é uma fase numa galáxia com cara de Star Wars, viajando pra longe: Terra e Lua no topo, depois Júpiter (LEDS) e Saturno (contato). As fotos da NASA viram pixel art no navegador. A rota na lateral direita (telas largas) mostra onde você está
- **Saltar**: aperte `/` (ou Ctrl/⌘+K, ou o botão Saltar), digite o destino e Enter salta pro hiperespaço. Também copia o e-mail, abre o GitHub, liga o som e leva pro jogo
- `js/pixel.js` desenha tudo em pixel art a partir de código, com volumes sombreados:
  - **Cursor**: caça de asas em X com um domo de astromecânico nas cores do C1-CD; inércia, rastro dos quatro motores, turbo, asas abrindo quando a mira trava num link, salto pro hiperespaço. Clique no vazio dispara lasers vermelhos, que acertam o droid, o rover e o invasor escondido (que leva pro jogo)
  - **C1-CD** (de CI/CD: integra e entrega): anda e pousa nos elementos da página, tem humores e emotes, vira as costas se levar tiro, roda o pipeline em cima de um projeto e fala em **hologramas**
  - **Observatório** (faixa sob os projetos): deserto à noite com duas luas, vaporizadores, cabana, sandcrawler, antenas que recebem o último push do GitHub e um observatório cujo telescópio segue a nave (clique para a ocular). O **rover** (Perseverance + WALL-E, em 3/4) passeia, escaneia o projeto sob o mouse, acena e tira selfie. **Jawas** tentam arrastar o rover de tempos em tempos (clique neles ou deixe o C1-CD chegar perto)
  - **O Império**: de 50 a 90 s um esquadrão de caças imperiais cruza a página atirando lasers verdes; dá pra derrubar com a nave (o C1-CD conta os abates). No contato, um destróier ataca Saturno até levar tiros suficientes e fugir pro hiperespaço
- **Destruição** (`js/caos.js`, `js/estacao.js`, `js/tropa.js`): os lasers desfazem os textos letra por letra, abrem crateras nos planetas e fotos e desintegram tudo em pixels; o backup restaura sozinho (texto em 11 s, planetas em 24 s, prédios do observatório em 30 s). No celular, sem nave, o toque atira no ponto tocado
  - **Estação de batalha** sobre o topo: carrega o superlaser e desintegra a Terra (ou a Lua). Um tiro no duto de exaustão, embaixo da trincheira, derruba ela; volta em 2 min
  - **Stormtroopers** descem de rapel nos blocos da página e atiram na nave; o **Vader** segura a nave com a Força e rebate tiros com o sabre. Tiro neles = desintegram em pixels
  - A nave tem casco: tiro empurra ela pra fora do cursor, ela solta fumaça, perde a ponta da asa e explode no zero; o C1-CD conserta quando ela passa em cima dele
  - Na janela Saltar dá pra chamar os stormtroopers, o Vader e a estação
- Fontes: Tektur nos títulos, Chakra Petch no texto
- `jogo.html`: o easter egg Defesa da VPC (código Konami, o invasor no rodapé/mapa, um tiro nele, ou a janela Saltar), com CSS/JS próprios em `css/jogo-base.css` e `js/jogo-ceu.js`

Design revisado com a skill [Hallmark](https://github.com/Nutlope/hallmark): carimbo e decisões no topo de `css/site.css`; rode `node ~/.claude/skills/hallmark/scripts/sloplint.mjs index.html css/site.css --render` antes de mudanças grandes.
