var FtpDeploy = require('../ftp-deploy.js');
var ftpDeploy = new FtpDeploy();

var config = {
    username: "rickbergfalk",
    password: "", // optional, prompted if none given
    host: "localhost",
    port: 21,
    localRoot: __dirname + "/test-root",
    remoteRoot: "/Users/rickbergfalk/Public/",
    exclude: ['.git', '.idea', 'tmp/*']
};

ftpDeploy.on('uploaded', function (data) {
    console.log('uploaded:');
    console.log(data);
});

ftpDeploy.on('uploading', function (data) {
    console.log('uploading');
    console.log(data);
});
    
ftpDeploy.deploy(config, function(err) {
    if (err) console.log(err);
    else console.log('finished');
});