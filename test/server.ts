import FtpSrv from "ftp-srv";

// Using non-standard port
const port = 2121;

const homeDir = __dirname + "/remote";
// console.log("serving", homeDir);

const options = {
    url: "ftp://127.0.0.1:" + port,
    anonymous: true,
    greeting: ["test ftp server", homeDir],
    pasv_url: "127.0.0.1",
};

const ftpServer = new FtpSrv(options);

ftpServer.on("login", (data, resolve, reject) => {
    console.log("[login] Connection by", data.username);
    console.log("[login] Setting home dir to:", homeDir);
    resolve({ root: homeDir });
});

ftpServer.on("client-error", ({ connection, context, error }) => {
    console.log("**client-error**");
    console.log(context);
    console.log(error);
});

ftpServer.on("disconnect", (err) => {
    console.log("**disconnect**");
    console.log(err);
});

ftpServer
    .listen()
    .then(() => {
        console.log(`Serving ${homeDir} on port: ${port}`);
    })
    .catch((err: Error) => {
        console.log("[error]", err);
    });
