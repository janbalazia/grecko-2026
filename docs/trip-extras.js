(()=>{
  const D=window.TRIP_DATA;
  if(!D?.activities)return;

  const activity=D.activities.find(p=>p.id==='activity-damouchari');
  if(!activity)return;

  const booking={
    url:'https://maps.app.goo.gl/RHVbf7sgbC8xrnyb9?g_st=ic',
    label:'Kontaktovať požičovňu',
    note:'Požičovňu kajakov pre tento výlet treba kontaktovať vopred a potvrdiť dostupnosť a čas štartu.'
  };
  activity.booking=booking;
  if(!activity.text.includes(booking.note)) activity.text=`${activity.text} ${booking.note}`;

  const item=document.querySelector(`.item[data-id="${activity.id}"]`);
  if(item){
    const p=item.querySelector('p');
    if(p)p.textContent=activity.text;
    if(!item.querySelector('.kayak-booking-link')){
      const link=document.createElement('a');
      link.className='kayak-booking-link';
      link.href=booking.url;
      link.target='_blank';
      link.rel='noopener';
      link.textContent='🛶 Kontaktovať požičovňu ↗';
      link.addEventListener('click',e=>e.stopPropagation());
      const maps=item.querySelector('a');
      item.insertBefore(link,maps||null);
    }
  }

  const title=document.querySelector('#selected-title');
  const text=document.querySelector('#selected-text');
  const actions=document.querySelector('.selected-copy .actions');
  let action=null;
  if(actions){
    action=document.createElement('a');
    action.className='action kayak-booking-action';
    action.href=booking.url;
    action.target='_blank';
    action.rel='noopener';
    action.textContent='🛶 Kontaktovať požičovňu';
    action.hidden=true;
    actions.insertBefore(action,actions.firstChild);
  }

  function syncSelected(){
    const active=title?.textContent.trim()===activity.name;
    if(action)action.hidden=!active;
    if(active&&text)text.textContent=activity.text;
  }

  if(title)new MutationObserver(syncSelected).observe(title,{childList:true,characterData:true,subtree:true});
  syncSelected();
})();
