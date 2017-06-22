var fortune = require('../lib/fortune.js');
var expect = require('chai').expect;

suite('Fortune tests',function(){
    test('getFortune() shall return a fortune', function(){
        expect(typeof fortune.getFortune() === 'string');
    })
})