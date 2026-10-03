import assert from 'node:assert/strict'
const courseCount=24,exposureInches=7.25,widthFt=32,wastePercent=10
const openings=[{id:'door',widthFt:3,heightFt:7,include:true},{id:'window',widthFt:4,heightFt:5,include:true}]
const height=courseCount*exposureInches/12
const gross=height*widthFt
const deduction=openings.reduce((s,o)=>s+o.widthFt*o.heightFt,0)
const net=gross-deduction
const order=net*(1+wastePercent/100)
assert.equal(height,14.5);assert.equal(gross,464);assert.equal(deduction,41);assert.equal(net,423);assert.equal(order,465.3)
console.log('siding measurement regression: PASS')
