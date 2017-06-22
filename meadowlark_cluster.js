var cluster = require('cluster');

function startWorker() {
    var worker = cluster.fork();
    console.log('Worker %d started.', worker.id);
}

if(cluster.isMaster){
    require('os').cpus().forEach(function(){
        startWorker();
    });
    cluster.on('disconnect',function(worker){
        console.log('Cluster: Worker %d disconnected from the cluster.', worker.id);
    });//to log workers disconnected

    cluster.on('exit', function(worker,code,signal){
        console.log('Cluster: Worker %d died with exit code %d (%s)', worker.id, code,signal);
        startWorker();
    });
}else{    
    require('./meadowlark.js')();//imported as a function.
}