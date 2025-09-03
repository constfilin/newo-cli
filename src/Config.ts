import util     from 'node:util';
import path     from 'node:path';
import fs       from 'node:fs';
import crypto   from 'node:crypto';

import dayjs    from 'dayjs';

import dotenv   from 'dotenv';
import Customer from './Customer';

export class Config {

    log_level       : number;
    base_url        : string;
    projects_dir    : string;
    state_dir       : string;
    customers       : Customer[] = [];

    constructor() {
        dotenv.config();
        const log_level_env = process.env.LOG_LEVEL ? parseInt(process.env.LOG_LEVEL) : NaN;
        this.log_level      = isNaN(log_level_env) ? 0 : log_level_env;
        this.base_url       = process.env.NEWO_BASE_URL||'https://app.newo.ai';
        this.projects_dir   = process.env.NEWO_PROJECTS_DIR||path.join(process.cwd(),'projects');
        if( !this.getStats(this.projects_dir)?.isDirectory() )
            fs.mkdirSync(this.projects_dir);
        this.state_dir      = path.join(process.env.NEWO_STATE_DIR||process.cwd(),'.newo');
        if( !this.getStats(this.state_dir)?.isDirectory() )
            fs.mkdirSync(this.state_dir);
        const tokens_dir = path.join(this.state_dir,'tokens');
        if( !this.getStats(tokens_dir)?.isDirectory() )
            fs.mkdirSync(tokens_dir);
        this.customers      = (process.env.NEWO_API_KEYS||process.env.NEWO_API_KEY).split(',').map(k=>k.trim()).filter(k=>k.length>0).map( api_key => {
            // Creating file/directory names matching API key is a security concern, so we hash the key
            const key_hash = crypto.createHash('sha256').update(api_key).digest('base64').replace(/\//g,'_');
            return new Customer(
                api_key,
                path.join(this.projects_dir,key_hash),
                path.join(tokens_dir,`${key_hash}.json`)
            );
        });
    }
    getStats( path:string ) {
        // Doesn't really have to me a method of this class, but whatever
        try {
            return fs.statSync(path);
        }
        catch( err ) {
            return undefined;
        }
    }
    log( level:number, ...args:any[] ) {
        if( this.log_level >= level ) {
            // tslint:disable:no-console
            console.log(level,`${dayjs().format("YYYY-MM-DD HH:mm:ss")}:${level}: ` + util.format(...args));
        }
    }
};

export default new Config();