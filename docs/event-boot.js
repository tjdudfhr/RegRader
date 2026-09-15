(function(){
  function expand(rows){
    return (rows||[]).map((r,i)=>({
      id:'ev_'+i,
      title:r.t,
      effectiveDate:r.d,
      amendmentType:r.a==='일'?'일부개정':(r.a==='타'?'타법개정':r.a),
      status:r.s===0?'현행':'시행예정',
      ministry:r.m||'',
      categories:r.c?[r.c]:[],
      source:{url:r.u?('https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq='+r.u):''},
      amendments:[{date:r.d,amendmentType:r.a==='일'?'일부개정':'타법개정'}]
    }));
  }
  async function boot(){
    try{
      const r=await fetch('./events_mini.json?v='+Date.now(),{cache:'no-store'});
      const items=expand(await r.json());
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
    }catch(e){console.warn('event-boot',e)}
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,600));
  else setTimeout(boot,600);
})();
