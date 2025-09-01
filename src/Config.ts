import util     from 'node:util';
import path     from 'node:path';
import fs       from 'node:fs';
import crypto   from 'node:crypto';

import dayjs    from 'dayjs';

import dotenv   from 'dotenv';
import Customer from './Customer';

const saveStats = ( path:string ) => {
    try {
        return fs.statSync(path);
    }
    catch( err ) {
        return undefined;
    }
}

export default class Config {

    log_level       : number;
    base_url        : string;
    state_dir       : string;
    customers       : Customer[] = [];

    constructor( log_level?:number ) {
        dotenv.config();
        this.log_level      = log_level ?? 0;
        this.base_url       = process.env.NEWO_BASE_URL||'https://app.newo.ai';
        this.state_dir      = path.join(process.env.NEWO_STATE_DIR||process.cwd(),'.newo');
        if( !saveStats(this.state_dir)?.isDirectory() )
            fs.mkdirSync(this.state_dir);
        const tokens_dir = path.join(this.state_dir,'tokens');
        if( !saveStats(tokens_dir)?.isDirectory() )
            fs.mkdirSync(tokens_dir);
        this.customers      = (process.env.NEWO_API_KEYS||process.env.NEWO_API_KEY).split(',').map(k=>k.trim()).filter(k=>k.length>0).map( api_key => {
            // Storing tokens in files matching API key is a security concern, so we hash the key
            const token_file = crypto.createHash('sha256').update(api_key).digest('base64').replace(/\//g,'_') + '.json';
            return new Customer(api_key,path.join(tokens_dir,token_file));
        });
    }
    get nowstr() : string {
        return dayjs().format("YYYY-MM-DD HH:mm:ss");
    }
    log( level:number, ...args:any[] ) {
        if( this.log_level >= level ) {
            // tslint:disable:no-console
            console.log(level,`${this.nowstr}:${level}: ` + util.format(...args));
        }
    }
};
