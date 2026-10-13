import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { createClient } from '@supabase/supabase-js';
import {
  Edit3, FileText, Plus, Moon, Sun,
  X, Feather, Menu, FileUp,
  GraduationCap, Compass, Users, Lightbulb, TrendingUp, Search,
  Trash2, Download, Upload, ChevronLeft, ChevronRight, BookOpen,
  User, Heart, MessageCircle, Send, Globe,
  Music, Play, Pause, SkipBack, SkipForward, Volume2, Share2, LogOut, Timer, Tag, MoreHorizontal
} from 'lucide-react';

// --- BANCO DE DADOS INDEXEDDB ASSÍNCRONO ---

const DB_NAME = 'EstudioNarrativoDB';
const DB_VERSION = 3;
let dbInstance = null;

const getDB = () => {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB não suportado neste ambiente.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (e) => {
      reject(new Error(`Erro ao abrir IndexedDB: ${e.target.error}`));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      dbInstance.onversionchange = () => {
        dbInstance.close();
        dbInstance = null;
      };
      dbInstance.onclose = () => {
        dbInstance = null;
      };
      resolve(dbInstance);
    };

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
      if (!db.objectStoreNames.contains('books')) db.createObjectStore('books', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('documents')) db.createObjectStore('documents', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('posts')) db.createObjectStore('posts', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('pdfs')) db.createObjectStore('pdfs', { keyPath: 'id' });
    };
  });
};

const dbGet = async (storeName, key) => {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = key ? store.get(key) : store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
};

const dbSet = async (storeName, val, key) => {
  try {
    const db = await getDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.onabort = () => resolve(false);
      tx.onerror = () => resolve(false);
      const store = tx.objectStore(storeName);
      if (key) store.put(val, key);
      else store.put(val);
      tx.oncomplete = () => resolve(true);
    });
  } catch (e) {
    console.error('Erro na gravação do IndexedDB:', e);
    return false;
  }
};

const dbDelete = async (storeName, key) => {
  try {
    const db = await getDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    });
  } catch {
    return false;
  }
};

// --- HELPERS ---

const calculateWords = (text = '') => {
  if (!text || typeof text !== 'string') return 0;
  const cleanText = text.trim();
  return cleanText ? (cleanText.match(/\S+/g) || []).length : 0;
};

const triggerSecureDownload = (content, filename, type) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// O React já escapa HTML ao renderizar, então aqui só removemos
// caracteres de controle (escapar &, < etc. faria o texto aparecer como "&amp;").
const sanitizeInput = (str = '') => {
  return String(str)
    .replace(/[\0\x08\x0B\x0C\x0E-\x1F]/g, '')
    .trim();
};

const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// --- DADOS INICIAIS ---

const LIVROS_INICIAIS = [
  {
    id: 'b1',
    title: 'A Sombra do Tempo',
    author: 'Alexandre Sousa',
    genre: 'Ficção Científica',
    coverColor: 'from-purple-600 to-indigo-800',
    synopsis: 'Uma jornada através das fendas temporais da Via Láctea, onde o passado e o futuro colidem em uma estação espacial abandonada.',
    content: `Capítulo 1: O Despertar\n\nO silêncio na estação espacial era quase ensurdecedor. Lucas olhou através da janela de quartzo e observou as estrelas distantes se contorcendo na dobra espacial.\n\n"Tudo pronto para o salto?", perguntou a inteligência artificial da nave, sua voz ecoando suavemente pelo painel de controle.\n\nA poeira estelar cobria a fiação do módulo principal. Nada naquelas coordenadas batia com os mapas galácticos antigos. Precisamos calibrar o reator secundário antes de avançar, alertou Lucas, ajustando as chaves do console.\n\nCapítulo 2: O Sinal\n\nUm bipe estridente cortou o ar estático do convés de comando. O painel holográfico piscou em carmesim.\n\n"Detectando emissão de táquions a 400 milhas náuticas", anunciou a IA. "Assinatura idêntica à nave de reconhecimento perdida há quarenta anos."`
  }
];

const PDFS_INICIAIS = [
  {
    id: 'doc_1',
    title: 'Manual de Escrita Criativa',
    fileName: 'manual_escrita.txt',
    size: '1.2 KB',
    uploadedAt: '2026-03-20',
    content: `A Estrutura Narrativa e a Arte de Contar Histórias\n\nA estrutura de três atos é um modelo utilizado na escrita dramática que divide uma história em três partes fundamentais: Exposição, Confronto e Resolução.\n\nNo Primeiro Ato, o universo e os personagens são apresentados. O incidente incitante rompe o equilíbrio do protagonista, forçando-o a tomar uma decisão transformadora.\n\nNo Segundo Ato, os obstáculos se multiplicam. O protagonista enfrenta provações e derrotas temporárias, culminando no ponto de maior tensão ou crise da jornada.\n\nNo Terceiro Ato, ocorre o clímax: o confronto final onde os dilemas centrais da história são resolvidos. Em seguida, a narrativa se encerra com a consolidação de um novo equilíbrio.`
  }
];

// --- PERFIL & COMUNIDADE ---

const AVATAR_GRADIENTS = [
  'from-indigo-500 to-purple-600',
  'from-rose-500 to-orange-500',
  'from-emerald-500 to-teal-600',
  'from-sky-500 to-blue-700',
  'from-amber-500 to-red-500',
  'from-fuchsia-500 to-pink-600'
];

const PERFIL_INICIAL = {
  name: 'Autor',
  handle: 'autor',
  bio: '',
  favoriteGenre: '',
  avatarColor: AVATAR_GRADIENTS[0]
};

// Posts de exemplo (fictícios) para a comunidade não começar vazia
const POSTS_INICIAIS = [
  {
    id: 'p_seed_1',
    isMine: false,
    authorName: 'Marina Lopes',
    authorHandle: 'marinalopes',
    authorColor: AVATAR_GRADIENTS[1],
    text: 'Alguém mais travou no segundo ato? Estou testando o método Snowflake para destravar meu romance de fantasia. Dicas são bem-vindas!',
    createdAt: '2026-10-08T14:00:00.000Z',
    likes: 4,
    likedByMe: false,
    comments: [
      { id: 'c_seed_1', isMine: false, authorName: 'Caio Andrade', text: 'Funcionou muito para mim. Comece pela frase única e vá expandindo.', createdAt: '2026-10-08T16:30:00.000Z' }
    ],
    sharedBook: null
  },
  {
    id: 'p_seed_2',
    isMine: false,
    authorName: 'Caio Andrade',
    authorHandle: 'caioandrade',
    authorColor: AVATAR_GRADIENTS[2],
    text: 'Terminei o primeiro capítulo do meu thriller. Feedback honesto é sempre bem-vindo.',
    createdAt: '2026-10-09T09:15:00.000Z',
    likes: 2,
    likedByMe: false,
    comments: [],
    sharedBook: {
      title: 'Quarto Fechado',
      genre: 'Thriller',
      synopsis: 'Um detetive aposentado investiga um crime impossível em uma mansão trancada por dentro.',
      excerpt: 'Capítulo 1\n\nA chave estava do lado de dentro da porta. Ninguém entrara, ninguém saíra, e ainda assim havia um corpo no centro da biblioteca.\n\n"Isso não é possível", murmurou o inspetor, passando a mão pelo batente.'
    }
  }
];

const Avatar = ({ name, color, src, size = 'w-10 h-10', text = 'text-base' }) => (
  <div className={`${size} ${text} shrink-0 rounded-full bg-gradient-to-br ${color || AVATAR_GRADIENTS[0]} flex items-center justify-center text-white font-bold`}>
    {src
      ? <img src={src} alt="" referrerPolicy="no-referrer" className="w-full h-full rounded-full object-cover" />
      : ((name || '?').trim().charAt(0).toUpperCase() || '?')}
  </div>
);

const formatPostDate = (iso) => {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
};

const APRENDIZAGEM_CONTEUDO = [
  {
    id: 'estruturas',
    title: 'Estrutura e Enredo',
    icon: Compass,
    description: 'Como organizar a história, controlar o ritmo e planejar sem travar.',
    resources: [
      'A Jornada do Escritor, de Christopher Vogler',
      'Story, de Robert McKee',
      'Save the Cat! Writes a Novel, de Jessica Brody'
    ],
    lessons: [
      {
        id: 'tres-atos',
        title: 'Estrutura de 3 Atos',
        tag: 'Arquitetura',
        level: 'Iniciante',
        minutes: 5,
        summary: "Divide a história em começo, meio e fim com funções claras: apresentar o mundo e o problema, complicar o conflito e resolvê-lo.",
        points: [
          "Ato 1 (cerca de 25%): apresenta o protagonista, o mundo comum e o incidente incitante, que quebra a rotina.",
          "Primeiro ponto de virada: o protagonista se compromete com o conflito e não pode mais voltar atrás.",
          "Ato 2 (cerca de 50%): obstáculos crescentes. No ponto médio (midpoint), algo muda o que ele sabe ou quer.",
          "Crise: o momento mais sombrio, em que a escolha parece impossível.",
          "Ato 3 (cerca de 25%): o clímax testa a escolha em ação, e a história chega a um novo equilíbrio."
        ],
        example: "Um bibliotecário encontra um mapa escondido num livro (incidente incitante). Ele rouba o livro para seguir a pista e passa a ser perseguido (primeiro ponto de virada). No meio da busca, descobre que o mapa foi forjado pelo próprio mentor (midpoint). Perde o mapa e o aliado (crise). No clímax, usa o que sabe sobre livros raros para desmascarar o mentor.",
        mistakes: [
          "Gastar mais de um terço do livro só na introdução.",
          "Segundo ato sem escalada: obstáculos de mesma intensidade cansam o leitor.",
          "Clímax resolvido por coincidência, e não por uma escolha do protagonista."
        ],
        exercise: "Escreva uma frase para cada marco da sua história: incidente incitante, primeiro ponto de virada, ponto médio, crise e clímax. Onde ficar vazio, a história precisa de trabalho."
      },
      {
        id: 'jornada-heroi',
        title: 'Jornada do Herói',
        tag: 'Mito e Fantasia',
        level: 'Intermediário',
        minutes: 6,
        summary: "Modelo de Joseph Campbell, adaptado por Christopher Vogler para o cinema e a literatura, que descreve a transformação do herói em doze estágios.",
        points: [
          "Partida: Mundo Comum, Chamado à Aventura, Recusa do Chamado, Encontro com o Mentor e Travessia do Primeiro Limiar.",
          "Iniciação: Testes, Aliados e Inimigos, Aproximação da Caverna Profunda, Provação e Recompensa.",
          "Retorno: Caminho de Volta, Ressurreição e Retorno com o Elixir.",
          "O essencial é a transformação: o herói volta diferente e traz algo de valor ao mundo comum."
        ],
        example: "Uma costureira de vila (Mundo Comum) recebe uma carta que a convoca ao palácio (Chamado). Hesita por causa da mãe doente (Recusa), até que uma velha tecelã a convence (Mentor). Ao cruzar o portão da cidade, não há volta (Primeiro Limiar).",
        mistakes: [
          "Seguir os doze passos como fórmula rígida: use como mapa, não como grade.",
          "Herói que não muda. A Ressurreição precisa custar algo.",
          "Esquecer o Retorno e terminar no clímax, sem mostrar o efeito no mundo comum."
        ],
        exercise: "Escolha um filme ou livro que você ama e identifique em quais estágios cada cena se encaixa. Depois faça o mesmo com a sua história e anote os estágios que faltam."
      },
      {
        id: 'snowflake',
        title: 'Método Floco de Neve',
        tag: 'Planejamento',
        level: 'Intermediário',
        minutes: 5,
        summary: "Método de Randy Ingermanson que expande a história aos poucos, de uma única frase até a lista de cenas, para planejar sem travar.",
        points: [
          "Passo 1: resuma a história em uma frase curta, sem nomes próprios, centrada no conflito.",
          "Passo 2: expanda para um parágrafo com cenário, três desastres e o final.",
          "Passo 3: crie uma ficha curta para cada personagem principal, com objetivo, motivação e conflito.",
          "Passos seguintes: aumente a sinopse para uma página e depois para quatro, até listar todas as cenas. O método tem dez passos, e os primeiros já dão uma base sólida."
        ],
        example: "Frase do passo 1: “Um bibliotecário tímido precisa desmascarar o mentor que forjou um mapa antes que uma coleção histórica seja destruída.”",
        mistakes: [
          "Tentar planejar tudo antes de escrever uma linha. Pare quando o plano der segurança para começar.",
          "Frase longa demais: se não cabe em um fôlego, o conflito ainda não está claro."
        ],
        exercise: "Escreva a frase do passo 1 para a sua história em até 15 palavras. Depois expanda para um parágrafo de cinco frases."
      },
      {
        id: 'ritmo-tensao',
        title: 'Ritmo e Tensão',
        tag: 'Técnica',
        level: 'Intermediário',
        minutes: 5,
        summary: "Alternar cenas de ação com momentos de reflexão controla a energia da leitura: tensão constante cansa, calma constante entedia.",
        points: [
          "Cena de ação: objetivo, conflito e desastre. O personagem quer algo, é impedido e a situação piora.",
          "Sequência de reflexão: reação, dilema e decisão. O personagem processa o desastre e escolhe o próximo passo. É o modelo de cena e sequência, de Dwight V. Swain.",
          "Frases curtas e parágrafos breves aceleram a leitura. Descrições e frases longas desaceleram.",
          "Termine capítulos com uma pergunta aberta ou uma mudança de situação para puxar o leitor."
        ],
        example: "Cena: ele corre para alcançar o trem (objetivo), o portão fecha (conflito) e o trem parte com a prova dentro (desastre). Sequência: sentado na plataforma, sente raiva (reação), pondera entre ligar para a polícia ou seguir de táxi (dilema) e escolhe o táxi (decisão).",
        mistakes: [
          "Capítulos inteiros de ação sem respiro: o leitor perde o vínculo emocional.",
          "Reflexões longas logo após o desastre, quando a história já está lenta."
        ],
        exercise: "Escolha um capítulo seu e marque cada cena como ação ou reflexão. Se houver mais de três do mesmo tipo seguidas, tente alternar."
      }
    ]
  },
  {
    id: 'personagens',
    title: 'Personagens',
    icon: Users,
    description: 'Motivações, papéis e arquétipos para criar pessoas que o leitor acredita.',
    resources: [
      'Creating Character Arcs, de K. M. Weiland',
      'O Homem e seus Símbolos, de Carl Jung e colaboradores',
      'The Hero Within, de Carol S. Pearson'
    ],
    lessons: [
      {
        id: 'ficha-profunda',
        title: 'A Ficha de Personagem Profunda',
        tag: 'Psicologia',
        level: 'Intermediário',
        minutes: 5,
        summary: "Personagens convincentes têm um desejo claro, uma necessidade que ainda não enxergam e uma ferida que explica por que agem como agem.",
        points: [
          "Desejo (want): o que o personagem persegue de forma consciente ao longo da trama.",
          "Necessidade (need): o que ele realmente precisa para crescer e ainda não percebe.",
          "Ferida (ghost ou wound): um evento do passado que moldou seus medos.",
          "Mentira: a crença equivocada que ele usa para se proteger e que o arco vai desafiar.",
          "Arco: positivo (supera a mentira), negativo (cede a ela) ou estático (mantém-se firme e transforma o mundo ao redor)."
        ],
        example: "Marta quer a promoção (desejo), mas precisa aprender a pedir ajuda (necessidade). Foi abandonada na infância depois de confiar demais (ferida) e acredita que “quem depende dos outros sempre perde” (mentira).",
        mistakes: [
          "Listar traços físicos sem nenhum conflito interno.",
          "Uma ferida dramática que não aparece em nenhuma decisão do personagem.",
          "Resolver o arco com um discurso, em vez de uma escolha em cena."
        ],
        exercise: "Escreva em uma frase cada: desejo, necessidade, ferida e mentira do seu protagonista. Depois escreva uma cena curta em que a mentira o leva a uma decisão ruim."
      },
      {
        id: 'tipos-papeis',
        title: 'Tipos e Papéis Funcionais',
        tag: 'Elenco',
        level: 'Iniciante',
        minutes: 4,
        summary: "Cada personagem importante cumpre uma função na história. Entender os papéis ajuda a equilibrar o elenco e evitar figurantes sem propósito.",
        points: [
          "Protagonista: quem move a ação e sofre a mudança central.",
          "Antagonista: a força de oposição, com motivos próprios e a convicção de estar certo.",
          "Mentor: oferece conhecimento, ferramenta ou coragem, e muitas vezes sai de cena.",
          "Aliados e coadjuvantes: ampliam o mundo, dão voz às dúvidas e revelam facetas do protagonista.",
          "Contraponto (foil): personagem que contrasta com o protagonista e destaca suas qualidades e falhas.",
          "Um mesmo personagem pode acumular papéis, e os papéis podem mudar ao longo da história."
        ],
        example: "Num romance policial, a detetive é a protagonista, o promotor que quer encerrar o caso depressa é o contraponto, e a legista veterana é a mentora que oferece a pista decisiva.",
        mistakes: [
          "Antagonista caricato, sem lógica própria.",
          "Personagens secundários que só existem para explicar a trama."
        ],
        exercise: "Liste os personagens da sua história e escreva ao lado a função de cada um. Se dois cumprem a mesma função sem diferença, considere fundi-los."
      },
      {
        id: 'arquetipos',
        title: 'Arquétipos Junguianos',
        tag: 'Teoria',
        level: 'Avançado',
        minutes: 5,
        summary: "Carl Jung descreveu padrões universais do inconsciente coletivo. Autores usam os arquétipos como ponto de partida e depois os subvertem para criar personagens únicos.",
        points: [
          "Adaptações populares, como a de Carol Pearson, listam doze arquétipos, entre eles o Inocente, o Herói, o Cuidador, o Rebelde, o Amante, o Criador, o Sábio, o Mago e o Governante.",
          "Cada arquétipo tem um desejo central e um medo. O Herói quer provar seu valor e teme a fraqueza. O Sábio busca a verdade e teme a ignorância.",
          "Sombra: o lado negativo ou reprimido de um arquétipo, útil para criar vilões e conflitos internos.",
          "Combine arquétipos. Um Cuidador cuja sombra é o controle é mais interessante do que um santo."
        ],
        example: "Uma Governante que protege seu reino (desejo de ordem) e, sob pressão, vira tirana (sombra) cria conflito sem precisar de um vilão externo.",
        mistakes: [
          "Usar o arquétipo como etiqueta e parar por aí.",
          "Ignorar a sombra: personagens só virtuosos soam falsos."
        ],
        exercise: "Escolha dois arquétipos para o seu protagonista, um principal e um secundário. Escreva uma situação em que a sombra de um atrapalha o outro."
      }
    ]
  },
  {
    id: 'definicoes',
    title: 'Ponto de Vista, Mundo e Prosa',
    icon: Lightbulb,
    description: 'Quem conta a história, onde ela acontece e como o texto convence.',
    resources: [
      'Sobre a Escrita, de Stephen King',
      'Wonderbook, de Jeff VanderMeer',
      'Ensaios de Brandon Sanderson sobre sistemas de magia'
    ],
    lessons: [
      {
        id: 'pov',
        title: 'Ponto de Vista',
        tag: 'Perspectiva',
        level: 'Iniciante',
        minutes: 5,
        summary: "O ponto de vista define quem conta a história e quanto o leitor pode saber. É uma das primeiras e mais importantes decisões do autor.",
        points: [
          "1ª pessoa: íntima e direta. Limita o leitor ao que o narrador sabe e permite narradores não confiáveis.",
          "3ª pessoa limitada: acompanha um personagem por cena, com acesso aos pensamentos dele.",
          "3ª pessoa onisciente: visão panorâmica, com acesso a vários personagens. Exige cuidado para não confundir o leitor.",
          "Evite o “salto de cabeça” (head-hopping): trocar de ponto de vista no meio da cena sem aviso.",
          "Um ponto de vista por cena é uma regra prática segura."
        ],
        example: "1ª pessoa: “Não vi o carro até ouvir o freio.” 3ª limitada: “Ela não viu o carro até ouvir o freio.” Onisciente: “Ninguém na rua viu o carro, e só o motorista sabia que os freios estavam falhando.”",
        mistakes: [
          "Revelar, no pensamento do narrador, algo que ele não poderia saber.",
          "Trocar de personagem dentro do mesmo parágrafo."
        ],
        exercise: "Reescreva uma cena sua em outra pessoa narrativa, por exemplo de 3ª limitada para 1ª. O que você ganhou? O que perdeu?"
      },
      {
        id: 'worldbuilding',
        title: 'Construção de Mundo',
        tag: 'Ambientação',
        level: 'Intermediário',
        minutes: 6,
        summary: "Um mundo bem construído parece ter vida além da página. Regras consistentes e detalhes bem escolhidos importam mais do que volume de informação.",
        points: [
          "Leis de Sanderson para magia: a capacidade de resolver conflitos com magia é proporcional ao quanto o leitor a entende; limitações são mais interessantes que poderes; expanda o que já existe antes de acrescentar algo novo.",
          "Magia dura tem regras explícitas e pode resolver problemas. Magia suave é misteriosa e serve mais à atmosfera.",
          "Pense nas consequências: se existe teletransporte, como ficam o comércio, a guerra e as fronteiras?",
          "Mostre o mundo pelos olhos dos personagens, em pequenos detalhes, e evite despejos de informação (info dump).",
          "Mantenha uma “bíblia do mundo” com regras, nomes, mapas e cronologia."
        ],
        example: "Num mundo em que a água é paga por quem a usa, uma cena de jantar já mostra a desigualdade: quem desperdiça uma jarra à mesa exibe riqueza.",
        mistakes: [
          "Prólogos longos que explicam o mundo antes de haver história.",
          "Regras que mudam sempre que a trama precisa."
        ],
        exercise: "Escolha uma regra do seu mundo (de magia, política ou tecnologia) e escreva três consequências práticas dela na vida de pessoas comuns."
      },
      {
        id: 'show-dont-tell',
        title: 'Mostre, Não Conte',
        tag: 'Escrita',
        level: 'Iniciante',
        minutes: 4,
        summary: "Em vez de declarar emoções e intenções, mostre sinais concretos: ações, falas, sensações e detalhes que levem o leitor a concluir sozinho.",
        points: [
          "Troque rótulos por sinais. Em vez de “ele estava nervoso”, mostre as mãos suando ou a caneta que ele não para de girar.",
          "Use os cinco sentidos, e não só a visão.",
          "Contar não é proibido: resumos servem para passagens de tempo e informações de pouca importância.",
          "Mostre os momentos-chave e conte o resto."
        ],
        example: "Contado: “Ana estava com raiva.” Mostrado: “Ana dobrou o bilhete duas vezes, depois uma terceira, até ele caber no punho fechado.”",
        mistakes: [
          "Mostrar tudo e deixar o texto lento.",
          "Sinais clichê, como o coração disparado em toda cena de medo."
        ],
        exercise: "Pegue três frases suas que nomeiam uma emoção (“estava triste”, “ficou com medo”) e reescreva cada uma usando só ações e detalhes."
      },
      {
        id: 'dialogos',
        title: 'Diálogos Naturais',
        tag: 'Escrita',
        level: 'Intermediário',
        minutes: 5,
        summary: "Bons diálogos revelam o personagem e fazem a história avançar. Soam como fala real, mas sem as repetições e pausas inúteis.",
        points: [
          "Cada fala deve cumprir ao menos uma função: revelar caráter, trazer informação ou aumentar o conflito.",
          "Subtexto: as pessoas raramente dizem exatamente o que querem, e o que fica nas entrelinhas gera tensão.",
          "Dê a cada personagem um jeito próprio de falar, com vocabulário, ritmo e interrupções característicos.",
          "Prefira “disse” e “perguntou”. Verbos e advérbios exagerados chamam atenção demais.",
          "Leia em voz alta: se você tropeçar, o leitor também vai tropeçar."
        ],
        example: "“Está tudo bem?” “Está.” “Você nem tocou no jantar.” “Já comi na rua.” A resposta curta e a desculpa mostram que há algo errado, sem que ninguém diga.",
        mistakes: [
          "Diálogo usado só para informar o leitor (“Como você sabe, meu irmão...”).",
          "Todos os personagens falando do mesmo jeito."
        ],
        exercise: "Escreva uma conversa de dez falas em que um personagem quer algo e não pode pedir diretamente."
      },
      {
        id: 'abertura',
        title: 'Aberturas e Ganchos',
        tag: 'Escrita',
        level: 'Intermediário',
        minutes: 4,
        summary: "As primeiras páginas decidem se o leitor continua. Uma boa abertura apresenta uma pessoa, um desejo e uma pergunta.",
        points: [
          "Comece perto da mudança: o dia em que algo é diferente, e não a manhã de rotina.",
          "Dê ao leitor alguém com quem se importar: um desejo, um medo ou uma voz marcante.",
          "Levante uma pergunta que a próxima página responda só em parte.",
          "Evite abrir com sonho, despertador, previsão do tempo ou descrição diante do espelho.",
          "Não prometa o que o livro não vai cumprir: a abertura define o tom e o gênero."
        ],
        example: "“No dia em que o relógio da praça parou, só a Clara percebeu.” Há uma pessoa, um fato estranho e uma pergunta.",
        mistakes: [
          "Começar com informações de bastidor, como a história do mundo ou do personagem.",
          "Um gancho espetacular sem relação com o resto do livro."
        ],
        exercise: "Escreva três versões da primeira frase da sua história: uma com ação, uma com voz e uma com pergunta. Mostre a um leitor e veja qual o faz querer continuar."
      }
    ]
  },
  {
    id: 'oficio',
    title: 'Revisão e Rotina',
    icon: Edit3,
    description: 'Como terminar o rascunho e transformá-lo em um texto melhor.',
    resources: [
      'Bird by Bird, de Anne Lamott',
      'Sobre a Escrita, de Stephen King'
    ],
    lessons: [
      {
        id: 'revisao-camadas',
        title: 'Revisão em Camadas',
        tag: 'Revisão',
        level: 'Intermediário',
        minutes: 5,
        summary: "Revisar tudo de uma vez cansa e deixa passar erros. Trabalhe em camadas, do mais amplo ao mais fino.",
        points: [
          "1ª camada, estrutura: a trama faz sentido? Há cenas que não mudam nada e podem sair?",
          "2ª camada, personagens e ritmo: motivações coerentes, arcos completos e capítulos equilibrados.",
          "3ª camada, cena a cena: objetivo, conflito e fechamento de cada cena.",
          "4ª camada, linguagem: repetições, vícios, clichês e frases pesadas.",
          "Última camada, revisão final: ortografia, pontuação e formatação.",
          "Deixe o texto descansar alguns dias entre o rascunho e a revisão, para reler com olhos novos."
        ],
        example: "Ao ler o terceiro capítulo, você nota que o mentor some sem explicação. Isso é problema de estrutura (camada 1) e deve ser resolvido antes de corrigir vírgulas.",
        mistakes: [
          "Corrigir vírgulas em cenas que vão ser cortadas.",
          "Começar a revisão antes de terminar o rascunho."
        ],
        exercise: "Escolha um capítulo e faça só a primeira camada: escreva uma frase dizendo o que muda na história nesse capítulo. Se não conseguir, ele é candidato a corte ou reescrita."
      },
      {
        id: 'habito',
        title: 'Hábito de Escrita',
        tag: 'Rotina',
        level: 'Iniciante',
        minutes: 4,
        summary: "Terminar um livro depende mais de constância do que de inspiração. Uma rotina pequena e realista vence maratonas esporádicas.",
        points: [
          "Defina uma meta mínima viável, como 200 a 300 palavras, e comemore quando bater.",
          "Escolha um horário fixo e um gatilho, como depois do café ou antes de dormir.",
          "Separe escrever de revisar: no rascunho, avance sem corrigir.",
          "Anote onde parou e o que vem a seguir, para começar rápido no dia seguinte.",
          "Use a meta diária e a sequência de dias do Estúdio Narrativo para acompanhar o progresso."
        ],
        example: "Quem escreve 300 palavras por dia soma mais de 100 mil palavras em um ano, o suficiente para um romance.",
        mistakes: [
          "Metas enormes que geram culpa e abandono.",
          "Esperar o clima perfeito para escrever."
        ],
        exercise: "Defina sua meta diária no editor e escreva por 15 minutos hoje, sem apagar nada."
      }
    ]
  },
  {
    id: 'tendencias',
    title: 'Gêneros e Mercado Editorial',
    icon: TrendingUp,
    description: 'O que os leitores esperam de cada gênero e como publicar.',
    resources: [
      'Write. Publish. Repeat., de Sean Platt e Johnny B. Truant',
      'Central de ajuda do Amazon KDP (regras e taxas atualizadas)'
    ],
    lessons: [
      {
        id: 'fantasia-romantasy',
        title: 'Fantasia e Romantasy',
        tag: 'Tendência',
        level: 'Iniciante',
        minutes: 4,
        summary: "A fantasia é um dos gêneros mais populares do mercado. O Romantasy mistura fantasia e romance e ganhou muito espaço nos últimos anos.",
        points: [
          "Alta fantasia: mundo inteiramente inventado, com sistemas próprios de magia e política.",
          "Fantasia urbana: elementos mágicos no mundo contemporâneo.",
          "Romantasy: o romance é parte central da trama, e a tensão emocional pesa tanto quanto o conflito externo.",
          "Leitores esperam as promessas do gênero: um mundo imersivo, regras claras de magia e uma relação central que evolui.",
          "Conhecer os subgêneros ajuda a posicionar o livro na sinopse, na capa e na divulgação."
        ],
        example: "Uma curandeira e um cavaleiro de reinos inimigos precisam cooperar para impedir uma guerra, e a relação entre eles evolui junto com o conflito. É um enredo típico de Romantasy.",
        mistakes: [
          "Seguir a tendência sem afinidade com o gênero: leitores percebem.",
          "Prometer romance na sinopse e entregar quase nada."
        ],
        exercise: "Escreva a sinopse da sua história em três linhas, citando o gênero e a promessa feita ao leitor."
      },
      {
        id: 'thriller',
        title: 'Thriller e Ficção Policial',
        tag: 'Gênero',
        level: 'Intermediário',
        minutes: 5,
        summary: "O gênero se sustenta em perguntas e respostas bem administradas: o leitor quer saber quem fez, como, por quê e o que vai acontecer.",
        points: [
          "Mistério de quarto fechado (locked-room): um crime aparentemente impossível, com um conjunto fechado de suspeitos.",
          "Procedural: acompanha o método de investigação com realismo.",
          "Thriller psicológico: a tensão vem da mente dos personagens e de narradores pouco confiáveis.",
          "Jogo limpo: dê ao leitor as pistas necessárias para chegar à solução antes ou junto com o detetive.",
          "Reviravoltas memoráveis nascem de pistas plantadas antes e reinterpretadas depois."
        ],
        example: "Se a pista decisiva é um relógio que adianta cinco minutos, mencione o relógio no capítulo 2 como um detalhe de cena. No final, ele muda o álibi.",
        mistakes: [
          "Solução que depende de uma informação que o leitor nunca recebeu.",
          "Revelar o culpado cedo demais ou por uma conversa explicativa."
        ],
        exercise: "Liste as cinco pistas do seu mistério e em qual capítulo cada uma aparece. Verifique se o leitor teria uma chance justa de resolver."
      },
      {
        id: 'ficcao-cientifica',
        title: 'Ficção Científica',
        tag: 'Gênero',
        level: 'Intermediário',
        minutes: 5,
        summary: "A ficção científica explora perguntas do tipo “e se...?” sobre ciência, tecnologia e sociedade. Os subgêneros variam em tom e rigor.",
        points: [
          "Cyberpunk: futuro urbano de alta tecnologia e baixa qualidade de vida, com corporações poderosas.",
          "Space opera: aventura em escala interestelar, com ênfase em personagens e conflitos épicos.",
          "Solarpunk: futuro otimista, com tecnologia sustentável e comunidades cooperativas.",
          "Sci-fi hard: ciência rigorosa, em que a plausibilidade científica faz parte do prazer da leitura.",
          "Escolha uma pergunta central (“e se...?”) e explore as consequências humanas dela."
        ],
        example: "“E se a memória pudesse ser vendida?” leva a questões de desigualdade, identidade e crime, e gera personagens e conflitos de forma natural.",
        mistakes: [
          "Explicar a tecnologia com mais detalhes do que a história precisa.",
          "Criar um futuro em que a sociedade é igual à de hoje."
        ],
        exercise: "Escreva a pergunta “e se...?” da sua história e três mudanças que ela provoca na vida cotidiana."
      },
      {
        id: 'autopublicacao',
        title: 'Mercado Digital e Autopublicação',
        tag: 'Carreira',
        level: 'Avançado',
        minutes: 6,
        summary: "Publicar por conta própria dá controle, mas exige cuidar de revisão, capa, divulgação e leitores.",
        points: [
          "Plataformas como o Amazon KDP permitem publicar e-books e livros impressos sob demanda.",
          "Os investimentos que mais pesam são a revisão profissional, uma capa adequada ao gênero e uma sinopse atraente.",
          "Metadados (título, subtítulo, categorias e palavras-chave) ajudam os leitores a encontrar o livro.",
          "Construa uma comunidade de leitores antes e depois do lançamento: newsletter, redes sociais e clubes de leitura.",
          "Confira as regras, taxas e prazos atuais da plataforma antes de publicar, porque mudam com frequência."
        ],
        example: "Imagine duas capas: uma de fantasia, com ilustração e tipografia ornamentada, e outra minimalista. O leitor do gênero reconhece a primeira como fantasia em segundos, e isso influencia o clique.",
        mistakes: [
          "Publicar sem revisão externa.",
          "Usar uma capa que não comunica o gênero.",
          "Divulgar só no dia do lançamento."
        ],
        exercise: "Escreva a sinopse do seu livro em 100 palavras e liste três livros semelhantes que o seu leitor ideal já leu."
      }
    ]
  }
];

// --- LEITURA CONFORTÁVEL, PDF, MÚSICA E CONTA GOOGLE ---

// Crie um "OAuth Client ID" (tipo Aplicativo da Web) no Google Cloud Console e cole aqui.
// Adicione a origem do app (ex.: http://localhost:5173) em "Origens JavaScript autorizadas".
const GOOGLE_CLIENT_ID = 'COLE_SEU_CLIENT_ID.apps.googleusercontent.com';

// Worker via CDN, na mesma versão instalada (evita problemas de bundling no react-scripts).
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
const MAX_PDF_BYTES = 25 * 1024 * 1024;

// Junta as linhas quebradas do PDF em parágrafos (heurística: linhas curtas encerram parágrafo).
const reflowPdfText = (raw) => {
  const lines = raw.split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (lines.length === 0) return '';
  const lens = lines.map(l => l.length).sort((a, b) => a - b);
  const median = lens[Math.floor(lens.length / 2)];
  const paragraphs = [];
  let current = lines[0];
  let lastLen = lines[0].length;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (/[a-zà-ú]-$/i.test(current) && /^[a-zà-ú]/.test(line)) current = current.slice(0, -1) + line;
    else if (lastLen < median * 0.6 && !/[,;]$/.test(current)) { paragraphs.push(current); current = line; }
    else current += ' ' + line;
    lastLen = line.length;
  }
  paragraphs.push(current);
  return paragraphs.join('\n');
};

const extractPdf = async (buffer) => {
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  let raw = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const { items } = await page.getTextContent();
    raw += items.map(it => (it.str ?? '') + (it.hasEOL ? '\n' : '')).join('').replace(/\n?$/, '\n');
  }
  const numPages = pdf.numPages;
  await pdf.destroy();
  return { numPages, text: reflowPdfText(raw) };
};

const decodeJwt = (token) => {
  const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(payload), c => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
};

// --- Leitor com modo de leitura confortável ---
const READER_THEMES = {
  light: { bg: '#fafaf9', fg: '#1c1917', border: '#e7e5e4', label: 'Claro' },
  sepia: { bg: '#f4ecd8', fg: '#433422', border: '#e0d3b0', label: 'Sépia' },
  dark: { bg: '#0f172a', fg: '#cbd5e1', border: '#1e293b', label: 'Escuro' }
};

// Divide o texto em trechos curtos para a leitura em voz alta (evita cortes em textos longos)
const toChunks = (text) => {
  const sentences = String(text).replace(/\s+/g, ' ').match(/[^.!?]+[.!?]*/g) || [];
  const chunks = [];
  let cur = '';
  for (const sen of sentences) {
    if ((cur + sen).length > 220 && cur) { chunks.push(cur.trim()); cur = sen; }
    else cur += sen;
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
};

const ComfortReader = ({ title, pages, onClose, defaultTheme, docKey }) => {
  const [idx, setIdx] = useState(0);
  const [query, setQuery] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [notes, setNotes] = useState([]);
  const [notesOpen, setNotesOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [quoteDraft, setQuoteDraft] = useState('');
  const [prefs, setPrefs] = useState({ theme: defaultTheme, size: 19, serif: true, spacing: 1.8, width: 65, rate: 1 });
  const scrollRef = useRef(null);
  const articleRef = useRef(null);
  const progressRef = useRef({});
  const progressLoaded = useRef(false);
  const notesMapRef = useRef({});
  const t = READER_THEMES[prefs.theme] || READER_THEMES.sepia;
  const total = pages.length || 1;
  const q = query.trim().toLowerCase();
  const supportsTts = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance !== 'undefined';

  useEffect(() => {
    let alive = true;
    dbGet('settings', 'readerPrefs').then(saved => { if (alive && saved) setPrefs(p => ({ ...p, ...saved })); });
    return () => { alive = false; };
  }, []);

  // Retoma a página onde a pessoa parou neste documento
  useEffect(() => {
    let alive = true;
    progressLoaded.current = false;
    dbGet('settings', 'readingProgress').then(map => {
      if (!alive) return;
      progressRef.current = map || {};
      const saved = docKey ? progressRef.current[docKey] : 0;
      if (Number.isInteger(saved)) setIdx(Math.min(Math.max(0, saved), total - 1));
      progressLoaded.current = true;
    });
    return () => { alive = false; };
  }, [docKey, total]);

  useEffect(() => {
    if (!docKey || !progressLoaded.current) return;
    progressRef.current = { ...progressRef.current, [docKey]: idx };
    dbSet('settings', progressRef.current, 'readingProgress');
  }, [idx, docKey]);

  // Marcadores e anotações deste documento
  useEffect(() => {
    let alive = true;
    dbGet('settings', 'annotations').then(map => {
      if (!alive) return;
      notesMapRef.current = map || {};
      setNotes(docKey ? (notesMapRef.current[docKey] || []) : []);
    });
    return () => { alive = false; };
  }, [docKey]);

  const persistNotes = (next) => {
    setNotes(next);
    if (!docKey) return;
    notesMapRef.current = { ...notesMapRef.current, [docKey]: next };
    dbSet('settings', notesMapRef.current, 'annotations');
  };

  const isMarked = notes.some(n => n.kind === 'bookmark' && n.page === idx);
  const toggleBookmark = () => {
    if (isMarked) {
      persistNotes(notes.filter(n => !(n.kind === 'bookmark' && n.page === idx)));
    } else {
      persistNotes([...notes, { id: `n_${Date.now()}`, kind: 'bookmark', page: idx, quote: '', text: '', createdAt: new Date().toISOString() }]);
    }
  };

  const captureSelection = () => {
    const sel = window.getSelection();
    const picked = sel ? sel.toString().trim() : '';
    const inside = sel && sel.anchorNode && articleRef.current && articleRef.current.contains(sel.anchorNode);
    if (picked && inside) setQuoteDraft(picked.slice(0, 400));
    setNotesOpen(true);
  };

  const addNote = () => {
    const text = noteText.trim().slice(0, 1000);
    const quote = quoteDraft.trim().slice(0, 400);
    if (!text && !quote) return;
    persistNotes([...notes, { id: `n_${Date.now()}`, kind: 'note', page: idx, quote, text, createdAt: new Date().toISOString() }]);
    setNoteText('');
    setQuoteDraft('');
  };

  const sortedNotes = useMemo(
    () => [...notes].sort((a, b) => a.page - b.page || String(a.createdAt).localeCompare(String(b.createdAt))),
    [notes]
  );

  const update = (patch) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    dbSet('settings', next, 'readerPrefs');
  };
  const go = useCallback((d) => setIdx(i => Math.min(total - 1, Math.max(0, i + d))), [total]);

  const hits = useMemo(
    () => (q.length < 2 ? [] : pages.map((pg, i) => (pg.toLowerCase().includes(q) ? i : -1)).filter(i => i >= 0)),
    [pages, q]
  );
  const jumpHit = (dir) => {
    if (!hits.length) return;
    const next = dir > 0
      ? (hits.find(h => h > idx) ?? hits[0])
      : ([...hits].reverse().find(h => h < idx) ?? hits[hits.length - 1]);
    setIdx(next);
  };

  // Leitura em voz alta: lê a página atual e segue para a próxima até o fim ou até parar
  useEffect(() => {
    if (!speaking || !supportsTts) return;
    const chunks = toChunks(pages[idx] || '');
    let cancelled = false;
    const run = (i) => {
      if (cancelled) return;
      if (i >= chunks.length) {
        if (idx < total - 1) setIdx(idx + 1);
        else setSpeaking(false);
        return;
      }
      const u = new window.SpeechSynthesisUtterance(chunks[i]);
      u.lang = 'pt-BR';
      u.rate = prefs.rate || 1;
      u.onend = () => run(i + 1);
      u.onerror = () => { if (!cancelled) setSpeaking(false); };
      window.speechSynthesis.speak(u);
    };
    window.speechSynthesis.cancel();
    run(0);
    return () => { cancelled = true; window.speechSynthesis.cancel(); };
  }, [speaking, idx, pages, total, prefs.rate, supportsTts]);

  useEffect(() => () => { if (window.speechSynthesis) window.speechSynthesis.cancel(); }, []);

  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target && e.target.tagName;
      if (e.key === 'Escape') onClose();
      else if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); }, [idx]);

  const btn = (active) => `px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${active ? 'bg-indigo-600 border-indigo-600 text-white' : 'hover:bg-black/10'}`;
  const opts = (list, key) => list.map(([label, val]) => (
    <button key={label} type="button" onClick={() => update({ [key]: val })} className={btn(prefs[key] === val)} style={{ borderColor: t.border }} aria-pressed={prefs[key] === val}>{label}</button>
  ));
  const nav = 'flex items-center gap-1 px-3 py-1.5 rounded-lg border disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black/10';

  const pageText = pages[idx] || '';
  const parts = q.length >= 2 ? pageText.split(new RegExp(`(${escapeRegExp(q)})`, 'gi')) : [pageText];

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex flex-col" style={{ background: t.bg, color: t.fg }}>
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b" style={{ borderColor: t.border }}>
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="w-5 h-5 text-indigo-500 shrink-0" />
          <h3 className="font-bold text-sm truncate">{title}</h3>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/10" aria-label="Fechar leitor">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 border-b text-xs" style={{ borderColor: t.border }}>
        <button type="button" onClick={() => setShowSettings(v => !v)} className={btn(showSettings)} style={{ borderColor: t.border }} aria-pressed={showSettings} aria-label="Ajustes de texto">Aa</button>
        {showSettings && (
          <>
        <div className="flex items-center gap-1">
          {Object.entries(READER_THEMES).map(([key, v]) => (
            <button key={key} type="button" onClick={() => update({ theme: key })} className={btn(prefs.theme === key)} style={{ borderColor: v.border }} aria-pressed={prefs.theme === key}>{v.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => update({ size: Math.max(14, prefs.size - 1) })} className={btn(false)} style={{ borderColor: t.border }} aria-label="Diminuir letra">A−</button>
          <span className="w-8 text-center tabular-nums">{prefs.size}</span>
          <button type="button" onClick={() => update({ size: Math.min(32, prefs.size + 1) })} className={btn(false)} style={{ borderColor: t.border }} aria-label="Aumentar letra">A+</button>
        </div>
        <div className="flex items-center gap-1">{opts([['Serifa', true], ['Sem serifa', false]], 'serif')}</div>
        <div className="flex items-center gap-1">{opts([['Estreita', 50], ['Média', 65], ['Larga', 80]], 'width')}</div>
        <div className="flex items-center gap-1">{opts([['Compacto', 1.5], ['Normal', 1.8], ['Amplo', 2.1]], 'spacing')}</div>
        </>
        )}
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') jumpHit(e.shiftKey ? -1 : 1); }}
            placeholder="Buscar no texto"
            aria-label="Buscar no texto"
            className="px-2 py-1 rounded-lg border text-xs bg-transparent w-36 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            style={{ borderColor: t.border }}
          />
          {q.length >= 2 && (
            <>
              <span className="tabular-nums">{hits.length} pág.</span>
              <button type="button" onClick={() => jumpHit(-1)} disabled={!hits.length} className={btn(false)} style={{ borderColor: t.border }} aria-label="Resultado anterior">↑</button>
              <button type="button" onClick={() => jumpHit(1)} disabled={!hits.length} className={btn(false)} style={{ borderColor: t.border }} aria-label="Próximo resultado">↓</button>
            </>
          )}
        </div>
        {supportsTts && (
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setSpeaking(v => !v)} className={btn(speaking)} style={{ borderColor: t.border }} aria-pressed={speaking}>
              {speaking ? 'Parar leitura' : 'Ouvir'}
            </button>
            {opts([['Lenta', 0.85], ['Normal', 1], ['Rápida', 1.25]], 'rate')}
          </div>
        )}
        {docKey && (
          <div className="flex items-center gap-1">
            <button type="button" onClick={toggleBookmark} className={btn(isMarked)} style={{ borderColor: t.border }} aria-pressed={isMarked}>
              {isMarked ? 'Página marcada ✓' : 'Marcar página'}
            </button>
            <button type="button" onClick={captureSelection} className={btn(false)} style={{ borderColor: t.border }}>Anotar seleção</button>
            <button type="button" onClick={() => setNotesOpen(o => !o)} className={btn(notesOpen)} style={{ borderColor: t.border }} aria-pressed={notesOpen}>
              Notas ({notes.length})
            </button>
          </div>
        )}
      </div>

      <div ref={scrollRef} className={`flex-1 overflow-y-auto px-5 py-8 ${notesOpen ? 'md:pr-80' : ''}`}>
        <article
          ref={articleRef}
          className="mx-auto whitespace-pre-wrap break-words"
          style={{
            maxWidth: `${prefs.width}ch`,
            fontSize: `${prefs.size}px`,
            lineHeight: prefs.spacing,
            fontFamily: prefs.serif ? 'Georgia, "Times New Roman", serif' : 'system-ui, -apple-system, "Segoe UI", sans-serif'
          }}
        >
          {parts.map((part, i) => (i % 2 === 1
            ? <mark key={i} style={{ background: '#fde047', color: '#1c1917' }}>{part}</mark>
            : part))}
        </article>
      </div>

      {notesOpen && docKey && (
        <aside className="absolute right-0 top-0 bottom-0 w-80 max-w-full flex flex-col border-l shadow-xl z-10" style={{ background: t.bg, color: t.fg, borderColor: t.border }}>
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: t.border }}>
            <h4 className="font-bold text-sm">Anotações e marcadores</h4>
            <button type="button" onClick={() => setNotesOpen(false)} className="p-1 rounded-lg hover:bg-black/10" aria-label="Fechar anotações">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 border-b space-y-2 text-xs" style={{ borderColor: t.border }}>
            {quoteDraft ? (
              <div className="rounded-lg border p-2 italic opacity-80" style={{ borderColor: t.border }}>
                “{quoteDraft}”
                <button type="button" onClick={() => setQuoteDraft('')} className="ml-2 not-italic underline">remover</button>
              </div>
            ) : (
              <p className="opacity-70">Dica: selecione um trecho no texto e clique em "Anotar seleção".</p>
            )}
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder={`Sua nota para a página ${idx + 1}...`}
              className="w-full px-2 py-1.5 rounded-lg border bg-transparent resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
              style={{ borderColor: t.border }}
            />
            <button type="button" onClick={addNote} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium">Salvar nota</button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2 text-xs">
            {sortedNotes.length === 0 && <p className="opacity-70">Nada por aqui ainda.</p>}
            {sortedNotes.map(n => (
              <div key={n.id} className="rounded-lg border p-2 space-y-1" style={{ borderColor: t.border }}>
                <p className="font-semibold">{n.kind === 'bookmark' ? 'Marcador' : 'Nota'} • página {n.page + 1}</p>
                {n.quote && <p className="italic opacity-80">“{n.quote}”</p>}
                {n.text && <p className="whitespace-pre-wrap break-words">{n.text}</p>}
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setIdx(Math.min(n.page, total - 1))} className="underline">Ir para a página</button>
                  <button type="button" onClick={() => persistNotes(notes.filter(x => x.id !== n.id))} className="underline text-rose-500">Excluir</button>
                </div>
              </div>
            ))}
          </div>
        </aside>
      )}

      <div className="border-t" style={{ borderColor: t.border }}>
        <div className="h-1" style={{ background: t.border }}>
          <div className="h-full bg-indigo-500 transition-all" style={{ width: `${((idx + 1) / total) * 100}%` }} />
        </div>
        <div className="flex items-center justify-between px-4 py-3 text-xs">
          <button type="button" disabled={idx === 0} onClick={() => go(-1)} className={nav} style={{ borderColor: t.border }}>
            <ChevronLeft className="w-4 h-4" /> Anterior
          </button>
          <span>Página {idx + 1} de {total}{isMarked ? ' • marcada' : ''}</span>
          <button type="button" disabled={idx >= total - 1} onClick={() => go(1)} className={nav} style={{ borderColor: t.border }}>
            Próxima <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Player de música (playlists do YouTube via IFrame API) ---
const MUSIC_PRESETS = [
  { id: 'lofi-louvor', name: 'Lo-Fi Cristão • Louvor' },
  { id: 'lofi-oracao', name: 'Lo-Fi Cristão • Oração e foco' },
  { id: 'lofi-hinos', name: 'Lo-Fi Cristão • Hinos' }
];

const getPlaylistId = (url = '') => (String(url).match(/[?&]list=([A-Za-z0-9_-]{10,})/) || [])[1] || '';

let ytApiPromise = null;
const loadYouTubeApi = () => {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!ytApiPromise) {
    ytApiPromise = new Promise((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT); };
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.onerror = () => { ytApiPromise = null; reject(new Error('Falha ao carregar a API do YouTube')); };
      document.head.appendChild(tag);
    });
  }
  return ytApiPromise;
};

const MusicPlayer = ({ isDark, showNotification }) => {
  const [links, setLinks] = useState({});
  const [presetId, setPresetId] = useState(MUSIC_PRESETS[0].id);
  const [linkDraft, setLinkDraft] = useState('');
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [trackTitle, setTrackTitle] = useState('');
  const [volume, setVolume] = useState(60);
  const holderRef = useRef(null);
  const playerRef = useRef(null);
  const volumeRef = useRef(60);

  const listId = getPlaylistId(links[presetId]);

  useEffect(() => {
    dbGet('settings', 'musicLinks').then(saved => { if (saved) setLinks(saved); });
  }, []);

  useEffect(() => {
    setReady(false);
    setPlaying(false);
    setTrackTitle('');
    if (!listId || !holderRef.current) return;
    let cancelled = false;
    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !holderRef.current) return;
        holderRef.current.innerHTML = '';
        const mount = document.createElement('div');
        holderRef.current.appendChild(mount);
        playerRef.current = new YT.Player(mount, {
          width: '100%',
          height: '200',
          playerVars: { listType: 'playlist', list: listId, playsinline: 1, rel: 0 },
          events: {
            onReady: (e) => { e.target.setVolume(volumeRef.current); setReady(true); },
            onStateChange: (e) => {
              setPlaying(e.data === 1);
              const title = e.target.getVideoData?.().title;
              if (title) setTrackTitle(title);
            }
          }
        });
      })
      .catch(() => showNotification('Não foi possível carregar o player do YouTube.'));
    return () => {
      cancelled = true;
      try { playerRef.current?.destroy(); } catch { /* ignore */ }
      playerRef.current = null;
    };
  }, [listId, showNotification]);

  const call = (fn, ...args) => { try { playerRef.current?.[fn]?.(...args); } catch { /* ignore */ } };
  const onVolume = (v) => { setVolume(v); volumeRef.current = v; call('setVolume', v); };

  const persist = (next) => { setLinks(next); dbSet('settings', next, 'musicLinks'); };
  const saveLink = () => {
    const url = linkDraft.trim();
    if (!getPlaylistId(url)) {
      showNotification('Cole o link de uma playlist do YouTube (precisa conter "list=").');
      return;
    }
    persist({ ...links, [presetId]: url });
    setLinkDraft('');
  };
  const clearLink = () => {
    const next = { ...links };
    delete next[presetId];
    persist(next);
  };

  const round = `p-2 rounded-full disabled:opacity-40 transition-colors ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`;

  return (
    <aside className={`rounded-xl border p-5 space-y-4 ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
      <h2 className="font-bold flex items-center gap-2">
        <Music className="w-5 h-5 text-indigo-500" /> Música para ler
      </h2>

      <div className="flex flex-col gap-2">
        {MUSIC_PRESETS.map(p => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPresetId(p.id)}
            aria-pressed={presetId === p.id}
            className={`text-left px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
              presetId === p.id
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-300 hover:bg-slate-100'
            }`}
          >
            {p.name}{links[p.id] ? '' : ' (sem link)'}
          </button>
        ))}
      </div>

      <div ref={holderRef} className={`rounded-xl overflow-hidden ${listId ? '' : 'hidden'}`} />

      {listId ? (
        <>
          <p className="text-xs text-slate-500 truncate" title={trackTitle}>{trackTitle || 'Carregando playlist...'}</p>
          <div className="flex items-center justify-center gap-2">
            <button type="button" disabled={!ready} onClick={() => call('previousVideo')} className={round} aria-label="Faixa anterior">
              <SkipBack className="w-5 h-5" />
            </button>
            <button
              type="button"
              disabled={!ready}
              onClick={() => call(playing ? 'pauseVideo' : 'playVideo')}
              className="p-3 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition-colors"
              aria-label={playing ? 'Pausar' : 'Tocar'}
            >
              {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <button type="button" disabled={!ready} onClick={() => call('nextVideo')} className={round} aria-label="Próxima faixa">
              <SkipForward className="w-5 h-5" />
            </button>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            <Volume2 className="w-4 h-4" />
            <input type="range" min="0" max="100" value={volume} onChange={(e) => onVolume(Number(e.target.value))} className="flex-1 accent-indigo-500" aria-label="Volume" />
          </label>
          <button type="button" onClick={clearLink} className="text-xs text-rose-500 hover:underline">Trocar o link desta playlist</button>
        </>
      ) : (
        <div className="space-y-2">
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Cole o link de uma playlist de lo-fi cristão do YouTube para ouvir aqui.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={linkDraft}
              onChange={(e) => setLinkDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveLink(); }}
              placeholder="https://youtube.com/playlist?list=..."
              className={`flex-1 min-w-0 px-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
              }`}
            />
            <button type="button" onClick={saveLink} className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium">Salvar</button>
          </div>
        </div>
      )}
    </aside>
  );
};

// --- Vínculo com conta Google (Google Identity Services) ---
const GIS_SRC = 'https://accounts.google.com/gsi/client';

const GoogleLinkCard = ({ google, isDark, onLink, onUnlink }) => {
  const btnRef = useRef(null);
  const cbRef = useRef(onLink);
  cbRef.current = onLink;
  const configured = !GOOGLE_CLIENT_ID.startsWith('COLE_');

  useEffect(() => {
    if (google || !configured) return;
    let cancelled = false;
    const init = () => {
      if (cancelled || !window.google?.accounts?.id || !btnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (resp) => { try { cbRef.current(decodeJwt(resp.credential)); } catch { /* ignore */ } }
      });
      window.google.accounts.id.renderButton(btnRef.current, {
        theme: isDark ? 'filled_black' : 'outline', size: 'large', text: 'continue_with', shape: 'pill', locale: 'pt-BR'
      });
    };
    if (window.google?.accounts?.id) {
      init();
      return () => { cancelled = true; };
    }
    let tag = document.querySelector(`script[src="${GIS_SRC}"]`);
    if (!tag) {
      tag = document.createElement('script');
      tag.src = GIS_SRC;
      tag.async = true;
      document.head.appendChild(tag);
    }
    tag.addEventListener('load', init);
    return () => { cancelled = true; tag.removeEventListener('load', init); };
  }, [google, configured, isDark]);

  return (
    <div className={`w-full mt-6 pt-6 border-t text-left ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
      <p className="text-xs font-semibold text-slate-500 mb-3">Conta Google</p>
      {google ? (
        <div className="flex items-center gap-3">
          {google.picture && <img src={google.picture} alt="" referrerPolicy="no-referrer" className="w-9 h-9 rounded-full" />}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{google.name}</p>
            <p className="text-xs text-slate-500 truncate">{google.email}</p>
          </div>
          <button type="button" onClick={onUnlink} className="p-2 rounded-lg hover:bg-rose-500/10 text-rose-500 transition-colors" title="Desvincular conta Google">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      ) : configured ? (
        <div ref={btnRef} />
      ) : (
        <p className="text-xs text-slate-500">Vínculo com a conta Google em breve.</p>
      )}
    </div>
  );
};

// --- Aba "Leitura": PDFs + comunidade + música ---
const ReadingTab = ({ isDark, pdfs, busy, publishedIds, communityReads, onUpload, onRead, onDelete, onTogglePublish, onSendFile, onOpenOriginal, onOrganize, cloudActive, onCopyLink, showNotification }) => {
  const [fq, setFq] = useState('');
  const [fc, setFc] = useState('');
  const [ft, setFt] = useState('');
  const inputRef = useRef(null);
  const muted = isDark ? 'text-slate-400' : 'text-slate-600';
  const card = isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200';
  const ghost = `px-3 py-1.5 rounded-lg border text-xs transition-colors whitespace-nowrap flex items-center gap-1.5 ${isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-300 hover:bg-slate-100'}`;

  return (
    <div className="space-y-6">
      <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Leitura</h1>
          <p className={`text-sm mt-1 ${muted}`}>Adicione PDFs, leia em modo confortável e compartilhe com outros autores.</p>
        </div>
        <input
          type="file"
          ref={inputRef}
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; onUpload(f); }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium transition-all"
        >
          <FileUp className="w-4 h-4" /> {busy ? 'Processando...' : 'Adicionar PDF'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-8">

          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-500" /> Meus PDFs ({pdfs.length})
            </h2>
            {pdfs.length > 0 && (
              <FilterBar isDark={isDark} items={pdfs} query={fq} setQuery={setFq} collection={fc} setCollection={setFc} tag={ft} setTag={setFt} />
            )}
            {pdfs.length === 0 && (
              <p className={`text-sm ${muted}`}>Nenhum PDF ainda. Clique em "Adicionar PDF" para começar.</p>
            )}
            <div className="space-y-3">
              {filterItems(pdfs, { query: fq, collection: fc, tag: ft }).map(pdf => {
                const published = !!pdf.sharedPostId && publishedIds.has(pdf.sharedPostId);
                return (
                  <div key={pdf.id} className={`p-4 rounded-xl border ${card}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2.5 bg-indigo-600/10 text-indigo-400 rounded-lg"><FileText className="w-5 h-5" /></div>
                      <div className="min-w-0">
                        <h4 className="font-semibold text-sm truncate">{pdf.title}</h4>
                        <p className="text-xs text-slate-500 truncate">{pdf.numPages} págs • {pdf.size}{published ? ' • publicado na comunidade' : ''}</p>
                      </div>
                    </div>
                    {pdf.scanned && (
                      <p className="text-xs text-amber-500 mt-2">Sem texto selecionável (provável PDF escaneado): o modo confortável não está disponível, mas dá para abrir o original.</p>
                    )}
                    <TagChips item={pdf} isDark={isDark} />
                    <div className="flex items-center gap-2 mt-3">
                      <button type="button" disabled={pdf.scanned} onClick={() => onRead({ title: pdf.title, content: pdf.text, key: `pdf:${pdf.id}` })} className={`${ghost} text-indigo-400 disabled:opacity-40`}>
                        <BookOpen className="w-3.5 h-3.5" /> Ler
                      </button>
                      <ActionMenu
                        isDark={isDark}
                        up
                        items={[
                          { label: 'Abrir original', onClick: () => onOpenOriginal(pdf) },
                          { label: published ? 'Remover compartilhamento' : 'Publicar na comunidade', onClick: () => onTogglePublish(pdf, 'public') },
                          ...(!published && cloudActive ? [{ label: 'Compartilhar por link', onClick: () => onTogglePublish(pdf, 'link') }] : []),
                          ...(published && pdf.shareToken ? [{ label: 'Copiar link', onClick: () => onCopyLink(pdf.shareToken) }] : []),
                          { label: 'Etiquetas e coleção', onClick: () => onOrganize('pdf', pdf) },
                          { label: 'Enviar arquivo', onClick: () => onSendFile(pdf) },
                          { label: 'Remover PDF', danger: true, onClick: () => onDelete(pdf) }
                        ]}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-indigo-500" /> Da comunidade ({communityReads.length})
            </h2>
            {communityReads.length === 0 && (
              <p className={`text-sm ${muted}`}>Quando outros autores publicarem livros ou PDFs, eles aparecem aqui.</p>
            )}
            <div className="space-y-3">
              {communityReads.map(item => (
                <div key={item.id} className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${card}`}>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-sm truncate">{item.title}</h4>
                    <p className="text-xs text-slate-500 truncate">{item.kind === 'pdf' ? 'PDF' : 'Livro'} • {item.meta} • por {item.author} (@{item.handle})</p>
                  </div>
                  <button type="button" onClick={() => onRead({ title: item.title, content: item.content, postId: item.id, key: `post:${item.id}` })} className={`${ghost} text-indigo-400`}>
                    <BookOpen className="w-3.5 h-3.5" /> Ler
                  </button>
                </div>
              ))}
            </div>
          </section>

        </div>

        <div className="space-y-6 lg:sticky lg:top-24">
          <MusicPlayer isDark={isDark} showNotification={showNotification} />
          <FocusTimer isDark={isDark} showNotification={showNotification} />
        </div>
      </div>
    </div>
  );
};

// --- UTILITÁRIOS: backup, capítulos, exportação, versões e alarme ---
const dateKey = (d) => d.toLocaleDateString('sv-SE');
const todayKey = () => dateKey(new Date());

const escapeHtml = (str = '') => String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const fr = new FileReader();
  fr.onload = () => resolve(fr.result);
  fr.onerror = reject;
  fr.readAsDataURL(blob);
});
const dataUrlToBlob = async (dataUrl) => (await fetch(dataUrl)).blob();

const bookToHtml = (book) =>
  `<h1>${escapeHtml(book.title)}</h1>` +
  (book.content || '').split('\n').map(l => (l.trim() ? `<p>${escapeHtml(l)}</p>` : '')).join('');

// Encontra linhas como "Capítulo 1: ..." / "Chapter 2" / "Parte 3"
const findChapters = (text = '') => {
  const found = [];
  const re = /^[ \t]*(?:cap[ií]tulo|chapter|parte)[ \t]+\S.*$/gim;
  let m;
  while ((m = re.exec(text)) !== null) {
    found.push({ title: m[0].trim().slice(0, 60), pos: m.index + (m[0].length - m[0].trimStart().length) });
  }
  return found;
};

// Guarda uma versão do manuscrito (máx. 20). Devolve a lista nova, ou null se nada mudou.
const snapshotBook = async (book, label) => {
  if (!book || !book.id || !(book.content || '').trim()) return null;
  const key = `history:${book.id}`;
  const list = (await dbGet('settings', key)) || [];
  if (list[0] && list[0].content === book.content) return null;
  const entry = { at: new Date().toISOString(), label, title: book.title || '', words: calculateWords(book.content), content: book.content };
  const next = [entry, ...list].slice(0, 20);
  await dbSet('settings', next, key);
  return next;
};

const beep = () => {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    osc.frequency.value = 660;
    osc.connect(ctx.destination);
    osc.start();
    setTimeout(() => { osc.stop(); ctx.close(); }, 500);
  } catch { /* ignore */ }
};

const FocusTimer = ({ isDark, showNotification }) => {
  const [minutes, setMinutes] = useState(25);
  const [remaining, setRemaining] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const endRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.round((endRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        setRunning(false);
        showNotification('Tempo de foco concluído! Hora de uma pausa.');
        beep();
      }
    }, 500);
    return () => clearInterval(id);
  }, [running, showNotification]);

  const choose = (m) => { setMinutes(m); setRemaining(m * 60); setRunning(false); };
  const start = () => {
    const secs = remaining > 0 ? remaining : minutes * 60;
    setRemaining(secs);
    endRef.current = Date.now() + secs * 1000;
    setRunning(true);
  };

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  const small = `px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-300 hover:bg-slate-100'}`;

  return (
    <section className={`rounded-xl border p-5 space-y-4 ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
      <h2 className="font-bold flex items-center gap-2">
        <Timer className="w-5 h-5 text-indigo-500" /> Tempo de foco
      </h2>
      <p className="text-4xl font-bold text-center tabular-nums" aria-live="off">{mm}:{ss}</p>
      <div className="flex items-center justify-center gap-2">
        {[15, 25, 50].map(m => (
          <button key={m} type="button" onClick={() => choose(m)} aria-pressed={minutes === m}
            className={minutes === m ? 'px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white' : small}>
            {m} min
          </button>
        ))}
      </div>
      <div className="flex items-center justify-center gap-2">
        {running ? (
          <button type="button" onClick={() => setRunning(false)} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium">Pausar</button>
        ) : (
          <button type="button" onClick={start} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium">{remaining > 0 && remaining < minutes * 60 ? 'Continuar' : 'Iniciar'}</button>
        )}
        <button type="button" onClick={() => choose(minutes)} className={small}>Zerar</button>
      </div>
    </section>
  );
};

// --- BIBLIOTECA: busca, etiquetas e coleções ---
const norm = (str = '') => String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const filterItems = (items, { query, collection, tag }) => {
  const q = norm(query.trim());
  return items.filter(it => {
    if (collection && it.collection !== collection) return false;
    if (tag && !(it.tags || []).includes(tag)) return false;
    if (!q) return true;
    return norm([it.title, it.author, it.genre, it.fileName, it.collection, ...(it.tags || [])].filter(Boolean).join(' ')).includes(q);
  });
};

const TagChips = ({ item, isDark }) => {
  const tags = item.tags || [];
  if (!item.collection && tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2 mb-2">
      {item.collection && (
        <span className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-600/10 text-indigo-400 border border-indigo-500/20">📁 {item.collection}</span>
      )}
      {tags.map(t => (
        <span key={t} className={`text-[11px] px-2 py-0.5 rounded-md ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>#{t}</span>
      ))}
    </div>
  );
};

const FilterBar = ({ isDark, items, query, setQuery, collection, setCollection, tag, setTag }) => {
  const collections = [...new Set(items.map(i => i.collection).filter(Boolean))];
  const tags = [...new Set(items.flatMap(i => i.tags || []))];
  const field = `px-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
    isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
  }`;
  return (
    <div className="mb-4 space-y-2">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por título, autor, gênero ou etiqueta..."
            aria-label="Buscar"
            className={`${field} w-full pl-9`}
          />
        </div>
        {collections.length > 0 && (
          <select value={collection} onChange={(e) => setCollection(e.target.value)} aria-label="Filtrar por coleção" className={field}>
            <option value="">Todas as coleções</option>
            {collections.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTag(tag === t ? '' : t)}
              aria-pressed={tag === t}
              className={`text-[11px] px-2 py-0.5 rounded-md border transition-colors ${
                tag === t
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-600 hover:bg-slate-100'
              }`}
            >
              #{t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// --- PERFIL: estatísticas de escrita ---
const WritingStats = ({ isDark, log, goal, todayWords }) => {
  const live = { ...log, [dateKey(new Date())]: todayWords };
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({
      key: dateKey(d),
      label: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
      words: live[dateKey(d)] || 0
    });
  }
  const weekTotal = days.reduce((sum, d) => sum + d.words, 0);
  const best = Math.max(0, ...Object.values(live));
  const max = Math.max(goal, ...days.map(d => d.words), 1);

  // Sequência: dias seguidos batendo a meta (se hoje ainda não bateu, conta a partir de ontem)
  let streak = 0;
  if (goal > 0) {
    const cursor = new Date();
    if ((live[dateKey(cursor)] || 0) < goal) cursor.setDate(cursor.getDate() - 1);
    while (streak < 3650 && (live[dateKey(cursor)] || 0) >= goal) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
  }

  return (
    <div className={`rounded-xl border p-6 space-y-5 ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
      <h3 className="font-bold text-lg">Estatísticas de escrita</h3>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-2xl font-bold">{streak} {streak > 0 ? '🔥' : ''}</p>
          <p className="text-xs text-slate-500">{streak === 1 ? 'dia seguido' : 'dias seguidos'} na meta</p>
        </div>
        <div>
          <p className="text-2xl font-bold">{weekTotal.toLocaleString('pt-BR')}</p>
          <p className="text-xs text-slate-500">palavras nos últimos 7 dias</p>
        </div>
        <div>
          <p className="text-2xl font-bold">{best.toLocaleString('pt-BR')}</p>
          <p className="text-xs text-slate-500">melhor dia</p>
        </div>
      </div>

      <div>
        <div className="flex items-end gap-2 h-28">
          {days.map(d => (
            <div key={d.key} className="flex-1 h-full flex flex-col justify-end items-center" title={`${d.words} palavras`}>
              <span className="text-[10px] text-slate-500 mb-1 tabular-nums">{d.words}</span>
              <div
                className={`w-full rounded-t-md ${goal > 0 && d.words >= goal ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                style={{ height: `${Math.max(2, (d.words / max) * 100)}%` }}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-1">
          {days.map(d => <span key={d.key} className="flex-1 text-center text-[10px] text-slate-500">{d.label}</span>)}
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Barras verdes são dias em que a meta ({goal} palavras) foi batida. O histórico começa a contar a partir do dia em que esta versão foi publicada.
      </p>
    </div>
  );
};

// --- NUVEM (Supabase): contas, sincronização e comunidade ---
// As duas chaves abaixo são configuradas no Render (Environment). Sem elas, o app funciona só no navegador.
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || '';
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const bookToRow = (uid, b) => ({
  user_id: uid,
  id: b.id,
  title: b.title || '',
  author: b.author || '',
  genre: b.genre || '',
  cover_color: b.coverColor || '',
  synopsis: b.synopsis || '',
  content: b.content || '',
  tags: b.tags || [],
  collection: b.collection || '',
  updated_ms: b.updatedAt || Date.now(),
  deleted: false
});

const rowToBook = (r) => ({
  id: r.id,
  title: r.title,
  author: r.author,
  genre: r.genre,
  coverColor: r.cover_color || 'from-blue-600 to-indigo-800',
  synopsis: r.synopsis,
  content: r.content,
  tags: r.tags || [],
  collection: r.collection || '',
  updatedAt: Number(r.updated_ms) || 0
});

const pdfToRow = (uid, p) => ({
  user_id: uid,
  id: p.id,
  title: p.title || '',
  file_name: p.fileName || '',
  size: p.size || '',
  num_pages: p.numPages || 0,
  scanned: !!p.scanned,
  tags: p.tags || [],
  collection: p.collection || '',
  uploaded_at: p.uploadedAt || '',
  updated_ms: p.updatedAt || Date.now(),
  deleted: false
});

const rowToPdfMeta = (r) => ({
  id: r.id,
  title: r.title,
  fileName: r.file_name,
  size: r.size,
  numPages: r.num_pages,
  scanned: r.scanned,
  tags: r.tags || [],
  collection: r.collection || '',
  uploadedAt: r.uploaded_at,
  updatedAt: Number(r.updated_ms) || 0
});

const cloudPushBook = async (uid, book) => {
  const { error } = await supabase.from('books').upsert(bookToRow(uid, book));
  if (error) console.error('Erro ao enviar manuscrito:', error);
  return !error;
};

const cloudDeleteBook = async (uid, id) => {
  const { error } = await supabase.from('books').upsert({
    user_id: uid, id, title: '', author: '', genre: '', cover_color: '', synopsis: '', content: '',
    tags: [], collection: '', updated_ms: Date.now(), deleted: true
  });
  if (error) console.error('Erro ao remover manuscrito na nuvem:', error);
};

const cloudPushPdfMeta = async (uid, pdf) => {
  const { error } = await supabase.from('pdfs').upsert(pdfToRow(uid, pdf));
  if (error) console.error('Erro ao enviar dados do PDF:', error);
  return !error;
};

const cloudPushPdf = async (uid, pdf) => {
  if (!pdf.blob) return false;
  const up = await supabase.storage.from('pdfs').upload(`${uid}/${pdf.id}.pdf`, pdf.blob, { upsert: true, contentType: 'application/pdf' });
  if (up.error) { console.error('Erro ao enviar arquivo PDF:', up.error); return false; }
  return cloudPushPdfMeta(uid, pdf);
};

const cloudDeletePdf = async (uid, id) => {
  await supabase.storage.from('pdfs').remove([`${uid}/${id}.pdf`]);
  const { error } = await supabase.from('pdfs').upsert({
    user_id: uid, id, title: '', file_name: '', size: '', num_pages: 0, scanned: false,
    tags: [], collection: '', uploaded_at: '', updated_ms: Date.now(), deleted: true
  });
  if (error) console.error('Erro ao remover PDF na nuvem:', error);
};

const mapCloudPost = (row, uid) => ({
  id: row.id,
  isMine: row.author_id === uid,
  authorId: row.author_id,
  authorName: (row.author && row.author.name) || 'Autor',
  authorHandle: (row.author && row.author.handle) || 'autor',
  authorColor: (row.author && row.author.avatar_color) || AVATAR_GRADIENTS[0],
  authorPicture: (row.author && row.author.avatar_url) || '',
  text: row.text || '',
  createdAt: row.created_at,
  likes: (row.likes || []).length,
  likedByMe: (row.likes || []).some(l => l.user_id === uid),
  comments: (row.comments || [])
    .map(c => ({
      id: c.id,
      isMine: c.author_id === uid,
      authorName: (c.author && c.author.name) || 'Autor',
      text: c.text,
      createdAt: c.created_at
    }))
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))),
  sharedBook: row.shared_book || null,
  sharedPdf: row.shared_pdf || null,
  visibility: row.visibility,
  shareToken: row.share_token,
  pdfId: row.pdf_id || null
});

const cloudFetchPosts = async (uid) => {
  const { data, error } = await supabase
    .from('posts')
    .select('id, author_id, text, shared_book, shared_pdf, visibility, share_token, pdf_id, created_at, author:profiles(name, handle, avatar_color, avatar_url), comments(id, author_id, text, created_at, author:profiles(name)), likes(user_id)')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data || []).map(row => mapCloudPost(row, uid));
};

// O texto completo de um PDF compartilhado só é baixado quando alguém abre para ler
const cloudFetchPostText = async (postId) => {
  const { data, error } = await supabase.from('posts').select('shared_text').eq('id', postId).maybeSingle();
  if (error || !data) return '';
  return data.shared_text || '';
};

const AccountCard = ({ isDark, session, onSignIn, onSignOut, blockedCount, onUnblockAll }) => {
  const user = session && session.user;
  const meta = (user && user.user_metadata) || {};
  const picture = meta.avatar_url || meta.picture || '';
  return (
    <div className={`w-full mt-6 pt-6 border-t text-left ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
      <p className="text-xs font-semibold text-slate-500 mb-3">Conta</p>
      {user ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {picture && <img src={picture} alt="" referrerPolicy="no-referrer" className="w-9 h-9 rounded-full" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{meta.full_name || meta.name || 'Conta Google'}</p>
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
            </div>
            <button type="button" onClick={onSignOut} className="p-2 rounded-lg hover:bg-rose-500/10 text-rose-500 transition-colors" title="Sair da conta">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-emerald-500">Sincronização ativa: seus textos e PDFs acompanham você em qualquer aparelho.</p>
          {blockedCount > 0 && (
            <button type="button" onClick={onUnblockAll} className="text-xs underline text-slate-500">
              Desbloquear {blockedCount} {blockedCount === 1 ? 'usuário' : 'usuários'}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <button
            type="button"
            onClick={onSignIn}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
              isDark ? 'border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200' : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700'
            }`}
          >
            Entrar com Google
          </button>
          <p className="text-xs text-slate-500">Entre para sincronizar seus textos e PDFs e participar da comunidade.</p>
        </div>
      )}
    </div>
  );
};

// --- INTERFACE: menu de ações e aba "Aprender" ---
const ActionMenu = ({ isDark, items, label, up }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={label || 'Mais opções'}
        className={`flex items-center gap-1.5 rounded-lg transition-colors ${label ? 'px-3 py-2 text-sm font-medium' : 'p-2'} ${
          isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
        }`}
      >
        <MoreHorizontal className="w-4 h-4" />
        {label}
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute right-0 ${up ? 'bottom-full mb-1' : 'top-full mt-1'} w-56 rounded-xl border py-1 z-30 shadow-xl ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          {items.map((it, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); it.onClick(); }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                it.danger
                  ? 'text-rose-500 hover:bg-rose-500/10'
                  : isDark ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const LearningTab = ({ isDark, done, onToggleDone, onStartExercise }) => {
  const [query, setQuery] = useState('');
  const [moduleId, setModuleId] = useState('all');
  const [openId, setOpenId] = useState(null);

  const all = useMemo(
    () => APRENDIZAGEM_CONTEUDO.flatMap(m => m.lessons.map(l => ({ ...l, moduleId: m.id, moduleTitle: m.title }))),
    []
  );
  const doneCount = all.filter(l => done[l.id]).length;
  const pct = all.length ? Math.round((doneCount / all.length) * 100) : 0;
  const next = all.find(l => !done[l.id]);
  const q = norm(query.trim());
  const searching = q.length >= 2;
  const matches = searching
    ? all.filter(l => norm([l.title, l.tag, l.summary, l.moduleTitle, ...l.points].join(' ')).includes(q))
    : [];
  const lesson = openId ? all.find(l => l.id === openId) : null;

  const muted = isDark ? 'text-slate-400' : 'text-slate-600';
  const line = isDark ? 'border-slate-800' : 'border-slate-200';
  const open = (id) => { setOpenId(id); window.scrollTo({ top: 0 }); };

  const renderRow = (l, showModule) => (
    <button
      key={l.id}
      type="button"
      onClick={() => open(l.id)}
      className={`w-full text-left flex items-start gap-3 px-4 py-3.5 transition-colors ${isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}
    >
      <span
        className={`mt-0.5 w-5 h-5 shrink-0 rounded-full border flex items-center justify-center text-[11px] ${
          done[l.id] ? 'bg-emerald-500 border-emerald-500 text-white' : isDark ? 'border-slate-600' : 'border-slate-300'
        }`}
      >
        {done[l.id] ? '✓' : ''}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-sm">{l.title}</span>
        <span className={`block text-xs mt-0.5 line-clamp-2 ${muted}`}>{l.summary}</span>
        {showModule && <span className="block text-[11px] mt-1 text-indigo-400">{l.moduleTitle}</span>}
      </span>
      <span className={`text-xs shrink-0 ${muted}`}>{l.minutes} min</span>
    </button>
  );

  const resourcesBlock = (mod) => (mod.resources && mod.resources.length > 0 ? (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Para ir além</h2>
      <ul className={`text-sm space-y-1 ${muted}`}>
        {mod.resources.map((r, i) => <li key={i}>{r}</li>)}
      </ul>
      <p className="text-xs text-slate-500">Os títulos em português podem variar conforme a edição.</p>
    </section>
  ) : null);

  // ---------- Detalhe da lição ----------
  if (lesson) {
    const mod = APRENDIZAGEM_CONTEUDO.find(m => m.id === lesson.moduleId);
    const siblings = mod.lessons;
    const idx = siblings.findIndex(l => l.id === lesson.id);
    const prev = siblings[idx - 1];
    const nxt = siblings[idx + 1];
    const isDone = !!done[lesson.id];
    const h2 = 'text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3';

    return (
      <article className="max-w-2xl mx-auto space-y-8">
        <button
          type="button"
          onClick={() => setOpenId(null)}
          className={`flex items-center gap-1 text-sm ${muted} hover:text-indigo-400 transition-colors`}
        >
          <ChevronLeft className="w-4 h-4" /> Todas as lições
        </button>

        <header className="space-y-3">
          <p className="text-xs uppercase tracking-wider text-indigo-400">{mod.title}</p>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{lesson.title}</h1>
          <p className={`text-xs ${muted}`}>{lesson.tag} • {lesson.level} • {lesson.minutes} min de leitura</p>
        </header>

        <p className="text-base leading-relaxed">{lesson.summary}</p>

        <section>
          <h2 className={h2}>Pontos-chave</h2>
          <ul className="space-y-2.5">
            {lesson.points.map((pt, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed">
                <span className="text-indigo-400 mt-0.5">•</span>
                <span>{pt}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className={h2}>Exemplo</h2>
          <blockquote className={`border-l-2 border-indigo-500 pl-4 text-sm leading-relaxed ${muted}`}>{lesson.example}</blockquote>
        </section>

        {lesson.mistakes && lesson.mistakes.length > 0 && (
          <section>
            <h2 className={h2}>Erros comuns</h2>
            <ul className="space-y-2">
              {lesson.mistakes.map((m, i) => (
                <li key={i} className={`flex gap-3 text-sm leading-relaxed ${muted}`}>
                  <span className="text-rose-400 mt-0.5">×</span>
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className={`rounded-xl border p-5 space-y-4 ${line} ${isDark ? 'bg-slate-900/40' : 'bg-white'}`}>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Exercício</h2>
          <p className="text-sm leading-relaxed">{lesson.exercise}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onStartExercise(lesson)}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
            >
              Praticar no editor
            </button>
            <button
              type="button"
              onClick={() => onToggleDone(lesson.id)}
              className={`px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
                isDone
                  ? 'border-emerald-500 text-emerald-500'
                  : isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-300 hover:bg-slate-100'
              }`}
            >
              {isDone ? 'Concluída ✓' : 'Marcar como concluída'}
            </button>
          </div>
        </section>

        <nav className={`flex items-center justify-between gap-3 pt-4 border-t ${line}`}>
          {prev ? (
            <button type="button" onClick={() => open(prev.id)} className={`flex items-center gap-1 text-sm text-left ${muted} hover:text-indigo-400 transition-colors`}>
              <ChevronLeft className="w-4 h-4 shrink-0" /> {prev.title}
            </button>
          ) : <span />}
          {nxt ? (
            <button type="button" onClick={() => open(nxt.id)} className={`flex items-center gap-1 text-sm text-right ${muted} hover:text-indigo-400 transition-colors`}>
              {nxt.title} <ChevronRight className="w-4 h-4 shrink-0" />
            </button>
          ) : <span />}
        </nav>

        {resourcesBlock(mod)}
      </article>
    );
  }

  // ---------- Lista ----------
  const visibleModules = moduleId === 'all' ? APRENDIZAGEM_CONTEUDO : APRENDIZAGEM_CONTEUDO.filter(m => m.id === moduleId);
  const chip = (active) => `px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
    active
      ? 'bg-indigo-600 text-white'
      : isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'
  }`;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Aprender</h1>
            <p className={`text-sm mt-1 ${muted}`}>{doneCount} de {all.length} lições concluídas</p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar uma técnica..."
              aria-label="Buscar lições"
              className={`w-full pl-9 pr-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
              }`}
            />
          </div>
        </div>

        <div className={`h-1 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
          <div className="h-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
        </div>

        {!searching && next && (
          <button
            type="button"
            onClick={() => open(next.id)}
            className={`w-full text-left flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-colors ${line} ${
              isDark ? 'hover:bg-slate-900' : 'hover:bg-white'
            }`}
          >
            <span className="min-w-0">
              <span className="block text-xs text-indigo-400">{doneCount === 0 ? 'Comece por aqui' : 'Continuar'}</span>
              <span className="block text-sm font-semibold truncate">{next.title}</span>
            </span>
            <ChevronRight className="w-4 h-4 shrink-0 text-slate-500" />
          </button>
        )}
        {!next && <p className="text-sm text-emerald-500">Você concluiu todas as lições. Continue praticando no editor!</p>}
      </div>

      {searching ? (
        <section className="space-y-3">
          <p className={`text-xs ${muted}`}>{matches.length} {matches.length === 1 ? 'resultado' : 'resultados'}</p>
          {matches.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma lição encontrada. Tente outra palavra.</p>
          ) : (
            <div className={`rounded-xl border divide-y ${line} ${isDark ? 'divide-slate-800' : 'divide-slate-200'}`}>
              {matches.map(l => renderRow(l, true))}
            </div>
          )}
        </section>
      ) : (
        <>
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            <button type="button" onClick={() => setModuleId('all')} className={chip(moduleId === 'all')}>Todas</button>
            {APRENDIZAGEM_CONTEUDO.map(m => {
              const total = m.lessons.length;
              const finished = m.lessons.filter(l => done[l.id]).length;
              return (
                <button key={m.id} type="button" onClick={() => setModuleId(m.id)} className={chip(moduleId === m.id)}>
                  {m.title} <span className="opacity-60">{finished}/{total}</span>
                </button>
              );
            })}
          </div>

          {visibleModules.map(m => {
            const IconComponent = m.icon;
            const finished = m.lessons.filter(l => done[l.id]).length;
            return (
              <section key={m.id} className="space-y-3">
                <div>
                  <h2 className="flex items-center gap-2 text-base font-semibold">
                    <IconComponent className="w-4 h-4 text-indigo-400" />
                    {m.title}
                    <span className={`text-xs font-normal ${muted}`}>{finished}/{m.lessons.length}</span>
                  </h2>
                  <p className={`text-xs mt-1 ${muted}`}>{m.description}</p>
                </div>
                <div className={`rounded-xl border divide-y ${line} ${isDark ? 'divide-slate-800' : 'divide-slate-200'}`}>
                  {m.lessons.map(l => renderRow({ ...l, moduleTitle: m.title }, false))}
                </div>
                {moduleId !== 'all' && resourcesBlock(m)}
              </section>
            );
          })}
        </>
      )}
    </div>
  );
};

// --- COMPONENTE PRINCIPAL ---

export default function EstudioApp() {
  const [theme, setTheme] = useState('dark');
  const [activeTab, setActiveTab] = useState('library');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const [books, setBooks] = useState([]);
  const [myPdfs, setMyPdfs] = useState([]);
  const [pdfs, setPdfs] = useState([]);
  const [pdfBusy, setPdfBusy] = useState(false);

  // Meta diária, modo foco, versões e backup
  const [dailyGoal, setDailyGoal] = useState(500);
  const [dayBaseline, setDayBaseline] = useState(null);
  const [focusMode, setFocusMode] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [lastBackupAt, setLastBackupAt] = useState(null);
  const backupInputRef = useRef(null);
  const editorRef = useRef(null);

  // Biblioteca (busca/etiquetas) e estatísticas
  const [libQuery, setLibQuery] = useState('');
  const [libCollection, setLibCollection] = useState('');
  const [libTag, setLibTag] = useState('');
  const [organizeTarget, setOrganizeTarget] = useState(null);
  const [tagsDraft, setTagsDraft] = useState('');
  const [collectionDraft, setCollectionDraft] = useState('');
  const [writingLog, setWritingLog] = useState({});
  const [learningDone, setLearningDone] = useState({});

  // Conta e nuvem
  const [session, setSession] = useState(null);
  const [blockedIds, setBlockedIds] = useState([]);
  const sessionUid = session && session.user ? session.user.id : null;
  const cloudOn = !!(supabase && session);
  const booksRef = useRef([]);
  const pdfsRef = useRef([]);
  booksRef.current = books;
  pdfsRef.current = pdfs;

  const [selectedBookId, setSelectedBookId] = useState('');
  const [saveStatus, setSaveStatus] = useState('salvo');

  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const [selectedModule, setSelectedModule] = useState(APRENDIZAGEM_CONTEUDO[0].id);
  const [searchTerm, setSearchTerm] = useState('');

  const [flipbookActive, setFlipbookActive] = useState(false);
  const [flipbookBook, setFlipbookBook] = useState(null);
  const [, setCurrentPageIndex] = useState(0);
  const [fontSize, setFontSize] = useState(16);

  // Perfil & Comunidade
  const [profile, setProfile] = useState(PERFIL_INICIAL);
  const [profileDraft, setProfileDraft] = useState(PERFIL_INICIAL);
  const [posts, setPosts] = useState([]);
  const [newPostText, setNewPostText] = useState('');
  const [shareBookId, setShareBookId] = useState('');
  const [commentDrafts, setCommentDrafts] = useState({});
  const [feedFilter, setFeedFilter] = useState('all');

  const [toast, setToast] = useState(null);
  const jsonFileInputRef = useRef(null);
  const docFileInputRef = useRef(null);
  const toastTimerRef = useRef(null);
  const currentBookRef = useRef(null);

  // Carregamento inicial do IndexedDB
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const savedTheme = await dbGet('settings', 'theme');
        if (savedTheme && isMounted) setTheme(savedTheme);

        const savedBooks = await dbGet('books');
        if (savedBooks && savedBooks.length > 0) {
          if (isMounted) {
            setBooks(savedBooks);
            setSelectedBookId(savedBooks[0].id);
          }
        } else {
          if (isMounted) {
            setBooks(LIVROS_INICIAIS);
            setSelectedBookId(LIVROS_INICIAIS[0].id);
          }
          for (const b of LIVROS_INICIAIS) {
            await dbSet('books', b);
          }
        }

        const savedPdfs = await dbGet('documents');
        if (savedPdfs && savedPdfs.length > 0) {
          if (isMounted) setMyPdfs(savedPdfs);
        } else {
          if (isMounted) setMyPdfs(PDFS_INICIAIS);
          for (const d of PDFS_INICIAIS) {
            await dbSet('documents', d);
          }
        }

        const savedProfile = await dbGet('settings', 'profile');
        if (savedProfile && isMounted) {
          setProfile(savedProfile);
          setProfileDraft(savedProfile);
        }

        const savedGoal = await dbGet('settings', 'dailyGoal');
        if (savedGoal && isMounted) setDailyGoal(savedGoal);
        const savedBaseline = await dbGet('settings', 'dayBaseline');
        if (savedBaseline && isMounted) setDayBaseline(savedBaseline);
        const savedLearning = await dbGet('settings', 'learningProgress');
        if (savedLearning && isMounted) setLearningDone(savedLearning);
        const savedLog = await dbGet('settings', 'writingLog');
        if (savedLog && isMounted) setWritingLog(savedLog);
        const savedBackupAt = await dbGet('settings', 'lastBackupAt');
        if (savedBackupAt && isMounted) setLastBackupAt(savedBackupAt);

        const savedPdfFiles = await dbGet('pdfs');
        if (savedPdfFiles && isMounted) setPdfs(savedPdfFiles);

        const savedPosts = await dbGet('posts');
        if (savedPosts && savedPosts.length > 0) {
          if (isMounted) setPosts(savedPosts);
        } else {
          if (isMounted) setPosts(POSTS_INICIAIS);
          for (const p of POSTS_INICIAIS) {
            await dbSet('posts', p);
          }
        }
      } catch (err) {
        console.error('Erro ao carregar dados do IndexedDB:', err);
        // Fallback: o app continua funcionando em memória
        if (isMounted) {
          setBooks(LIVROS_INICIAIS);
          setSelectedBookId(LIVROS_INICIAIS[0].id);
          setMyPdfs(PDFS_INICIAIS);
          setPosts(POSTS_INICIAIS);
        }
      } finally {
        if (isMounted) setIsLoaded(true);
      }
    }
    loadData();
    return () => {
      isMounted = false;
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const currentBook = useMemo(() => {
    return books.find(b => b.id === selectedBookId) || books[0] || { id: '', title: '', content: '', author: '', genre: '', synopsis: '' };
  }, [books, selectedBookId]);

  useEffect(() => {
    currentBookRef.current = currentBook;
  }, [currentBook]);

  const currentBookWords = useMemo(() => {
    return calculateWords(currentBook?.content || '');
  }, [currentBook?.content]);

  const showNotification = useCallback((msg) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // Autosave com debounce
  useEffect(() => {
    if (!isLoaded || !selectedBookId) return;

    const targetBook = books.find(b => b.id === selectedBookId);
    if (!targetBook) return;

    setSaveStatus('salvando');
    const handler = setTimeout(async () => {
      const success = await dbSet('books', targetBook);
      if (success && supabase && sessionUid) cloudPushBook(sessionUid, targetBook);
      setSaveStatus(success ? 'salvo' : 'erro');
    }, 1000);

    return () => clearTimeout(handler);
  }, [books, selectedBookId, isLoaded, sessionUid]);

  useEffect(() => {
    if (!isLoaded) return;
    dbSet('settings', theme, 'theme');
  }, [theme, isLoaded]);

  // Atalho Ctrl+S / Cmd+S
  useEffect(() => {
    const handleGlobalKeyDown = async (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        const activeBook = currentBookRef.current;
        if (activeBook && activeBook.id) {
          const ok = await dbSet('books', activeBook);
          setSaveStatus(ok ? 'salvo' : 'erro');
          showNotification(ok ? 'Projeto salvo com sucesso!' : 'Erro ao salvar o projeto.');
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [showNotification]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleTitleChange = (newTitle) => {
    setBooks(prev => prev.map(b => (b.id === selectedBookId ? { ...b, title: newTitle, updatedAt: Date.now() } : b)));
  };

  const handleContentChange = (newContent) => {
    setBooks(prev => prev.map(b => (b.id === selectedBookId ? { ...b, content: newContent, updatedAt: Date.now() } : b)));
  };

  const handleCreateNewBook = () => {
    const newBook = {
      id: `b_${Date.now()}`,
      updatedAt: Date.now(),
      title: 'Novo Manuscrito',
      author: 'Autor',
      genre: 'Geral',
      coverColor: 'from-blue-600 to-indigo-800',
      synopsis: 'Sem sinopse.',
      content: ''
    };
    setBooks(prev => [newBook, ...prev]);
    setSelectedBookId(newBook.id);
    setActiveTab('editor');
    showNotification('Novo manuscrito criado!');
  };

  const confirmDeleteBook = (id) => {
    if (books.length <= 1) {
      showNotification('Você deve manter ao menos um projeto ativo.');
      return;
    }
    setDeleteConfirmId(id);
  };

  const executeDeleteBook = async () => {
    if (!deleteConfirmId) return;
    const id = deleteConfirmId;
    try {
      const filtered = books.filter(b => b.id !== id);
      setBooks(filtered);
      await dbDelete('books', id);
      await dbDelete('settings', `history:${id}`);
      if (cloudOn) cloudDeleteBook(sessionUid, id);
      if (selectedBookId === id && filtered.length > 0) {
        setSelectedBookId(filtered[0].id);
      }
      showNotification('Projeto removido com sucesso.');
    } catch (error) {
      console.error('Erro ao excluir manuscrito:', error);
      showNotification('Erro ao excluir o manuscrito.');
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleDeleteDoc = async (id) => {
    setMyPdfs(prev => prev.filter(d => d.id !== id));
    await dbDelete('documents', id);
    showNotification('Documento removido.');
  };

  const handleExportJSON = (book) => {
    const jsonString = JSON.stringify(book, null, 2);
    const fileName = `${(book.title || 'projeto').toLowerCase().replace(/[^a-z0-9]/g, '_')}.json`;
    triggerSecureDownload(jsonString, fileName, 'application/json');
    showNotification('Projeto exportado em JSON!');
  };

  const handleExportTXT = (book) => {
    const textContent = `${book.title}\n\n${book.content}`;
    const fileName = `${(book.title || 'manuscrito').toLowerCase().replace(/[^a-z0-9]/g, '_')}.txt`;
    triggerSecureDownload(textContent, fileName, 'text/plain;charset=utf-8');
    showNotification('Manuscrito baixado em TXT!');
  };

  const handleImportJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showNotification('Erro: Arquivo excede o limite de 10MB.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (typeof imported !== 'object' || imported === null || !imported.title || imported.content === undefined) {
          throw new Error('Formato inválido');
        }
        const newBook = {
          id: `b_imp_${Date.now()}`,
          title: sanitizeInput(imported.title || 'Projeto Importado').slice(0, 100),
          author: sanitizeInput(imported.author || 'Desconhecido').slice(0, 80),
          genre: sanitizeInput(imported.genre || 'Geral').slice(0, 50),
          coverColor: typeof imported.coverColor === 'string' ? imported.coverColor : 'from-indigo-600 to-purple-800',
          synopsis: sanitizeInput(imported.synopsis || '').slice(0, 500),
          content: String(imported.content || '')
        };
        setBooks(prev => [newBook, ...prev]);
        setSelectedBookId(newBook.id);
        showNotification(`Projeto "${newBook.title}" importado!`);
      } catch {
        showNotification('Erro: Arquivo JSON de projeto inválido ou corrompido.');
      }
    };
    reader.onerror = () => showNotification('Erro ao ler o arquivo.');
    reader.readAsText(file);
    e.target.value = '';
  };

  // Upload de documentos de apoio (.txt / .md)
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showNotification('Erro: Documento excede o limite de 5MB.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const newDoc = {
        id: `doc_${Date.now()}`,
        title: sanitizeInput(file.name.replace(/\.[^.]+$/, '')).slice(0, 100) || 'Documento',
        fileName: sanitizeInput(file.name).slice(0, 120),
        size: formatFileSize(file.size),
        uploadedAt: new Date().toISOString().slice(0, 10),
        content: String(event.target.result || '')
      };
      setMyPdfs(prev => [newDoc, ...prev]);
      await dbSet('documents', newDoc);
      showNotification(`Documento "${newDoc.title}" anexado!`);
    };
    reader.onerror = () => showNotification('Erro ao ler o documento.');
    reader.readAsText(file);
    e.target.value = '';
  };

  // --- PERFIL ---
  const handleSaveProfile = async () => {
    const clean = {
      name: sanitizeInput(profileDraft.name).slice(0, 60) || 'Autor',
      handle: sanitizeInput(profileDraft.handle).toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24) || 'autor',
      bio: sanitizeInput(profileDraft.bio).slice(0, 300),
      favoriteGenre: sanitizeInput(profileDraft.favoriteGenre).slice(0, 50),
      avatarColor: profileDraft.avatarColor || AVATAR_GRADIENTS[0],
      google: profile.google || null
    };
    setProfile(clean);
    setProfileDraft(clean);
    const ok = await dbSet('settings', clean, 'profile');
    if (cloudOn) {
      const { error } = await supabase.from('profiles').update({
        name: clean.name, handle: clean.handle, bio: clean.bio, favorite_genre: clean.favoriteGenre, avatar_color: clean.avatarColor
      }).eq('id', sessionUid);
      if (error) {
        showNotification(error.code === '23505' ? 'Esse @usuário já está em uso. Escolha outro.' : 'Perfil salvo só neste aparelho (erro ao enviar para a nuvem).');
        return;
      }
    }
    showNotification(ok ? 'Perfil atualizado!' : 'Erro ao salvar o perfil.');
  };

  const profileStats = useMemo(() => {
    const myPosts = posts.filter(p => p.isMine);
    return {
      manuscripts: books.length,
      words: books.reduce((sum, b) => sum + calculateWords(b.content), 0),
      posts: myPosts.length,
      likes: myPosts.reduce((sum, p) => sum + (p.likes || 0), 0)
    };
  }, [books, posts]);

  // --- COMUNIDADE ---
  const sortedPosts = useMemo(() => {
    const base = (supabase && !session)
      ? []
      : posts.filter(p => p.visibility !== 'link' && !blockedIds.includes(p.authorId));
    const list = feedFilter === 'mine' ? base.filter(p => p.isMine) : base;
    return [...list].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }, [posts, feedFilter, session, blockedIds]);

  const updatePost = async (id, updater) => {
    const target = posts.find(p => p.id === id);
    if (!target) return;
    const updated = updater(target);
    setPosts(prev => prev.map(p => (p.id === id ? updated : p)));
    await dbSet('posts', updated);
  };

  const handleCreatePost = async () => {
    const text = sanitizeInput(newPostText).slice(0, 1000);
    const book = books.find(b => b.id === shareBookId);
    if (!text && !book) {
      showNotification('Escreva algo ou escolha um manuscrito para compartilhar.');
      return;
    }
    if (supabase && !session) {
      showNotification('Entre com sua conta Google (aba Perfil) para publicar na comunidade.');
      return;
    }
    if (cloudOn) {
      if (book && !(await confirmPublishTerms())) return;
      const { error } = await supabase.from('posts').insert({
        author_id: sessionUid,
        text,
        visibility: 'public',
        shared_book: book
          ? { title: book.title, genre: book.genre, synopsis: book.synopsis, excerpt: (book.content || '').slice(0, 2000) }
          : null
      });
      if (error) {
        console.error(error);
        showNotification('Não foi possível publicar agora.');
        return;
      }
      setNewPostText('');
      setShareBookId('');
      setFeedFilter('all');
      await refreshPosts();
      showNotification('Publicado na comunidade!');
      return;
    }
    const post = {
      id: `p_${Date.now()}`,
      isMine: true,
      authorName: '',
      authorHandle: '',
      authorColor: '',
      text,
      createdAt: new Date().toISOString(),
      likes: 0,
      likedByMe: false,
      comments: [],
      sharedBook: book
        ? {
            title: book.title,
            genre: book.genre,
            synopsis: book.synopsis,
            excerpt: (book.content || '').slice(0, 2000)
          }
        : null
    };
    setPosts(prev => [post, ...prev]);
    await dbSet('posts', post);
    setNewPostText('');
    setShareBookId('');
    setFeedFilter('all');
    showNotification('Publicado na comunidade!');
  };

  const handleToggleLike = (id) => {
    if (cloudOn) { cloudToggleLike(id); return; }
    updatePost(id, p => ({
      ...p,
      likedByMe: !p.likedByMe,
      likes: Math.max(0, (p.likes || 0) + (p.likedByMe ? -1 : 1))
    }));
  };

  const handleAddComment = (id) => {
    const text = sanitizeInput(commentDrafts[id] || '').slice(0, 500);
    if (!text) return;
    if (cloudOn) { cloudAddComment(id, text); setCommentDrafts(prev => ({ ...prev, [id]: '' })); return; }
    updatePost(id, p => ({
      ...p,
      comments: [
        ...(p.comments || []),
        { id: `c_${Date.now()}`, isMine: true, authorName: '', text, createdAt: new Date().toISOString() }
      ]
    }));
    setCommentDrafts(prev => ({ ...prev, [id]: '' }));
  };

  const handleDeletePost = async (id) => {
    if (cloudOn) { await cloudDeletePost(id); return; }
    setPosts(prev => prev.filter(p => p.id !== id));
    await dbDelete('posts', id);
    showNotification('Publicação removida.');
  };

  // --- AÇÕES NA NUVEM (só com login) ---
  const refreshPosts = async () => {
    if (!cloudOn) return;
    try {
      setPosts(await cloudFetchPosts(sessionUid));
    } catch (err) {
      console.error('Erro ao atualizar a comunidade:', err);
    }
  };

  const confirmPublishTerms = async () => {
    if (await dbGet('settings', 'termsAccepted')) return true;
    const ok = window.confirm(
      'Antes de publicar: você declara ter o direito de compartilhar este conteúdo (obra própria, domínio público ou com autorização do autor). ' +
      'Conteúdo ofensivo, ilegal ou protegido por direitos autorais pode ser denunciado e removido, e a conta pode ser suspensa. Deseja continuar?'
    );
    if (ok) await dbSet('settings', true, 'termsAccepted');
    return ok;
  };

  const cloudToggleLike = async (id) => {
    const post = posts.find(p => p.id === id);
    if (!post) return;
    setPosts(prev => prev.map(p => (p.id === id
      ? { ...p, likedByMe: !p.likedByMe, likes: Math.max(0, p.likes + (p.likedByMe ? -1 : 1)) }
      : p)));
    const { error } = post.likedByMe
      ? await supabase.from('likes').delete().eq('post_id', id).eq('user_id', sessionUid)
      : await supabase.from('likes').insert({ post_id: id, user_id: sessionUid });
    if (error) {
      showNotification('Não foi possível curtir agora.');
      await refreshPosts();
    }
  };

  const cloudAddComment = async (id, text) => {
    const { error } = await supabase.from('comments').insert({ post_id: id, author_id: sessionUid, text });
    if (error) {
      showNotification('Não foi possível comentar agora.');
      return;
    }
    await refreshPosts();
  };

  const cloudDeletePost = async (id) => {
    const { error } = await supabase.from('posts').delete().eq('id', id);
    if (error) {
      showNotification('Não foi possível remover agora.');
      return;
    }
    setPosts(prev => prev.filter(p => p.id !== id));
    showNotification('Publicação removida.');
  };

  const cloudTogglePublishPdf = async (pdf, visibility) => {
    const mine = posts.find(p => p.isMine && p.pdfId === pdf.id);
    if (mine) { await cloudDeletePost(mine.id); return; }
    if (pdf.scanned) {
      showNotification('Este PDF não tem texto para compartilhar no leitor.');
      return;
    }
    if ((pdf.text || '').length > 3000000) {
      showNotification('Este PDF é grande demais para compartilhar (limite de cerca de 3 milhões de caracteres).');
      return;
    }
    if (!(await confirmPublishTerms())) return;
    const { error } = await supabase.from('posts').insert({
      author_id: sessionUid,
      text: '',
      visibility,
      pdf_id: pdf.id,
      shared_pdf: { title: pdf.title, numPages: pdf.numPages },
      shared_text: pdf.text
    });
    if (error) {
      console.error(error);
      showNotification('Não foi possível compartilhar este PDF agora.');
      return;
    }
    await refreshPosts();
    showNotification(visibility === 'link' ? 'Link criado! Use "Copiar link" para enviar a quem quiser.' : 'PDF publicado na comunidade!');
  };

  const handleCopyLink = async (token) => {
    const url = `${window.location.origin}/?p=${token}`;
    try {
      await navigator.clipboard.writeText(url);
      showNotification('Link copiado!');
    } catch {
      window.prompt('Copie o link abaixo:', url);
    }
  };

  const handleReportPost = async (post) => {
    const reason = window.prompt('Por que você quer denunciar esta publicação? (opcional)');
    if (reason === null) return;
    const { error } = await supabase.from('reports').insert({
      post_id: post.id,
      reporter_id: sessionUid,
      reason: sanitizeInput(reason).slice(0, 300)
    });
    showNotification(error ? 'Não foi possível enviar a denúncia.' : 'Denúncia enviada. Obrigado!');
  };

  const handleBlockUser = async (post) => {
    if (!window.confirm(`Bloquear ${post.authorName}? As publicações dessa pessoa deixarão de aparecer para você.`)) return;
    const { error } = await supabase.from('blocks').insert({ blocker_id: sessionUid, blocked_id: post.authorId });
    if (error) {
      showNotification('Não foi possível bloquear agora.');
      return;
    }
    setBlockedIds(prev => [...prev, post.authorId]);
    showNotification('Usuário bloqueado.');
  };

  const handleUnblockAll = async () => {
    await supabase.from('blocks').delete().eq('blocker_id', sessionUid);
    setBlockedIds([]);
    showNotification('Bloqueios removidos.');
  };

  const handleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    if (error) showNotification('Não foi possível iniciar o login com o Google.');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    await dbSet('settings', { ...profile, google: null }, 'profile');
    window.location.reload();
  };

  // Sincroniza perfil, manuscritos, PDFs e comunidade ao entrar
  const syncCloud = async (user) => {
    const uid = user.id;
    const meta = user.user_metadata || {};
    try {
      // 1) Perfil
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
      let base = prof;
      const cloudIsFresh = prof && !prof.bio && !prof.favorite_genre && !prof.avatar_color;
      if (prof && cloudIsFresh && profile.name && profile.name !== 'Autor') {
        const patch = {
          name: profile.name,
          bio: profile.bio || '',
          favorite_genre: profile.favoriteGenre || '',
          avatar_color: profile.avatarColor || AVATAR_GRADIENTS[0]
        };
        const { error: e1 } = await supabase.from('profiles').update(patch).eq('id', uid);
        if (!e1) base = { ...prof, ...patch };
        if (profile.handle && profile.handle !== 'autor') {
          const { error: e2 } = await supabase.from('profiles').update({ handle: profile.handle }).eq('id', uid);
          if (!e2) base = { ...base, handle: profile.handle };
        }
      }
      const google = {
        sub: uid,
        email: user.email || '',
        name: meta.full_name || meta.name || '',
        picture: meta.avatar_url || meta.picture || '',
        linkedAt: new Date().toISOString()
      };
      const nextProfile = {
        name: (base && base.name) || google.name || 'Autor',
        handle: (base && base.handle) || 'autor',
        bio: (base && base.bio) || '',
        favoriteGenre: (base && base.favorite_genre) || '',
        avatarColor: (base && base.avatar_color) || AVATAR_GRADIENTS[0],
        google
      };
      setProfile(nextProfile);
      setProfileDraft(nextProfile);
      await dbSet('settings', nextProfile, 'profile');

      // 2) Manuscritos (vale a edição mais recente; exclusões também sincronizam)
      const { data: bRows, error: bErr } = await supabase.from('books').select('*').eq('user_id', uid);
      if (bErr) throw bErr;
      let mergedBooks = [...booksRef.current];
      const pushBooks = [];
      const cloudBookIds = new Set();
      for (const r of bRows || []) {
        cloudBookIds.add(r.id);
        const local = mergedBooks.find(b => b.id === r.id);
        const cloudMs = Number(r.updated_ms) || 0;
        const localMs = (local && local.updatedAt) || 0;
        if (r.deleted) {
          if (local && localMs <= cloudMs) {
            mergedBooks = mergedBooks.filter(b => b.id !== r.id);
            await dbDelete('books', r.id);
          } else if (local) {
            pushBooks.push(local);
          }
        } else if (!local) {
          const nb = rowToBook(r);
          mergedBooks.unshift(nb);
          await dbSet('books', nb);
        } else if (cloudMs > localMs) {
          const nb = { ...local, ...rowToBook(r) };
          mergedBooks = mergedBooks.map(b => (b.id === r.id ? nb : b));
          await dbSet('books', nb);
        } else if (localMs > cloudMs) {
          pushBooks.push(local);
        }
      }
      for (const b of mergedBooks) {
        if (!cloudBookIds.has(b.id) && !(b.id === 'b1' && !b.updatedAt)) pushBooks.push(b);
      }
      for (let i = 0; i < pushBooks.length; i += 10) {
        const { error } = await supabase.from('books').upsert(pushBooks.slice(i, i + 10).map(b => bookToRow(uid, b)));
        if (error) console.error('Erro ao enviar manuscritos:', error);
      }
      setBooks(mergedBooks);
      setSelectedBookId(prev => (mergedBooks.some(b => b.id === prev) ? prev : (mergedBooks[0] ? mergedBooks[0].id : '')));

      // 3) PDFs
      const { data: pRows, error: pErr } = await supabase.from('pdfs').select('*').eq('user_id', uid);
      if (pErr) throw pErr;
      let mergedPdfs = [...pdfsRef.current];
      const cloudPdfIds = new Set();
      const toDownload = [];
      for (const r of pRows || []) {
        cloudPdfIds.add(r.id);
        const local = mergedPdfs.find(x => x.id === r.id);
        const cloudMs = Number(r.updated_ms) || 0;
        const localMs = (local && local.updatedAt) || 0;
        if (r.deleted) {
          if (local) {
            mergedPdfs = mergedPdfs.filter(x => x.id !== r.id);
            await dbDelete('pdfs', r.id);
          }
        } else if (!local) {
          toDownload.push(r);
        } else if (cloudMs > localMs) {
          const np = { ...local, ...rowToPdfMeta(r) };
          mergedPdfs = mergedPdfs.map(x => (x.id === r.id ? np : x));
          await dbSet('pdfs', np);
        } else if (localMs > cloudMs) {
          await cloudPushPdfMeta(uid, local);
        }
      }
      for (const x of mergedPdfs) {
        if (!cloudPdfIds.has(x.id)) await cloudPushPdf(uid, x);
      }
      setPdfs(mergedPdfs);
      if (toDownload.length > 0) {
        showNotification('Baixando seus PDFs da nuvem...');
        for (const r of toDownload) {
          const { data: blob } = await supabase.storage.from('pdfs').download(`${uid}/${r.id}.pdf`);
          if (!blob) continue;
          const { numPages, text } = await extractPdf(await blob.arrayBuffer());
          const rec = { ...rowToPdfMeta(r), numPages, text, blob, sharedPostId: null };
          await dbSet('pdfs', rec);
          setPdfs(prev => [rec, ...prev.filter(x => x.id !== rec.id)]);
        }
      }

      // 4) Comunidade e bloqueios
      const { data: blocks } = await supabase.from('blocks').select('blocked_id').eq('blocker_id', uid);
      setBlockedIds((blocks || []).map(b => b.blocked_id));
      setPosts(await cloudFetchPosts(uid));

      showNotification('Conta sincronizada!');
    } catch (err) {
      console.error('Erro na sincronização:', err);
      showNotification('Não foi possível sincronizar agora. Tentaremos de novo ao reabrir o app.');
    }
  };

  // --- PDFs ---
  const handleUploadPdf = async (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
      showNotification('Selecione um arquivo PDF.');
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      showNotification('Erro: PDF excede o limite de 25MB.');
      return;
    }
    setPdfBusy(true);
    try {
      const { numPages, text } = await extractPdf(await file.arrayBuffer());
      const scanned = text.replace(/\s/g, '').length < numPages * 40;
      const record = {
        id: `pdf_${Date.now()}`,
        updatedAt: Date.now(),
        title: sanitizeInput(file.name.replace(/\.[^.]+$/, '')).slice(0, 100) || 'PDF',
        fileName: sanitizeInput(file.name).slice(0, 120),
        size: formatFileSize(file.size),
        numPages,
        uploadedAt: new Date().toISOString().slice(0, 10),
        text,
        scanned,
        blob: file,
        sharedPostId: null
      };
      const ok = await dbSet('pdfs', record);
      setPdfs(prev => [record, ...prev]);
      if (cloudOn) {
        cloudPushPdf(sessionUid, record).then(okCloud => {
          if (!okCloud) showNotification('PDF salvo só neste aparelho (falha ao enviar para a nuvem).');
        });
      }
      showNotification(
        !ok ? 'PDF aberto, mas não foi possível salvá-lo no navegador.'
          : scanned ? 'PDF adicionado, mas sem texto selecionável (provável escaneado).'
          : `PDF "${record.title}" adicionado!`
      );
    } catch (err) {
      console.error('Erro ao processar PDF:', err);
      showNotification('Não foi possível ler este PDF (protegido por senha ou corrompido?).');
    } finally {
      setPdfBusy(false);
    }
  };

  const handleDeletePdf = async (pdf) => {
    if (pdf.sharedPostId) await handleDeletePost(pdf.sharedPostId);
    setPdfs(prev => prev.filter(p => p.id !== pdf.id));
    await dbDelete('pdfs', pdf.id);
    if (cloudOn) cloudDeletePdf(sessionUid, pdf.id);
    showNotification('PDF removido.');
  };

  const handleTogglePublishPdf = async (pdf, visibility = 'public') => {
    if (supabase && !session) {
      showNotification('Entre com sua conta Google (aba Perfil) para compartilhar.');
      return;
    }
    if (cloudOn) { await cloudTogglePublishPdf(pdf, visibility); return; }
    const isPublished = !!pdf.sharedPostId && posts.some(p => p.id === pdf.sharedPostId);
    if (isPublished) {
      await handleDeletePost(pdf.sharedPostId);
      const updated = { ...pdf, sharedPostId: null };
      setPdfs(prev => prev.map(p => (p.id === pdf.id ? updated : p)));
      await dbSet('pdfs', updated);
      return;
    }
    if (pdf.scanned) {
      showNotification('Este PDF não tem texto para compartilhar no leitor.');
      return;
    }
    const post = {
      id: `p_${Date.now()}`,
      isMine: true,
      authorName: '',
      authorHandle: '',
      authorColor: '',
      text: '',
      createdAt: new Date().toISOString(),
      likes: 0,
      likedByMe: false,
      comments: [],
      sharedBook: null,
      sharedPdf: { title: pdf.title, numPages: pdf.numPages, text: pdf.text }
    };
    setPosts(prev => [post, ...prev]);
    await dbSet('posts', post);
    const updated = { ...pdf, sharedPostId: post.id };
    setPdfs(prev => prev.map(p => (p.id === pdf.id ? updated : p)));
    await dbSet('pdfs', updated);
    showNotification('PDF publicado na comunidade!');
  };

  const handleSendPdfFile = async (pdf) => {
    const name = pdf.fileName || 'documento.pdf';
    const file = new File([pdf.blob], name, { type: 'application/pdf' });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: pdf.title });
      } else {
        triggerSecureDownload(pdf.blob, name, 'application/pdf');
        showNotification('Compartilhamento nativo indisponível aqui; o PDF foi baixado.');
      }
    } catch (err) {
      if (err?.name !== 'AbortError') showNotification('Não foi possível compartilhar o arquivo.');
    }
  };

  const handleOpenPdfOriginal = (pdf) => {
    const url = URL.createObjectURL(pdf.blob);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const publishedIds = useMemo(() => new Set(posts.map(p => p.id)), [posts]);

  const pdfsView = useMemo(() => pdfs.map(x => {
    const mine = posts.find(post => post.isMine && post.pdfId === x.id);
    return mine ? { ...x, sharedPostId: mine.id, shareToken: mine.shareToken } : x;
  }), [pdfs, posts]);

  const communityReads = useMemo(() => posts
    .filter(p => (!supabase || !!session) && !p.isMine && !blockedIds.includes(p.authorId) && (p.sharedBook || p.sharedPdf))
    .map(p => ({
      id: p.id,
      kind: p.sharedPdf ? 'pdf' : 'book',
      title: (p.sharedPdf || p.sharedBook).title,
      author: p.authorName,
      handle: p.authorHandle,
      meta: p.sharedPdf ? `${p.sharedPdf.numPages} páginas` : (p.sharedBook.genre || 'Geral'),
      content: p.sharedPdf ? p.sharedPdf.text : p.sharedBook.excerpt
    })), [posts, session, blockedIds]);

  // --- CONTA GOOGLE ---
  const handleGoogleLink = async (g) => {
    const google = { sub: g.sub, email: g.email, name: g.name, picture: g.picture, linkedAt: new Date().toISOString() };
    const useGoogleName = (!profile.name || profile.name === 'Autor') && g.name;
    const nameFromGoogle = useGoogleName ? { name: sanitizeInput(g.name).slice(0, 60) } : {};
    const next = { ...profile, google, ...nameFromGoogle };
    setProfile(next);
    setProfileDraft(prev => ({ ...prev, google, ...nameFromGoogle }));
    const ok = await dbSet('settings', next, 'profile');
    showNotification(ok ? `Conta Google vinculada: ${g.email}` : 'Erro ao salvar o vínculo.');
  };

  const handleGoogleUnlink = async () => {
    window.google?.accounts?.id?.disableAutoSelect?.();
    const next = { ...profile, google: null };
    setProfile(next);
    setProfileDraft(prev => ({ ...prev, google: null }));
    await dbSet('settings', next, 'profile');
    showNotification('Conta Google desvinculada.');
  };

  // Paginação do leitor (Flipbook)
  const pages = useMemo(() => {
    if (!flipbookBook) return ['Sem conteúdo para exibição.'];
    const fullText = flipbookBook.content || 'Conteúdo em branco.';
    const paragraphs = fullText.split('\n');
    const resultPages = [];
    let currentPage = '';
    const WORDS_PER_PAGE = 220;

    for (const p of paragraphs) {
      const pageWordCount = calculateWords(currentPage);
      const paragraphWordCount = calculateWords(p);

      if (pageWordCount + paragraphWordCount > WORDS_PER_PAGE && currentPage.length > 0) {
        resultPages.push(currentPage.trim());
        currentPage = p + '\n\n';
      } else {
        currentPage += p + '\n\n';
      }
    }

    if (currentPage.trim().length > 0) {
      resultPages.push(currentPage.trim());
    }

    return resultPages.length > 0 ? resultPages : ['Sem conteúdo para exibição.'];
  }, [flipbookBook]);

  const openFlipbook = async (book) => {
    let target = book;
    if (book.postId && !book.content && supabase) {
      const text = await cloudFetchPostText(book.postId);
      if (!text) {
        showNotification('Não foi possível carregar este texto agora.');
        return;
      }
      target = { ...book, content: text };
    }
    setFlipbookBook(target);
    setCurrentPageIndex(0);
    setFlipbookActive(true);
  };

  const closeFlipbook = () => {
    setFlipbookActive(false);
    setFlipbookBook(null);
  };

  const isDark = theme === 'dark';

  const toolBtn = `flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors ${
    isDark ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-300 hover:bg-slate-100 text-slate-700'
  }`;
  const libBtn = `flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
    isDark ? 'border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
  }`;

  // --- Busca, etiquetas e coleções ---
  const visibleBooks = useMemo(
    () => filterItems(books, { query: libQuery, collection: libCollection, tag: libTag }),
    [books, libQuery, libCollection, libTag]
  );
  const allCollections = useMemo(
    () => [...new Set([...books, ...pdfs].map(i => i.collection).filter(Boolean))],
    [books, pdfs]
  );

  const openOrganize = (kind, item) => {
    setOrganizeTarget({ kind, item });
    setTagsDraft((item.tags || []).join(', '));
    setCollectionDraft(item.collection || '');
  };

  const saveOrganize = async () => {
    if (!organizeTarget) return;
    const tags = [...new Set(tagsDraft.split(',').map(x => sanitizeInput(x).toLowerCase().slice(0, 24)).filter(Boolean))].slice(0, 8);
    const collection = sanitizeInput(collectionDraft).slice(0, 40);
    const { kind, item } = organizeTarget;
    if (kind === 'book') {
      const updated = { ...(books.find(b => b.id === item.id) || item), tags, collection, updatedAt: Date.now() };
      setBooks(prev => prev.map(b => (b.id === item.id ? updated : b)));
      await dbSet('books', updated);
      if (cloudOn) cloudPushBook(sessionUid, updated);
    } else {
      const updated = { ...(pdfs.find(x => x.id === item.id) || item), tags, collection, updatedAt: Date.now() };
      setPdfs(prev => prev.map(x => (x.id === item.id ? updated : x)));
      await dbSet('pdfs', updated);
      if (cloudOn) cloudPushPdfMeta(sessionUid, updated);
    }
    setOrganizeTarget(null);
    showNotification('Etiquetas e coleção salvas!');
  };

  // --- Aprendizagem ---
  const handleToggleLesson = (id) => {
    const next = { ...learningDone };
    if (next[id]) delete next[id];
    else next[id] = true;
    setLearningDone(next);
    dbSet('settings', next, 'learningProgress');
  };

  const handleStartExercise = (lesson) => {
    const newBook = {
      id: `b_${Date.now()}`,
      updatedAt: Date.now(),
      title: `Exercício: ${lesson.title}`,
      author: profile.name || 'Autor',
      genre: 'Exercício',
      coverColor: 'from-emerald-600 to-teal-800',
      synopsis: `Prática da lição "${lesson.title}".`,
      content: `${lesson.title}\n\nExercício:\n${lesson.exercise}\n\n---\n\n`
    };
    setBooks(prev => [newBook, ...prev]);
    setSelectedBookId(newBook.id);
    setActiveTab('editor');
    showNotification('Exercício criado no editor!');
  };

  // --- Meta diária de palavras ---
  const totalWords = useMemo(() => books.reduce((sum, b) => sum + calculateWords(b.content), 0), [books]);
  const todayWords = Math.max(0, totalWords - (dayBaseline ? dayBaseline.words : totalWords));
  const backupOld = !lastBackupAt || (Date.now() - new Date(lastBackupAt).getTime()) > 7 * 24 * 3600 * 1000;
  const chapters = useMemo(() => findChapters(currentBook.content), [currentBook.content]);

  useEffect(() => {
    if (!isLoaded) return;
    const today = todayKey();
    if (!dayBaseline || dayBaseline.date !== today) {
      const base = { date: today, words: totalWords };
      setDayBaseline(base);
      dbSet('settings', base, 'dayBaseline');
    }
  }, [isLoaded, dayBaseline, totalWords]);

  // Sessão (login com Google via Supabase)
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Sincroniza uma vez por login
  useEffect(() => {
    if (!supabase || !sessionUid || !isLoaded) return;
    syncCloud(session.user);
  }, [sessionUid, isLoaded]);

  // Mantém a comunidade atualizada enquanto a aba está aberta
  useEffect(() => {
    if (!supabase || !sessionUid || activeTab !== 'community') return;
    let cancelled = false;
    const load = async () => {
      try {
        const list = await cloudFetchPosts(sessionUid);
        if (!cancelled) setPosts(list);
      } catch (err) {
        console.error('Erro ao carregar a comunidade:', err);
      }
    };
    load();
    const id = setInterval(load, 45000);
    return () => { cancelled = true; clearInterval(id); };
  }, [sessionUid, activeTab]);

  // Abre links de compartilhamento (?p=...) mesmo para quem não tem conta
  useEffect(() => {
    if (!isLoaded) return;
    const token = new URLSearchParams(window.location.search).get('p');
    if (!token) return;
    window.history.replaceState({}, '', window.location.pathname);
    if (!supabase) {
      showNotification('Este link precisa da versão do app com contas ativada.');
      return;
    }
    (async () => {
      const { data, error } = await supabase.rpc('get_post_by_token', { p_token: token });
      const row = Array.isArray(data) ? data[0] : data;
      if (error || !row) {
        showNotification('Link inválido ou removido.');
        return;
      }
      const sp = row.shared_pdf;
      const sb = row.shared_book;
      const name = sp ? sp.title : (sb ? sb.title : 'Texto compartilhado');
      const content = sp ? row.shared_text : (sb ? sb.excerpt : row.text);
      openFlipbook({ title: `${name} — por ${row.author_name}`, content: content || row.text || '', key: `post:${row.id}` });
    })();
  }, [isLoaded]);

  // Registra as palavras escritas hoje (para as estatísticas)
  useEffect(() => {
    if (!isLoaded || !dayBaseline) return;
    const today = todayKey();
    if (dayBaseline.date !== today) return;
    if ((writingLog[today] || 0) === todayWords) return;
    const id = setTimeout(() => {
      const next = { ...writingLog, [today]: todayWords };
      setWritingLog(next);
      dbSet('settings', next, 'writingLog');
    }, 800);
    return () => clearTimeout(id);
  }, [isLoaded, dayBaseline, todayWords, writingLog]);

  // Versão automática a cada 5 minutos (só se o texto mudou)
  useEffect(() => {
    if (!isLoaded) return;
    const id = setInterval(() => {
      const b = currentBookRef.current;
      if (b && b.id) snapshotBook(b, 'auto');
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [isLoaded]);

  // Esc sai do modo foco
  useEffect(() => {
    if (!focusMode) return;
    const onKey = (e) => { if (e.key === 'Escape') setFocusMode(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusMode]);

  const handleGoalChange = (value) => {
    const n = Math.max(0, Math.min(100000, Number(value) || 0));
    setDailyGoal(n);
    dbSet('settings', n, 'dailyGoal');
  };

  // --- Versões ---
  const openHistory = async () => {
    setHistory((await dbGet('settings', `history:${currentBook.id}`)) || []);
    setHistoryOpen(true);
  };

  const handleSaveVersion = async () => {
    const next = await snapshotBook(currentBook, 'manual');
    if (next) {
      setHistory(next);
      showNotification('Versão salva!');
    } else {
      showNotification('Nenhuma mudança desde a última versão.');
    }
  };

  const handleRestoreVersion = async (entry) => {
    await snapshotBook(currentBook, 'antes-de-restaurar');
    handleContentChange(entry.content);
    setHistory((await dbGet('settings', `history:${currentBook.id}`)) || []);
    showNotification('Versão restaurada. O texto anterior ficou guardado no histórico.');
  };

  // --- Capítulos ---
  const jumpToChapter = (pos) => {
    const el = editorRef.current;
    if (!el) return;
    el.scrollTop = Math.max(0, (pos / Math.max(1, el.value.length)) * el.scrollHeight - 40);
    el.focus();
    el.setSelectionRange(pos, pos);
  };

  // --- Exportar para Word / PDF ---
  const handleExportWord = (book) => {
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${escapeHtml(book.title)}</title></head><body style="font-family:Georgia,serif;font-size:12pt;line-height:1.5">${bookToHtml(book)}</body></html>`;
    const fileName = `${(book.title || 'manuscrito').toLowerCase().replace(/[^a-z0-9]/g, '_')}.doc`;
    triggerSecureDownload('\ufeff' + html, fileName, 'application/msword');
    showNotification('Manuscrito baixado para o Word (.doc)!');
  };

  const handlePrintPdf = (book) => {
    const w = window.open('', '_blank');
    if (!w) {
      showNotification('Permita pop-ups neste site para gerar o PDF.');
      return;
    }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(book.title)}</title><style>body{font-family:Georgia,serif;max-width:680px;margin:40px auto;line-height:1.7;font-size:12pt}h1{font-size:22pt}p{margin:0 0 12px}</style></head><body>${bookToHtml(book)}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  // --- Backup completo ---
  const handleExportAll = async () => {
    try {
      showNotification('Preparando o backup...');
      const pdfRecords = [];
      for (const rec of pdfs) {
        const { blob, ...rest } = rec;
        pdfRecords.push({ ...rest, fileData: blob ? await blobToDataUrl(blob) : null });
      }
      const settings = {};
      for (const k of ['theme', 'readerPrefs', 'musicLinks', 'dailyGoal', 'readingProgress', 'annotations', 'writingLog', 'learningProgress']) {
        const v = await dbGet('settings', k);
        if (v !== undefined && v !== null) settings[k] = v;
      }
      const payload = {
        app: 'estudio-narrativo',
        version: 1,
        exportedAt: new Date().toISOString(),
        profile: { ...profile, google: null },
        settings,
        books,
        documents: myPdfs,
        pdfs: pdfRecords,
        posts: posts.filter(post => post.isMine)
      };
      triggerSecureDownload(JSON.stringify(payload), `estudio-narrativo-backup-${todayKey()}.json`, 'application/json');
      const stamp = new Date().toISOString();
      setLastBackupAt(stamp);
      await dbSet('settings', stamp, 'lastBackupAt');
      showNotification('Backup completo baixado!');
    } catch (err) {
      console.error('Erro ao gerar backup:', err);
      showNotification('Erro ao gerar o backup.');
    }
  };

  // Restaura sem apagar nada: só adiciona o que ainda não existe aqui.
  const handleRestoreBackup = (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data || data.app !== 'estudio-narrativo' || !Array.isArray(data.books)) throw new Error('formato');

        for (const b of data.books) {
          if (b && b.id && !books.some(x => x.id === b.id)) await dbSet('books', b);
        }
        for (const d of (data.documents || [])) {
          if (d && d.id && !myPdfs.some(x => x.id === d.id)) await dbSet('documents', d);
        }
        for (const rec of (data.pdfs || [])) {
          if (!rec || !rec.id || pdfs.some(x => x.id === rec.id)) continue;
          const { fileData, ...rest } = rec;
          await dbSet('pdfs', { ...rest, blob: fileData ? await dataUrlToBlob(fileData) : null });
        }
        for (const post of (data.posts || [])) {
          if (post && post.id && !posts.some(x => x.id === post.id)) await dbSet('posts', post);
        }
        for (const [k, v] of Object.entries(data.settings || {})) {
          if (['readingProgress', 'annotations', 'writingLog', 'musicLinks', 'learningProgress'].includes(k)) {
            const cur = (await dbGet('settings', k)) || {};
            await dbSet('settings', { ...v, ...cur }, k);
          } else if (['readerPrefs', 'dailyGoal'].includes(k) && (await dbGet('settings', k)) == null) {
            await dbSet('settings', v, k);
          }
        }
        if (data.profile && profile.name === 'Autor' && !profile.google) {
          await dbSet('settings', { ...data.profile, google: null }, 'profile');
        }

        showNotification('Backup restaurado! Recarregando...');
        setTimeout(() => window.location.reload(), 1200);
      } catch (err) {
        console.error('Erro ao restaurar backup:', err);
        showNotification('Erro: arquivo de backup inválido ou corrompido.');
      }
    };
    reader.onerror = () => showNotification('Erro ao ler o arquivo de backup.');
    reader.readAsText(file);
  };


  const navItems = [
    { id: 'library', label: 'Biblioteca', Icon: BookOpen },
    { id: 'editor', label: 'Editor', Icon: Edit3 },
    { id: 'reading', label: 'Leitura', Icon: FileText },
    { id: 'community', label: 'Comunidade', Icon: Globe },
    { id: 'learning', label: 'Aprender', Icon: GraduationCap },
    { id: 'profile', label: 'Perfil', Icon: User }
  ];

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>

      {/* CABEÇALHO */}
      <header className={`sticky top-0 z-30 border-b ${isDark ? 'bg-slate-950/95 border-slate-800' : 'bg-white/95 border-slate-200'}`}>
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Feather className="w-5 h-5 text-indigo-500" />
            <span className="font-semibold tracking-tight">Estúdio Narrativo</span>
          </div>

          <nav className="hidden md:flex items-center gap-1" aria-label="Navegação principal">
            {navItems.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                aria-current={activeTab === id ? 'page' : undefined}
                className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === id
                    ? 'border-indigo-500 text-indigo-500'
                    : `border-transparent ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'}`
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          <button
            onClick={toggleTheme}
            className={`p-2 rounded-lg transition-colors ${isDark ? 'text-amber-400 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}
            title="Alternar tema"
            aria-label="Alternar tema"
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* NAVEGAÇÃO NO CELULAR */}
      <nav
        className={`md:hidden fixed bottom-0 inset-x-0 z-30 border-t flex ${isDark ? 'bg-slate-950/95 border-slate-800' : 'bg-white/95 border-slate-200'}`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        aria-label="Navegação principal"
      >
        {navItems.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            aria-current={activeTab === id ? 'page' : undefined}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
              activeTab === id ? 'text-indigo-500' : 'text-slate-500'
            }`}
          >
            <Icon className="w-5 h-5" />
            {label}
          </button>
        ))}
      </nav>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 pb-24 md:p-6">

        {/* --- LEITURA (PDFs + MÚSICA) --- */}
        <div className={activeTab === 'reading' ? '' : 'hidden'}>
          <ReadingTab
            isDark={isDark}
            pdfs={pdfsView}
            busy={pdfBusy}
            publishedIds={publishedIds}
            communityReads={communityReads}
            onUpload={handleUploadPdf}
            onRead={openFlipbook}
            onDelete={handleDeletePdf}
            onTogglePublish={handleTogglePublishPdf}
            onSendFile={handleSendPdfFile}
            onOpenOriginal={handleOpenPdfOriginal}
            onOrganize={openOrganize}
            cloudActive={cloudOn}
            onCopyLink={handleCopyLink}
            showNotification={showNotification}
          />
        </div>

        {/* --- BIBLIOTECA --- */}
        {activeTab === 'library' && (
          <div className="space-y-8">

            <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Biblioteca</h1>
                <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {books.length} {books.length === 1 ? 'manuscrito' : 'manuscritos'} • {totalWords.toLocaleString('pt-BR')} palavras
                </p>
                <p className={`text-xs mt-1 ${backupOld ? 'text-amber-500' : 'text-slate-500'}`}>
                  {lastBackupAt
                    ? `Último backup: ${new Date(lastBackupAt).toLocaleDateString('pt-BR')}`
                    : 'Sem backup ainda: use "Mais" e depois "Backup completo".'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <input type="file" ref={jsonFileInputRef} onChange={handleImportJSON} accept=".json" className="hidden" />
                <input type="file" ref={backupInputRef} onChange={handleRestoreBackup} accept=".json" className="hidden" />

                <button
                  onClick={handleCreateNewBook}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Novo manuscrito
                </button>

                <ActionMenu
                  isDark={isDark}
                  label="Mais"
                  items={[
                    { label: 'Importar projeto (JSON)', onClick: () => jsonFileInputRef.current?.click() },
                    { label: 'Backup completo', onClick: handleExportAll },
                    { label: 'Restaurar backup', onClick: () => backupInputRef.current?.click() }
                  ]}
                />
              </div>
            </div>

            {/* MANUSCRITOS */}
            <div>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Feather className="w-5 h-5 text-indigo-500" />
                Manuscritos Ativos ({books.length})
              </h2>

              {books.length > 0 && (
                <FilterBar isDark={isDark} items={books} query={libQuery} setQuery={setLibQuery} collection={libCollection} setCollection={setLibCollection} tag={libTag} setTag={setLibTag} />
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {visibleBooks.length === 0 && (
                  <p className="text-sm text-slate-500 col-span-full">Nenhum manuscrito encontrado com esses filtros.</p>
                )}
                {visibleBooks.map((book) => (
                  <div
                    key={book.id}
                    className={`group relative rounded-xl border p-5 flex flex-col justify-between transition-all duration-200 ${
                      isDark ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className={`h-24 rounded-xl bg-gradient-to-br ${book.coverColor || 'from-indigo-600 to-purple-800'} p-3 flex flex-col justify-between text-white mb-3`}>
                        <span className="text-xs font-semibold uppercase tracking-wider bg-black/30 px-2 py-1 rounded-md w-fit backdrop-blur-sm">
                          {book.genre || 'Geral'}
                        </span>
                        <div>
                          <h3 className="font-bold text-lg leading-snug line-clamp-1">{book.title}</h3>
                          <p className="text-xs text-white/80">{book.author}</p>
                        </div>
                      </div>

                      <p className={`text-xs line-clamp-3 mb-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        {book.synopsis || 'Sem sinopse informada.'}
                      </p>
                      <TagChips item={book} isDark={isDark} />
                    </div>

                    <div className={`flex items-center justify-between pt-3 border-t text-xs ${isDark ? 'border-slate-800/50' : 'border-slate-200'}`}>
                      <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>
                        {calculateWords(book.content)} palavras
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openFlipbook({ ...book, key: `book:${book.id}` })}
                          className="p-2 rounded-lg hover:bg-indigo-600/10 text-indigo-400 transition-colors"
                          title="Ler"
                        >
                          <BookOpen className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedBookId(book.id);
                            setActiveTab('editor');
                          }}
                          className="p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
                          title="Editar"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <ActionMenu
                          isDark={isDark}
                          up
                          items={[
                            { label: 'Etiquetas e coleção', onClick: () => openOrganize('book', book) },
                            { label: 'Exportar JSON', onClick: () => handleExportJSON(book) },
                            { label: 'Excluir', danger: true, onClick: () => confirmDeleteBook(book.id) }
                          ]}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* DOCUMENTOS DE APOIO */}
            <div className={`pt-6 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-500" />
                  Documentos de Apoio ({myPdfs.length})
                </h2>

                <input
                  type="file"
                  ref={docFileInputRef}
                  onChange={handleFileUpload}
                  accept=".txt,.md"
                  className="hidden"
                />
                <button
                  onClick={() => docFileInputRef.current?.click()}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
                    isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                  }`}
                >
                  <FileUp className="w-4 h-4 text-indigo-400" />
                  Anexar Documento (.txt / .md)
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myPdfs.map((doc) => (
                  <div
                    key={doc.id}
                    className={`p-4 rounded-xl border flex items-center justify-between ${
                      isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="p-2.5 bg-indigo-600/10 text-indigo-400 rounded-lg">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="truncate">
                        <h4 className="font-semibold text-sm truncate">{doc.title}</h4>
                        <p className="text-xs text-slate-500 truncate">{doc.fileName} • {doc.size}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => openFlipbook({ title: doc.title, content: doc.content, key: `doc:${doc.id}` })}
                        className={`px-3 py-1.5 rounded-lg border text-xs text-indigo-400 transition-colors whitespace-nowrap ${
                          isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        Visualizar
                      </button>
                      <button
                        onClick={() => handleDeleteDoc(doc.id)}
                        className="p-2 rounded-lg hover:bg-rose-500/10 text-rose-500 transition-colors"
                        title="Remover documento"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* --- EDITOR PRO --- */}
        {activeTab === 'editor' && (
          <div className={focusMode ? `fixed inset-0 z-40 p-4 md:p-10 flex flex-col ${isDark ? 'bg-slate-950' : 'bg-slate-50'}` : 'h-[calc(100vh-11rem)] md:h-[calc(100vh-8rem)] flex flex-col md:flex-row gap-4'}>

            {/* LISTA LATERAL */}
            <div className={`${focusMode ? 'hidden ' : ''}w-full md:w-64 flex flex-col rounded-xl border p-4 max-h-60 md:max-h-none ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h3 className="font-bold text-sm uppercase tracking-wider text-slate-500 mb-3">Seus Manuscritos</h3>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {books.map(b => (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBookId(b.id)}
                    className={`w-full text-left p-3 rounded-xl transition-all ${
                      b.id === selectedBookId
                        ? 'bg-indigo-600 text-white font-medium'
                        : isDark ? 'hover:bg-slate-800/60 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <p className="text-sm font-semibold truncate">{b.title || 'Sem título'}</p>
                    <p className="text-xs opacity-75 truncate">{calculateWords(b.content)} palavras</p>
                  </button>
                ))}
              </div>

              <button
                onClick={handleCreateNewBook}
                className={`mt-3 w-full py-2.5 rounded-xl border border-dashed hover:border-indigo-500 text-indigo-400 flex items-center justify-center gap-2 text-xs font-semibold transition-all ${isDark ? 'border-slate-700' : 'border-slate-300'}`}
              >
                <Plus className="w-4 h-4" /> Criar Projeto
              </button>
            </div>

            {/* ÁREA DE TEXTO */}
            <div className={`flex-1 flex flex-col min-h-0 rounded-xl border ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'}`}>

              <div className={`p-4 border-b flex flex-wrap items-center justify-between gap-4 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                <input
                  type="text"
                  value={currentBook.title || ''}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Título do Manuscrito..."
                  className="bg-transparent text-xl font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded-lg px-2 py-1 flex-1 min-w-[200px]"
                />

                <div className="flex items-center gap-3 text-xs">
                  <span className={`px-2.5 py-1 rounded-full ${
                    saveStatus === 'salvo' ? 'bg-emerald-500/10 text-emerald-400' :
                    saveStatus === 'salvando' ? 'bg-amber-500/10 text-amber-400' : 'bg-rose-500/10 text-rose-400'
                  }`}>
                    {saveStatus === 'salvo' ? '✓ Salvo' : saveStatus === 'salvando' ? 'Salvando...' : 'Erro ao salvar'}
                  </span>

                  <button onClick={openHistory} className={toolBtn}>Versões</button>
                  <button onClick={() => setFocusMode(f => !f)} className={toolBtn}>{focusMode ? 'Sair do foco' : 'Foco'}</button>
                  <ActionMenu
                    isDark={isDark}
                    label="Exportar"
                    items={[
                      { label: 'Texto (.txt)', onClick: () => handleExportTXT(currentBook) },
                      { label: 'Word (.doc)', onClick: () => handleExportWord(currentBook) },
                      { label: 'PDF (imprimir)', onClick: () => handlePrintPdf(currentBook) }
                    ]}
                  />
                </div>
              </div>

              <div className={`px-4 py-2 border-b flex flex-wrap items-center gap-3 text-xs ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                <span className="text-slate-500">Meta de hoje:</span>
                <div className={`flex-1 min-w-[120px] h-2 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                  <div className="h-full bg-emerald-500 transition-all" style={{ width: `${dailyGoal > 0 ? Math.min(100, (todayWords / dailyGoal) * 100) : 0}%` }} />
                </div>
                <span className="tabular-nums">{todayWords} /</span>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={dailyGoal}
                  onChange={(e) => handleGoalChange(e.target.value)}
                  aria-label="Meta diária de palavras"
                  className={`w-20 px-2 py-1 rounded-lg border text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                  }`}
                />
                <span>palavras</span>
                {dailyGoal > 0 && todayWords >= dailyGoal && <span className="text-emerald-500 font-semibold">Meta batida! 🎉</span>}
                {chapters.length > 0 && (
                  <select
                    value=""
                    onChange={(e) => { if (e.target.value !== '') jumpToChapter(Number(e.target.value)); }}
                    aria-label="Ir para capítulo"
                    className={`ml-auto px-2 py-1 rounded-lg border text-xs max-w-[200px] ${
                      isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  >
                    <option value="">Capítulos ({chapters.length})</option>
                    {chapters.map((c, i) => <option key={i} value={c.pos}>{c.title}</option>)}
                  </select>
                )}
              </div>

              <div className="flex-1 p-4 flex flex-col min-h-0">
                <textarea
                  ref={editorRef}
                  value={currentBook.content || ''}
                  onChange={(e) => handleContentChange(e.target.value)}
                  placeholder="Escreva sua história aqui... Use Ctrl+S para salvar manualmente a qualquer momento."
                  className={`w-full flex-1 p-4 bg-transparent resize-none focus:outline-none font-serif leading-relaxed ${
                    isDark ? 'text-slate-200 placeholder-slate-600' : 'text-slate-800 placeholder-slate-400'
                  }`}
                  style={{ fontSize: `${fontSize}px` }}
                />
              </div>

              <div className={`px-4 py-3 border-t flex items-center justify-between text-xs text-slate-500 ${isDark ? 'border-slate-800/60' : 'border-slate-200'}`}>
                <div className="flex items-center gap-4">
                  <span>{currentBookWords} palavras</span>
                  <span>{(currentBook.content || '').length} caracteres</span>
                </div>

                <div className="flex items-center gap-2">
                  <span>Fonte:</span>
                  <button
                    onClick={() => setFontSize(f => Math.max(12, f - 2))}
                    className={`px-2 py-0.5 rounded font-bold ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
                    aria-label="Diminuir fonte"
                  >
                    -
                  </button>
                  <span>{fontSize}px</span>
                  <button
                    onClick={() => setFontSize(f => Math.min(28, f + 2))}
                    className={`px-2 py-0.5 rounded font-bold ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
                    aria-label="Aumentar fonte"
                  >
                    +
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* --- APRENDER --- */}
        {activeTab === 'learning' && (
          <LearningTab
            isDark={isDark}
            done={learningDone}
            onToggleDone={handleToggleLesson}
            onStartExercise={handleStartExercise}
          />
        )}

        {/* --- COMUNIDADE --- */}
        {activeTab === 'community' && (
          <div className="space-y-6 max-w-3xl mx-auto">

            <div className={`border-b pb-6 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Comunidade</h1>
              <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Compartilhe trechos, troque ideias e dê feedback a outros autores.
              </p>
              <p className={`text-xs mt-2 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                {supabase
                  ? (session ? 'Publicações compartilhadas com todos os usuários do app.' : 'Entre com sua conta Google (aba Perfil) para ver e publicar na comunidade.')
                  : 'As publicações ficam salvas apenas neste navegador. Os posts de Marina e Caio são exemplos.'}
              </p>
            </div>

            {/* NOVO POST */}
            <div className={`rounded-xl border p-4 ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="flex gap-3">
                <Avatar name={profile.name} color={profile.avatarColor} />
                <textarea
                  value={newPostText}
                  onChange={(e) => setNewPostText(e.target.value)}
                  maxLength={1000}
                  rows={3}
                  placeholder="Compartilhe uma ideia, dúvida ou conquista..."
                  className={`flex-1 bg-transparent resize-none focus:outline-none text-sm ${isDark ? 'placeholder-slate-600' : 'placeholder-slate-400'}`}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-3 border-t border-slate-800/40">
                <select
                  value={shareBookId}
                  onChange={(e) => setShareBookId(e.target.value)}
                  className={`text-xs rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-full ${
                    isDark ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-slate-300 text-slate-700'
                  }`}
                >
                  <option value="">Sem manuscrito anexado</option>
                  {books.map(b => (
                    <option key={b.id} value={b.id}>Anexar trecho: {b.title || 'Sem título'}</option>
                  ))}
                </select>

                <button
                  onClick={handleCreatePost}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all"
                >
                  <Send className="w-4 h-4" /> Publicar
                </button>
              </div>
            </div>

            {/* FILTRO */}
            <div className="flex gap-2">
              {[{ id: 'all', label: 'Todos' }, { id: 'mine', label: 'Meus posts' }].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFeedFilter(f.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    feedFilter === f.id
                      ? 'bg-indigo-600 text-white'
                      : isDark ? 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200' : 'bg-white border border-slate-200 text-slate-600'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* FEED */}
            <div className="space-y-4">
              {sortedPosts.length === 0 && (
                <p className="text-sm text-slate-500">Nenhuma publicação por aqui ainda.</p>
              )}

              {sortedPosts.map((post) => {
                const authorName = post.isMine ? profile.name : post.authorName;
                const authorHandle = post.isMine ? profile.handle : post.authorHandle;
                const authorColor = post.isMine ? profile.avatarColor : post.authorColor;

                return (
                  <article
                    key={post.id}
                    className={`rounded-xl border p-5 ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar name={authorName} color={authorColor} src={post.isMine ? (profile.google && profile.google.picture) : post.authorPicture} />
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{authorName}</p>
                          <p className="text-xs text-slate-500 truncate">@{authorHandle} • {formatPostDate(post.createdAt)}</p>
                        </div>
                      </div>

                      {!post.isMine && cloudOn && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => handleReportPost(post)} className="px-2 py-1 rounded-lg text-xs text-slate-500 hover:bg-slate-500/10 transition-colors" title="Denunciar publicação">Denunciar</button>
                          <button onClick={() => handleBlockUser(post)} className="px-2 py-1 rounded-lg text-xs text-slate-500 hover:bg-slate-500/10 transition-colors" title="Bloquear usuário">Bloquear</button>
                        </div>
                      )}

                      {post.isMine && (
                        <button
                          onClick={() => handleDeletePost(post.id)}
                          className="p-2 rounded-lg hover:bg-rose-500/10 text-rose-500 transition-colors"
                          title="Excluir publicação"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {post.text && (
                      <p className="text-sm leading-relaxed mt-4 whitespace-pre-wrap break-words">{post.text}</p>
                    )}

                    {post.sharedBook && (
                      <div className={`mt-4 rounded-xl border p-4 ${isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-bold text-sm truncate">{post.sharedBook.title}</p>
                            <p className="text-xs text-indigo-400">{post.sharedBook.genre || 'Geral'}</p>
                          </div>
                          <button
                            onClick={() => openFlipbook({ title: post.sharedBook.title, content: post.sharedBook.excerpt, key: `post:${post.id}` })}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs text-indigo-400 whitespace-nowrap transition-colors ${
                              isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            <BookOpen className="w-3.5 h-3.5" /> Ler trecho
                          </button>
                        </div>
                        {post.sharedBook.synopsis && (
                          <p className={`text-xs mt-2 line-clamp-3 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                            {post.sharedBook.synopsis}
                          </p>
                        )}
                      </div>
                    )}

                    {post.sharedPdf && (
                      <div className={`mt-4 rounded-xl border p-4 flex items-center justify-between gap-3 ${isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="min-w-0">
                          <p className="font-bold text-sm truncate">{post.sharedPdf.title}</p>
                          <p className="text-xs text-indigo-400">PDF • {post.sharedPdf.numPages} páginas</p>
                        </div>
                        <button
                          onClick={() => openFlipbook({ title: post.sharedPdf.title, content: post.sharedPdf.text, postId: post.id, key: `post:${post.id}` })}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs text-indigo-400 whitespace-nowrap transition-colors ${
                            isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          <BookOpen className="w-3.5 h-3.5" /> Ler PDF
                        </button>
                      </div>
                    )}

                    <div className={`flex items-center gap-4 mt-4 pt-3 border-t text-xs ${isDark ? 'border-slate-800/50' : 'border-slate-200'}`}>
                      <button
                        onClick={() => handleToggleLike(post.id)}
                        className={`flex items-center gap-1.5 transition-colors ${post.likedByMe ? 'text-rose-500' : 'text-slate-500 hover:text-rose-400'}`}
                        aria-pressed={post.likedByMe}
                      >
                        <Heart className={`w-4 h-4 ${post.likedByMe ? 'fill-current' : ''}`} />
                        {post.likes || 0}
                      </button>
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <MessageCircle className="w-4 h-4" />
                        {(post.comments || []).length}
                      </span>
                    </div>

                    {/* COMENTÁRIOS */}
                    {(post.comments || []).length > 0 && (
                      <div className="mt-3 space-y-2">
                        {post.comments.map(c => (
                          <div key={c.id} className={`rounded-xl px-3 py-2 text-xs ${isDark ? 'bg-slate-950/50' : 'bg-slate-50'}`}>
                            <span className="font-semibold">{c.isMine ? profile.name : c.authorName}</span>
                            <span className="text-slate-500"> • {formatPostDate(c.createdAt)}</span>
                            <p className={`mt-1 whitespace-pre-wrap break-words ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{c.text}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2 mt-3">
                      <input
                        type="text"
                        value={commentDrafts[post.id] || ''}
                        onChange={(e) => setCommentDrafts(prev => ({ ...prev, [post.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment(post.id); }}
                        maxLength={500}
                        placeholder="Escreva um comentário..."
                        className={`flex-1 px-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                          isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                        }`}
                      />
                      <button
                        onClick={() => handleAddComment(post.id)}
                        className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                        aria-label="Enviar comentário"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {/* --- PERFIL --- */}
        {activeTab === 'profile' && (
          <div className="space-y-6">

            <div className={`border-b pb-6 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Seu Perfil</h1>
              <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Como os outros autores veem você na comunidade.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* CARTÃO DO PERFIL */}
              <div className={`rounded-xl border p-6 flex flex-col items-center text-center ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
                <Avatar name={profile.name} color={profile.avatarColor} src={profile.google?.picture} size="w-24 h-24" text="text-4xl" />
                <h2 className="text-xl font-bold mt-4">{profile.name}</h2>
                <p className="text-sm text-slate-500">@{profile.handle}</p>
                {profile.favoriteGenre && (
                  <span className="mt-3 text-xs font-semibold px-2.5 py-1 rounded-md bg-indigo-600/10 text-indigo-400 border border-indigo-500/20">
                    {profile.favoriteGenre}
                  </span>
                )}
                <p className={`text-sm mt-4 whitespace-pre-wrap break-words ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {profile.bio || 'Nenhuma bio ainda.'}
                </p>

                {supabase ? (
                  <AccountCard
                    isDark={isDark}
                    session={session}
                    onSignIn={handleSignIn}
                    onSignOut={handleSignOut}
                    blockedCount={blockedIds.length}
                    onUnblockAll={handleUnblockAll}
                  />
                ) : (
                  <GoogleLinkCard google={profile.google} isDark={isDark} onLink={handleGoogleLink} onUnlink={handleGoogleUnlink} />
                )}

                <div className={`grid grid-cols-2 gap-3 w-full mt-6 pt-6 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                  {[
                    { label: 'Manuscritos', value: profileStats.manuscripts },
                    { label: 'Palavras', value: profileStats.words.toLocaleString('pt-BR') },
                    { label: 'Publicações', value: profileStats.posts },
                    { label: 'Curtidas', value: profileStats.likes }
                  ].map(s => (
                    <div key={s.label}>
                      <p className="text-lg font-bold">{s.value}</p>
                      <p className="text-xs text-slate-500">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* FORMULÁRIO */}
              <div className={`lg:col-span-2 rounded-xl border p-6 space-y-4 ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
                <h3 className="font-bold text-lg">Editar perfil</h3>

                {[
                  { key: 'name', label: 'Nome de exibição', max: 60, placeholder: 'Seu nome' },
                  { key: 'handle', label: 'Usuário (apenas letras, números e _)', max: 24, placeholder: 'seu_usuario' },
                  { key: 'favoriteGenre', label: 'Gênero favorito', max: 50, placeholder: 'Ex.: Fantasia, Thriller...' }
                ].map(f => (
                  <label key={f.key} className="block">
                    <span className="text-xs font-semibold text-slate-500">{f.label}</span>
                    <input
                      type="text"
                      value={profileDraft[f.key] || ''}
                      onChange={(e) => setProfileDraft(prev => ({ ...prev, [f.key]: e.target.value }))}
                      maxLength={f.max}
                      placeholder={f.placeholder}
                      className={`mt-1 w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                        isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                      }`}
                    />
                  </label>
                ))}

                <label className="block">
                  <span className="text-xs font-semibold text-slate-500">Bio ({(profileDraft.bio || '').length}/300)</span>
                  <textarea
                    value={profileDraft.bio || ''}
                    onChange={(e) => setProfileDraft(prev => ({ ...prev, bio: e.target.value }))}
                    maxLength={300}
                    rows={4}
                    placeholder="Conte um pouco sobre você e o que escreve..."
                    className={`mt-1 w-full px-3 py-2 rounded-xl border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  />
                </label>

                <div>
                  <span className="text-xs font-semibold text-slate-500">Cor do avatar</span>
                  <div className="flex flex-wrap gap-3 mt-2">
                    {AVATAR_GRADIENTS.map(g => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setProfileDraft(prev => ({ ...prev, avatarColor: g }))}
                        className={`w-9 h-9 rounded-full bg-gradient-to-br ${g} transition-all ${
                          profileDraft.avatarColor === g ? 'ring-2 ring-offset-2 ring-indigo-500 ring-offset-transparent scale-110' : ''
                        }`}
                        aria-label="Escolher cor do avatar"
                        aria-pressed={profileDraft.avatarColor === g}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setProfileDraft(profile)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium border ${
                      isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    Descartar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    className="px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white"
                  >
                    Salvar perfil
                  </button>
                </div>
              </div>
            </div>

            <WritingStats isDark={isDark} log={writingLog} goal={dailyGoal} todayWords={todayWords} />
          </div>
        )}

      </main>

      {/* --- LEITOR (MODO DE LEITURA CONFORTÁVEL) --- */}
      {flipbookActive && flipbookBook && (
        <ComfortReader
          key={flipbookBook.key || flipbookBook.title}
          docKey={flipbookBook.key}
          title={flipbookBook.title}
          pages={pages}
          onClose={closeFlipbook}
          defaultTheme={isDark ? 'dark' : 'sepia'}
        />
      )}

      {/* --- MODAL: CONFIRMAÇÃO DE EXCLUSÃO --- */}
      {deleteConfirmId !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-confirm-title"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setDeleteConfirmId(null)}
        >
          <div
            className={`max-w-md w-full border rounded-xl p-6 shadow-xl ${
              isDark ? 'border-slate-800 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-900'
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="delete-confirm-title" className="font-bold text-lg mb-2">
              Confirmar Exclusão
            </h3>

            <p className={`text-sm mb-6 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Tem certeza de que deseja excluir este manuscrito? Esta ação não pode ser desfeita.
            </p>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border ${
                  isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-300 hover:bg-slate-100'
                }`}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={executeDeleteBook}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-red-600 hover:bg-red-500 text-white"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: ETIQUETAS E COLEÇÃO --- */}
      {organizeTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setOrganizeTarget(null)}
        >
          <div
            className={`max-w-md w-full border rounded-xl p-6 shadow-xl space-y-4 ${
              isDark ? 'border-slate-800 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-900'
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="font-bold text-lg">Etiquetas e coleção</h3>
            <p className="text-xs text-slate-500 truncate">{organizeTarget.item.title}</p>

            <label className="block">
              <span className="text-xs font-semibold text-slate-500">Etiquetas (separe por vírgula)</span>
              <input
                type="text"
                value={tagsDraft}
                onChange={(e) => setTagsDraft(e.target.value)}
                maxLength={120}
                placeholder="fantasia, revisar, favorito"
                className={`mt-1 w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                }`}
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-500">Coleção (uma por item)</span>
              <input
                type="text"
                list="colecoes-existentes"
                value={collectionDraft}
                onChange={(e) => setCollectionDraft(e.target.value)}
                maxLength={40}
                placeholder="Ex.: Projetos 2026"
                className={`mt-1 w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                }`}
              />
              <datalist id="colecoes-existentes">
                {allCollections.map(c => <option key={c} value={c} />)}
              </datalist>
            </label>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOrganizeTarget(null)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border ${isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-300 hover:bg-slate-100'}`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveOrganize}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: VERSÕES --- */}
      {historyOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setHistoryOpen(false)}
        >
          <div
            className={`max-w-lg w-full max-h-[80vh] flex flex-col border rounded-xl p-6 shadow-xl ${
              isDark ? 'border-slate-800 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-900'
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">Versões salvas</h3>
              <button onClick={() => setHistoryOpen(false)} aria-label="Fechar"><X className="w-5 h-5" /></button>
            </div>
            <button
              onClick={handleSaveVersion}
              className="mb-4 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium"
            >
              Salvar versão agora
            </button>
            <div className="flex-1 overflow-y-auto space-y-2">
              {history.length === 0 && (
                <p className="text-sm text-slate-500">Nenhuma versão ainda. O app guarda uma automaticamente a cada 5 minutos, quando há mudanças.</p>
              )}
              {history.map((h) => (
                <div key={h.at} className={`flex items-center justify-between gap-3 p-3 rounded-xl border text-xs ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                  <div className="min-w-0">
                    <p className="font-semibold">{new Date(h.at).toLocaleString('pt-BR')}</p>
                    <p className="text-slate-500">
                      {h.words} palavras • {h.label === 'manual' ? 'manual' : h.label === 'auto' ? 'automática' : 'antes de restaurar'}
                    </p>
                  </div>
                  <button onClick={() => handleRestoreVersion(h)} className={toolBtn}>Restaurar</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- TOAST --- */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-3 rounded-xl bg-indigo-600 text-white text-sm font-medium shadow-xl"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
