module.exports = function(grunt){
    //load plugin here
    [
        'grunt-cafe-mocha',
        'grunt-contrib-jshint',
        'grunt-exec'
    ].forEach(function(task){
        grunt.loadNpmTasks(task);
    });
    
    //configure plugins
    grunt.initConfig({
        cafemocha:{all:{src:'qa/tests-stress.js',options:{ui:'tdd'},}},
        jshint:{
            app:['meadowlark.js','public/js/**/*.js','lib/**/*.js'],
            qa:['Gruntfile.js','public/qa/**/*.js','qa/**/*.js']
        },
        exec:{
            linkchecker:{cmd:'linkchecker http://localhost:9527'}
        },
    });
    //register tasks
    grunt.registerTask('default',['cafemocha','jshint','exec']);
};