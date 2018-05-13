// works with the test server
const path = require("path");

const FtpDeploy = require("../src/ftp-deploy");

const config = {
    user: "anonymous",
    password: "anon", // Optional, prompted if none given
    host: "localhost",
    port: 2121,
    localRoot: path.join(__dirname, "../test/local"),
    remoteRoot: "/ftp",
    exclude: [],
    include: ["folderA/**/*", 'test-inside-root.txt']
};

const ftpDeploy = new FtpDeploy();

// use with promises
ftpDeploy.deploy(config)
    .then(res => console.log('finished'))
    .catch(err => console.log(err))

// ftpDeploy.on('uploading', data => console.log('uploading', data));
ftpDeploy.on('uploading', data => console.log('uploaded', data));
