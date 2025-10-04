import util         from 'node:util';
import path         from 'node:path';
import crypto       from 'node:crypto';

import dayjs        from 'dayjs';
import dotenv       from 'dotenv';

import * as utils   from './utils';
import Customer     from './Customer';

export class Config {

    logLevel       : number;
    baseUrl        : string;
    projectsDir    : string;
    stateDir       : string;
    customers      : Customer[] = [];

    constructor() {
        dotenv.config();
        const log_level_env = process.env.LOG_LEVEL ? parseInt(process.env.LOG_LEVEL) : NaN;
        this.logLevel      = isNaN(log_level_env) ? 0 : log_level_env;
        this.baseUrl       = process.env.NEWO_BASE_URL||'https://app.newo.ai';
        this.projectsDir   = utils.enforceDirectory(process.env.NEWO_PROJECTS_DIR||path.join(process.cwd(),'projects'));
        this.stateDir      = utils.enforceDirectory(process.env.NEWO_STATE_DIR||path.join(process.cwd(),'.newo'));
        this.customers      = (process.env.NEWO_API_KEYS||process.env.NEWO_API_KEY).split(',').map(k=>k.trim()).filter(k=>k.length>0).map( api_key => {
            // Creating file/directory names matching API key is a security concern, so we hash the key
            const keyHash = crypto.createHash('sha256').update(api_key).digest('base64').replace(/\//g,'_');
            return new Customer(
                api_key,
                path.join(this.projectsDir,keyHash),
                path.join(this.stateDir,keyHash)
            );
        });
    }
    log( level:number, ...args:any[] ) {
        if( this.logLevel >= level ) {
            process.stderr.write(`${dayjs().format("YYYY-MM-DD HH:mm:ss")}: `+util.format(...args)+'\n');
        }
    }
};

export default new Config();