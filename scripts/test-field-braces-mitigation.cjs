const braces=require("../vendor/braces");
const safe=braces.parse("{a,b}",{maxDepth:100});
if(!safe||safe.type!=="root")throw new Error("baseline braces parse failed");
let rejected=false;
try{braces.parse("{".repeat(101)+"a"+"}".repeat(101),{maxDepth:100});}
catch(error){rejected=error instanceof SyntaxError&&/max depth/.test(error.message);}
if(!rejected)throw new Error("deep brace input was not rejected");
console.log("field braces mitigation test: PASS");
