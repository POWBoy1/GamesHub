const API_GAMES   = '/api/games';
const API_APPS    = '/api/apps';
const API_TOOLS   = '/api/tools';

let games=[], apps=[], tools=[], favorites=JSON.parse(localStorage.getItem('favorites')||'[]');
let view='home', settingsOpen=false;
let panicKey = localStorage.getItem('panicKey') || '=';
let panicURL = localStorage.getItem('panicURL') || 'https://classroom.google.com';

async function fetchJson(url) {
  try {
    const res = await fetch(url);
    if (res && res.ok) return await res.json();
  } catch (e) { }
  return null;
}

const grid            = document.getElementById('grid');
const pageTitle       = document.getElementById('pageTitle');
const homePanel       = document.getElementById('homePanel');
const searchContainer = document.getElementById('searchContainer');
const searchInput     = document.getElementById('searchInput');
const tabHome     = document.getElementById('tabHome');
const tabAll      = document.getElementById('tabAll');
const tabApps     = document.getElementById('tabApps');
const tabTools    = document.getElementById('tabTools');
const tabFav      = document.getElementById('tabFav');
const tabDiscord  = document.getElementById('tabDiscord');
const tabSettings = document.getElementById('tabSettings');

const setTitle    = document.getElementById('setTitle');
const setIcon     = document.getElementById('setIcon');
const setPanic    = document.getElementById('setPanic');
const setPanicURL = document.getElementById('setPanicURL');
const resetPrefs  = document.getElementById('resetPrefs');
const exportPrefs = document.getElementById('exportPrefs');
const importButton = document.getElementById('importButton');
const importPrefs  = document.getElementById('importPrefs');

setPanic.value    = panicKey;
setPanicURL.value = panicURL;
setTitle.value    = localStorage.getItem('tabTitle') || 'Home - Classroom';
setIcon.value     = localStorage.getItem('tabIcon')  || '';

const savedTitle = localStorage.getItem('tabTitle');
const savedIcon  = localStorage.getItem('tabIcon');
if (savedTitle) document.title = savedTitle;
if (savedIcon)  document.getElementById('siteFavicon').href = savedIcon;

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/scramjet-sw.js', { scope: '/' })
    .then(async () => {
      console.log('✅ Scramjet SW registered');
      try {
        const connection = new BareMux.BareMuxConnection('/baremux/worker.js');
        await connection.setTransport('/epoxy/index.mjs', [{
          wisp: 'wss://' + location.host + '/wisp/',
          disable_certificate_validation: true
        }]);
        console.log('✅ BareMux transport set');
      } catch(e) {
        console.warn('BareMux setup failed:', e);
      }
    })
    .catch(e => console.warn('Scramjet SW failed:', e));
}

function resolveURL(input) {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const looksLikeURL =
    (trimmed.startsWith('http://') || trimmed.startsWith('https://')) ||
    (/^[^\s]+\.[a-zA-Z]{2,}(\/.*)?$/.test(trimmed) && !trimmed.includes(' '));

  if (looksLikeURL) {
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      return 'https://' + trimmed;
    }
    return trimmed;
  }

  return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
}

function navigateProxy() {
  const input = document.getElementById('proxyInput').value;
  const url = resolveURL(input);
  if (!url) return;
  window.location.href = 'proxy.html?url=' + encodeURIComponent(url);
}

document.getElementById('proxyGo').addEventListener('click', navigateProxy);
document.getElementById('proxyInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') navigateProxy();
});

async function fetchAll() {
  try {
    const [g, a, t] = await Promise.all([
      fetchJson(API_GAMES),
      fetchJson(API_APPS),
      fetchJson(API_TOOLS)
    ]);

    games = Array.isArray(g) ? g : [];
    apps  = Array.isArray(a) ? a : [];
    tools = Array.isArray(t) ? t : [];

    const sortByTitle = arr =>
      arr.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));

    sortByTitle(games);
    sortByTitle(apps);
    sortByTitle(tools);

    console.log(`✅ Loaded: ${games.length} games, ${apps.length} apps, ${tools.length} tools`);
  } catch(e) {
    console.warn('Failed to fetch data', e);
  }

  render();
}

fetchAll();

function updateTabs(){
  [tabHome,tabAll,tabApps,tabTools,tabFav,tabSettings].forEach(b=>b.classList.remove('active'));
  if(settingsOpen)        tabSettings.classList.add('active');
  else if(view==='home')  tabHome.classList.add('active');
  else if(view==='all')   tabAll.classList.add('active');
  else if(view==='apps')  tabApps.classList.add('active');
  else if(view==='tools') tabTools.classList.add('active');
  else if(view==='fav')   tabFav.classList.add('active');
}

tabDiscord.addEventListener('click', () => {
  window.location.href = 'https://discord.gg/gaceZWaY7B';
});

function render(){
  grid.innerHTML='';
  const isHome = view==='home';

  homePanel.closest('.home-panel-wrapper').classList.toggle('hidden', !isHome);
  pageTitle.classList.toggle('hidden', isHome);
  grid.classList.toggle('hidden', isHome);
  searchContainer.classList.toggle('hidden', isHome);

  updateTabs();

  if(isHome) return;

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

  if(view==='all')        { pageTitle.textContent='All Games'; list=games; }
  else if(view==='apps')  { pageTitle.textContent='All Apps';  list=apps;  }
  else if(view==='tools') { pageTitle.textContent='All Tools'; list=tools; }

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
  searchInput.oninput=()=>{
    const filter=searchInput.value.toLowerCase();
    grid.querySelectorAll('.card').forEach(card=>{
      const title=card.querySelector('.title-wrapper span').textContent.toLowerCase();
      card.style.display=title.includes(filter)?'block':'none';
    });
  };
}

function setupSearchFavorites(){
  searchInput.value='';
  searchInput.oninput=()=>{
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

  const maxNormal=17, maxHover=15;
  function truncate(max){ titleSpan.textContent=item.title.length>max?item.title.slice(0,max)+'…':item.title; }
  truncate(maxNormal);

  let scrollTimeout, scrollInterval;
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
  card.addEventListener('mouseleave',()=>{ truncate(maxNormal); clearTimeout(scrollTimeout); clearInterval(scrollInterval); });

  star.addEventListener('click',e=>{
    e.stopPropagation();
    if(star.classList.contains('active')){
      star.classList.remove('active');
      favorites=favorites.filter(f=>f!==item.key);
    } else {
      star.classList.add('active');
      favorites.push(item.key);
    }
    localStorage.setItem('favorites',JSON.stringify(favorites));
    if(view==='fav') render();
  });

  card.addEventListener('click',()=>openItem(item.url, item.title));
  return card;
}

function openItem(url, title=''){
  window.location.href = 'iframe.html?url=' + encodeURIComponent(url) + '&title=' + encodeURIComponent(title);
}

function closeSettings(){
  settingsOpen=false;
  document.getElementById('settings').classList.remove('show');
}

tabHome.addEventListener('click',    ()=>{ view='home';  closeSettings(); render(); });
tabAll.addEventListener('click',     ()=>{ view='all';   closeSettings(); render(); });
tabApps.addEventListener('click',    ()=>{ view='apps';  closeSettings(); render(); });
tabTools.addEventListener('click',   ()=>{ view='tools'; closeSettings(); render(); });
tabFav.addEventListener('click',     ()=>{ view='fav';   closeSettings(); render(); });
tabSettings.addEventListener('click',()=>{ settingsOpen=!settingsOpen; document.getElementById('settings').classList.toggle('show',settingsOpen); updateTabs(); });

function applyTabSettings(){
  if(setTitle.value){ document.title=setTitle.value; localStorage.setItem('tabTitle',setTitle.value); }
  if(setIcon.value){  document.getElementById('siteFavicon').href=setIcon.value; localStorage.setItem('tabIcon',setIcon.value); }
  panicKey=setPanic.value;    localStorage.setItem('panicKey',panicKey);
  panicURL=setPanicURL.value; localStorage.setItem('panicURL',panicURL);
}

[setTitle, setIcon, setPanic, setPanicURL].forEach(inp => inp.addEventListener('change', applyTabSettings));

exportPrefs.addEventListener('click',()=>{
  const data={
    tabTitle:  localStorage.getItem('tabTitle')  || '',
    tabIcon:   localStorage.getItem('tabIcon')   || '',
    panicKey:  localStorage.getItem('panicKey')  || '=',
    panicURL:  localStorage.getItem('panicURL')  || 'https://classroom.google.com',
    favorites: localStorage.getItem('favorites') || '[]'
  };
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download='gameshub_prefs.json'; a.click();
  URL.revokeObjectURL(url);
});

importButton.addEventListener('click',()=>importPrefs.click());

importPrefs.addEventListener('change',async(e)=>{
  const file=e.target.files[0];
  if(!file) return;
  const text=await file.text();
  try{
    const data=JSON.parse(text);
    if(data.tabTitle)  localStorage.setItem('tabTitle',data.tabTitle);
    if(data.tabIcon)   localStorage.setItem('tabIcon',data.tabIcon);
    if(data.panicKey)  localStorage.setItem('panicKey',data.panicKey);
    if(data.panicURL)  localStorage.setItem('panicURL',data.panicURL);
    if(data.favorites) localStorage.setItem('favorites',data.favorites);
    location.reload();
  } catch(e){
    alert('Invalid import file.');
  }
});

resetPrefs.onclick=()=>{ localStorage.clear(); location.reload(); };

document.addEventListener('keydown',e=>{ if(e.key===panicKey) window.location.href=panicURL; });

function preloadPanicURL(){
  const link=document.createElement('link');
  link.rel='preconnect';
  link.href=panicURL;
  document.head.appendChild(link);
  fetch(panicURL,{mode:'no-cors'}).catch(()=>{});
}
preloadPanicURL();