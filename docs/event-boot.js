(function(){
  async function boot(){
    try{
      const files=[]; for(let i=0;i<8;i++) files.push('./e'+i+'.json');
      const chunks=await Promise.all(files.map(f=>fetch(f+'?v='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(f);return r.json()})));
      const items=chunks.flat();
      window.lawsData=items; try{lawsData=items}catch(e){}
      if(!document.getElementById('event-model-banner')){
        const el=document.createElement('div'); el.id='event-model-banner';
        el.style.cssText='position:sticky;top:0;z-index:9999;background:#12324f;color:#fff;padding:10px 14px;font:14px/1.4 -apple-system,sans-serif';
        const past=items.filter(x=>x.status==='현행').length;
        el.innerHTML='<b>이벤트 모델</b> 개정 '+items.length+'건 · 시행완료 '+past+' · 시행예정 '+(items.length-past)+' · <a href="./watch.html" style="color:#9fd1ff">Watch</a>';
        document.body.insertBefore(el,document.body.firstChild);
      }
      try{if(typeof displayLawList==='function')displayLawList(items)}catch(e){}
      try{if(typeof updateQuarterlyCounts==='function')updateQuarterlyCounts()}catch(e){}
    }catch(e){console.warn(e)}
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,600));
  else setTimeout(boot,600);
})();
