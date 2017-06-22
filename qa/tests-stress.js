var loadtest = require('loadtest'),
    expect = require('chai').expect;
suite('Stress tests', function(){
    test('100 requests in a second Test', function(done){
        var options = {
            url:'http://port-9527.nodecon-chenesing10629.codeanyapp.com/',
            concurrency:4,
            maxRequests:100
        };
        loadtest.loadTest(options,function(err,result){
            expect(!err);
            expect(result.totalTimeSeconds < 1);
            done();
        });
    });
}) ;