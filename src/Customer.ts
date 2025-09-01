import fs       from 'fs-extra';
import * as axios from 'axios';

import Config   from './Config';
import Client   from './Client';
import {
    Project
}               from './Types';

export default class Customer {

    private api_key         : string;
    private tokens_path     : string;
    private access_token?   : string;
    private refresh_token?  : string;
    private refresh_url?    : string;

    public  client?         : Client;
    public  projects?       : Project[];
    public  profile?        : Record<string,any>;

    // private
    private async saveTokens( tokens:Record<string,any> ) {
        console.log(1,`Saving tokens to ${this.tokens_path}`);
        await fs.writeJson(this.tokens_path,tokens,{ spaces: 2 });
    }
    private async loadTokens() {
        if( await fs.pathExists(this.tokens_path) )
            return fs.readJson(this.tokens_path);
        if( this.access_token || this.refresh_token ) {
            const tokens = {
                access_token    : this.access_token || '',
                refresh_token   : this.refresh_token || '',
                expires_at      : Date.now() + 10 * 60 * 1000
            };
            await this.saveTokens(tokens);
            return tokens;
        }
        return null;
    }
    private isExpired( tokens:Record<string,any> ) {
        if( !tokens?.expires_at )
            return false;
        return Date.now() >= tokens.expires_at - 10_000;
    }
    private async exchangeApiKeyForToken( config:Config ) {
        const url       = `${config.base_url}/api/v1/auth/api-key/token`;
        const res       = await axios.default.post(url, {}, { headers: { 'x-api-key': this.api_key, 'accept': 'application/json' } });
        const data      = res.data || {};
        const access    = data.access_token || data.token || data.accessToken;
        const refresh   = data.refresh_token || data.refreshToken || '';
        const expiresInSec = data.expires_in || data.expiresIn || 3600;
        const tokens    = {
            access_token    : access,
            refresh_token   : refresh,
            expires_at      : Date.now() + expiresInSec * 1000
        };
        await this.saveTokens(tokens);
        return tokens;
    }
    private async getValidAccessToken( config:Config ) {
        try {
            let tokens = await this.loadTokens();
            if( !tokens || !tokens.access_token ) {
                tokens = await this.exchangeApiKeyForToken(config);
                return tokens.access_token;
            }
            if( !this.isExpired(tokens) )
                return tokens.access_token;
            if( this.refresh_url && tokens.refresh_token ) {
                tokens = await this.refreshWithEndpoint(config,tokens.refresh_token);
                return tokens.access_token;
            }
            tokens = await this.exchangeApiKeyForToken(config);
            return tokens.access_token;
        }
        catch(e:any) {
            throw Error(`Error obtaining access token: ${e.message}`);
        }
    }
    private async refreshWithEndpoint( config:Config, refreshToken: boolean ) {
        if( !this.refresh_token )
            throw new Error('NEWO_REFRESH_URL not set');
        const res = await axios.default.post(this.refresh_token, { refresh_token: refreshToken }, { headers: { 'accept': 'application/json' } });
        const data = res.data || {};
        const access = data.access_token || data.token || data.accessToken;
        const refresh = data.refresh_token ?? refreshToken;
        const expiresInSec = data.expires_in || 3600;
        const tokens = { access_token: access, refresh_token: refresh, expires_at: Date.now() + expiresInSec * 1000 };
        await this.saveTokens(tokens);
        return tokens;
    }
    private async forceReauth( config:Config ) {
        const tokens = await this.exchangeApiKeyForToken(config);
        return tokens.access_token;
    }
    // public
    constructor( api_key:string, tokens_path:string ) {
        if( !api_key )
            throw new Error('NEWO_API_KEY not set. Provide an API key in .env');
        this.api_key     = api_key;
        this.tokens_path = tokens_path;
    }
    async getClient( config:Config ) : Promise<Client> {
        if( this.client )
            return this.client;
        let accessToken = await this.getValidAccessToken(config);
        config.log(3,`✓ Access token obtained for key ending in ...${this.api_key.slice(-4)}`);
        const ai = axios.default.create({
            baseURL: config.base_url,
            headers: { accept: 'application/json' }
        });
        ai.interceptors.request.use(async( config_ ) => {
            // @ts-expect-error
            config_.headers = config.headers || {};
            config_.headers.Authorization = `Bearer ${accessToken}`;
            if (config.log_level>2 ) {
                config.log(2, `→ ${config_.method?.toUpperCase()} ${config_.url}`);
                if (config_.data)
                    config.log(2, '  Data:', JSON.stringify(config_.data, null, 2));
                if (config_.params)
                    config.log(1, '  Params:', config_.params);
            }
            return config_;
        });
        let retried = false;
        ai.interceptors.response.use(
            ( r ) => {
                if( config.log_level>2 ) {
                    config.log(1, `← ${r.status} ${r.config.method?.toUpperCase()} ${r.config.url}`);
                    if (r.data && Object.keys(r.data).length < 20) {
                        config.log(3, '  Response:', JSON.stringify(r.data, null, 2));
                    } else if (r.data) {
                        config.log(3, `  Response: [${typeof r.data}] ${Array.isArray(r.data) ? r.data.length + ' items' : 'large object'}`);
                    }
                }
                return r;
            },
            async (error) => {
                const status = error?.response?.status;
                if( config.log_level>2 ) {
                    config.log(1, `← ${status} ${error.config?.method?.toUpperCase()} ${error.config?.url} - ${error.message}`);
                    if (error.response?.data)
                        config.log(1, '  Error data:', error.response.data);
                }
                if( status === 401 && !retried ) {
                    retried = true;
                    config.log(2, '🔄 Retrying with fresh token...');
                    accessToken = await this.forceReauth(config);
                    error.config.headers.Authorization = `Bearer ${accessToken}`;
                    return ai.request(error.config);
                }
                throw error;
            }
        );
        return (this.client=new Client(ai));
    }
    // These 2 provide cached versions of projects and profile
    listProjects() {
        if( this.projects )
            return this.projects;
        if( !this.client )
            throw new Error('Client not initialized. Call getClient() first.');
        return this.client.listProjects().then( projects => {
            this.projects = projects;
            return projects;
        });
    }
    getCustomerProfile() {
        if( this.profile )
            return this.profile;
        if( !this.client )
            throw new Error('Client not initialized. Call getClient() first.');
        return this.client.getCustomerProfile().then( profile => {
            this.profile = profile;
            return profile;
        });
    }
}
