const API_BASES = [
  'https://gameshubapi.powboy1.xyz',
  'https://cdngameshubapi.powboy1.xyz',
  'https://gameshubapi.vercel.app',
  'https://altgameshubapi.vercel.app',
  'https://powboy1.netlify.app'
];

const apiServerSelect = document.getElementById('apiServer');
API_BASES.forEach((base, index) => {
  const option = document.createElement('option');
  option.value = index;
  option.textContent = `Server ${index + 1}`;
  apiServerSelect.appendChild(option);
});

let selectedServer = parseInt(localStorage.getItem('apiServer') || '0');
apiServerSelect.value = selectedServer;

const API_GAMES = API_BASES.map(base => `${base}/api/games`);
const API_APPS = API_BASES.map(base => `${base}/api/apps`);
const API_TOOLS = API_BASES.map(base => `${base}/api/tools`);
const VERSION_API = API_BASES.map(base => `${base}/api/version`);

async function fetchWithFallback(urls, options){
  if(!Array.isArray(urls)) urls=[urls];
  const ordered=[urls[selectedServer], ...urls.filter((_,i)=>i!==selectedServer)];
  for(const u of ordered){
    try{
      const res=await fetch(u, options);
      if(res && res.ok) return res;
    }catch(e){}
  }
  return null;
}

const grid=document.getElementById('grid');
const pageTitle=document.getElementById('pageTitle');
const homePanel=document.getElementById('homePanel');
const versionText=document.getElementById('versionText');
const searchContainer=document.getElementById('searchContainer');
const searchInput=document.getElementById('searchInput');

const tabHome=document.getElementById('tabHome');
const tabAll=document.getElementById('tabAll');
const tabApps=document.getElementById('tabApps');
const tabTools=document.getElementById('tabTools');
const tabFav=document.getElementById('tabFav');
const tabSettings=document.getElementById('tabSettings');

const setTitle=document.getElementById('setTitle');
const setIcon=document.getElementById('setIcon');
const setPanic=document.getElementById('setPanic');
const setPanicURL=document.getElementById('setPanicURL');
const resetPrefs=document.getElementById('resetPrefs');

const exportPrefs=document.getElementById('exportPrefs');
const importButton=document.getElementById('importButton');
const importPrefs=document.getElementById('importPrefs');

let games=[], apps=[], tools=[], favorites=JSON.parse(localStorage.getItem('favorites')||'[]');
let view='home', settingsOpen=false;

let panicKey=localStorage.getItem('panicKey')||'=';
let panicURL=localStorage.getItem('panicURL')||'https://classroom.google.com';

setPanic.value=panicKey;
setPanicURL.value=panicURL;
setTitle.value=localStorage.getItem('tabTitle')||'Home - Classroom';
setIcon.value=localStorage.getItem('tabIcon')||'';

const savedTitle=localStorage.getItem('tabTitle');
const savedIcon=localStorage.getItem('tabIcon');
if(savedTitle) document.title=savedTitle;
if(savedIcon) document.getElementById('siteFavicon').href=savedIcon;

async function fetchVersion(){
  try{
    const res=await fetchWithFallback(VERSION_API);
    if(res && res.ok){
      const data=await res.json();
      versionText.textContent=`API Version ${data.version}`;
    } else versionText.textContent='API Version unavailable';
  } catch(e){versionText.textContent='API Version unavailable';}
}
fetchVersion();

async function fetchAll(){
  try{
    const settled = await Promise.allSettled([
      fetchWithFallback(API_GAMES),
      fetchWithFallback(API_APPS),
      fetchWithFallback(API_TOOLS),
    ]);

    games = (settled[0].status==='fulfilled' && settled[0].value && settled[0].value.ok) ? await settled[0].value.json() : [];
    apps  = (settled[1].status==='fulfilled' && settled[1].value && settled[1].value.ok) ? await settled[1].value.json() : [];
    tools = (settled[2].status==='fulfilled' && settled[2].value && settled[2].value.ok) ? await settled[2].value.json() : [];

    render();
  }catch(e){console.warn('Failed to fetch data', e); render();}
}
fetchAll();

function updateTabs(){
  [tabHome,tabAll,tabApps,tabTools,tabFav,tabSettings].forEach(b=>b.classList.remove('active'));
  if(settingsOpen) tabSettings.classList.add('active');
  else if(view==='home') tabHome.classList.add('active');
  else if(view==='all') tabAll.classList.add('active');
  else if(view==='apps') tabApps.classList.add('active');
  else if(view==='tools') tabTools.classList.add('active');
  else if(view==='fav') tabFav.classList.add('active');
}

function render(){
  grid.innerHTML='';
  homePanel.closest('.home-panel-wrapper').classList.toggle('hidden',view!=='home');
  pageTitle.classList.toggle('hidden',view==='home');
  grid.classList.toggle('hidden',view==='home');
  searchContainer.classList.toggle('hidden', view==='home');
  updateTabs();

  if(view==='home') return;

  let list=[];

  if(view==='fav'){
    pageTitle.textContent='Favorites';
    const sections=[{title:'Games',data:games},{title:'Apps',data:apps},{title:'Tools',data:tools}];
    sections.forEach(sec=>{
      const filtered=sec.data.filter(d=>favorites.includes(d.key));
      if(filtered.length===0) return;
      const sectionDiv=document.createElement('div'); sectionDiv.className='fav-section';
      const header=document.createElement('h3'); header.textContent=sec.title;
      sectionDiv.appendChild(header);
      const cardsDiv=document.createElement('div'); cardsDiv.className='fav-cards';
      filtered.forEach((item,i)=>{
        const card=createCard(item);
        card.style.animationDelay=`${i*50}ms`;
        cardsDiv.appendChild(card);
      });
      sectionDiv.appendChild(cardsDiv);
      grid.appendChild(sectionDiv);
    });
    setupSearchFavorites();
    return;
  }

  if(view==='all'){ pageTitle.textContent='All Games'; list=games; }
  else if(view==='apps'){ pageTitle.textContent='All Apps'; list=apps; }
  else if(view==='tools'){ pageTitle.textContent='All Tools'; list=tools; }

  if(!Array.isArray(list) || list.length===0){
    grid.innerHTML='<p style="color:var(--muted);grid-column:1/-1;text-align:center">No items found</p>';
    return;
  }

  list.forEach((item,i)=>{
    const card=createCard(item);
    card.style.animationDelay=`${i*50}ms`;
    grid.appendChild(card);
  });

  setupSearch(list);
}

function setupSearch(list){
  searchInput.value='';
  searchInput.oninput=()=> {
    const filter=searchInput.value.toLowerCase();
    grid.querySelectorAll('.card').forEach(card=>{
      const title=card.querySelector('.title-wrapper span').textContent.toLowerCase();
      card.style.display=title.includes(filter)?'block':'none';
    });
  };
}

function setupSearchFavorites(){
  searchInput.value='';
  searchInput.oninput=()=> {
    const filter=searchInput.value.toLowerCase();
    grid.querySelectorAll('.fav-cards .card').forEach(card=>{
      const title=card.querySelector('.title-wrapper span').textContent.toLowerCase();
      card.style.display=title.includes(filter)?'block':'none';
    });
  };
}

function createCard(item){
  const card=document.createElement('div'); card.className='card';
  card.innerHTML=`
    <div class="thumb"><img loading="lazy" src="${item.thumbnail}" alt="${item.title}"></div>
    <div class="meta">
      <img loading="lazy" src="${item.icon}" alt="">
      <div class="title-wrapper"><span>${item.title}</span></div>
      <span class="star ${favorites.includes(item.key)?'active':''}">★</span>
    </div>
  `;
  const star=card.querySelector('.star');
  const titleSpan=card.querySelector('.title-wrapper span');

  const maxNormal=17,maxHover=15;
  function truncate(max){titleSpan.textContent=item.title.length>max?item.title.slice(0,max)+'…':item.title;}
  truncate(maxNormal);

  let scrollTimeout,scrollInterval;
  card.addEventListener('mouseenter',()=>{
    truncate(maxHover);
    if(item.title.length>maxHover){
      scrollTimeout=setTimeout(()=>{
        let pos=0;
        scrollInterval=setInterval(()=>{
          pos++; if(pos+maxHover>item.title.length) pos=0;
          titleSpan.textContent=item.title.slice(pos,pos+maxHover)+(pos+maxHover<item.title.length?'…':'');
        },300);
      },1000);
    }
  });
  card.addEventListener('mouseleave',()=>{truncate(maxNormal);clearTimeout(scrollTimeout);clearInterval(scrollInterval);});

  star.addEventListener('click',e=>{
    e.stopPropagation();
    if(star.classList.contains('active')){
      star.classList.remove('active');
      favorites=favorites.filter(f=>f!==item.key);
    } else{
      star.classList.add('active');
      favorites.push(item.key);
    }
    localStorage.setItem('favorites',JSON.stringify(favorites));
    if(view==='fav') render();
  });

  card.addEventListener('click',()=>openItem(item.url));
  return card;
}

const player=document.getElementById('player');
const frame=document.getElementById('frame');
function openItem(url){frame.src=url; player.classList.add('show');}
document.getElementById('closePlayer').onclick=()=>{frame.src='';player.classList.remove('show');};

document.getElementById('fullscreenBtn').onclick = () => {
  const playerBox = document.querySelector('.player-box');
  if (!document.fullscreenElement) playerBox.requestFullscreen().catch(e => console.warn(e));
  else document.exitFullscreen();
};

function closeSettings(){
  settingsOpen=false;
  document.getElementById('settings').classList.remove('show');
}

tabHome.addEventListener('click', ()=>{ view='home'; closeSettings(); render(); });
tabAll.addEventListener('click', ()=>{ view='all'; closeSettings(); render(); });
tabApps.addEventListener('click', ()=>{ view='apps'; closeSettings(); render(); });
tabTools.addEventListener('click', ()=>{ view='tools'; closeSettings(); render(); });
tabFav.addEventListener('click', ()=>{ view='fav'; closeSettings(); render(); });
tabSettings.addEventListener('click', ()=>{ settingsOpen=!settingsOpen; document.getElementById('settings').classList.toggle('show', settingsOpen); updateTabs(); });

function applyTabSettings(){
  if(setTitle.value){
    document.title=setTitle.value;
    localStorage.setItem('tabTitle', setTitle.value);
  }
  if(setIcon.value){
    document.getElementById('siteFavicon').href=setIcon.value;
    localStorage.setItem('tabIcon', setIcon.value);
  }
  panicKey=setPanic.value; localStorage.setItem('panicKey',panicKey);
  panicURL=setPanicURL.value; localStorage.setItem('panicURL',panicURL);
}

[setTitle,setIcon,setPanic,setPanicURL].forEach(inp=>inp.addEventListener('change',applyTabSettings));

apiServerSelect.addEventListener('change',()=>{
  selectedServer=parseInt(apiServerSelect.value);
  localStorage.setItem('apiServer',selectedServer);
  fetchAll();
});

function exportPrefsFunc(){
  const data = {
    tabTitle: localStorage.getItem('tabTitle') || '',
    tabIcon: localStorage.getItem('tabIcon') || '',
    panicKey: localStorage.getItem('panicKey') || '=',
    panicURL: localStorage.getItem('panicURL') || 'https://classroom.google.com',
    apiServer: localStorage.getItem('apiServer') || '0',
    favorites: localStorage.getItem('favorites') || '[]'
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'gameshub_prefs.json';
  a.click();
  URL.revokeObjectURL(url);
}

exportPrefs.addEventListener('click', exportPrefsFunc);

importButton.addEventListener('click', () => importPrefs.click());

importPrefs.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if(!file) return;
  const text = await file.text();
  try{
    const data = JSON.parse(text);
    if(data.tabTitle) localStorage.setItem('tabTitle', data.tabTitle);
    if(data.tabIcon) localStorage.setItem('tabIcon', data.tabIcon);
    if(data.panicKey) localStorage.setItem('panicKey', data.panicKey);
    if(data.panicURL) localStorage.setItem('panicURL', data.panicURL);
    if(data.apiServer) localStorage.setItem('apiServer', data.apiServer);
    if(data.favorites) localStorage.setItem('favorites', data.favorites);

    location.reload();
  }catch(e){
    alert('Invalid import file.');
  }
});

resetPrefs.onclick=()=>{localStorage.clear(); location.reload();};
document.addEventListener('keydown',e=>{if(e.key===panicKey) window.location.href=panicURL;});

function preloadPanicURL(){
  const link=document.createElement('link');
  link.rel='preconnect';
  link.href=panicURL;
  document.head.appendChild(link);
  fetch(panicURL,{mode:'no-cors'}).catch(()=>{});
}
preloadPanicURL();

render();
