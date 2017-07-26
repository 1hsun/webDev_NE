var assert = require('chai').assert;
var http = require('http');
var rest = require('restler');

suite('API tests',function(){//test suite
  var attraction = {
    lat:45.516011,
    lng: -122.682062,
    name: 'Portland Art Museum',
    description: 'Founded in 1892, the Portland Art Museum\'s colleciton of native art is not to be missed. If modern art is more to your liking, there are six stories of modern art for your enjoyment.',
    email: 'test@meadowlark.com',
  };
  
  var base = 'http://port-9527.testcon-chenesing10629.codeanyapp.com';
  
  test('apiTest01,attraction adding',function(done){
    rest.post(base+'/api/attraction',{data:attraction}).on('success',function(data){
      //condition of success event
      assert.match(data.id,/\w/,'id was set.');
      done();
    });
  });
  
  test('apiTest02, should be able to add an attraction', function(done){
    rest.post(base+'/api/attraction',{ data:attraction }).on('success',function(data){
      rest.get(base+'/api/attraction/'+data.id).on('success',function(data){
        assert(data.name === attraction.name);
        assert(data.description === attraction.description);
        done();
      })
    })
  });
});