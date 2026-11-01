// Validate the research contract using in-memory examples, never personal data.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Ajv=require('ajv');
const root=path.join(__dirname,'../docs/research-handoff');
const schema=JSON.parse(fs.readFileSync(path.join(root,'health-ingredient-reference.schema.json'),'utf8'));
const baseline=JSON.parse(fs.readFileSync(path.join(root,'health-food-baseline.json'),'utf8'));
const goals=baseline.goals.map(g=>g.id),ajv=new Ajv({strict:false,allErrors:true});
ajv.addFormat('uri',{type:'string',validate:value=>{try{return /^https?:$/.test(new URL(value).protocol);}catch{return false;}}});
const validate=ajv.compile(schema);
const summary={coverage:'not_found',population:'格式检查示例',key_questions:[],findings:'示例，无研究结论。',limitations:[],evidence_refs:[]};
const assessment={assessment:'insufficient_evidence',form_ids:[],population:'格式检查示例',rationale:'示例，无研究结论。',conditions:[],portion_guidance:null,preparation_notes:[],principle_ids:[],evidence_refs:[]};
const document={schema_version:'2.0.0',meta:{title:'仅用于检查格式',research_stage:'ingredients',research_date:'2026-10-31',goal_scope:goals,coverage:'partial',status:'research_reference_only',review_status:'not_clinically_reviewed'},sources:[],goal_summaries:Object.fromEntries(goals.map(id=>[id,structuredClone(summary)])),principles:[],foods:[{food_id:'tomato',name_zh:'番茄',coverage:'not_found',forms:[],goal_assessments:Object.fromEntries(goals.map(id=>[id,structuredClone(assessment)])),allergens:[],allergen_notes:'示例，尚未核查。',assessment_notes:[],evidence_refs:[]}],rule_audits:[],gaps:[]};
assert(validate(document),JSON.stringify(validate.errors));
for(const id of goals){
 const missingSummary=structuredClone(document);delete missingSummary.goal_summaries[id];assert(!validate(missingSummary),'Must reject a missing goal summary: '+id);
 const missingAssessment=structuredClone(document);delete missingAssessment.foods[0].goal_assessments[id];assert(!validate(missingAssessment),'Must reject a missing ingredient assessment: '+id);
}
const onlyUric=structuredClone(document);onlyUric.meta.goal_scope=['uric'];assert(!validate(onlyUric));
const wrongStage=structuredClone(document);wrongStage.recipes=[];assert(!validate(wrongStage),'Stage one must not silently mix in recipes');
assert.equal(new Set(baseline.foods.map(f=>f.id)).size,85);assert.equal(baseline.rules_to_audit.length,17);
assert.equal(baseline.contains_personal_records,false);assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'health-diet-reference.schema.json'),'utf8')),schema);
console.log('Research handoff PASS: 7 goals required globally and per ingredient; missing goals, single-goal scope and premature recipes rejected; 85 foods/17 rules, no personal records.');
