var db=require('/root/networking-qa-workflow/backend/src/database');
var count=db.prepare("SELECT count(*) as cnt FROM tcl_scripts").get();
console.log('Total tcl_scripts:', count.cnt);
var r=db.prepare("SELECT DISTINCT workflow_id FROM tcl_scripts LIMIT 5").all();
console.log('Workflow IDs:', r.map(function(x){return x.workflow_id;}));
var scripts=db.prepare("SELECT filename, length(content) as len FROM tcl_scripts ORDER BY filename").all();
scripts.forEach(function(x){ console.log(x.len + '\t' + x.filename); });
