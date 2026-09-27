import { levelForXp, rebuildProjection, assertSafeShopReward, achievementCandidates } from "./domain.js";
export function runSelfTests(){
  const results=[];
  const test=(name,fn)=>{try{fn();results.push([name,true]);}catch(error){results.push([name,false,error.message]);}};
  test("level formula",()=>{if(levelForXp(0)!==1||levelForXp(400)!==3)throw Error("unexpected level");});
  test("projection rewards",()=>{const p=rebuildProjection({events:[{id:"e",type:"quest_completed",questId:"q",gameDate:"2026-01-01"}],grants:[{eventId:"e",xp:20,gold:5,attributes:{INT:1}}],quests:[{id:"q",recurring:true}],achievements:[]});if(p.lifetimeXp!==20||p.gold!==5||p.attributes.INT!==1)throw Error("reward mismatch");});
  test("streak consecutive",()=>{const p=rebuildProjection({events:[{id:"a",type:"quest_completed",questId:"q",gameDate:"2026-01-01"},{id:"b",type:"quest_completed",questId:"q",gameDate:"2026-01-02"}],grants:[],quests:[{id:"q",recurring:true}],achievements:[]});if(p.streaks.q.best!==2)throw Error("streak mismatch");});
  test("negative stat is clamped",()=>{const p=rebuildProjection({events:[{id:"e",type:"daily_missed",questId:"q",gameDate:"2026-01-02"}],grants:[{eventId:"e",xp:0,gold:0,attributes:{DISCIPLINE:-3}}],quests:[{id:"q",recurring:true}],achievements:[]});if(p.attributes.DISCIPLINE!==0)throw Error("negative stat leaked");});
  test("good doctor candidates",()=>{const p=rebuildProjection({events:[{id:"e",type:"points",gameDate:"2026-01-01"}],grants:[{eventId:"e",xp:0,gold:0,attributes:{},goodDoctorPoints:50}],quests:[],achievements:[]});if(!achievementCandidates(p).some(a=>a.id==="good-doctor-50"))throw Error("good doctor tier missing");});
  test("great discipline candidates",()=>{const p=rebuildProjection({events:[{id:"e",type:"points",gameDate:"2026-01-01"}],grants:[{eventId:"e",xp:0,gold:0,attributes:{},greatDisciplinePoints:70}],quests:[],achievements:[]});if(!achievementCandidates(p).some(a=>a.id==="great-discipline-70"))throw Error("great discipline tier missing");});
  test("shop safety",()=>{let blocked=false;try{assertSafeShopReward("medication");}catch{blocked=true;}if(!blocked)throw Error("unsafe reward allowed");});
  return results;
}
