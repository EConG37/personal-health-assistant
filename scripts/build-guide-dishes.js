// Curate real dish names and main ingredients from saved NHC recipe examples.
// Candidate extraction is evidence, never a source of generated dish names.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.join(__dirname,'..'),candidates=require('../docs/guide-dishes/extracted-candidates.json');
const sources={
 'gout-guide-2024':{title:'成人高尿酸血症与痛风食养指南（2024年版）',goal:'uric',url:'https://www.nhc.gov.cn/sps/c100088/202402/9ba512ba8e314a47a181db11d2fa188d.shtml',section:'附录3 食谱示例',scope:'无症状高尿酸血症期、痛风间歇期的食谱示例'},
 'hypertension-guide-2023':{title:'成人高血压食养指南（2023年版）',goal:'pressure',url:'https://www.nhc.gov.cn/cms-search/downFiles/63f752a17cfd4b4781f744477561866f.pdf',section:'附录3 不同地区食谱示例',scope:'成人高血压人群的地区食谱示例'},
 'glucose-guide-2023':{title:'成人糖尿病食养指南（2023年版）',goal:'glucose',url:'https://www.nhc.gov.cn/cms-search/downFiles/4fcbecd2c18e46baaf291bf46c2b79cd.pdf',section:'不同地区食谱示例',scope:'成人糖尿病人群的食谱示例'},
 'lipids-guide-2023':{title:'成人高脂血症食养指南（2023年版）',goal:'lipids',url:'https://www.nhc.gov.cn/cms-search/downFiles/252e7bd69d064fc5a00f02fbc64b5e23.pdf',section:'附录3 食谱示例',scope:'指南中的日常菜品示例；不用于自动判断中医证型'},
 'obesity-guide-2024':{title:'成人肥胖食养指南（2024年版）',goal:'weight',url:'https://www.nhc.gov.cn/sps/c100088/202402/9ba512ba8e314a47a181db11d2fa188d.shtml',section:'食谱示例',scope:'成人肥胖人群的地区食谱示例'}
};
const categories={
 protein:['西红柿炒鸡蛋','西葫芦炒鸡蛋','韭菜炒鸡蛋','黄瓜炒鸡蛋','青椒炒肉丝','芹菜炒肉丝','芹菜炒鸡丝','西兰花炒鸡胸肉','西兰花炒肉片','木耳炒鸡胸肉','西红柿炖牛肉','洋葱西红柿烩牛肉','胡萝卜炖牛肉','土豆炖牛肉','清蒸鲈鱼','水煮鸡胸肉','虾仁炒西葫芦','虾仁炒黄瓜','小葱拌豆腐','青椒豆干','芦笋豆腐干','香干莴笋','滑炒鸡片','豆干肉丝','鸡丝芦笋','鸡片炒油菜','蘑菇炒肉','尖椒炒肉','煮鸡蛋','荷包蛋'],
 veg:['凉拌黄瓜','凉拌菠菜','清炒西兰花','蒜蓉西兰花','西兰花炒胡萝卜','胡萝卜炒西兰花','香菇炒芹菜','洋葱炒木耳','香菇炒油菜','香菇炒菜心','清炒油菜','素炒小白菜','醋熘白菜','醋溜土豆丝','蒜泥茄子','凉拌蒜蓉茄子','素炒三丝','清炒芥兰','白灼芥兰','拌紫甘蓝','清炒苦瓜','蒜蓉娃娃菜','西兰花木耳','木耳炒菜花','白灼菜花','清炒空心菜','素炒西葫芦','芦笋炒香菇','西红柿炒西葫芦','凉拌藕片','豌豆胡萝卜','凉拌芹菜','凉拌芹菜丝','蒜蓉油麦菜','炝拌白菜','小炒素三鲜'],
 staple:['米饭','二米饭','糙米饭','燕麦米饭','玉米饭','紫薯饭','南瓜饭','蒸南瓜','蒸红薯','蒸山药','煮玉米','全麦面包','全麦面包片','玉米面馒头','燕麦馒头','紫薯馒头','馒头','双色花卷','蔬菜面','荞麦面条','山药鸡蛋面','鸡蛋饼','蔬菜饼','窝头'],
 dairy:['脱脂牛奶','低脂牛奶','无糖酸奶','无糖豆浆','豆浆','牛奶'],
 fruit:['苹果','梨','鸭梨','香蕉','樱桃','蓝莓','橙子','橘子','葡萄','西瓜','桃','桃子','猕猴桃']
};
const aliases={
 '鸡蛋':'egg','蛋白':'egg_white','牛奶':'milk_lowfat','酸奶':'yogurt_plain','豆浆':'soy_milk',
 '大米':'rice_white','粳米':'rice_white','糙米':'rice_mixed','黑米':'rice_mixed','紫米':'rice_mixed','小米':'congee_millet','玉米面':'corn','玉米':'corn','燕麦':'oats','紫薯':'sweet_potato','红薯':'sweet_potato','甘薯':'sweet_potato','土豆':'potato','山药':'yam','南瓜':'pumpkin',
 '面条':'noodle','荞麦面':'noodle','面粉':'noodle','全麦面包':'bread_whole','面包':'bread_whole',
 '豆腐干':'tofu_dry','豆干':'tofu_dry','香干':'tofu_dry','嫩豆腐':'tofu_soft','豆腐':'tofu',
 '鸡胸':'chicken_breast','鸡肉':'chicken_breast','鸡片':'chicken_breast','去皮鸡':'chicken_breast','猪瘦肉':'pork_lean','猪肉':'pork_lean','猪里脊':'pork_lean','牛瘦肉':'beef_lean','牛肉':'beef_lean','牛里脊':'beef_lean','鲈鱼':'fish_bass','虾':'shrimp',
 '西红柿':'tomato','番茄':'tomato','西兰花':'broccoli','菜花':'broccoli','胡萝卜':'carrot','黄瓜':'cucumber','西葫芦':'zucchini','芹菜':'celery','西芹':'celery','白菜':'cabbage','娃娃菜':'cabbage','菠菜':'spinach','洋葱':'onion','青椒':'pepper_green','柿子椒':'pepper_green','尖椒':'pepper_green','莴笋':'celtuce','茄子':'eggplant','莲藕':'lotus_root','藕':'lotus_root','芦笋':'asparagus','苦瓜':'zucchini','冬瓜':'winter_melon','油菜':'bok_choy','小白菜':'bok_choy','菜心':'bok_choy','空心菜':'bok_choy','芥兰':'bok_choy','油麦菜':'lettuce','生菜':'lettuce','紫甘蓝':'cabbage_round','木耳':'mushroom_fresh','香菇':'mushroom_fresh','蘑菇':'mushroom_fresh','金针菇':'mushroom_fresh','口蘑':'mushroom_fresh',
 '苹果':'apple','梨':'pear','香蕉':'banana','樱桃':'cherry','蓝莓':'blueberry','橙':'orange','橘':'orange','葡萄':'grape','西瓜':'watermelon','桃':'lychee','核桃':'walnut','杏仁':'almond','花生':'walnut'
};
// These aliases only connect the same ingredient to existing preference choices;
// they never substitute one vegetable/fruit for another in a recipe.
for(const k of ['苦瓜','花生','桃','菜花','空心菜','芥兰','木耳','金针菇','口蘑','面粉'])delete aliases[k];
const foodById=Object.fromEntries(require('../core/foods').FOODS.map(f=>[f.id,f]));
const blacklist=/黄芪|党参|当归|决明|葛根|菊苣|菊花|茯苓|酸枣仁|麦冬|桃仁|荷叶|桑叶|山楂|玫瑰|甘草|藿香|生地/;
const clean=s=>s.replace(/【[^】]*】|\[[^\]]*\]|\*/g,'').replace(/[0-9０-９.～~—\-]+\s*(?:mL|ml|g|克|毫升|个|只|片|张|条|枚|根|半)?/g,'').replace(/[（()）]/g,'').trim();
const normalize=s=>s.replace(/\s/g,'');
const dishes=[],unmatched=[];
for(const[kind,names]of Object.entries(categories))for(const name of names){
 const matches=candidates.filter(c=>c.name===name&&!blacklist.test(c.raw)&&!c.raw.includes('冰糖')&&!c.raw.includes('红糖')&&!c.raw.includes('白糖'));
 if(!matches.length){unmatched.push(name);continue;}
 const canonical=matches[0],ingredients=canonical.raw.split(/[，,、；;]/).map(clean).filter(s=>s&&!/^(适量|少许|毫升)$/.test(s));
 if(!ingredients.length)ingredients.push(name);
 const refs=matches.filter(c=>normalize(c.raw)===normalize(canonical.raw)).filter((c,i,a)=>a.findIndex(x=>x.pdf===c.pdf)===i).map(c=>({sourceId:c.pdf,page:c.page}));
 const related=matches.filter((c,i,a)=>a.findIndex(x=>x.pdf===c.pdf)===i).map(c=>c.pdf);
 const ids=new Set();
 for(const ingredient of ingredients){let found=false;for(const[term,id]of Object.entries(aliases).sort((a,b)=>b[0].length-a[0].length))if(ingredient.includes(term)&&foodById[id]){ids.add(id);found=true;break;}}
 const explicitCover={ '二米饭':'rice_mixed','玉米面馒头':'corn','燕麦馒头':'oats','紫薯馒头':'sweet_potato','馒头':'noodle','双色花卷':'noodle','蔬菜饼':'noodle','窝头':'corn','全麦面包片':'bread_whole','全麦面包':'bread_whole','无糖豆浆':'soy_milk','豆浆':'soy_milk'};
 const coverFoodId=explicitCover[name]||[...ids].find(id=>kind==='protein'?foodById[id].role==='protein':kind==='veg'?foodById[id].role==='veg':kind==='staple'?foodById[id].role==='staple':true)||[...ids][0];
 if(!coverFoodId){unmatched.push(name+'（缺少图片关联）');continue;}
 ids.add(coverFoodId);
 const text=ingredients.join(' '),allergens=[];
 if(/蛋/.test(text))allergens.push('egg');if(/奶|乳/.test(text))allergens.push('milk');if(/豆浆|豆腐|豆干|香干|黄豆|大豆|黑豆|腐竹/.test(text))allergens.push('soy');
 if(/面粉|面条|面包|小麦|全麦/.test(text)||/面|馒头|花卷|饼/.test(name)&&!/玉米/.test(name))allergens.push('wheat');
 if(/核桃|杏仁|花生|腰果/.test(text))allergens.push('nuts');if(/鲈鱼|鱼肉|草鱼|鲫鱼|带鱼/.test(text))allergens.push('fish');if(/虾|贝|蚝/.test(text))allergens.push('shellfish');
 const animal=/猪|牛肉|鸡肉|鸡胸|鸡腿|鸡片|羊肉|鸭肉|鱼|虾|蟹|贝|蚝|火腿/.test(text);
 const id='guide_'+crypto.createHash('sha256').update(name).digest('hex').slice(0,12);
 dishes.push({id,name:name==='西红柿炒鸡蛋'?'番茄炒蛋':name,sourceName:name,kind:animal&&kind==='veg'?'protein':kind,coverFoodId,ingredientIds:[...ids],ingredients,allergens,containsAnimalMeat:animal,slots:kind==='fruit'?['snack']:kind==='dairy'?['breakfast','snack']:kind==='staple'?['breakfast','lunch','dinner']:['煮鸡蛋','荷包蛋','小葱拌豆腐','青椒豆干','香干莴笋'].includes(name)?['breakfast','lunch','dinner']:['lunch','dinner'],method:/蒸|煮|白灼/.test(name)?'steam':/炒|煎/.test(name)?'stirfry':'mixed',sourceRefs:refs,relatedSources:related});
}
const sourceFiles=Object.keys(sources).map(id=>{
 const file=path.join(root,'docs/research-handoff/downloads',id+'.pdf');
 return {sourceId:id,file:'docs/research-handoff/downloads/'+id+'.pdf',sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};
});
const output={version:'nhc-dishes-v1',sources,dishes};
fs.mkdirSync(path.join(root,'core/data'),{recursive:true});fs.writeFileSync(path.join(root,'core/data/guide-dishes.json'),JSON.stringify(output,null,2)+'\n');
const evidence=dishes.map(d=>({id:d.id,name:d.name,sourceName:d.sourceName,canonical:candidates.find(c=>c.name===d.sourceName&&c.pdf===d.sourceRefs[0].sourceId&&c.page===d.sourceRefs[0].page)}));
fs.writeFileSync(path.join(root,'docs/guide-dishes/catalog-evidence.json'),JSON.stringify({evidence,unmatched},null,2)+'\n');
fs.writeFileSync(path.join(root,'docs/guide-dishes/source-files.json'),JSON.stringify({sourceFiles},null,2)+'\n');
console.log(JSON.stringify({dishes:dishes.length,byKind:Object.fromEntries(Object.keys(categories).map(k=>[k,dishes.filter(d=>d.kind===k).length])),unmatched}));
