#!/usr/bin/env node
// balance-test.mjs — Автоматический анализ баланса юнитов «Дома Пустыни» v2.8
// Запуск:  node balance-test.mjs
// Флаги:   --json     → JSON-файл (report.json)
//          --verbose  → полная матрица всех матч-апов

// ── Цвета ────────────────────────────────────────────────────────────────────
const C = {
  reset:'\x1b[0m', bold:'\x1b[1m', dim:'\x1b[2m',
  r:'\x1b[31m', g:'\x1b[32m', y:'\x1b[33m', b:'\x1b[34m',
  m:'\x1b[35m', c:'\x1b[36m', w:'\x1b[37m', o:'\x1b[38;5;208m',
};
const JSON_MODE    = process.argv.includes('--json');
const VERBOSE_MODE = process.argv.includes('--verbose');

// ── Определения юнитов (зеркало src/cards.js) ────────────────────────────────
const UNITS = {
  scout:             { name:'Ищейка',        cost:2, hp:220, sq:2, spd:1.60, atk:32, cd:0.80, rng:0.8,  type:'ground', ac:'light',                  tgt:['ground','building'], rarity:'common' },
  swordsman:         { name:'Клинок Дома',   cost:2, hp:430, sq:3, spd:0.95, atk:45, cd:1.00, rng:0.9,  type:'ground', ac:'medium',                 tgt:['ground','building'], rarity:'common' },
  assault:           { name:'Башнелом',      cost:3, hp:680, sq:2, spd:0.75, atk:42, cd:1.20, rng:0.9,  type:'ground', ac:'assault',                tgt:['ground','building'], rarity:'common' },
  archer:            { name:'Стрелок',       cost:3, hp:190, sq:3, spd:0.85, atk:19, cd:1.00, rng:4.5,  type:'ground', ac:'ranged',  airAtk:15,      tgt:['ground','air','building'], rarity:'common' },
  spearman:          { name:'Пикейщик',      cost:3, hp:320, sq:3, spd:0.85, atk:35, cd:0.90, rng:1.4,  type:'ground', ac:'antiHeavy',              tgt:['ground','building'], rarity:'common' },
  drone:             { name:'Сокол',         cost:4, hp:280, sq:1, spd:1.10, atk:20, cd:1.00, rng:2.8,  type:'air',    ac:'light',                  tgt:['ground','building'], rarity:'common' },
  heavy:             { name:'Латник',        cost:5, hp:900, sq:1, spd:0.50, atk:60, cd:1.50, rng:0.9,  type:'ground', ac:'heavy',                  tgt:['ground','building'], rarity:'common' },
  guard:             { name:'Гвардеец',      cost:4, hp:680, sq:2, spd:0.60, atk:40, cd:1.10, rng:0.9,  type:'ground', ac:'guard',                  tgt:['ground','building'], rarity:'rare',  faction:'honor' },
  dune_guard:        { name:'Страж',         cost:3, hp:520, sq:2, spd:0.75, atk:32, cd:1.10, rng:1.0,  type:'ground', ac:'mediumControl',          tgt:['ground','building'], rarity:'common',
                       special:{ type:'first_hit_slow', slowPct:0.25, duration:2.0 } },
  sand_runner:       { name:'Бегун',         cost:2, hp:230, sq:2, spd:1.50, atk:24, cd:0.80, rng:0.8,  type:'ground', ac:'lightRaider',            tgt:['ground','building'], rarity:'common',
                       special:{ type:'opening_sprint', sprintDuration:2.5, sprintSpeed:2.1 } },
  hook_thrower:      { name:'Метатель',      cost:3, hp:240, sq:1, spd:0.85, atk:30, cd:1.40, rng:3.2,  type:'ground', ac:'rangedControl',          tgt:['ground','building'], rarity:'common',
                       special:{ type:'first_hit_hook', interruptDuration:0.5 } },
  caravan_shields:   { name:'Щитоносцы',     cost:4, hp:620, sq:3, spd:0.65, atk:34, cd:1.00, rng:0.9,  type:'ground', ac:'shield',                 tgt:['ground','building'], rarity:'rare',
                       special:{ type:'front_ranged_reduction', reductionPct:0.30 } },
  rock_demolitionist:{ name:'Подрывник',     cost:4, hp:260, sq:1, spd:0.70, atk:55, cd:1.80, rng:2.5,  type:'ground', ac:'explosive', aoeRad:1.2,  tgt:['ground','building'], rarity:'rare',
                       special:{ type:'aoe_attack', radius:1.2 } },
  caravan_duelist:   { name:'Дуэлянт',       cost:3, hp:470, sq:1, spd:1.05, atk:48, cd:1.00, rng:0.9,  type:'ground', ac:'duelist',                tgt:['ground','building'], rarity:'rare',
                       special:{ type:'duel_bonus', isolatedRadius:2.0, damageBonusPct:0.25, incomingReductionPct:0.15 } },
  desert_trapper:    { name:'Ловец',         cost:4, hp:380, sq:2, spd:0.90, atk:36, cd:1.00, rng:1.2,  type:'ground', ac:'trapper',                tgt:['ground','building'], rarity:'epic',
                       special:{ type:'first_fast_root', rootDuration:1.25, targetArmor:['light','lightRaider'] } },
  siege_drone:       { name:'Осадный Дрон',  cost:4, hp:320, sq:1, spd:1.05, atk:45, cd:1.20, rng:3.4,  type:'air',    ac:'siegeAir',               tgt:['engineer','building'], rarity:'epic',
                       special:{ type:'siege_specialist' }, siegeOnly:true },
  garrison_marshal:  { name:'Маршал',        cost:6, hp:1050,sq:1, spd:0.55, atk:68, cd:1.35, rng:1.0,  type:'ground', ac:'legendaryHonorDefender', tgt:['ground','building'], rarity:'legendary', faction:'honor',
                       special:{ type:'garrison_counter', damageTakenForCounter:250, counterDamageBonusPct:0.60 } },
  oath_blade:        { name:'Клинок Присяги',cost:6, hp:820, sq:1, spd:0.85, atk:72, cd:1.25, rng:1.0,  type:'ground', ac:'legendaryHonorDuelist',  tgt:['ground','building'], rarity:'legendary', faction:'honor',
                       special:{ type:'oath_mark', firstHitFlatBonus:45, expensiveTargetBonusPct:0.25, microStun:0.35 } },
};

const IDS = Object.keys(UNITS);
const DT  = 0.05;
const MAX_T = 90;

// ── Симуляция ─────────────────────────────────────────────────────────────────

function d2(ax, az, bx, bz) { return Math.sqrt((ax-bx)**2+(az-bz)**2); }

function canTarget(atkDef, tgtDef) { return atkDef.tgt.includes(tgtDef.type); }

function mkUnit(id, def, idx, sq, side) {
  return {
    id, def, hp: def.hp, maxHp: def.hp,
    x: (idx - (sq-1)/2) * 0.7,
    z: side === 'A' ? -7 : 7,
    atkTimer: idx * 0.06,  // детерминированный сдвиг
    stunTimer: 0, slowTimer: 0, rootTimer: 0,
    alive: true, side,
    _firstHit:   false,
    _counterAcc: 0,
    _counterOn:  false,
    _sprintEnd:  def.special?.sprintDuration ?? 0,
  };
}

function calcDmg(u, target, all) {
  let dmg = u.def.atk;

  // Пикейщик: бонус vs тяжёлой брони
  if (u.def.ac === 'antiHeavy' && ['heavy','assault','legendaryHonorDefender','legendaryHonorDuelist'].includes(target.def.ac))
    dmg = 65;

  // Стрелок: airDamage vs воздуха
  if (u.def.ac === 'ranged' && target.def.type === 'air')
    dmg = u.def.airAtk ?? u.def.atk;

  // Дуэлянт: бонус если цель изолирована
  if (u.def.special?.type === 'duel_bonus') {
    const iso = u.def.special.isolatedRadius;
    const nearAllies = all.filter(e => e.alive && e.side === target.side && e !== target && d2(e.x,e.z,target.x,target.z) <= iso);
    if (!nearAllies.length) dmg *= 1 + u.def.special.damageBonusPct;
  }

  // Маршал: контр-атака
  if (u.def.special?.type === 'garrison_counter' && u._counterOn) {
    dmg *= 1 + u.def.special.counterDamageBonusPct;
    u._counterOn = false;
  }

  // Клинок Присяги: первый удар
  if (u.def.special?.type === 'oath_mark' && !u._firstHit) {
    dmg += u.def.special.firstHitFlatBonus;
    if ((target.def.cost ?? 0) >= 5) dmg *= 1 + u.def.special.expensiveTargetBonusPct;
  }

  return Math.max(1, dmg);
}

function applyDef(atkDef, tgtUnit, dmg) {
  // Щитоносцы: снижение от дальних
  if (tgtUnit.def.special?.type === 'front_ranged_reduction' && atkDef.rng > 2.0)
    dmg *= 1 - tgtUnit.def.special.reductionPct;
  // Дуэлянт: снижение входящего (только в дуэли, sq=1)
  if (tgtUnit.def.special?.type === 'duel_bonus' && tgtUnit.def.sq === 1)
    dmg *= 1 - tgtUnit.def.special.incomingReductionPct;
  return Math.max(1, dmg);
}

function dealHit(u, target, all, t) {
  let dmg = calcDmg(u, target, all);
  dmg = applyDef(u.def, target, dmg);

  if (u.def.special?.type === 'aoe_attack') {
    const r = u.def.special.radius;
    for (const v of all.filter(e => e.alive && e.side !== u.side && d2(target.x,target.z,e.x,e.z) <= r)) {
      const vd = v === target ? dmg : dmg * 0.6;
      v.hp -= vd;
      counterAccum(v, vd);
    }
  } else {
    target.hp -= dmg;
    counterAccum(target, dmg);
  }

  // Одноразовые эффекты первого удара
  if (!u._firstHit) {
    u._firstHit = true;
    const sp = u.def.special;
    if (sp?.type === 'first_hit_slow')  target.slowTimer  = Math.max(target.slowTimer,  sp.duration);
    if (sp?.type === 'first_hit_hook')  target.stunTimer  = Math.max(target.stunTimer,  sp.interruptDuration);
    if (sp?.type === 'oath_mark')       target.stunTimer  = Math.max(target.stunTimer,  sp.microStun);
    if (sp?.type === 'first_fast_root' && sp.targetArmor.includes(target.def.ac))
      target.rootTimer = Math.max(target.rootTimer, sp.rootDuration);
  }
}

function counterAccum(unit, dmg) {
  if (unit.def.special?.type !== 'garrison_counter') return;
  unit._counterAcc += dmg;
  if (unit._counterAcc >= unit.def.special.damageTakenForCounter) {
    unit._counterAcc -= unit.def.special.damageTakenForCounter;
    unit._counterOn = true;
  }
}

function runCombat(idA, idB) {
  const dA = UNITS[idA], dB = UNITS[idB];

  // Если ни один из двух не может атаковать другого — пропускаем
  const aCanHitB = canTarget(dA, dB);
  const bCanHitA = canTarget(dB, dA);

  const unitsA = Array.from({length: dA.sq}, (_,i) => mkUnit(idA, dA, i, dA.sq, 'A'));
  const unitsB = Array.from({length: dB.sq}, (_,i) => mkUnit(idB, dB, i, dB.sq, 'B'));
  const all = [...unitsA, ...unitsB];

  let t = 0;
  while (t < MAX_T) {
    t += DT;

    for (const u of all) {
      if (!u.alive) continue;
      u.atkTimer  = Math.max(0, u.atkTimer  - DT);
      u.stunTimer = Math.max(0, u.stunTimer - DT);
      u.slowTimer = Math.max(0, u.slowTimer - DT);
      u.rootTimer = Math.max(0, u.rootTimer - DT);
    }

    for (const u of all) {
      if (!u.alive || u.stunTimer > 0) continue;

      const foes = all.filter(e => e.alive && e.side !== u.side && canTarget(u.def, e.def));
      if (!foes.length) continue;

      let nearest = null, nearD = Infinity;
      for (const e of foes) { const d = d2(u.x,u.z,e.x,e.z); if (d < nearD) { nearD = d; nearest = e; } }
      if (!nearest) continue;

      if (nearD <= u.def.rng) {
        if (u.atkTimer > 0) continue;
        u.atkTimer = u.def.cd;
        dealHit(u, nearest, all, t);
      } else if (u.rootTimer === 0) {
        let spd = u.def.spd;
        if (u.slowTimer > 0) spd *= 0.75;
        if (u.def.special?.type === 'opening_sprint' && t <= u._sprintEnd) spd = u.def.special.sprintSpeed;
        const dx = nearest.x - u.x, dz = nearest.z - u.z, dd = Math.max(d2(0,0,dx,dz), 0.001);
        u.x += (dx/dd)*spd*DT; u.z += (dz/dd)*spd*DT;
      }
    }

    for (const u of all) if (u.alive && u.hp <= 0) u.alive = false;

    const alA = unitsA.filter(u=>u.alive).length;
    const alB = unitsB.filter(u=>u.alive).length;
    if (alA === 0 || alB === 0) break;
  }

  const alA = unitsA.filter(u=>u.alive);
  const alB = unitsB.filter(u=>u.alive);
  const hpA = alA.reduce((s,u)=>s+u.hp,0);
  const hpB = alB.reduce((s,u)=>s+u.hp,0);
  const mxA = dA.hp*dA.sq, mxB = dB.hp*dB.sq;

  let winner;
  if      (alA.length > 0 && alB.length === 0) winner = 'A';
  else if (alB.length > 0 && alA.length === 0) winner = 'B';
  else if (hpA > hpB)                           winner = 'A';
  else if (hpB > hpA)                           winner = 'B';
  else                                           winner = 'draw';

  return { winner, hpPctA: hpA/mxA, hpPctB: hpB/mxB, time: t, aCanHitB, bCanHitA };
}

// ── Метрики по юниту ──────────────────────────────────────────────────────────

function metrics(id) {
  const d = UNITS[id];
  const squadDps = d.cd > 0 ? (d.atk / d.cd) * d.sq : 0;
  const squadEhp = d.hp * d.sq;
  const dpsPerCost = squadDps / d.cost;
  const ehpPerCost = squadEhp / d.cost;
  const power = Math.sqrt(squadDps * squadEhp) / d.cost;
  return { squadDps, squadEhp, dpsPerCost, ehpPerCost, power };
}

// ── Прогон всех матч-апов ─────────────────────────────────────────────────────

function runAll() {
  const results = {};
  const combat = IDS.filter(id => !UNITS[id].siegeOnly);

  for (const idA of IDS) {
    results[idA] = {};
    for (const idB of IDS) {
      if (idA === idB) { results[idA][idB] = { winner:'self' }; continue; }
      results[idA][idB] = runCombat(idA, idB);
    }
  }
  return results;
}

// ── Подсчёт win rate ──────────────────────────────────────────────────────────

function winRates(results) {
  const wr = {};
  for (const idA of IDS) {
    wr[idA] = {};
    const costs = [...new Set(IDS.map(id => UNITS[id].cost))].sort((a,b)=>a-b);
    for (const costB of costs) {
      const peers = IDS.filter(id => id !== idA && UNITS[id].cost === costB);
      if (!peers.length) { wr[idA][costB] = null; continue; }
      let wins=0, total=0;
      for (const idB of peers) {
        const r = results[idA][idB];
        if (!r.aCanHitB || !r.bCanHitA) continue; // пропускаем асимметричные матч-апы
        total++;
        if (r.winner === 'A') wins++;
        else if (r.winner === 'draw') wins += 0.5;
      }
      wr[idA][costB] = total > 0 ? wins/total : null;
    }
  }
  return wr;
}

// ── Анализ имбы ───────────────────────────────────────────────────────────────

const IMBA_THRESHOLD = 0.65;
const WEAK_THRESHOLD = 0.38;

function analyze(results, wr, allMetrics) {
  const imba = [], weak = [], balanced = [];
  const avgDpsPerCost = IDS.reduce((s,id)=>s+allMetrics[id].dpsPerCost,0)/IDS.length;
  const avgEhpPerCost = IDS.reduce((s,id)=>s+allMetrics[id].ehpPerCost,0)/IDS.length;

  for (const id of IDS) {
    const def = UNITS[id];
    if (def.siegeOnly) continue;

    const costPeerWr = wr[id][def.cost];
    if (costPeerWr === null) continue;

    const m = allMetrics[id];
    const entry = { id, name:def.name, cost:def.cost, rarity:def.rarity, costPeerWr,
                    dpsPerCost: m.dpsPerCost, ehpPerCost: m.ehpPerCost, power: m.power,
                    reasons:[] };

    if (costPeerWr >= IMBA_THRESHOLD) {
      if (costPeerWr >= 0.75) entry.reasons.push(`Win rate vs 同级 ${(costPeerWr*100).toFixed(0)}% — критически высок`);
      else entry.reasons.push(`Win rate vs 同级 ${(costPeerWr*100).toFixed(0)}%`);
      if (m.dpsPerCost > avgDpsPerCost * 1.25) entry.reasons.push(`DPS/🌶 = ${m.dpsPerCost.toFixed(1)} (норма ~${avgDpsPerCost.toFixed(1)})`);
      if (m.ehpPerCost > avgEhpPerCost * 1.25) entry.reasons.push(`EHP/🌶 = ${m.ehpPerCost.toFixed(0)} (норма ~${avgEhpPerCost.toFixed(0)})`);
      imba.push(entry);
    } else if (costPeerWr <= WEAK_THRESHOLD) {
      entry.reasons.push(`Win rate vs 同级 ${(costPeerWr*100).toFixed(0)}%`);
      if (m.dpsPerCost < avgDpsPerCost * 0.75) entry.reasons.push(`DPS/🌶 = ${m.dpsPerCost.toFixed(1)} (норма ~${avgDpsPerCost.toFixed(1)})`);
      if (m.ehpPerCost < avgEhpPerCost * 0.75) entry.reasons.push(`EHP/🌶 = ${m.ehpPerCost.toFixed(0)} (норма ~${avgEhpPerCost.toFixed(0)})`);
      weak.push(entry);
    } else {
      balanced.push(entry);
    }
  }

  imba.sort((a,b) => b.costPeerWr - a.costPeerWr);
  weak.sort((a,b) => a.costPeerWr - b.costPeerWr);
  return { imba, weak, balanced };
}

// ── Рекомендации ─────────────────────────────────────────────────────────────

function recommend(imba, weak) {
  const recs = [];
  for (const e of imba) {
    const d = UNITS[e.id];
    const lines = [];
    if (e.costPeerWr >= 0.80)
      lines.push(`  ${C.r}–10% HP${C.reset} (${d.hp} → ${Math.round(d.hp*0.90)}) или ${C.r}–5 ATK${C.reset} (${d.atk} → ${d.atk-5})`);
    else if (e.costPeerWr >= 0.65)
      lines.push(`  ${C.y}–5% HP${C.reset} (${d.hp} → ${Math.round(d.hp*0.95)}) или ${C.y}–3 ATK${C.reset} (${d.atk} → ${d.atk-3})`);
    if (d.special?.type === 'duel_bonus') lines.push(`  Рассмотреть снижение duelBonus 25% → 20%`);
    if (d.special?.type === 'aoe_attack') lines.push(`  Уменьшить AoE radius ${d.special.radius} → ${(d.special.radius*0.85).toFixed(1)}`);
    recs.push({ id:e.id, name:e.name, tag:'ИМБА', lines });
  }
  for (const e of weak) {
    const d = UNITS[e.id];
    const lines = [];
    lines.push(`  ${C.g}+8% HP${C.reset} (${d.hp} → ${Math.round(d.hp*1.08)}) или ${C.g}+3 ATK${C.reset} (${d.atk} → ${d.atk+3})`);
    recs.push({ id:e.id, name:e.name, tag:'СЛАБЫЙ', lines });
  }
  return recs;
}

// ── Форматирование ────────────────────────────────────────────────────────────

function rarityColor(r) {
  if (r === 'legendary') return C.o;
  if (r === 'epic')      return C.m;
  if (r === 'rare')      return C.b;
  return C.w;
}

function wrColor(v) {
  if (v === null) return `${C.dim}  —  ${C.reset}`;
  if (v >= IMBA_THRESHOLD) return `${C.r}${(v*100).toFixed(0).padStart(3)}%${C.reset}`;
  if (v <= WEAK_THRESHOLD) return `${C.y}${(v*100).toFixed(0).padStart(3)}%${C.reset}`;
  return `${C.g}${(v*100).toFixed(0).padStart(3)}%${C.reset}`;
}

const PAD = (s, n, r=false) => r ? String(s).padStart(n) : String(s).padEnd(n);

function printHeader() {
  console.log(`\n${C.o}${C.bold}${'═'.repeat(72)}`);
  console.log(`  ⚔  АВТОМАТИЧЕСКИЙ АНАЛИЗ БАЛАНСА — Дома Пустыни v2.8`);
  console.log(`     ${IDS.length} юнитов · ${IDS.length * (IDS.length-1)} матч-апов · порог имбы ≥${(IMBA_THRESHOLD*100).toFixed(0)}%`);
  console.log(`${'═'.repeat(72)}${C.reset}`);
}

function printEfficiencyTable(allMetrics) {
  console.log(`\n${C.bold}${C.c}▸ ТАБЛИЦА ЭФФЕКТИВНОСТИ${C.reset} (сортировка: Power Score ↓)\n`);
  const header = `${'Юнит'.padEnd(17)} ${'Стоим'.padEnd(6)} ${'HP×кол'.padStart(7)} ${'DPS×кол'.padStart(8)} ${'DPS/🌶'.padStart(7)} ${'EHP/🌶'.padStart(7)} ${'Power'.padStart(6)}  Ред.`;
  console.log(`${C.dim}${header}${C.reset}`);
  console.log(`${C.dim}${'─'.repeat(72)}${C.reset}`);

  const sorted = IDS.slice().sort((a,b) => allMetrics[b].power - allMetrics[a].power);
  for (const id of sorted) {
    const d = UNITS[id];
    const m = allMetrics[id];
    const rc = rarityColor(d.rarity);
    const siege = d.siegeOnly ? ` ${C.dim}[siege]${C.reset}` : '';
    const name = (d.name.length > 15 ? d.name.slice(0,14)+'…' : d.name).padEnd(16);
    console.log(
      `${rc}${name}${C.reset} ` +
      `${String(d.cost+'🌶').padEnd(5)} ` +
      `${PAD(Math.round(m.squadEhp), 7, true)}  ` +
      `${PAD(m.squadDps.toFixed(1), 8, true)}  ` +
      `${PAD(m.dpsPerCost.toFixed(1), 6, true)}  ` +
      `${PAD(m.ehpPerCost.toFixed(0), 6, true)}  ` +
      `${PAD(m.power.toFixed(1), 5, true)}` +
      `${siege}`
    );
  }
}

function printCostTierWinRates(wr) {
  const costs = [...new Set(IDS.map(id => UNITS[id].cost))].sort((a,b)=>a-b);
  console.log(`\n${C.bold}${C.c}▸ WIN RATE ПО ЦЕНОВЫМ ТИРАМ${C.reset} (строка = юнит, столбец = стоимость оппонента)\n`);

  const header = `${'Юнит'.padEnd(17)} ` + costs.map(c => `${c}🌶  `.padStart(6)).join('');
  console.log(`${C.dim}${header}${C.reset}`);
  console.log(`${C.dim}${'─'.repeat(17 + costs.length * 6)}${C.reset}`);

  const sorted = IDS.slice().sort((a,b) => UNITS[a].cost - UNITS[b].cost || a.localeCompare(b));
  for (const id of sorted) {
    const d = UNITS[id];
    const name = (d.name.length > 15 ? d.name.slice(0,14)+'…' : d.name).padEnd(16);
    const cells = costs.map(c => {
      if (UNITS[id].siegeOnly) return `${C.dim} n/a${C.reset} `;
      const v = wr[id][c];
      return ` ${wrColor(v)}  `;
    }).join('');
    console.log(`${rarityColor(d.rarity)}${name}${C.reset} ${cells}`);
  }

  console.log(`\n${C.dim}  Цвет: ${C.g}зелёный = баланс${C.reset} ${C.dim}| ${C.r}красный = перекос (>=${(IMBA_THRESHOLD*100).toFixed(0)}%)${C.reset} ${C.dim}| ${C.y}жёлтый = слабый (<=${(WEAK_THRESHOLD*100).toFixed(0)}%)${C.reset}`);
}

function printImbaReport(analysis) {
  const { imba, weak } = analysis;

  console.log(`\n${C.bold}${C.r}▸ ВОЗМОЖНЫЕ ИМБЫ (${imba.length})${C.reset}`);
  if (!imba.length) {
    console.log(`  ${C.g}Критических дисбалансов не обнаружено.${C.reset}`);
  } else {
    for (const e of imba) {
      console.log(`\n  ${C.r}${C.bold}⚠ ${e.name} [${e.id}]${C.reset} ${rarityColor(e.rarity)}${e.rarity}${C.reset} · стоимость ${e.cost}🌶`);
      console.log(`    Win rate vs ${e.cost}🌶 юнитов: ${C.r}${C.bold}${(e.costPeerWr*100).toFixed(0)}%${C.reset} (порог ${(IMBA_THRESHOLD*100).toFixed(0)}%)`);
      for (const r of e.reasons) console.log(`    · ${r}`);
    }
  }

  console.log(`\n${C.bold}${C.y}▸ СЛАБЫЕ ЮНИТЫ (${weak.length})${C.reset}`);
  if (!weak.length) {
    console.log(`  ${C.g}Явно слабых юнитов не обнаружено.${C.reset}`);
  } else {
    for (const e of weak) {
      console.log(`\n  ${C.y}${C.bold}↓ ${e.name} [${e.id}]${C.reset} ${rarityColor(e.rarity)}${e.rarity}${C.reset} · стоимость ${e.cost}🌶`);
      console.log(`    Win rate vs ${e.cost}🌶 юнитов: ${C.y}${C.bold}${(e.costPeerWr*100).toFixed(0)}%${C.reset} (порог ${(WEAK_THRESHOLD*100).toFixed(0)}%)`);
      for (const r of e.reasons) console.log(`    · ${r}`);
    }
  }

  // Siege specialists
  const siege = IDS.filter(id => UNITS[id].siegeOnly);
  if (siege.length) {
    console.log(`\n${C.bold}${C.b}▸ СПЕЦИАЛИЗИРОВАННЫЕ (вне 1v1 рейтинга)${C.reset}`);
    for (const id of siege) {
      const d = UNITS[id];
      console.log(`  ${C.b}◈ ${d.name} [${id}]${C.reset} — атакует только здания и инженеров (осадный юнит)`);
    }
  }
}

function printRecommendations(recs) {
  if (!recs.length) return;
  console.log(`\n${C.bold}${C.c}▸ РЕКОМЕНДАЦИИ ПО БАЛАНСУ${C.reset}\n`);
  for (const r of recs) {
    const tag = r.tag === 'ИМБА' ? `${C.r}[ИМБА]${C.reset}` : `${C.y}[СЛАБ]${C.reset}`;
    console.log(`  ${tag} ${C.bold}${r.name}${C.reset}`);
    for (const l of r.lines) console.log(l);
    console.log('');
  }
}

function printVerboseMatrix(results) {
  if (!VERBOSE_MODE) return;
  const w = 4;
  const label = id => id.slice(0,3);
  console.log(`\n${C.bold}${C.c}▸ МАТРИЦА МАТЧ-АПОВ (A побеждает B)${C.reset}`);
  console.log(`${C.dim}  Символ: ${C.g}Win${C.reset} ${C.dim}| ${C.y}Draw${C.reset} ${C.dim}| ${C.r}Loss${C.reset} ${C.dim}| — нельзя атаковать${C.reset}`);
  const header = '     ' + IDS.map(id => label(id).padEnd(w)).join('');
  console.log(`${C.dim}${header}${C.reset}`);
  for (const idA of IDS) {
    const row = IDS.map(idB => {
      if (idA === idB) return `${C.dim} · ${C.reset} `;
      const r = results[idA][idB];
      if (!r.aCanHitB) return `${C.dim} — ${C.reset} `;
      if (r.winner === 'A')    return `${C.g} W  ${C.reset}`;
      if (r.winner === 'B')    return `${C.r} L  ${C.reset}`;
      return `${C.y} D  ${C.reset}`;
    }).join('');
    console.log(`${C.dim}${label(idA).padEnd(4)}${C.reset} ${row}`);
  }
}

function printSummary(analysis, t) {
  const { imba, weak, balanced } = analysis;
  const total = imba.length + weak.length + balanced.length;
  console.log(`\n${C.o}${'─'.repeat(72)}${C.reset}`);
  console.log(`  Итог: ${C.g}${balanced.length}/${total} в норме${C.reset}  ·  ${C.r}${imba.length} имб${C.reset}  ·  ${C.y}${weak.length} слабых${C.reset}`);
  console.log(`  Время анализа: ${t}мс`);
  console.log(`${C.o}${'─'.repeat(72)}${C.reset}\n`);
}

// ── Точка входа ───────────────────────────────────────────────────────────────

const t0 = Date.now();

const allMetrics  = Object.fromEntries(IDS.map(id => [id, metrics(id)]));
const results     = runAll();
const wr          = winRates(results);
const analysis    = analyze(results, wr, allMetrics);
const recs        = recommend(analysis.imba, analysis.weak);
const elapsed     = Date.now() - t0;

if (JSON_MODE) {
  const report = {
    generatedAt: new Date().toISOString(),
    units: Object.fromEntries(IDS.map(id => [id, { ...UNITS[id], metrics: allMetrics[id], winRates: wr[id] }])),
    imba:     analysis.imba.map(e => ({ id:e.id, cost:e.cost, costPeerWr:e.costPeerWr, reasons:e.reasons })),
    weak:     analysis.weak.map(e => ({ id:e.id, cost:e.cost, costPeerWr:e.costPeerWr, reasons:e.reasons })),
    balanced: analysis.balanced.map(e => e.id),
  };
  const fs = await import('fs');
  fs.writeFileSync('report.json', JSON.stringify(report, null, 2), 'utf8');
  console.log(`✓ report.json сохранён (${Object.keys(report.units).length} юнитов)`);
} else {
  printHeader();
  printEfficiencyTable(allMetrics);
  printCostTierWinRates(wr);
  printImbaReport(analysis);
  printRecommendations(recs);
  printVerboseMatrix(results);
  printSummary(analysis, elapsed);
}
