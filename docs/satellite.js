(()=>{
  const D=window.TRIP_DATA;
  const svg=document.querySelector('#map-svg');
  const stage=document.querySelector('#map-stage');
  const wrap=document.querySelector('#map-wrap');
  if(!D||!svg||!stage||!wrap)return;

  const W=900,H=620,NS='http://www.w3.org/2000/svg';
  const decode=(s,p=6)=>{let i=0,lat=0,lon=0,out=[],f=10**p;while(i<s.length){let r=0,sh=0,b;do{b=s.charCodeAt(i++)-63;r|=(b&31)<<sh;sh+=5}while(b>=32);lat+=r&1?~(r>>1):r>>1;r=0;sh=0;do{b=s.charCodeAt(i++)-63;r|=(b&31)<<sh;sh+=5}while(b>=32);lon+=r&1?~(r>>1):r>>1;out.push([lon/f,lat/f])}return out};
  const points=[D.airport,...D.nights,...D.activities];
  const coords=[...decode(D.routePolyline),...points.map(p=>p.coords)];
  const xs=coords.map(c=>c[0]),ys=coords.map(c=>c[1]);
  const minX=Math.min(...xs)-.08,maxX=Math.max(...xs)+.08,minY=Math.min(...ys)-.08,maxY=Math.max(...ys)+.08;

  const inv=([x,y])=>[
    minX+((x-35)/830)*(maxX-minX),
    minY+((585-y)/550)*(maxY-minY)
  ];

  const routeHalo=document.querySelector('#route-halo');
  const makeImage=()=>{
    const image=document.createElementNS(NS,'image');
    image.classList.add('satellite-layer');
    image.setAttribute('preserveAspectRatio','none');
    image.setAttribute('aria-hidden','true');
    image.style.pointerEvents='none';
    stage.insertBefore(image,routeHalo||stage.firstChild);
    return image;
  };

  let activeImage=makeImage();
  activeImage.id='satellite-layer';
  let pendingImage=null;
  let activeUrl='';
  let requestSeq=0;

  const switcher=document.createElement('div');
  switcher.className='map-style-switch';
  switcher.setAttribute('aria-label','Podklad mapy');
  switcher.innerHTML='<button type="button" data-map-style="satellite">Satelit</button><button type="button" data-map-style="vector">Schéma</button>';
  wrap.append(switcher);

  const attribution=document.createElement('div');
  attribution.className='satellite-attribution';
  attribution.innerHTML='<a href="https://cloudless.eox.at/" target="_blank" rel="noopener">EOxCloudless</a> by EOX IT Services GmbH<br><span>Contains modified Copernicus Sentinel data 2025</span>';
  wrap.append(attribution);

  let style=localStorage.getItem('greckoMapStyle')||'satellite';
  let timer=0;

  const transform=()=>{
    const t=stage.getAttribute('transform')||'';
    const m=t.match(/translate\(([-\d.]+)[ ,]([-\d.]+)\)\s*scale\(([-\d.]+)\)/);
    return m?{x:+m[1],y:+m[2],s:+m[3]}:{x:0,y:0,s:1};
  };

  const buildUrl=(bbox,width,height)=>{
    const q=new URLSearchParams({
      FORMAT:'image/png',TRANSPARENT:'FALSE',VERSION:'1.1.1',SERVICE:'WMS',REQUEST:'GetMap',
      LAYERS:'s2cloudless-2025',STYLES:'',SRS:'EPSG:4326',WIDTH:String(width),HEIGHT:String(height),BBOX:bbox.join(',')
    });
    return 'https://tiles.maps.eox.at/?'+q.toString();
  };

  const discardPending=()=>{
    if(pendingImage){pendingImage.remove();pendingImage=null;}
  };

  function refresh(){
    clearTimeout(timer);
    if(style!=='satellite'||!navigator.onLine){
      requestSeq++;
      discardPending();
      activeImage.style.display='none';
      attribution.hidden=true;
      return;
    }

    const z=transform();
    let left=(0-z.x)/z.s,right=(W-z.x)/z.s,top=(0-z.y)/z.s,bottom=(H-z.y)/z.s;

    // Keep a generous overscan around the viewport. During a drag the current
    // raster stays fixed in map coordinates and moves with the route; a new
    // raster is requested only after the gesture settles.
    const padX=(right-left)*.55,padY=(bottom-top)*.55;
    left-=padX;right+=padX;top-=padY;bottom+=padY;

    const [lonLeft,latTop]=inv([left,top]);
    const [lonRight,latBottom]=inv([right,bottom]);
    const bbox=[lonLeft,latBottom,lonRight,latTop].map(v=>+v.toFixed(7));
    const reqW=1400;
    const reqH=Math.max(560,Math.min(1400,Math.round(reqW*(bottom-top)/(right-left))));
    const url=buildUrl(bbox,reqW,reqH);

    activeImage.style.display='block';
    attribution.hidden=false;
    if(url===activeUrl)return;

    const seq=++requestSeq;
    discardPending();
    const next=makeImage();
    pendingImage=next;
    next.setAttribute('x',left);
    next.setAttribute('y',top);
    next.setAttribute('width',right-left);
    next.setAttribute('height',bottom-top);

    next.addEventListener('load',()=>{
      if(seq!==requestSeq||style!=='satellite'||!navigator.onLine){
        next.remove();
        if(pendingImage===next)pendingImage=null;
        return;
      }
      const previous=activeImage;
      next.classList.add('loaded');
      next.id='satellite-layer-next';
      activeImage=next;
      pendingImage=null;
      activeUrl=url;
      setTimeout(()=>{
        if(previous&&previous!==activeImage)previous.remove();
        activeImage.id='satellite-layer';
      },240);
    },{once:true});

    next.addEventListener('error',()=>{
      if(pendingImage===next)pendingImage=null;
      next.remove();
      if(!activeUrl){activeImage.style.display='none';attribution.hidden=true;}
    },{once:true});

    next.setAttribute('href',url);
  }

  function schedule(){clearTimeout(timer);timer=setTimeout(refresh,220)}

  function applyStyle(next,announce=true){
    style=next;
    localStorage.setItem('greckoMapStyle',style);
    switcher.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.mapStyle===style));
    refresh();
    if(announce&&style==='satellite'&&!navigator.onLine){
      const toast=document.querySelector('#toast');
      if(toast){toast.textContent='Satelit potrebuje internet · zobrazujem offline schému';toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2200)}
    }
  }

  switcher.addEventListener('click',e=>{
    const b=e.target.closest('button[data-map-style]');
    if(b)applyStyle(b.dataset.mapStyle);
  });

  new MutationObserver(schedule).observe(stage,{attributes:true,attributeFilter:['transform']});
  addEventListener('online',()=>refresh());
  addEventListener('offline',()=>refresh());

  applyStyle(style,false);
})();
