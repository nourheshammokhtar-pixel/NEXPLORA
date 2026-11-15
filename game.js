(() => {
  'use strict';

  const SAVE_KEY = 'nex-lunar-adventure-v1';
  const NASA_CACHE_KEY = 'nex-nasa-images-v1';
  const sites = {
    rim: { name: 'Shackleton Crater Rim', sun: 1.0, water: 1.0, terrain: 'Rolling crater rim', note: 'A balanced game challenge with sunlit high ground and nearby shadowed regions to explore.' },
    floor: { name: 'Cabeus Crater Floor', sun: 0.58, water: 1.35, terrain: 'Deep, shadowed basin', note: 'A harder power challenge. The game makes ice-search rewards more likely here.' },
    ridge: { name: 'South Pole Ridge', sun: 1.25, water: 0.72, terrain: 'Bright, rocky high ground', note: 'A brighter game challenge with fewer nearby ice samples to find.' }
  };
  const recipes = {
    habitat: { name: 'Lunar Habitat', icon: '🏠', cost: { materials: 2, equipment: 1 }, description: 'A cozy place for the crew to live and rest.' },
    solar: { name: 'Solar Panels', icon: '☀️', cost: { materials: 2, equipment: 1 }, description: 'Turns sunlight into power for the outpost.' },
    life: { name: 'Life Support Unit', icon: '🫧', cost: { materials: 2, equipment: 1 }, description: 'Helps the crew recycle water and maintain oxygen.' },
    storage: { name: 'Storage Station', icon: '📦', cost: { materials: 1, equipment: 0 }, description: 'Keeps supplies organized and ready to use.' },
    shelter: { name: 'Radiation Shelter', icon: '🛡️', cost: { materials: 2, equipment: 0 }, description: 'Uses a regolith-covered shelter idea to help protect the crew.' },
    rover: { name: 'Rover Bay', icon: '🤖', cost: { materials: 1, equipment: 1 }, description: 'Parks a rover for trips to nearby science targets.' },
    lab: { name: 'Science Lab', icon: '🔬', cost: { materials: 2, equipment: 1 }, description: 'Studies lunar samples and earns science points.' }
  };
  const missionNames = [
    'Explore the landing area', 'Build a Lunar Habitat', 'Set up solar power', 'Start life support',
    'Organize the supplies', 'Protect the crew', 'Explore with the rover', 'Study a Moon sample',
    'Respond to the space-weather alert', 'Complete the lunar outpost'
  ];
  const missionHelp = [
    'Collect 3 material bundles and mark a safe spot for the base.',
    'Choose BUILD, select Lunar Habitat, then click a clear spot near your base marker.',
    'Build Solar Panels. They make more energy on brighter days.',
    'Build the Life Support Unit. It uses energy to help with air and water.',
    'Build a Storage Station to organize the supplies you find.',
    'Build a Radiation Shelter. It costs materials that could go to other buildings.',
    'Build a Rover Bay, then launch a trip to collect a science sample.',
    'Build a Science Lab and study one collected sample.',
    'Choose one response to the space-weather training alert.',
    'Build the habitat, panels, life support, storage, shelter, rover bay, and lab.'
  ];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const state = {
    screen: 'welcome',
    name: '',
    site: 'rim',
    day: 1,
    player: { x: 0, z: 2, rotation: 0, target: null },
    basePosition: null,
    inventory: { materials: 2, equipment: 2, food: 4, water: 4, oxygen: 4, samples: 0 },
    resources: { power: 64, health: 100, science: 0 },
    entities: [],
    buildings: [],
    stats: { materialsCollected: 0, samplesCollected: 0, samplesStudied: 0, roverTrips: 0, daysCompleted: 0 },
    activated: { solar: true, life: false, shelter: false },
    eventChoice: null,
    event: null,
    solarRecord: null,
    roverOnTrip: false,
    placement: null
  };
  const pressed = new Set();
  let selectedSite = 'rim';
  let nearbyKey = '';
  let buildMode = '';
  let placingBase = false;
  let animationFrame = 0;
  let lastFrame = 0;
  let toastTimer = 0;
  let galleryRequest = 0;
  let movementSaveTimer = 0;

  function makeEntities(site) {
    const extraIce = site === 'floor' ? 1 : 0;
    return [
      { id: 'm1', kind: 'materials', name: 'Moon rock bundle', x: -8, z: 4, amount: 3, text: 'Loose lunar rocks can be useful for science and construction ideas.' },
      { id: 'm2', kind: 'materials', name: 'Useful rock pieces', x: 6, z: 2, amount: 2, text: 'These rocks are game supplies, not a measured resource deposit.' },
      { id: 'm3', kind: 'materials', name: 'Regolith sample', x: -5, z: -9, amount: 3, text: 'Regolith is the loose dust and broken rock on the Moon.' },
      { id: 'm4', kind: 'materials', name: 'Building material crate', x: 10, z: -4, amount: 2, text: 'This game crate represents packed building supplies.' },
      { id: 'e1', kind: 'equipment', name: 'Energy equipment', x: 3, z: -8, amount: 2, text: 'These spare parts can help build solar equipment.' },
      { id: 'e2', kind: 'equipment', name: 'Power converter', x: -11, z: -3, amount: 1, text: 'A power converter helps connect a system to the battery.' },
      { id: 'f1', kind: 'food', name: 'Food pack', x: 8, z: 8, amount: 2, text: 'Food helps the crew stay strong during the mission.' },
      { id: 'w1', kind: 'water', name: 'Water canister', x: -2, z: 11, amount: 2, text: 'Water is a precious crew supply.' },
      { id: 'o1', kind: 'oxygen', name: 'Oxygen supply pack', x: 12, z: 6, amount: 2, text: 'Oxygen is needed for the crew to breathe.' },
      { id: 's1', kind: 'sample', name: 'Lunar rock sample', x: -9, z: 10, amount: 1, text: 'Scientists study Moon rocks to learn how the Moon changed over time.' },
      { id: 's2', kind: 'sample', name: 'Shadowed-crater sample', x: 11, z: -10, amount: 1 + extraIce, text: 'This sample is a game token. It does not confirm water ice at a real site.' }
    ].map(item => ({ ...item, collected: false }));
  }

  function newMission(name, site) {
    Object.assign(state, {
      screen: 'game',
      name: name.trim().slice(0, 20),
      site,
      day: 1,
      player: { x: 0, z: 2, rotation: 0, target: null },
      basePosition: null,
      inventory: { materials: 2, equipment: 2, food: 4, water: 4, oxygen: 4, samples: 0 },
      resources: { power: 64, health: 100, science: 0 },
      entities: makeEntities(site),
      buildings: [],
      stats: { materialsCollected: 0, samplesCollected: 0, samplesStudied: 0, roverTrips: 0, daysCompleted: 0 },
      activated: { solar: true, life: false, shelter: false },
      eventChoice: null,
      event: null,
      solarRecord: null,
      roverOnTrip: false,
      placement: null
    });
    selectedSite = site;
    buildMode = '';
    placingBase = false;
    nearbyKey = '';
    save();
    showScreen('game');
    say(`Welcome to ${sites[site].name}, ${state.name}! Use W, A, S, D or the arrow keys to walk. Click the ground to head there.`);
    render();
  }

  function save() {
    try {
      const saved = { ...state, screen: 'game', player: { ...state.player, target: null }, placement: null };
      localStorage.setItem(SAVE_KEY, JSON.stringify(saved));
      $('#saveLabel').textContent = 'Saved on this device';
    } catch (error) {
      $('#saveLabel').textContent = 'Saving is unavailable';
      console.warn('Mission progress could not be saved.', error);
    }
    updateContinue();
  }

  function loadSaved() {
    try {
      const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (!raw || !raw.name || !sites[raw.site] || !Array.isArray(raw.entities) || !Array.isArray(raw.buildings)) return false;
      Object.assign(state, raw, { screen: 'game', placement: null, player: { ...raw.player, target: null } });
      selectedSite = state.site;
      buildMode = '';
      placingBase = false;
      nearbyKey = '';
      state.roverOnTrip = false;
      showScreen('game');
      say(`Welcome back, ${state.name}. Your Day ${state.day} mission is ready.`);
      render();
      return true;
    } catch (error) {
      console.warn('Saved mission could not be loaded.', error);
      return false;
    }
  }

  function updateContinue() {
    let exists=false;
    try{
      exists=Boolean(localStorage.getItem(SAVE_KEY));
    }catch(error){
      $('#saveLabel').textContent='Saving is unavailable';
      console.warn('Saved mission status could not be checked.',error);
    }
    $('#continueButton').classList.toggle('hidden', !exists);
    $('#newGameButton').classList.toggle('hidden', !exists);
    if($('#saveLabel').textContent!=='Saving is unavailable'){
      $('#saveLabel').textContent=exists?'Saved on this device':'Progress saves on this device';
    }
  }

  function showScreen(screen) {
    state.screen = screen;
    $$('.screen').forEach(section => section.classList.toggle('active', section.id === `${screen}Screen`));
    document.body.classList.toggle('playing', screen === 'game');
    $('#topStats').classList.toggle('hidden', screen !== 'game');
    if(screen !== 'game'){
      closePanel();
      buildMode = '';
      placingBase = false;
      state.placement = null;
      nearbyKey = '';
      $('#placementHint').classList.remove('visible');
    }
    if(screen === 'setup'){
      selectedSite = 'rim';
      $$('.site-choice').forEach(card=>{
        const selected=card.dataset.site===selectedSite;
        card.classList.toggle('selected',selected);
        card.setAttribute('aria-pressed',selected?'true':'false');
      });
      $('#selectedSiteDescription').textContent=sites[selectedSite].note;
      $('#playerName').value='';
    }
    if (screen === 'game') {
      $('#worldCanvas').focus({ preventScroll: true });
      if (!animationFrame) animationFrame = requestAnimationFrame(loop);
    }
  }

  function openDialog(title, body, buttons = []) {
    $('#dialogTitle').textContent = title;
    $('#dialogBody').innerHTML = body;
    $('#dialogActions').replaceChildren(...buttons.map(({ label, action, style = 'secondary' }) => {
      const button = document.createElement('button');
      button.className = `button ${style}`;
      button.type = 'button';
      button.dataset.dialogAction = action;
      button.textContent = label;
      return button;
    }));
    $('#appDialog').showModal();
  }

  function closeDialog() {
    if ($('#appDialog').open) $('#appDialog').close();
    $('#dialogBody').replaceChildren();
    $('#dialogActions').replaceChildren();
  }

  function say(message) {
    const bubble = $('#novaMessage');
    if (bubble.textContent !== message) {
      bubble.textContent = message;
      bubble.classList.remove('message-pop');
      void bubble.offsetWidth;
      bubble.classList.add('message-pop');
    }
  }

  function toast(message) {
    const node = $('#toast');
    node.textContent = message;
    node.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove('visible'), 2600);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  }

  function objectiveProgress() {
    const buildings = new Set(state.buildings.map(item => item.type));
    switch (state.day) {
      case 1: return Math.min(3, state.stats.materialsCollected) + (state.basePosition ? 1 : 0);
      case 2: return Number(buildings.has('habitat'));
      case 3: return Number(buildings.has('solar'));
      case 4: return Number(buildings.has('life'));
      case 5: return Number(buildings.has('storage'));
      case 6: return Number(buildings.has('shelter'));
      case 7: return Number(buildings.has('rover')) + Math.min(1, state.stats.roverTrips);
      case 8: return Number(buildings.has('lab')) + Math.min(1, state.stats.samplesStudied);
      case 9: return Number(Boolean(state.eventChoice));
      default: return [...buildings].filter(type => Object.prototype.hasOwnProperty.call(recipes, type)).length;
    }
  }

  function objectiveTarget() {
    return [4,1,1,1,1,1,2,2,1,7][state.day - 1] || 1;
  }

  function isObjectiveComplete() {
    const buildings = new Set(state.buildings.map(item => item.type));
    switch (state.day) {
      case 1: return state.stats.materialsCollected >= 3 && Boolean(state.basePosition);
      case 2: return buildings.has('habitat');
      case 3: return buildings.has('solar');
      case 4: return buildings.has('life');
      case 5: return buildings.has('storage');
      case 6: return buildings.has('shelter');
      case 7: return buildings.has('rover') && state.stats.roverTrips > 0;
      case 8: return buildings.has('lab') && state.stats.samplesStudied > 0;
      case 9: return Boolean(state.eventChoice);
      default: return ['habitat','solar','life','storage','shelter','rover','lab'].every(type => buildings.has(type));
    }
  }

  function renderHUD() {
    $('#dayLabel').textContent = `DAY ${state.day} / 10`;
    $('#dayLabelCopy').textContent = `DAY ${state.day} / 10`;
    $('#missionSite').textContent = sites[state.site].name;
    $('#resourcePower').textContent = `${Math.round(state.resources.power)}%`;
    $('#resourceHealth').textContent = `${Math.round(state.resources.health)}%`;
    $('#resourceFood').textContent = state.inventory.food;
    $('#resourceWater').textContent = state.inventory.water;
    $('#resourceOxygen').textContent = state.inventory.oxygen;
    $('#resourceMaterials').textContent = state.inventory.materials;
    $('#resourceScience').textContent = state.resources.science;
    $('#objectiveTitle').textContent = `Day ${state.day}: ${missionNames[state.day - 1]}`;
    $('#objectiveText').textContent = missionHelp[state.day - 1];
    const progress = objectiveProgress(), target = objectiveTarget();
    $('#objectiveCount').textContent = `${Math.min(progress,target)} / ${target}`;
    $('#objectiveBar').style.width = `${Math.min(100, progress / target * 100)}%`;
    $('#advanceDayButton').classList.toggle('hidden', !isObjectiveComplete());
    $('#markBaseButton').classList.toggle('hidden', state.day !== 1 || Boolean(state.basePosition));
    $('#buildMenuButton').disabled = state.day === 1;
    $('#missionTag').textContent = `Explorer ${state.name}`;
    renderInventory();
    renderBuildMenu();
    renderNearby();
    if (state.placement) {
      state.placement.valid = validBuildLocation(state.placement.x, state.placement.z, state.placement.type);
    }
    updateContinue();
  }

  function renderInventory() {
    const inventory = [
      ['🪨','Building materials','materials','Used to construct base modules.'],
      ['🔧','Energy equipment','equipment','Parts needed for power and habitat systems.'],
      ['🥫','Food','food','Keeps the crew fed.'],
      ['💧','Water','water','A vital crew supply.'],
      ['🫧','Oxygen packs','oxygen','Emergency breathing supplies.'],
      ['🔬','Science samples','samples','Study samples in the Science Lab.']
    ];
    $('#inventoryGrid').innerHTML = inventory.map(([icon,name,key,desc]) =>
      `<article class="inventory-item"><span>${icon}</span><div><b>${name}</b><small>${desc}</small></div><strong>${state.inventory[key]}</strong></article>`
    ).join('');
  }

  function renderBuildMenu() {
    $('#buildItems').innerHTML = Object.entries(recipes).map(([type,item]) => {
      const owned = state.buildings.some(building => building.type === type);
      const cost = Object.entries(item.cost).filter(([,amount])=>amount).map(([key,amount])=>`${amount} ${key}`).join(' + ');
      const canPay = Object.entries(item.cost).every(([key,amount])=>state.inventory[key]>=amount);
      return `<button type="button" class="build-choice ${owned?'built':''}" data-build="${type}" ${owned||!canPay?'disabled':''}>
        <span>${item.icon}</span><b>${item.name}</b><small>${item.description}</small><em>${owned?'Built':`Cost: ${cost}`}</em>
      </button>`;
    }).join('');
  }

  function renderNearby() {
    const near = getNearby();
    const key = near ? `${near.kind}:${near.id}` : '';
    if(!near){
      nearbyKey='';
      $('#nearbyCard').classList.remove('visible');
      $('#nearbyCard').replaceChildren();
      return;
    }
    if (key !== nearbyKey) {
      nearbyKey = key;
      const label = near.kind === 'resource' ? near.item.name : near.building.name;
      const action = near.kind === 'resource' ? 'collect' : 'useBuilding';
      $('#nearbyCard').innerHTML = `<span class="nearby-icon">${near.kind==='resource'?entityIcon(near.item.kind):near.building.icon}</span>
        <div><b>${escapeHtml(label)}</b><small>${escapeHtml(near.kind==='resource'?near.item.text:recipes[near.building.type].description)}</small></div>
        <button type="button" class="button small-button" data-nearby-action="${action}" data-nearby-id="${escapeHtml(near.id)}">${near.kind==='resource'?'COLLECT':'OPEN'}</button>`;
      $('#nearbyCard').classList.add('visible');
      if (near.kind === 'resource') say(`${near.item.name}! Come close and collect it for your mission.`);
    }
  }

  function entityIcon(kind) {
    return ({ materials:'🪨', equipment:'🔧', food:'🥫', water:'💧', oxygen:'🫧', sample:'🔬' })[kind] || '✨';
  }

  function getNearby() {
    let best = null, bestDistance = Infinity;
    state.entities.filter(item => !item.collected).forEach(item => {
      const d = distance(state.player,item);
      if (d < 2.5 && d < bestDistance) { best = { kind:'resource', id:item.id, item }; bestDistance=d; }
    });
    state.buildings.forEach(building => {
      const d=distance(state.player,building);
      if (d<3 && d<bestDistance) { best={kind:'building',id:building.id,building};bestDistance=d; }
    });
    return best;
  }

  function collect(id) {
    const item = state.entities.find(resource => resource.id === id && !resource.collected);
    if (!item || distance(state.player,item)>2.7) {
      say('Walk a little closer to the supply, then try again.');
      return;
    }
    item.collected = true;
    state.inventory[item.kind] = (state.inventory[item.kind] || 0) + item.amount;
    if(item.kind==='materials')state.stats.materialsCollected+=item.amount;
    if(item.kind==='sample')state.stats.samplesCollected+=item.amount;
    say(`You collected ${item.amount} ${item.name.toLowerCase()}! Your inventory is updated.`);
    toast(`Collected ${item.amount} ${item.kind}`);
    save();render();
  }

  function costText(cost) {
    return Object.entries(cost).filter(([,n])=>n).map(([key,n])=>`${n} ${key}`).join(' + ');
  }

  function canBuild(type) {
    return Object.entries(recipes[type].cost).every(([key,amount]) => state.inventory[key] >= amount);
  }

  function validBuildLocation(x,z,type) {
    if (!state.basePosition) return false;
    if (Math.hypot(x-state.basePosition.x,z-state.basePosition.z)>12) return false;
    if (Math.hypot(x+4.5,z+3.6)<3.4) return false;
    return state.buildings.every(building => distance({x,z},building)>3.1);
  }

  function startBuild(type) {
    if(!recipes[type] || state.buildings.some(item=>item.type===type))return;
    if(!canBuild(type)){
      const missing=Object.entries(recipes[type].cost).filter(([key,amount])=>state.inventory[key]<amount).map(([key,amount])=>`${Math.max(0,amount-state.inventory[key])} more ${key}`).join(' and ');
      say(`You need ${missing} before you can build the ${recipes[type].name}. Collect supplies around the Moon.`);
      return;
    }
    buildMode=type;
    placingBase=false;
    state.player.target=null;
    const angle=state.player.rotation||0;
    const x=state.player.x-Math.sin(angle)*3,z=state.player.z-Math.cos(angle)*3;
    state.placement={type,x,z,valid:validBuildLocation(x,z,type)};
    $('#placementHint').textContent=`Placing ${recipes[type].name}: move close to your base and click a clear spot.`;
    $('#placementHint').classList.add('visible');
    closePanel();
    say(`Choose a clear spot for the ${recipes[type].name}. I will check its cost and space before building.`);
    render();
  }

  function markBaseSpot() {
    placingBase=true;
    buildMode='';
    state.placement={type:'habitat',x:state.player.x,z:state.player.z,valid:true};
    $('#placementHint').textContent='Mark a flat place for the base. Click the Moon surface.';
    $('#placementHint').classList.add('visible');
    say('Pick a clear, level place for the base. Click the ground to mark the build zone.');
  }

  function onGroundClick(point) {
    if(placingBase){
      state.basePosition={x:point.x,z:point.z};
      placingBase=false;state.placement=null;
      $('#placementHint').classList.remove('visible');
      say('Base site marked! Keep your buildings inside the glowing base area.');
      toast('Base location marked');
      save();render();return;
    }
    if(buildMode){
      placeBuilding(point.x,point.z);
      return;
    }
    state.player.target=point;
    say('I’m following your route. Use W, A, S, D or the arrow keys to walk too.');
  }

  function placeBuilding(x,z) {
    const type=buildMode,recipe=recipes[type];
    if(!type)return;
    if(!validBuildLocation(x,z,type)){
      state.placement={type,x,z,valid:false};
      say('This spot is outside your base area or too close to another building. Try another place.');
      toast('Choose a clear spot near the base');
      render();return;
    }
    if(!canBuild(type)){
      say(`The ${recipe.name} needs ${costText(recipe.cost)}. Collect supplies before placing it.`);
      buildMode='';state.placement=null;render();return;
    }
    Object.entries(recipe.cost).forEach(([key,amount])=>state.inventory[key]-=amount);
    const building={id:`${type}-${Date.now()}`,type,name:recipe.name,icon:recipe.icon,x,z,active:false};
    state.buildings.push(building);
    if(type==='solar')state.activated.solar=true;
    buildMode='';state.placement=null;
    $('#placementHint').classList.remove('visible');
    say(`Great work! Your ${recipe.name} is ready. Building it used ${costText(recipe.cost)}.`);
    toast(`${recipe.name} built!`);
    save();render();
  }

  function closePanel() {
    $$('.side-panel').forEach(panel=>panel.classList.remove('visible'));
  }

  function openPanel(id) {
    closePanel();
    $(`#${id}`).classList.add('visible');
  }

  function useBuilding(id) {
    const building=state.buildings.find(item=>item.id===id);
    if(!building || distance(state.player,building)>3.3) {
      say('Walk closer to that base module to use it.');
      return;
    }
    const type=building.type;
    if(type==='habitat'){
      openDialog('Lunar Habitat',`<p>${state.name}, you are safe inside the habitat. A rest uses <b>1 food</b> and restores <b>12 crew health</b>.</p><p>Food: ${state.inventory.food} · Crew health: ${Math.round(state.resources.health)}%</p>`,[{label:'Rest (use 1 food)',action:'rest',style:'primary'},{label:'Close',action:'close'}]);
    } else if(type==='solar'){
      openDialog('Solar Panels',`<p>Solar panels turn sunlight into electricity. Today’s game setting is <b>${Math.round(sites[state.site].sun*100)}% sunlight efficiency</b>.</p><p>Power: ${Math.round(state.resources.power)}%. Solar system: ${state.activated.solar?'on':'off'}.</p>`,[{label:state.activated.solar?'Turn panels off':'Turn panels on',action:'toggleSolar',style:'primary'},{label:'Close',action:'close'}]);
    } else if(type==='life'){
      openDialog('Life Support Unit',`<p>This simplified game system uses <b>4 power</b> and <b>1 water</b> each day to help maintain oxygen.</p><p>System: ${state.activated.life?'on':'off'} · Water: ${state.inventory.water} · Oxygen: ${state.inventory.oxygen}.</p>`,[{label:state.activated.life?'Turn system off':'Turn system on',action:'toggleLife',style:'primary'},{label:'Close',action:'close'}]);
    } else if(type==='storage'){
      openStorage();
    } else if(type==='shelter'){
      openDialog('Radiation Shelter',`<p>A thick layer of lunar soil is one idea scientists study for shielding. This simple game shelter can reduce a training-event health hit.</p><p>Shelter: ${state.activated.shelter?'ready':'not activated'}.</p>`,[{label:state.activated.shelter?'Shelter ready':'Prepare shelter',action:'toggleShelter',style:'primary'},{label:'Close',action:'close'}]);
    } else if(type==='lab'){
      openDialog('Science Lab',`<p>Study one rock sample to earn 10 science points.</p><p>Samples: ${state.inventory.samples} · Science score: ${state.resources.science}.</p>`,[{label:'Study one sample',action:'studySample',style:'primary'},{label:'Close',action:'close'}]);
    } else if(type==='rover'){
      openDialog('Rover Bay',`<p>A rover can explore farther than an astronaut on foot. Each trip uses <b>8 power</b>.</p><p>Power: ${Math.round(state.resources.power)}% · Rover trips: ${state.stats.roverTrips}.</p>`,[{label:'Launch rover trip',action:'roverTrip',style:'primary'},{label:'Close',action:'close'}]);
    }
  }

  function openStorage() {
    const keys=['materials','equipment','food','water','oxygen','samples'];
    const inventory=keys.map(key=>`<div class="storage-row"><span>${key}</span><b>${state.inventory[key]}</b><span>ready to use</span></div>`).join('');
    openDialog('Storage Station',`<p>Your supplies are stored together here. Items stay in your mission inventory.</p><div class="storage-list">${inventory}</div>`);
  }

  function dialogAction(action) {
    if(action==='close'){closeDialog();return;}
    if(action==='home'){handleAction('home');return;}
    if(action==='resume'){closeDialog();return;}
    if(action==='passport'){closeDialog();showPassport();return;}
    if(action==='playAgain'){closeDialog();showScreen('setup');return;}
    if(action==='rest'){
      if(state.inventory.food<1){say('You need a food pack before the crew can rest.');closeDialog();return;}
      state.inventory.food--;state.resources.health=clamp(state.resources.health+12,0,100);say('The crew had a good rest. Health is up, but one food pack was used.');
    } else if(action==='toggleSolar'){
      state.activated.solar=!state.activated.solar;say(`Solar panels are ${state.activated.solar?'on':'off'}. The power meter changes at the next day.`);
    } else if(action==='toggleLife'){
      if(!state.activated.life&&state.resources.power<4){say('There is not enough power to start life support.');closeDialog();return;}
      state.activated.life=!state.activated.life;say(`Life support is ${state.activated.life?'on':'off'}. It uses shared power and water.`);
    } else if(action==='toggleShelter'){
      state.activated.shelter=true;say('Radiation shelter is ready. It can help during the training alert.');
    } else if(action==='studySample'){
      if(state.inventory.samples<1){say('Find a lunar rock sample before starting an experiment.');closeDialog();return;}
      state.inventory.samples--;state.resources.science+=10;state.stats.samplesStudied++;say('Sample studied! You earned 10 science points. A rock can hold clues about the Moon’s history.');
      toast('+10 science points');
    } else if(action==='roverTrip'){
      if(state.stats.roverTrips>0){say('Great exploring! You have already completed today’s rover goal.');closeDialog();return;}
      if(state.resources.power<8){say('The rover needs 8 power for a trip. Save energy or wait for solar power.');closeDialog();return;}
      state.resources.power-=8;state.resources.science+=3;state.inventory.samples++;
      state.stats.roverTrips++;state.stats.samplesCollected++;state.roverOnTrip=true;
      say('The rover found a science sample and returned safely. The trip used 8 power.');
      toast('Rover discovery: +1 sample');
      setTimeout(()=>{state.roverOnTrip=false;render();},1800);
    }
    closeDialog();save();render();
  }

  function currentEvent() {
    if(state.solarRecord){
      const record=state.solarRecord;
      const kind=record.classType||record.type||'solar event';
      const date=record.beginTime?new Date(record.beginTime).toLocaleDateString():'date unavailable';
      return { title:`NASA recorded a ${kind} solar flare`, description:`This historical event began ${date}. It is a learning example, not a warning about current danger.`, source:'NASA DONKI · HISTORICAL',date };
    }
    return { title:'Space-weather practice alert', description:'Mission control has scheduled a practice shelter drill. This is a training scenario, not a live NASA alert.', source:'PRACTICE SCENARIO',date:'' };
  }

  function openEvent() {
    const event=currentEvent();
    openDialog(event.title,`<p>${escapeHtml(event.description)}</p><p class="notice">${escapeHtml(event.source)}${event.date?` · ${escapeHtml(event.date)}`:''}</p>
      <div class="event-options">
        <button type="button" data-dialog-action="eventShelter"><b>Protect the crew</b><small>Use 12 power. Shelter can soften the training hit.</small></button>
        <button type="button" data-dialog-action="eventScience"><b>Keep the science trip</b><small>Gain 6 science. Crew health may fall by 12.</small></button>
        <button type="button" data-dialog-action="eventBalance"><b>Share power carefully</b><small>Use 2 water. Gain 2 science and avoid extra risk.</small></button>
      </div>`);
  }

  function chooseEvent(action) {
    if(state.eventChoice)return;
    if(action==='eventShelter'){
      if(state.resources.power<12){say('You need 12 power to run the full shelter plan. Choose another response.');return;}
      state.resources.power-=12;
      state.resources.health=clamp(state.resources.health+(state.activated.shelter?0:-6),0,100);
      state.eventChoice='shelter';
      say(state.activated.shelter?'Your shelter softened the training event. The crew stayed protected.':'You spent power on protection. Without a prepared shelter, the crew still felt the drill.');
    } else if(action==='eventScience'){
      state.resources.power=clamp(state.resources.power-8,0,100);
      state.resources.health=clamp(state.resources.health-(state.activated.shelter?3:12),0,100);
      state.resources.science+=6;state.eventChoice='science';
      say('The science team kept working. The choice gained 6 science but cost power and crew comfort.');
    } else if(action==='eventBalance'){
      if(state.inventory.water<2){say('This choice needs 2 water. Collect a water canister or choose another response.');return;}
      state.inventory.water-=2;state.resources.science+=2;state.eventChoice='balance';
      say('You shared the supplies. The crew stayed steady, but two water units were used.');
    }
    closeDialog();save();render();
  }

  function completeDay() {
    if(!isObjectiveComplete())return;
    if(state.day===9&&!state.eventChoice){openEvent();return;}
    if(state.day===10){finishMission();return;}
    const dayFinished=state.day;
    state.stats.daysCompleted=Math.max(state.stats.daysCompleted,dayFinished);
    const profile=sites[state.site];
    const daylight=[1.0,0.82,0.52,0.33,0.72,1.08,0.46,0.3,0.92,0.65][(state.day-1)%10];
    const solar=state.activated.solar&&state.buildings.some(b=>b.type==='solar')?Math.round(11*profile.sun*daylight):4;
    state.resources.power=clamp(state.resources.power+solar,0,100);
    state.inventory.food=Math.max(0,state.inventory.food-1);
    if(state.activated.life&&state.inventory.water>0&&state.resources.power>=4){
      state.resources.power-=4;state.inventory.water--;
      state.inventory.oxygen=clamp(state.inventory.oxygen+1,0,12);
      state.resources.health=clamp(state.resources.health+2,0,100);
      say(`Day ${dayFinished} complete. Solar added ${solar} power; life support used 4 power and 1 water.`);
    } else {
      state.resources.health=clamp(state.resources.health-(state.inventory.oxygen?3:10),0,100);
      state.inventory.oxygen=Math.max(0,state.inventory.oxygen-1);
      say(`Day ${dayFinished} complete. Solar added ${solar} power. Life support needs power and water to run.`);
    }
    if(state.inventory.food===0)state.resources.health=clamp(state.resources.health-6,0,100);
    state.day++;state.eventChoice=null;state.player.target=null;
    state.stats.daysCompleted=dayFinished;
    save();render();
    if(state.day===9) openEvent();
  }

  function finishMission() {
    state.stats.daysCompleted=Math.max(state.stats.daysCompleted,10);
    const allBuilt=['habitat','solar','life','storage','shelter','rover','lab'].every(type=>state.buildings.some(b=>b.type===type));
    const rank=allBuilt&&state.resources.science>=10?'Outpost Commander':state.stats.roverTrips?'Moon Explorer':'Resourceful Pioneer';
    const record={name:state.name,site:sites[state.site].name,rank,science:state.resources.science,days:state.stats.daysCompleted,date:new Date().toLocaleDateString()};
    try{
      const old=JSON.parse(localStorage.getItem('nex-explorer-passport-v1')||'[]');
      localStorage.setItem('nex-explorer-passport-v1',JSON.stringify([record,...old].slice(0,20)));
      localStorage.removeItem(SAVE_KEY);
    }catch(error){console.warn('Explorer record could not be saved.',error);}
    closeDialog();
    openDialog('Mission complete!',`<p>Great exploring, ${escapeHtml(state.name)}! You completed ${state.stats.daysCompleted} mission days at ${escapeHtml(sites[state.site].name)}.</p>
      <div class="debrief-stats"><div><small>Leadership badge</small><b>${rank}</b></div><div><small>Science score</small><b>${state.resources.science}</b></div><div><small>Buildings</small><b>${state.buildings.length}</b></div><div><small>Samples studied</small><b>${state.stats.samplesStudied}</b></div></div>
      <p>Lesson: a Moon base needs shared power, water, protection, and teamwork. These are simplified learning rules, not mission forecasts.</p>`,
      [{label:'PLAY AGAIN',action:'playAgain',style:'primary'},{label:'EXPLORER PASSPORT',action:'passport'},{label:'RETURN HOME',action:'home'}]);
    updateContinue();
  }

  function render() {
    if(state.screen!=='game')return;
    renderHUD();
    $('#powerMeter').style.width=`${clamp(state.resources.power,0,100)}%`;
    $('#healthMeter').style.width=`${clamp(state.resources.health,0,100)}%`;
    $('#siteName').textContent=sites[state.site].name;
    $('#siteNote').textContent=sites[state.site].note;
    $('#worldCanvas').setAttribute('aria-label',`3D lunar surface. ${state.name} is at ${sites[state.site].name}. Use WASD to walk, drag to orbit, and scroll to zoom.`);
    if(window.NexWorld?.isReady)window.NexWorld.render(state,performance.now()/1000);
  }

  function updatePlayer(dt) {
    const p=state.player,speed=3.5*dt;
    let dx=0,dz=0;
    if(pressed.has('KeyW')||pressed.has('ArrowUp'))dz-=1;
    if(pressed.has('KeyS')||pressed.has('ArrowDown'))dz+=1;
    if(pressed.has('KeyA')||pressed.has('ArrowLeft'))dx-=1;
    if(pressed.has('KeyD')||pressed.has('ArrowRight'))dx+=1;
    const moving=dx!==0||dz!==0;
    if(moving){
      p.target=null;
      const len=Math.hypot(dx,dz);dx/=len;dz/=len;
    } else if(p.target){
      dx=p.target.x-p.x;dz=p.target.z-p.z;
      const len=Math.hypot(dx,dz);
      if(len<0.24){p.target=null;dx=0;dz=0;}else{dx/=len;dz/=len;}
    }
    if(dx||dz){
      const nx=clamp(p.x+dx*speed,-14,14),nz=clamp(p.z+dz*speed,-14,14);
      const blocked=state.buildings.some(building=>Math.hypot(nx-building.x,nz-building.z)<1.45);
      if(!blocked){p.x=nx;p.z=nz;p.rotation=Math.atan2(dx,dz);}
    }
    state.moving=moving||Boolean(p.target);
  }

  function loop(now) {
    animationFrame=0;
    const dt=Math.min(0.04,(now-lastFrame)/1000||0);
    lastFrame=now;
    if(state.screen==='game'){
      const beforeX=state.player.x,beforeZ=state.player.z;
      updatePlayer(dt);
      if((Math.abs(state.player.x-beforeX)>0.01||Math.abs(state.player.z-beforeZ)>0.01)&&!movementSaveTimer){
        movementSaveTimer=setTimeout(()=>{movementSaveTimer=0;save();},450);
      }
      renderNearby();
      if(window.NexWorld?.isReady)window.NexWorld.render(state,now/1000);
      animationFrame=requestAnimationFrame(loop);
    }
  }

  function openNASA() {
    const status='<p id="galleryStatus" class="notice">Loading real NASA images…</p><div id="imageGallery" class="image-gallery"></div><button class="button secondary" type="button" data-action="retryGallery">RETRY IMAGES</button>';
    openDialog('NASA Science Center',`<p>Real NASA media is shown here when the Images and Video Library is reachable. The 3D world is game-made art.</p>
      <div class="science-topics"><article><b>Moon and lunar ice</b><p>NASA studies the Moon’s surface and shadowed places. This game’s site values are simplified.</p><a href="https://science.nasa.gov/moon/moon-water-and-ices/" target="_blank" rel="noreferrer">NASA Moon water and ice ↗</a></article>
      <article><b>Space radiation</b><p>Radiation depends on many factors. Game health points are not medical data.</p><a href="https://visualization.osdr.nasa.gov/radlab/gui/data-api/" target="_blank" rel="noreferrer">NASA RadLab ↗</a></article>
      <article><b>Space biology</b><p>NASA’s open repository shares spaceflight biology studies. This game does not claim to model medical outcomes.</p><a href="https://osdr.nasa.gov/" target="_blank" rel="noreferrer">NASA OSDR ↗</a></article>
      <article><b>Artemis, LRO, VIPER</b><p>These missions and programs help us learn about lunar exploration.</p><a href="https://www.nasa.gov/humans-in-space/artemis/" target="_blank" rel="noreferrer">Artemis ↗</a> · <a href="https://science.nasa.gov/mission/lro/" target="_blank" rel="noreferrer">LRO ↗</a> · <a href="https://science.nasa.gov/mission/viper/" target="_blank" rel="noreferrer">VIPER ↗</a></article>
      <article><b>Space food research</b><p>Explore Canadian space research. This game does not use a verified food-production dataset.</p><a href="https://www.asc-csa.gc.ca/eng/" target="_blank" rel="noreferrer">Canadian Space Agency ↗</a></article></div>
      <section class="gallery-section"><h3>NASA photo gallery</h3>${status}</section>
      <p class="credits">Image source: NASA Images and Video Library. Moon world artwork is generated by this game and is not NASA photography. NASA and CSA do not endorse the game.</p>`);
    loadGallery();
  }

  async function loadGallery() {
    const target=$('#imageGallery'),label=$('#galleryStatus');
    if(!target||!label)return;
    const request=++galleryRequest;
    target.innerHTML='';
    label.textContent='Loading images from NASA…';
    try{
      const cached=JSON.parse(localStorage.getItem(NASA_CACHE_KEY)||'null');
      if(cached?.items?.length){
        renderGallery(cached.items);
        label.textContent='Saved NASA images · not live. Retry to check for newer results.';
      }
      const response=await fetch('https://images-api.nasa.gov/search?q=lunar%20surface%20Moon&media_type=image&page_size=6');
      if(!response.ok)throw new Error(`NASA Images returned ${response.status}`);
      const data=await response.json();
      const items=(data.collection?.items||[]).filter(item=>item.links?.some(link=>link.render==='image')).slice(0,6);
      if(!items.length)throw new Error('NASA returned no image results.');
      if(request!==galleryRequest)return;
      renderGallery(items);
      label.textContent='Live results from NASA Images and Video Library.';
      try{localStorage.setItem(NASA_CACHE_KEY,JSON.stringify({items,savedAt:Date.now()}));}catch(error){console.warn('NASA images could not be cached.',error);}
    }catch(error){
      console.warn('NASA image gallery request failed.',error);
      if(request!==galleryRequest)return;
      const cached=JSON.parse(localStorage.getItem(NASA_CACHE_KEY)||'null');
      label.textContent=cached?.items?.length?'NASA could not be reached. Showing saved NASA results, not live.':'NASA images are unavailable right now. Use the source link or try again.';
      if(!cached?.items?.length)target.innerHTML='<a class="gallery-empty" href="https://images.nasa.gov/" target="_blank" rel="noreferrer">Open the NASA Images Library ↗</a>';
    }
  }

  function renderGallery(items) {
    const target=$('#imageGallery');
    if(!target)return;
    target.innerHTML=items.map((item,index)=>{
      const data=item.data?.[0]||{},image=item.links?.find(link=>link.render==='image')?.href||'';
      const record=item.href||'https://images.nasa.gov/';
      const title=escapeHtml(data.title||'NASA lunar image');
      const description=escapeHtml((data.description||'NASA image from the public Images and Video Library.').slice(0,180));
      const credit=escapeHtml(data.photographer||data.center||'NASA');
      return `<article class="nasa-image"><button type="button" data-preview="${index}" aria-label="Enlarge ${title}"><img src="${escapeHtml(image)}" alt="${title}" loading="lazy"></button><b>${title}</b><small>${description}</small><small>Credit: ${credit}</small><a href="${escapeHtml(record)}" target="_blank" rel="noreferrer">Open NASA source ↗</a></article>`;
    }).join('');
    $$('#imageGallery img').forEach(image=>image.addEventListener('error',()=>{
      const card=image.closest('.nasa-image');
      if(!card)return;
      const preview=image.closest('button');
      if(preview)preview.replaceWith(Object.assign(document.createElement('span'),{className:'gallery-empty',textContent:'NASA thumbnail failed to load. Use Retry Images.'}));
    },{once:true}));
    $$('#imageGallery [data-preview]').forEach(button=>button.addEventListener('click',()=>{
      const item=items[Number(button.dataset.preview)],data=item.data?.[0]||{},image=item.links?.find(link=>link.render==='image')?.href||'';
      openDialog(data.title||'NASA image',`<img class="image-preview" src="${escapeHtml(image)}" alt="${escapeHtml(data.title||'NASA image')}"><p>${escapeHtml(data.description||'NASA image.')}</p><p>Credit: ${escapeHtml(data.photographer||data.center||'NASA')}</p><a href="${escapeHtml(item.href||'https://images.nasa.gov/')}" target="_blank" rel="noreferrer">Open original NASA record ↗</a>`);
    }));
  }

  async function fetchDonki() {
    const end=new Date(),start=new Date(Date.now()-7*86400000);
    const date=value=>value.toISOString().slice(0,10);
    const url=`https://ccmc.gsfc.nasa.gov/DONKI-API/get/FLR?startDate=${date(start)}&endDate=${date(end)}`;
    try{
      const response=await fetch(url);
      if(!response.ok)throw new Error(`DONKI returned ${response.status}`);
      const rows=await response.json();
      state.solarRecord=Array.isArray(rows)?rows.filter(row=>row.beginTime).sort((a,b)=>new Date(b.beginTime)-new Date(a.beginTime))[0]||null:null;
      $('#dataStatus').textContent=state.solarRecord?'Recent historical NASA DONKI event loaded.':'NASA returned no recent solar-flare records.';
    }catch(error){
      state.solarRecord=null;
      $('#dataStatus').textContent='NASA DONKI could not be reached. The alert is a practice scenario, not a live warning.';
      console.warn('DONKI data unavailable; use the labeled practice event.',error);
    }
  }

  function showHowTo() {
    openDialog('How to explore',`<ol class="guide-list"><li>Use <b>W, A, S, D</b> or arrow keys to walk.</li><li>Move close to glowing supplies and choose <b>COLLECT</b>.</li><li>Mark your base, choose a building, and click a clear place on the Moon.</li><li>Use the rover, life-support unit, shelter, and lab to complete ten mission days.</li><li>Watch your supplies. Every system uses something the crew needs.</li></ol><p>Drag the Moon view to look around. Scroll to zoom. On a touch screen, drag to walk and use the on-screen arrows.</p>`);
  }

  function showNovaHelp() {
    if(state.screen==='setup'){
      openDialog('Commander Nova’s setup tip',`<p>First, choose your explorer name. Then pick a landing site.</p><p><b>Shackleton Rim</b> is a balanced game challenge. <b>Cabeus Floor</b> has a harder sunlight challenge. <b>South Pole Ridge</b> has more game sunlight.</p><p>These are simplified game settings, not landing forecasts.</p>`);
    }else if(state.screen==='game'){
      say(`Day ${state.day}: ${missionHelp[state.day-1]}`);
      openDialog(`Commander Nova · Day ${state.day}`,`<p>${escapeHtml(missionHelp[state.day-1])}</p><p>Power: ${Math.round(state.resources.power)}%. Crew health: ${Math.round(state.resources.health)}%. Food: ${state.inventory.food} · Water: ${state.inventory.water} · Oxygen: ${state.inventory.oxygen}.</p><p>Try one task at a time. Every system uses supplies that could help somewhere else.</p>`);
    }else{
      openDialog('Commander Nova’s welcome tip','<p>Start an adventure to choose your explorer name and landing site. I’ll help you explore, collect supplies, and build your outpost.</p>');
    }
  }

  function showPassport() {
    let records=[];
    try{records=JSON.parse(localStorage.getItem('nex-explorer-passport-v1')||'[]');}catch(error){console.warn('Passport could not be read.',error);}
    const content=records.length?records.map(record=>`<article class="passport-record"><b>${escapeHtml(record.rank)}</b><small>${escapeHtml(record.name)} · ${escapeHtml(record.site)} · ${record.date}</small><strong>${record.science} science</strong></article>`).join(''):'<p>Your explorer history will appear here after a mission debrief.</p>';
    openDialog('Explorer Passport',`<p>Your mission badges and records are saved on this device.</p>${content}`);
  }

  function handleAction(action, target) {
    if(action==='start'||action==='newGame'){closeDialog();showScreen('setup');return;}
    if(action==='continue'){loadSaved();return;}
    if(action==='home'){closeDialog();showScreen('welcome');updateContinue();return;}
    if(action==='how'){showHowTo();return;}
    if(action==='guideHelp'){showNovaHelp();return;}
    if(action==='science'){openNASA();return;}
    if(action==='passport'){showPassport();return;}
    if(action==='closeDialog'){closeDialog();return;}
    if(action==='retryGallery'){loadGallery();return;}
    if(action==='build'){openPanel('buildPanel');say('Choose a building. I’ll show its cost before you place it.');return;}
    if(action==='inventory'){openPanel('inventoryPanel');return;}
    if(action==='missions'){openPanel('missionPanel');return;}
    if(action==='map'){
      openDialog('Moon map',`<p>Your landing site is ${escapeHtml(sites[state.site].name)}. You are at ${Math.round(state.player.x)}, ${Math.round(state.player.z)}. Materials, food, water, oxygen, and samples are marked by glowing objects in the 3D world.</p><p>Base marker: ${state.basePosition?'set':'not placed yet'} · Buildings: ${state.buildings.length}.</p>`);
      return;
    }
    if(action==='pause'){
      openDialog('Mission paused',`<p>Your game is saved on this device. Take a break whenever you need one.</p>`,[{label:'RESUME MISSION',action:'resume',style:'primary'},{label:'SAVE & HOME',action:'home'}]);return;
    }
    if(action==='resume'){closeDialog();return;}
    if(action==='markBase'){markBaseSpot();return;}
    if(action==='advanceDay'){completeDay();return;}
    if(action==='openEvent'){
      if(state.day===9)openEvent();
      else openDialog('Space-weather practice',`<p>${escapeHtml($('#dataStatus').textContent)}</p><p>The decision challenge appears on Day 9. NASA records are shown as past events, not live safety warnings.</p>`);
      return;
    }
    if(action==='rover'){
      const building=state.buildings.find(item=>item.type==='rover');
      if(building)useBuilding(building.id);else{say('Build a Rover Bay first, then you can launch a rover trip.');toast('Rover Bay needed');}
      return;
    }
    if(action==='closePanels'){closePanel();buildMode='';state.placement=null;$('#placementHint').classList.remove('visible');render();return;}
    if(action==='toggleTutorial'){showHowTo();return;}
    if(action==='dialog'){
      const task=target.dataset.dialogAction;
      if(task?.startsWith('event'))chooseEvent(task);else dialogAction(task);
      return;
    }
  }

  $('#setupForm').addEventListener('submit',event=>{
    event.preventDefault();
    const name=$('#playerName').value.trim();
    if(!name){$('#playerName').focus();return;}
    newMission(name,selectedSite);
  });
  $$('.site-choice').forEach(card=>card.addEventListener('click',()=>{
    selectedSite=card.dataset.site;
    $$('.site-choice').forEach(item=>{
      item.classList.toggle('selected',item===card);
      item.setAttribute('aria-pressed',item===card?'true':'false');
    });
    $('#selectedSiteDescription').textContent=sites[selectedSite].note;
  }));
  document.addEventListener('click',event=>{
    const action=event.target.closest('[data-action]');
    if(action){if(action.tagName==='A')event.preventDefault();handleAction(action.dataset.action,action);return;}
    const build=event.target.closest('[data-build]');
    if(build){startBuild(build.dataset.build);return;}
    const nearby=event.target.closest('[data-nearby-action]');
    if(nearby){
      if(nearby.dataset.nearbyAction==='collect')collect(nearby.dataset.nearbyId);
      else useBuilding(nearby.dataset.nearbyId);
      return;
    }
    const dialogButton=event.target.closest('[data-dialog-action]');
    if(dialogButton)handleAction('dialog',dialogButton);
  });
  $('#dialogClose').addEventListener('click',closeDialog);
  $('#appDialog').addEventListener('click',event=>{if(event.target===event.currentTarget)closeDialog();});
  document.addEventListener('keydown',event=>{
    const key=event.code;
    if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(key)&&state.screen==='game'&&!$('#appDialog').open){
      if(!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){pressed.add(key);event.preventDefault();}
    }
    if(key==='KeyE'&&state.screen==='game'){const near=getNearby();if(near)near.kind==='resource'?collect(near.id):useBuilding(near.id);}
    if(key==='Escape'&&$('#appDialog').open)closeDialog();
  });
  document.addEventListener('keyup',event=>pressed.delete(event.code));
  window.addEventListener('blur',()=>pressed.clear());
  if(window.NexWorld?.isReady){
    window.NexWorld.setGroundClickHandler(onGroundClick);
    window.NexWorld.setPlacementMoveHandler(point=>{
      if(state.placement){
        state.placement={...state.placement,...point,valid:placingBase||validBuildLocation(point.x,point.z,state.placement.type)};
      }
    });
  }
  window.addEventListener('nex-world-error',event=>{
    $('#worldError').textContent=event.detail;
    $('#worldError').classList.add('visible');
  });
  $('#touchControls').addEventListener('pointerdown',event=>{
    const control=event.target.closest('[data-move]');
    if(!control)return;
    event.preventDefault();
    const code=control.dataset.move;
    pressed.add(code);
    control.setPointerCapture(event.pointerId);
  });
  $('#touchControls').addEventListener('pointerup',event=>pressed.delete(event.target.closest('[data-move]')?.dataset.move));
  $('#touchControls').addEventListener('pointercancel',event=>pressed.delete(event.target.closest('[data-move]')?.dataset.move));

  window.addEventListener('load',()=>{
    if(window.NexWorldError){
      $('#worldError').textContent=window.NexWorldError;
      $('#worldError').classList.add('visible');
    }
    updateContinue();
    fetchDonki();
  });
})();
