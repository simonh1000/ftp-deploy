import PromiseFtp from "promise-ftp";

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

export type Ftp = PromiseFtp | PromiseFtp;
