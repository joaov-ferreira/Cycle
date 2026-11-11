# CYCLE — Prompt para planos com IA

> Este arquivo é gerado por `npm run docs:prompt` a partir da biblioteca de exercícios do app. Não o edite à mão: altere a origem e rode o comando de novo.

1. Cole o prompt abaixo como primeira mensagem de um novo chat em qualquer assistente de IA.
2. Acrescente seus dados: objetivo, experiência, dias por semana, equipamentos, limitações e cargas atuais.
3. Copie a resposta em JSON, ou salve-a como um arquivo `.json`, e importe-a no app em Periodização → Nova → Importar periodização.

````text
Você é um treinador experiente de força e hipertrofia. Monte uma periodização de musculação para mim
e entregue como um arquivo para o app CYCLE.

ANTES DE MONTAR O TREINO
Você precisa saber: meu objetivo (hipertrofia, força, condicionamento geral…), minha experiência de
treino (iniciante, intermediário ou avançado), quantos dias por semana posso treinar e por quanto
tempo, os equipamentos que tenho (academia completa, academia em casa, só halteres…), lesões ou
movimentos a evitar, exercícios de que gosto ou não gosto e — opcionalmente — as cargas que uso hoje.
Se algo disso faltar na minha mensagem, pergunte primeiro e espere a minha resposta. Não invente os
meus dados.

SAÍDA
Responda com UM documento JSON dentro de um único bloco de código ```json, sem comentários e sem mais
nada dentro do bloco. Você pode acrescentar uma explicação curta depois do bloco. O documento deve
seguir este formato (os nomes das propriedades ficam em inglês, exatamente como abaixo):

{
  "format": "cycle-plan",
  "version": 1,
  "name": "nome da periodização, até 60 caracteres",
  "description": "opcional, até 500 caracteres",
  "sessionsPerWeek": 4,
  "cycle": { "loadWeeks": 6, "deloadWeeks": 1, "deloadVolumeFactor": 0.5, "deloadLoadFactor": 0.9 },
  "customExercises": [
    { "key": "meu-exercicio", "name": "Nome do exercício", "primaryMuscle": "back",
      "secondaryMuscles": ["biceps"], "equipment": "machine", "mechanics": "compound" }
  ],
  "workouts": [
    { "name": "nome do treino, até 40 caracteres",
      "exercises": [
        { "exercise": "barbell-bench-press", "sets": 4, "reps": "8-12", "rir": 2, "rest": 120,
          "startLoad": 60, "note": "opcional, até 200 caracteres" }
      ] }
  ]
}

REGRAS
1. "exercise" deve ser um id da LISTA DE EXERCÍCIOS abaixo, copiado exatamente. Somente quando o
   exercício de que preciso não estiver na lista, defina-o em "customExercises" e use a "key" dele
   em "exercise".
2. primaryMuscle / secondaryMuscles: chest (peito), back (costas), shoulders (ombros), traps
   (trapézio), biceps (bíceps), triceps (tríceps), forearms (antebraços), abs (abdômen), lowerBack
   (lombar), glutes (glúteos), quads (quadríceps), hamstrings (posteriores de coxa), adductors
   (adutores), abductors (abdutores), calves (panturrilhas).
   equipment: barbell (barra), dumbbell (halteres), machine (máquina), cable (polia), smith,
   kettlebell, bodyweight (peso corporal), band (elástico), other (outro).
   mechanics: compound (multiarticular) ou isolation (isolado).
3. Limites: 1–14 treinos; 1–30 exercícios por treino; sets (séries) 1–20; reps (repetições) 1–100;
   rir 0–5; rest (descanso) 0–900 segundos; sessionsPerWeek 1–14; loadWeeks 1–16; deloadWeeks 0–2;
   deloadVolumeFactor 0.3–1; deloadLoadFactor 0.5–1.
4. "reps" é uma faixa, como "8-12". O app usa dupla progressão: eu aumento as repetições dentro da
   faixa e o app sobe a carga quando todas as séries chegam ao topo da faixa; por isso sempre informe
   uma faixa (um número único, como "5", significa que a carga sobe sempre que todas as séries o
   atingirem).
5. "rir" é a meta de repetições na reserva e "rest" o descanso entre as séries, em segundos.
6. "startLoad" (kg) somente quando eu disser a carga que uso naquele exercício; caso contrário, omita.
7. "sessionsPerWeek" é o número de sessões que faço por semana; os treinos são feitos em rodízio.
8. "cycle": loadWeeks 8 para iniciante, 6 para intermediário, 4 para avançado, seguidas de 1 semana
   de deload, a menos que eu peça outra coisa.
9. Todas as cargas em quilogramas. Escreva nomes e observações em português.

LISTA DE EXERCÍCIOS (id — nome — músculo principal — equipamento)
barbell-bench-press — Supino reto com barra — chest — barbell
dumbbell-bench-press — Supino reto com halteres — chest — dumbbell
incline-barbell-bench-press — Supino inclinado com barra — chest — barbell
incline-dumbbell-press — Supino inclinado com halteres — chest — dumbbell
decline-barbell-bench-press — Supino declinado com barra — chest — barbell
smith-bench-press — Supino reto no Smith — chest — smith
smith-incline-bench-press — Supino inclinado no Smith — chest — smith
machine-chest-press — Supino na máquina — chest — machine
incline-machine-chest-press — Supino inclinado na máquina — chest — machine
push-up — Flexão de braço — chest — bodyweight
chest-dip — Mergulho para peitoral — chest — bodyweight
dumbbell-fly — Crucifixo com halteres — chest — dumbbell
incline-dumbbell-fly — Crucifixo inclinado com halteres — chest — dumbbell
cable-crossover — Crossover na polia — chest — cable
low-cable-fly — Crucifixo baixo na polia — chest — cable
pec-deck-fly — Voador (peck deck) — chest — machine
dumbbell-pullover — Pullover com halteres — chest — dumbbell
pull-up — Barra fixa — back — bodyweight
chin-up — Barra fixa supinada — back — bodyweight
lat-pulldown — Puxada alta — back — cable
close-grip-lat-pulldown — Puxada alta pegada fechada — back — cable
straight-arm-pulldown — Pulldown com braços estendidos — back — cable
barbell-row — Remada curvada — back — barbell
pendlay-row — Remada Pendlay — back — barbell
dumbbell-row — Remada unilateral com halter — back — dumbbell
chest-supported-dumbbell-row — Remada apoiada com halteres — back — dumbbell
seated-cable-row — Remada baixa — back — cable
single-arm-cable-row — Remada unilateral na polia — back — cable
t-bar-row — Remada cavalinho — back — barbell
landmine-row — Remada landmine — back — barbell
machine-row — Remada sentada na máquina — back — machine
iso-lateral-row — Remada iso-lateral na máquina — back — machine
smith-row — Remada curvada no Smith — back — smith
kettlebell-row — Remada com kettlebell — back — kettlebell
inverted-row — Remada invertida — back — bodyweight
cable-pullover — Pullover na polia — back — cable
band-pulldown — Pulldown com elástico — back — band
machine-lat-pulldown — Puxada alta na máquina — back — machine
overhead-press — Desenvolvimento com barra — shoulders — barbell
dumbbell-shoulder-press — Desenvolvimento com halteres — shoulders — dumbbell
arnold-press — Desenvolvimento Arnold — shoulders — dumbbell
machine-shoulder-press — Desenvolvimento na máquina — shoulders — machine
smith-shoulder-press — Desenvolvimento no Smith — shoulders — smith
kettlebell-overhead-press — Desenvolvimento com kettlebell — shoulders — kettlebell
landmine-press — Desenvolvimento landmine — shoulders — barbell
lateral-raise — Elevação lateral — shoulders — dumbbell
cable-lateral-raise — Elevação lateral na polia — shoulders — cable
dumbbell-front-raise — Elevação frontal com halteres — shoulders — dumbbell
dumbbell-rear-delt-fly — Crucifixo inverso com halteres — shoulders — dumbbell
reverse-pec-deck — Crucifixo inverso na máquina — shoulders — machine
cable-face-pull — Face pull na polia — shoulders — cable
barbell-upright-row — Remada alta com barra — shoulders — barbell
pike-push-up — Flexão pike — shoulders — bodyweight
band-pull-apart — Abertura com elástico — shoulders — band
barbell-shrug — Encolhimento com barra — traps — barbell
dumbbell-shrug — Encolhimento com halteres — traps — dumbbell
smith-shrug — Encolhimento no Smith — traps — smith
machine-shrug — Encolhimento na máquina — traps — machine
kettlebell-shrug — Encolhimento com kettlebell — traps — kettlebell
barbell-curl — Rosca direta com barra — biceps — barbell
dumbbell-curl — Rosca direta com halteres — biceps — dumbbell
hammer-curl — Rosca martelo — biceps — dumbbell
incline-dumbbell-curl — Rosca inclinada com halteres — biceps — dumbbell
alternating-dumbbell-curl — Rosca alternada com halteres — biceps — dumbbell
concentration-curl — Rosca concentrada — biceps — dumbbell
zottman-curl — Rosca Zottman — biceps — dumbbell
barbell-preacher-curl — Rosca scott com barra — biceps — barbell
machine-preacher-curl — Rosca scott na máquina — biceps — machine
machine-biceps-curl — Rosca na máquina — biceps — machine
cable-curl — Rosca na polia — biceps — cable
barbell-21s-curl — Rosca 21 com barra — biceps — barbell
band-curl — Rosca com elástico — biceps — band
triceps-pushdown — Tríceps na polia — triceps — cable
triceps-rope-pushdown — Tríceps corda na polia — triceps — cable
cable-overhead-triceps-extension — Tríceps francês na polia — triceps — cable
dumbbell-overhead-triceps-extension — Tríceps francês com halteres — triceps — dumbbell
barbell-skull-crusher — Tríceps testa com barra — triceps — barbell
dumbbell-skull-crusher — Tríceps testa com halteres — triceps — dumbbell
close-grip-bench-press — Supino fechado com barra — triceps — barbell
smith-close-grip-bench-press — Supino fechado no Smith — triceps — smith
parallel-bar-dip — Mergulho nas paralelas — triceps — bodyweight
diamond-push-up — Flexão diamante — triceps — bodyweight
dumbbell-triceps-kickback — Tríceps coice com halteres — triceps — dumbbell
machine-triceps-extension — Tríceps na máquina — triceps — machine
band-triceps-pushdown — Tríceps com elástico — triceps — band
barbell-wrist-curl — Flexão de punho com barra — forearms — barbell
barbell-reverse-wrist-curl — Extensão de punho com barra — forearms — barbell
dumbbell-wrist-curl — Flexão de punho com halteres — forearms — dumbbell
dumbbell-reverse-wrist-curl — Extensão de punho com halteres — forearms — dumbbell
barbell-reverse-curl — Rosca inversa com barra — forearms — barbell
crunch — Abdominal supra — abs — bodyweight
sit-up — Abdominal completo — abs — bodyweight
reverse-crunch — Abdominal reverso — abs — bodyweight
hanging-leg-raise — Elevação de pernas suspenso — abs — bodyweight
lying-leg-raise — Elevação de pernas deitado — abs — bodyweight
cable-crunch — Abdominal na polia — abs — cable
machine-crunch — Abdominal na máquina — abs — machine
kettlebell-russian-twist — Rotação russa com kettlebell — abs — kettlebell
cable-woodchopper — Abdominal oblíquo na polia — abs — cable
dumbbell-side-bend — Inclinação lateral com halter — abs — dumbbell
ab-wheel-rollout — Roda abdominal — abs — other
conventional-deadlift — Levantamento terra — lowerBack — barbell
back-extension — Hiperextensão lombar — lowerBack — machine
good-morning — Bom dia — lowerBack — barbell
trap-bar-deadlift — Levantamento terra com barra hexagonal — lowerBack — barbell
reverse-hyperextension — Hiperextensão reversa — lowerBack — machine
barbell-hip-thrust — Elevação pélvica com barra — glutes — barbell
dumbbell-hip-thrust — Elevação pélvica com halter — glutes — dumbbell
smith-hip-thrust — Elevação pélvica no Smith — glutes — smith
hip-thrust-machine — Elevação pélvica na máquina — glutes — machine
kettlebell-swing — Swing com kettlebell — glutes — kettlebell
cable-pull-through — Puxada entre as pernas na polia — glutes — cable
cable-glute-kickback — Glúteo coice na polia — glutes — cable
glute-kickback-machine — Glúteo coice na máquina — glutes — machine
band-glute-bridge — Elevação pélvica com elástico — glutes — band
glute-bridge — Ponte de glúteo — glutes — bodyweight
donkey-kick — Glúteo coice no solo — glutes — bodyweight
barbell-back-squat — Agachamento livre — quads — barbell
barbell-front-squat — Agachamento frontal — quads — barbell
barbell-sumo-squat — Agachamento sumô com barra — quads — barbell
leg-press — Leg press 45° — quads — machine
single-leg-press — Leg press unilateral — quads — machine
hack-squat — Agachamento hack — quads — machine
belt-squat — Agachamento no cinto — quads — machine
leg-extension — Cadeira extensora — quads — machine
smith-squat — Agachamento no Smith — quads — smith
kettlebell-goblet-squat — Agachamento goblet com kettlebell — quads — kettlebell
dumbbell-goblet-squat — Agachamento goblet com halter — quads — dumbbell
dumbbell-bulgarian-split-squat — Agachamento búlgaro com halteres — quads — dumbbell
dumbbell-walking-lunge — Afundo com halteres — quads — dumbbell
dumbbell-step-up — Subida no step com halteres — quads — dumbbell
bodyweight-squat — Agachamento sem carga — quads — bodyweight
romanian-deadlift — Levantamento terra romeno — hamstrings — barbell
stiff-leg-deadlift — Stiff com barra — hamstrings — barbell
dumbbell-romanian-deadlift — Levantamento terra romeno com halteres — hamstrings — dumbbell
kettlebell-romanian-deadlift — Levantamento terra romeno com kettlebell — hamstrings — kettlebell
smith-romanian-deadlift — Levantamento terra romeno no Smith — hamstrings — smith
leg-curl — Mesa flexora — hamstrings — machine
seated-leg-curl — Cadeira flexora — hamstrings — machine
single-leg-curl — Mesa flexora unilateral — hamstrings — machine
cable-leg-curl — Flexora na polia — hamstrings — cable
band-leg-curl — Flexora com elástico — hamstrings — band
nordic-curl — Flexora nórdica — hamstrings — bodyweight
hip-adduction-machine — Cadeira adutora — adductors — machine
cable-hip-adduction — Adução na polia — adductors — cable
side-lying-hip-adduction — Adução deitado — adductors — bodyweight
band-hip-adduction — Adução com elástico — adductors — band
hip-abduction-machine — Cadeira abdutora — abductors — machine
cable-hip-abduction — Abdução na polia — abductors — cable
side-lying-hip-abduction — Abdução deitado — abductors — bodyweight
band-clamshell — Concha com elástico — abductors — band
standing-calf-raise — Panturrilha em pé — calves — machine
seated-calf-raise — Panturrilha sentado — calves — machine
leg-press-calf-raise — Panturrilha no leg press — calves — machine
donkey-calf-raise — Panturrilha no burrinho — calves — machine
smith-calf-raise — Panturrilha no Smith — calves — smith
single-leg-calf-raise — Panturrilha unilateral — calves — bodyweight
dumbbell-calf-raise — Panturrilha em pé com halter — calves — dumbbell
````
