// Read-only review of fields missed by rationale-only checks.
const fs=require('node:fs'),path=require('node:path');
const dir=path.join(__dirname,'../docs/research-handoff'),out=path.join(dir,'acceptance-r4');fs.mkdirSync(out,{recursive:true});
const doc=JSON.parse(fs.readFileSync(path.join(dir,'health-ingredient-reference-r4.json'),'utf8'));
const strings=[];
function walk(v,p){if(typeof v==='string')strings.push({pointer:p,text:v});else if(Array.isArray(v))v.forEach((x,i)=>walk(x,p+'/'+i));else if(v&&typeof v==='object')for(const[k,x]of Object.entries(v))walk(x,p+'/'+k);}
walk(doc,'');
const inventory=strings.filter(r=>r.pointer.startsWith('/foods/')&&!r.pointer.includes('/metrics/')&&!r.pointer.includes('/evidence_refs/')&&/[0-9]/.test(r.text)&&/(?:kcal|mg|[0-9]g|ml|mL|%|克|毫升)/i.test(r.text));
const candidatePaths=[
 ['/foods/0/assessment_notes/0','液态奶已按100g保存，备注仍写100ml且差异约3%，与当前口径矛盾'],
 ['/foods/2/forms/0/notes','全脂希腊酸奶9～10g脂肪的跨食品数值没有对应来源，需移除或明确为未验证候选'],
 ['/foods/5/forms/0/notes','蛋白占全蛋58%的重量换算缺匹配来源，不能作为份量换算依据'],
 ['/foods/10/goal_assessments/lipids/conditions/0','燕麦每日30～50g干重未附对应单品份量依据'],
 ['/foods/10/goal_assessments/weight/preparation_notes/0','燕麦40g约147kcal与本条目379kcal/100g不符，应为151.6kcal或撤掉固定份量换算'],
 ['/foods/38/forms/0/notes','一张海苔2～3g依产品规格，未提供对应产品或称重来源'],
 ['/foods/78/forms/0/notes','啤酒500ml约215kcal仍在备注中，当前能量指标为空且无产品来源'],
 ['/foods/82/forms/0/notes','蜂蜜约80%为糖仍在备注中，评估理由虽已清掉同一旧值，备注未同步'],
 ['/foods/87/forms/0/notes','淀粉通常3～5g/菜仍是未核实的菜品份量，缺实际菜品配方'],
 ['/foods/64/goal_assessments/uric/conditions/0','核桃每日10～15g仍在条件中，仅嘌呤值与多样化原则不足以给出这份量'],
 ['/foods/65/goal_assessments/uric/conditions/0','杏仁每日10～15g仍在条件中，需补同目标用量依据或删除数字']
];
const noteFindings=candidatePaths.map(([pointer,issue])=>({pointer,issue,text:strings.find(r=>r.pointer===pointer)?.text}));
const energyStatusContradictions=[];
for(const[fi,f]of doc.foods.entries()){
 const a=f.goal_assessments.weight,energies=f.forms.flatMap(form=>form.metrics.filter(m=>m.name==='energy_kcal'&&m.value!==null).map(m=>({form_id:form.form_id,value:m.value,unit:m.unit})));
 if(energies.length&&/未核实.{0,8}能量值/.test(a.rationale))energyStatusContradictions.push({pointer:`/foods/${fi}/goal_assessments/weight/rationale`,food_id:f.food_id,text:a.rationale,metrics:energies});
}
const eggNo=doc.foods.find(f=>f.food_id==='new_egg_noodle'),eggNoIndex=doc.foods.indexOf(eggNo),eggForm=eggNo.forms[0];
const categoryFinding={pointer:`/foods/${eggNoIndex}/goal_assessments/weight/rationale`,food_id:eggNo.food_id,text:eggNo.goal_assessments.weight.rationale,classified_as_protein_source:eggNo.goal_assessments.weight.rationale.startsWith('蛋白质来源'),numeric_carbohydrate:eggForm.metrics.find(m=>m.name==='carbohydrate_g')?.value,numeric_protein:eggForm.metrics.find(m=>m.name==='protein_g')?.value,issue:'鸡蛋面在本轮默认模板中被PROT集合归为蛋白质来源；应按含蛋面条的主食类别管理，不能据此替代蛋白质份额'};
const noodleSnapshot=JSON.parse(fs.readFileSync(path.join(dir,'build/usda/noodle.json'),'utf8')).foods.find(f=>f.fdcId===169732);
categoryFinding.snapshot_food_category=noodleSnapshot.foodCategory;
categoryFinding.snapshot_description=noodleSnapshot.description;
const counts={numeric_free_text_strings:inventory.length,note_findings:noteFindings.length,energy_status_contradictions:energyStatusContradictions.length,egg_noodle_protein_classification:Number(categoryFinding.classified_as_protein_source)};
fs.writeFileSync(path.join(out,'notes-checks.json'),JSON.stringify({scope:'r4_read_only_notes_conditions_and_category_review',counts,note_findings:noteFindings,energy_status_contradictions:energyStatusContradictions,category_finding:categoryFinding,numeric_text_inventory:inventory},null,2)+'\n');
console.log(JSON.stringify({counts,energy_contradiction_food_ids:energyStatusContradictions.map(x=>x.food_id),category_finding:categoryFinding},null,2));
