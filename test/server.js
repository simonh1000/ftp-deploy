// Quick start

const homeDir =
    require("os").homedir() + "/code/sync/nodejs/ftp-deploy/test/remote/";

const FtpSrv = require("ftp-srv");

const options = {
    greeting: ["greeting from test ftp server"]
};

// Using non-standard port
const ftpServer = new FtpSrv("ftp://127.0.0.1:2121", options);

ftpServer.on("login", ({ connection, username, password }, resolve, reject) => {
    console.log("Connection by", username);
    console.log("setting home dir to :", homeDir);
    resolve({ root: homeDir });
});

ftpServer
    .listen()
    .then(() => {
        console.log("listening");
    })
    .catch(err => {
        console.log(err);
    });
