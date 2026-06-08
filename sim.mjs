// Headless simulator — mirrors unit-manager.js logic exactly
// Run: node sim.mjs

const CARD_DEFS = {
  scout:    { hp:220, speed:1.60, attackDamage:32, buildingDamage:16, attackCooldown:0.8, range:0.8, cost:2, armorClass:'light',     unitType:'ground', targetTypes:['ground','building'] },
  swordsman:{ hp:430, speed:0.95, attackDamage:45, buildingDamage:32, attackCooldown:1.0, range:0.9, cost:2, armorClass:'medium',    unitType:'ground', targetTypes:['ground','building'] },
  assault:  { hp:680, speed:0.75, attackDamage:42, buildingDamage:95, attackCooldown:1.2, range:0.9, cost:3, armorClass:'assault',   unitType:'ground', targetTypes:['ground','building'] },
  archer:   { hp:190, speed:0.85, attackDamage:38, airDamage:50, buildingDamage:18, attackCooldown:1.0, range:4.5, cost:3, armorClass:'ranged',    unitType:'ground', targetTypes:['ground','air','building'] },
  spearman: { hp:320, speed:0.85, attackDamage:35, buildingDamage:18, attackCooldown:0.9, range:1.4, cost:3, armorClass:'antiHeavy', unitType:'ground', targetTypes:['ground','building'] },
  drone:    { hp:280, speed:1.10, attackDamage:32, buildingDamage:30, attackCooldown:1.0, range:2.8, cost:4, armorClass:'light',     unitType:'air',    targetTypes:['ground','building'] },
  heavy:    { hp:900, speed:0.50, attackDamage:60, buildingDamage:45, attackCooldown:1.5, range:0.9, cost:5, armorClass:'heavy',     unitType:'ground', targetTypes:['ground','building'] },
  engineer: { hp:140, speed:1.00, attackDamage:0,  buildingDamage:0,  attackCooldown:null, range:0, cost:2, armorClass:'engineer',  unitType:'ground', targetTypes:[] },
};

const AI_DECK = ['scout','swordsman','swordsman','assault','assault','archer','spearman','drone','heavy','engineer'];

const TOWER_DATA = {
  player_left:    { x:-6, z: 11, damage:40, cooldown:1.5, range:5.2, side:'player', isCitadel:false, maxHp:1300 },
  player_citadel: { x: 0, z: 13, damage:55, cooldown:1.4, range:6.2, side:'player', isCitadel:true,  maxHp:2200 },
  player_right:   { x: 6, z: 11, damage:40, cooldown:1.5, range:5.2, side:'player', isCitadel:false, maxHp:1300 },
  enemy_left:     { x:-6, z:-11, damage:40, cooldown:1.5, range:5.2, side:'enemy',  isCitadel:false, maxHp:1300 },
  enemy_citadel:  { x: 0, z:-13, damage:55, cooldown:1.4, range:6.2, side:'enemy',  isCitadel:true,  maxHp:2200 },
  enemy_right:    { x: 6, z:-11, damage:40, cooldown:1.5, range:5.2, side:'enemy',  isCitadel:false, maxHp:1300 },
};

const LANE_TOWER_CHAIN = {
  player: { left:['enemy_left','enemy_citadel'],   center:['enemy_citadel'], right:['enemy_right','enemy_citadel'] },
  enemy:  { left:['player_left','player_citadel'], center:['player_citadel'],right:['player_right','player_citadel'] },
};

const LANE_X  = { left:-6, center:0, right:6 };
const SPAWN_Z = { player:14.5, enemy:-14.5 };

const CONFIG = {
  startingSpices:5, baseSpiceBank:10, matchDurationSeconds:180,
  citadelIncomePerMinute:12, sideTowerIncomePerMinute:6,
  engineers:[{income:10,bank:12},{income:12,bank:14},{income:15,bank:16}],
};

const AI_SPAWN_INTERVAL = 6.5;
const DT = 0.05; // 50ms step — precise enough, fast enough

// ── Helpers ──────────────────────────────────────────────────────────────────

function dist2D(ax,az,bx,bz){ const dx=ax-bx,dz=az-bz; return Math.sqrt(dx*dx+dz*dz); }
function fmt(s){ return `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`; }

function calcUnitDamage(attacker, target) {
  if (attacker.cardId==='archer') return target.def.unitType==='air' ? attacker.def.airDamage : attacker.def.attackDamage;
  if (attacker.cardId==='spearman') {
    const ac=target.def.armorClass;
    if (ac==='heavy'||ac==='assault') return 65;
  }
  return attacker.def.attackDamage;
}

// ── Economy ──────────────────────────────────────────────────────────────────

class Economy {
  constructor(towerState) {
    this.ts=towerState; this.spices=CONFIG.startingSpices;
    this.bank=CONFIG.baseSpiceBank; this.engStage=0; this.engIncome=0; this._acc=0;
  }
  get incomePerMin() {
    let i=0;
    if(this.ts.citadel.alive) i+=CONFIG.citadelIncomePerMinute;
    if(this.ts.left.alive)    i+=CONFIG.sideTowerIncomePerMinute;
    if(this.ts.right.alive)   i+=CONFIG.sideTowerIncomePerMinute;
    return i+this.engIncome;
  }
  tick(dt){ this._acc+=(this.incomePerMin/60)*dt; const e=Math.floor(this._acc); if(e>0){this._acc-=e;this.spices=Math.min(this.spices+e,this.bank);} }
  cardCost(id){ return id==='engineer'?Math.min(2+this.engStage,4):CARD_DEFS[id].cost; }
  canPlay(id){ if(id==='engineer'&&this.engStage>=3)return false; return this.spices>=this.cardCost(id); }
  spend(n){ this.spices=Math.max(0,this.spices-n); }
  activateEngineer(){
    const s=this.engStage+1; if(s>3)return;
    const c=CONFIG.engineers[s-1]; this.engStage=s; this.engIncome=c.income; this.bank=c.bank;
  }
}

// ── Hand ─────────────────────────────────────────────────────────────────────

class Hand {
  constructor(deck){
    this._deck=[...deck];
    for(let i=this._deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[this._deck[i],this._deck[j]]=[this._deck[j],this._deck[i]];}
    this._hand=this._deck.splice(0,4);
  }
  get cards(){ return this._hand; }
  affordable(eco){ return this._hand.filter(id=>eco.canPlay(id)); }
  play(idx){
    if(this._deck.length>0){ this._hand[idx]=this._deck.shift(); }
    else {
      // recycle
      const played=this._hand[idx];
      const rest=this._hand.filter((_,i)=>i!==idx);
      this._deck=[...rest,played];
      for(let i=this._deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[this._deck[i],this._deck[j]]=[this._deck[j],this._deck[i]];}
      this._hand[idx]=this._deck.shift();
    }
  }
}

// ── Match ────────────────────────────────────────────────────────────────────

let _uid=0;

function runMatch(matchNum) {
  // Reset towers
  const towers={};
  for(const [id,td] of Object.entries(TOWER_DATA))
    towers[id]={ alive:true, isCitadel:td.isCitadel, side:td.side, hp:td.maxHp, maxHp:td.maxHp };

  const pTs={ left:towers.player_left, citadel:towers.player_citadel, right:towers.player_right };
  const eTs={ left:towers.enemy_left,  citadel:towers.enemy_citadel,  right:towers.enemy_right  };
  const pEco=new Economy(pTs), eEco=new Economy(eTs);
  const pHand=new Hand([...AI_DECK]), eHand=new Hand([...AI_DECK]);
  const towerTimers=Object.fromEntries(Object.keys(TOWER_DATA).map(id=>[id,0]));

  let units=[];
  const stats={ spawns:{player:0,enemy:0}, kills:{player:0,enemy:0}, towersLost:{player:[],enemy:[]} };
  let aiTimerP=0, aiTimerE=0, elapsed=0, winner=null;

  function spawnAI(side){
    const hand=side==='player'?pHand:eHand, eco=side==='player'?pEco:eEco;
    const aff=hand.affordable(eco); if(!aff.length)return;
    const cardId=aff[Math.floor(Math.random()*aff.length)];
    const lane=['left','center','right'][Math.floor(Math.random()*3)];
    eco.spend(eco.cardCost(cardId));
    hand.play(hand.cards.indexOf(cardId));
    units.push({ id:_uid++, cardId, def:CARD_DEFS[cardId], side, lane,
      hp:CARD_DEFS[cardId].hp, maxHp:CARD_DEFS[cardId].hp,
      attackTimer:0, alive:true,
      x:LANE_X[lane], z:SPAWN_Z[side] });
    stats.spawns[side]++;
  }

  function damageTower(id, amount){
    const t=towers[id]; if(!t?.alive)return false;
    t.hp-=amount; if(t.hp<=0)t.hp=0;
    if(t.hp<=0){
      t.alive=false;
      const side=id.startsWith('player')?'player':'enemy';
      const name=id.includes('citadel')?'Цитадель':id.includes('left')?'Левая':'Правая';
      stats.towersLost[side].push({name,time:elapsed});
      if(id==='enemy_citadel')  winner='player';
      if(id==='player_citadel') winner='enemy';
      return true;
    }
    return false;
  }

  // ── Main loop ────────────────────────────────────────────────────────────
  while(elapsed < CONFIG.matchDurationSeconds && !winner){
    elapsed+=DT;
    pEco.tick(DT); eEco.tick(DT);

    // AI spawn
    aiTimerP+=DT; if(aiTimerP>=AI_SPAWN_INTERVAL){aiTimerP=0;spawnAI('player');}
    aiTimerE+=DT; if(aiTimerE>=AI_SPAWN_INTERVAL){aiTimerE=0;spawnAI('enemy');}

    // Tower shooting
    for(const [towerId,td] of Object.entries(TOWER_DATA)){
      if(!towers[towerId].alive)continue;
      towerTimers[towerId]=Math.max(0,towerTimers[towerId]-DT);
      if(towerTimers[towerId]>0)continue;
      const enemySide=td.side==='player'?'enemy':'player';
      let target=null,minD=Infinity;
      for(const u of units){
        if(!u.alive||u.side!==enemySide)continue;
        const d=dist2D(td.x,td.z,u.x,u.z);
        if(d<=td.range&&d<minD){minD=d;target=u;}
      }
      if(target){
        target.hp-=td.damage; towerTimers[towerId]=td.cooldown;
        if(target.hp<=0){target.alive=false;stats.kills[td.side]++;}
      }
    }

    // Unit AI
    for(const u of units){
      if(!u.alive)continue;
      u.attackTimer=Math.max(0,u.attackTimer-DT);

      // Engineer: walk to center node
      if(u.cardId==='engineer'){
        const dx=0-u.x,dz=0-u.z,d=Math.sqrt(dx*dx+dz*dz);
        if(d<=1.5){
          u.alive=false;
          (u.side==='player'?pEco:eEco).activateEngineer();
        } else {
          u.x+=(dx/d)*u.def.speed*DT; u.z+=(dz/d)*u.def.speed*DT;
        }
        continue;
      }

      // Find target tower
      const chain=LANE_TOWER_CHAIN[u.side][u.lane];
      let targetTowerId=null;
      for(const tid of chain){ if(towers[tid]?.alive){targetTowerId=tid;break;} }
      if(!targetTowerId)continue;

      const tp=TOWER_DATA[targetTowerId];
      const dToTower=dist2D(u.x,u.z,tp.x,tp.z);

      // Find closest attackable enemy
      let closest=null,closestD=Infinity;
      for(const e of units){
        if(!e.alive||e.side===u.side)continue;
        if(!u.def.targetTypes.includes(e.def.unitType))continue;
        const d=dist2D(u.x,u.z,e.x,e.z);
        if(d<closestD){closestD=d;closest=e;}
      }

      if(closest&&closestD<=u.def.range){
        if(u.attackTimer===0){
          closest.hp-=calcUnitDamage(u,closest);
          u.attackTimer=u.def.attackCooldown;
          if(closest.hp<=0){closest.alive=false;stats.kills[u.side]++;}
        }
      } else if(dToTower<=u.def.range){
        if(u.attackTimer===0){
          u.attackTimer=u.def.attackCooldown;
          damageTower(targetTowerId,u.def.buildingDamage);
        }
      } else {
        const dx=tp.x-u.x,dz=tp.z-u.z,d=Math.max(dToTower,0.01);
        u.x+=(dx/d)*u.def.speed*DT; u.z+=(dz/d)*u.def.speed*DT;
      }
    }

    units=units.filter(u=>u.alive);
  }

  if(!winner) winner='draw';

  // ── Output ───────────────────────────────────────────────────────────────
  const W='\x1b[34m', R='\x1b[31m', Y='\x1b[33m', G='\x1b[32m', X='\x1b[0m';
  const winLabel = winner==='player'?`${W}СИНИЙ ИИ ПОБЕДИЛ${X}`:winner==='enemy'?`${R}КРАСНЫЙ ИИ ПОБЕДИЛ${X}`:`${Y}НИЧЬЯ${X}`;
  console.log(`\n${'─'.repeat(58)}`);
  console.log(`  МАТЧ ${matchNum}   ${winLabel}   ${Y}${fmt(elapsed)}${X}`);
  console.log(`${'─'.repeat(58)}`);
  console.log(`  Юниты выставлено:  ${W}Синий ${stats.spawns.player}${X}  |  ${R}Красный ${stats.spawns.enemy}${X}`);
  console.log(`  Юниты убито:       ${W}Синий ${stats.kills.player}${X}  |  ${R}Красный ${stats.kills.enemy}${X}`);

  console.log(`\n  БАШНИ:`);
  const order=['player_left','player_citadel','player_right','enemy_left','enemy_citadel','enemy_right'];
  for(const id of order){
    const t=towers[id];
    const pct=Math.round(t.hp/t.maxHp*100);
    const bar='█'.repeat(Math.round(pct/10))+'░'.repeat(10-Math.round(pct/10));
    const color=t.alive?(pct>60?G:pct>25?Y:R):'\x1b[90m';
    const label=id.replace('player','Синий').replace('enemy','Красный')
      .replace('_left',' Лев').replace('_citadel',' Цит').replace('_right',' Прав');
    console.log(`  ${label.padEnd(14)} ${color}${bar}${X} ${t.alive?pct+'%':'☠ ПАЛА'}`);
  }

  if(stats.towersLost.player.length||stats.towersLost.enemy.length){
    console.log(`\n  СОБЫТИЯ:`);
    const all=[
      ...stats.towersLost.player.map(l=>({t:l.time,msg:`${W}Синий${X} потерял ${l.name}`})),
      ...stats.towersLost.enemy.map(l=>({t:l.time,msg:`${R}Красный${X} потерял ${l.name}`})),
    ].sort((a,b)=>a.t-b.t);
    for(const e of all) console.log(`  [${fmt(e.t)}] ${e.msg}`);
  }

  return { winner, elapsed, stats, towers };
}

// ── Run 10 matches ────────────────────────────────────────────────────────────

const results=[];
for(let i=1;i<=10;i++) results.push(runMatch(i));

// ── Summary + balance recommendations ────────────────────────────────────────

const W='\x1b[34m',R='\x1b[31m',Y='\x1b[33m',G='\x1b[32m',X='\x1b[0m';
console.log(`\n${'═'.repeat(58)}`);
console.log(`  СВОДКА ${results.length} МАТЧЕЙ`);
console.log(`${'═'.repeat(58)}`);
const wins={player:0,enemy:0,draw:0};
for(const r of results) wins[r.winner]++;
console.log(`  ${W}Синий${X}: ${wins.player} побед   ${R}Красный${X}: ${wins.enemy} побед   Ничья: ${wins.draw}`);

const avgTime=results.reduce((a,r)=>a+r.elapsed,0)/results.length;
console.log(`  Среднее время матча: ${(avgTime/60).toFixed(1)} мин`);

console.log(`\n  БАЛАНС:`);
if(avgTime<90)
  console.log(`  ${R}✗${X} Матчи очень короткие (${(avgTime/60).toFixed(1)} мин) — башни сносятся слишком быстро`);
else if(avgTime<165)
  console.log(`  ${G}✓${X} Темп хороший (${(avgTime/60).toFixed(1)} мин) — в целевом диапазоне 1:30–2:45`);
else
  console.log(`  ${Y}!${X} Матчи затяжные (${(avgTime/60).toFixed(1)} мин) — башни слишком прочные или юниты слабые`);

// Citadel falls without side towers?
const directCitadel=results.filter(r=>{
  const loserLoss=r.winner==='player'?r.stats.towersLost.enemy:r.stats.towersLost.player;
  const cit=loserLoss.find(l=>l.name==='Цитадель');
  const sides=loserLoss.filter(l=>l.name!=='Цитадель');
  return cit&&sides.length===0;
});
if(directCitadel.length>0)
  console.log(`  ${Y}!${X} В ${directCitadel.length}/${results.length} матчах цитадель пала без боковых башен — центральная линия уязвима`);
else
  console.log(`  ${G}✓${X} Прогрессия башен нормальная (боковые → цитадель)`);

// Winner keeps all towers
const cleanWins=results.filter(r=>{
  if(r.winner==='draw')return false;
  const wl=r.winner==='player'?r.stats.towersLost.player:r.stats.towersLost.enemy;
  return wl.length===0;
});
if(cleanWins.length>=2)
  console.log(`  ${Y}!${X} В ${cleanWins.length}/${results.length} матчах победитель не потерял ни одной башни — возможен дисбаланс по картам`);
else
  console.log(`  ${G}✓${X} Обе стороны несут потери — взаимная угроза присутствует`);

// Avg units per match
const avgP=results.reduce((a,r)=>a+r.stats.spawns.player,0)/results.length;
const avgE=results.reduce((a,r)=>a+r.stats.spawns.enemy,0)/results.length;
console.log(`  Среднее юнитов за матч: ${W}Синий ${avgP.toFixed(1)}${X}  |  ${R}Красный ${avgE.toFixed(1)}${X}`);

// Tower HP left in losing side
const survivingTowerHP=results.map(r=>{
  const loserPrefix=r.winner==='player'?'enemy':'player';
  return Object.entries(r.towers)
    .filter(([id,t])=>id.startsWith(loserPrefix)&&t.alive)
    .map(([_,t])=>Math.round(t.hp/t.maxHp*100));
}).flat();
if(survivingTowerHP.length>0){
  const avgPct=survivingTowerHP.reduce((a,b)=>a+b,0)/survivingTowerHP.length;
  console.log(`  Уцелевшие башни проигравшего: в среднем ${avgPct.toFixed(0)}% HP — ${avgPct<20?'разгром, атака слишком сильна':'приемлемый остаток'}`);
}

console.log('');
