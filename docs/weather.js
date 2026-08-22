(()=>{
  const D=window.TRIP_DATA;
  if(!D?.nights?.length)return;

  const nights=D.nights;
  const CACHE_KEY='grecko-weather-v1';
  const MAX_AGE=15*60*1000;
  const weatherById=new Map();
  const $=(s,r=document)=>r.querySelector(s);

  const selectedCard=$('.selected-card');
  const selectedTitle=$('#selected-title');
  const selectedWeather=document.createElement('section');
  selectedWeather.id='selected-weather';
  selectedWeather.className='weather-panel selected-weather';
  selectedWeather.hidden=true;
  if(selectedCard)selectedCard.append(selectedWeather);

  const inlineHosts=new Map();
  for(const n of nights){
    const item=document.querySelector(`.item[data-id="${n.id}"]`);
    if(!item)continue;
    const host=document.createElement('section');
    host.className='weather-panel weather-inline weather-loading';
    host.dataset.weatherId=n.id;
    host.innerHTML='<div class="weather-loading-text">🌤️ Načítavam počasie…</div>';
    host.addEventListener('click',e=>e.stopPropagation());
    const link=item.querySelector('a');
    item.insertBefore(host,link||null);
    inlineHosts.set(n.id,host);
  }

  function weatherInfo(code){
    if(code===0)return['☀️','Jasno'];
    if(code===1)return['🌤️','Prevažne jasno'];
    if(code===2)return['⛅️','Polooblačno'];
    if(code===3)return['☁️','Zamračené'];
    if(code===45||code===48)return['🌫️','Hmla'];
    if(code>=51&&code<=57)return['🌦️','Mrholenie'];
    if(code>=61&&code<=67)return['🌧️','Dážď'];
    if(code>=71&&code<=77)return['🌨️','Sneženie'];
    if(code>=80&&code<=82)return['🌦️','Prehánky'];
    if(code===85||code===86)return['🌨️','Snehové prehánky'];
    if(code>=95&&code<=99)return['⛈️','Búrky'];
    return['🌤️','Počasie'];
  }

  const n=v=>Number.isFinite(v)?Math.round(v):'–';
  const pct=v=>Number.isFinite(v)?`${Math.round(v)} %`:'–';
  const hm=t=>typeof t==='string'&&t.includes('T')?t.split('T')[1].slice(0,5):'';

  function markup(w,stale=false){
    if(!w?.current||!w?.daily)return'<div class="weather-error">Počasie momentálne nie je dostupné.</div>';
    const c=w.current,d=w.daily;
    const [ci,cl]=weatherInfo(c.weather_code);
    const [i1,l1]=weatherInfo(d.weather_code?.[1]);
    const [i2,l2]=weatherInfo(d.weather_code?.[2]);
    return `
      <div class="weather-head">
        <strong>Počasie</strong>
        <span>${stale?'Posledné uložené údaje':'Aktualizované'}${hm(c.time)?` ${hm(c.time)}`:''}</span>
      </div>
      <div class="weather-grid">
        <div class="weather-day weather-now">
          <div class="weather-label">Teraz</div>
          <div class="weather-main"><span class="weather-icon">${ci}</span><b>${n(c.temperature_2m)}°</b></div>
          <div class="weather-desc">${cl}</div>
          <div class="weather-sub">Pocitovo ${n(c.apparent_temperature)}° · vietor ${n(c.wind_speed_10m)} km/h</div>
        </div>
        <div class="weather-day">
          <div class="weather-label">Zajtra</div>
          <div class="weather-main"><span class="weather-icon">${i1}</span><b>${n(d.temperature_2m_max?.[1])}°</b></div>
          <div class="weather-desc">${l1}</div>
          <div class="weather-sub">${n(d.temperature_2m_min?.[1])}–${n(d.temperature_2m_max?.[1])}° · dážď ${pct(d.precipitation_probability_max?.[1])}</div>
        </div>
        <div class="weather-day">
          <div class="weather-label">Pozajtra</div>
          <div class="weather-main"><span class="weather-icon">${i2}</span><b>${n(d.temperature_2m_max?.[2])}°</b></div>
          <div class="weather-desc">${l2}</div>
          <div class="weather-sub">${n(d.temperature_2m_min?.[2])}–${n(d.temperature_2m_max?.[2])}° · dážď ${pct(d.precipitation_probability_max?.[2])}</div>
        </div>
      </div>
      <div class="weather-source"><a href="https://open-meteo.com/" target="_blank" rel="noopener">Open‑Meteo</a></div>`;
  }

  function renderHost(host,id,stale=false){
    if(!host)return;
    const w=weatherById.get(id);
    host.classList.remove('weather-loading');
    host.innerHTML=markup(w,stale);
  }

  function renderSelected(stale=false){
    if(!selectedTitle||!selectedWeather)return;
    const night=nights.find(x=>x.name===selectedTitle.textContent.trim());
    if(!night){selectedWeather.hidden=true;return}
    selectedWeather.hidden=false;
    renderHost(selectedWeather,night.id,stale);
  }

  function renderAll(stale=false){
    for(const [id,host] of inlineHosts)renderHost(host,id,stale);
    renderSelected(stale);
  }

  function loadCache(){
    try{
      const raw=localStorage.getItem(CACHE_KEY);if(!raw)return null;
      const c=JSON.parse(raw);if(!c?.savedAt||!c?.data)return null;
      for(const [id,w] of Object.entries(c.data))weatherById.set(id,w);
      return c;
    }catch{return null}
  }

  function saveCache(){
    try{localStorage.setItem(CACHE_KEY,JSON.stringify({savedAt:Date.now(),data:Object.fromEntries(weatherById)}))}catch{}
  }

  async function refreshWeather(){
    const lat=nights.map(x=>x.coords[1]).join(',');
    const lon=nights.map(x=>x.coords[0]).join(',');
    const params=new URLSearchParams({
      latitude:lat,
      longitude:lon,
      current:'temperature_2m,apparent_temperature,weather_code,wind_speed_10m',
      daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
      forecast_days:'3',
      timezone:'Europe/Athens'
    });
    const r=await fetch(`https://api.open-meteo.com/v1/forecast?${params}`,{cache:'no-store'});
    if(!r.ok)throw new Error(`Weather HTTP ${r.status}`);
    const json=await r.json();
    const rows=Array.isArray(json)?json:[json];
    nights.forEach((night,i)=>{if(rows[i])weatherById.set(night.id,rows[i])});
    saveCache();
    renderAll(false);
  }

  if(selectedTitle)new MutationObserver(()=>renderSelected(false)).observe(selectedTitle,{childList:true,characterData:true,subtree:true});

  const cached=loadCache();
  if(cached){
    const stale=Date.now()-cached.savedAt>MAX_AGE;
    renderAll(stale);
    if(!stale)return;
  }

  refreshWeather().catch(()=>{
    if(weatherById.size)renderAll(true);
    else{
      for(const host of inlineHosts.values()){host.classList.remove('weather-loading');host.innerHTML='<div class="weather-error">Počasie sa nepodarilo načítať.</div>'}
      selectedWeather.hidden=true;
    }
  });
})();
