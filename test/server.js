// Quick start

// Using non-standard port
const port = 2121;
const homeDir =
    require("os").homedir() + "/code/nodejs/ftp-deploy/playground/remote";

const FtpSrv = require("ftp-srv");

const options = {
    greeting: ["test ftp server", homeDir],
    anonymous: true,
    pasv_url: "127.0.0.1",
    url: "ftp://127.0.0.1:" + port
};

const ftpServer = new FtpSrv(options);

ftpServer.on("login", (data, resolve, reject) => {
    console.log("[login] Connection by", data.username);
    console.log("[login] Setting home dir to:", homeDir);
    resolve({ root: homeDir });
});

ftpServer.on('client-error', ({ connection, context, error }) => {
    console.log("**client-error**");
    console.log(context);
    console.log(error);
});

ftpServer.on('error', (err) => {
    console.log("**error**");
    console.log(err);
});

ftpServer.on('uncaughtException', (err) => {
    console.log("**uncaughtException**");
    console.log(err);
})

ftpServer
    .listen()
    .then(() => {
        console.log(`Serving ${homeDir} on port: ${port}`);
    })
    .catch(err => {
        console.log("[error]", err);
    });
