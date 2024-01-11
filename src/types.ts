import PromiseFtp from "promise-ftp";
import PromiseSftp from "ssh2-sftp-client";
export interface FtpDeployConfig {
    remoteRoot: string;
    localRoot: string;
    sftp?: boolean;
    host: string;
    include: string[];
    exclude: string[];
    deleteRemote?: boolean;
    password?: string;
    user: string;
}

export type FileMap = Record<string, string[]>;

export type Ftp = PromiseFtp | PromiseSftp;
